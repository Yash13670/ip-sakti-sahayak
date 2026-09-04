/**
 * UI Translation Service — Final robust version
 * Translations load synchronously from cache, async from API.
 * UI always shows correct language immediately from cache.
 */

const CACHE_PREFIX = 'ipsakti_ui_trans_';
const LANG_KEY = 'ipsakti_language';

// ─── Cache ────────────────────────────────────────────────────────────────

function getCacheKey(lang: string): string {
  return `${CACHE_PREFIX}${lang}`;
}

function loadCache(lang: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(getCacheKey(lang));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(lang: string, cache: Record<string, string>): void {
  try {
    localStorage.setItem(getCacheKey(lang), JSON.stringify(cache));
  } catch { /* quota exceeded */ }
}

// ─── Language Persistence ─────────────────────────────────────────────────

export function getSavedLanguage(): string {
  try {
    return localStorage.getItem(LANG_KEY) || 'en';
  } catch {
    return 'en';
  }
}

export function saveLanguage(lang: string): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch { /* ignore */ }
}

// ─── Sarvam Translation ───────────────────────────────────────────────────

async function callSarvamTranslate(text: string, targetLang: string): Promise<string> {
  const res = await fetch('/api/sarvam/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      sourceLanguage: 'en',
      targetLanguage: targetLang,
    }),
  });

  if (!res.ok) throw new Error(`Translation API error: ${res.status}`);
  const data = await res.json();
  return data.translatedText || text;
}

async function translateStrings(
  strings: string[],
  targetLang: string
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const BATCH = 5;

  for (let i = 0; i < strings.length; i += BATCH) {
    const batch = strings.slice(i, i + BATCH);
    const promises = batch.map(async (str) => {
      try {
        results[str] = await callSarvamTranslate(str, targetLang);
      } catch (err) {
        // IMPORTANT: do NOT cache the fallback as if it were a real translation.
        // Leaving it out of `results` keeps it "missing" so it gets retried
        // on the next load instead of being permanently stuck in English.
        console.error(`[UI Translation] Failed to translate "${str}" to ${targetLang}:`, err);
      }
    });
    await Promise.all(promises);
    if (i + BATCH < strings.length) {
      await new Promise(r => setTimeout(r, 150));
    }
  }
  return results;
}

// ─── Translation State ────────────────────────────────────────────────────

let currentLang = 'en';
let currentTranslations: Record<string, string> = {};
let loadingPromise: Promise<void> | null = null;
// Version counter — increments when translations update
let translationVersion = 0;

/**
 * Get current translation version. Components use this to detect changes.
 */
export function getTranslationVersion(): number {
  return translationVersion;
}

// ─── Public API ───────────────────────────────────────────────────────────

export function getCurrentTranslations(): Record<string, string> {
  return currentTranslations;
}

export function getCurrentLanguage(): string {
  return currentLang;
}

/**
 * Synchronously load cached translations for a language.
 * Returns the cache immediately — no API call.
 */
export function loadCachedTranslations(lang: string): Record<string, string> {
  if (lang === 'en') return {};
  const cache = loadCache(lang);
  currentLang = lang;
  currentTranslations = { ...cache };
  return cache;
}

/**
 * Load translations. First loads from cache (sync), then fetches missing from API.
 */
export async function loadTranslations(
  lang: string,
  strings: string[]
): Promise<void> {
  if (lang === 'en') {
    if (currentLang !== 'en') {
      currentLang = 'en';
      currentTranslations = {};
      translationVersion++;
    }
    return;
  }

  currentLang = lang;

  // Load from cache synchronously
  const cache = loadCache(lang);
  currentTranslations = { ...cache };

  // Find missing
  const missing = strings.filter(s => !cache[s] && s.trim().length > 0);

  if (missing.length === 0) {
    translationVersion++;
    return;
  }

  loadingPromise = (async () => {
    try {
      const translated = await translateStrings(missing, lang);
      const updatedCache = { ...currentTranslations, ...translated };
      currentTranslations = updatedCache;
      saveCache(lang, updatedCache);
      translationVersion++;
    } catch (err) {
      console.error('[UI Translation] Failed:', err);
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Get a translated string.
 */
export function t(key: string): string {
  if (currentLang === 'en') return key;
  return currentTranslations[key] || key;
}

export function translationsReady(): boolean {
  return currentLang === 'en' || Object.keys(currentTranslations).length > 0;
}
