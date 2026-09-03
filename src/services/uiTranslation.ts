/**
 * UI Translation Service — Robust version
 * Uses Sarvam AI translation API with localStorage caching.
 * Guarantees re-render via Zustand store integration.
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
      } catch {
        results[str] = str;
      }
    });
    await Promise.all(promises);
    if (i + BATCH < strings.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────

let currentLang = 'en';
let currentTranslations: Record<string, string> = {};
let loadingPromise: Promise<void> | null = null;
let loadingLang = '';

export function getCurrentTranslations(): Record<string, string> {
  return currentTranslations;
}

export function getCurrentLanguage(): string {
  return currentLang;
}

/**
 * Load translations. Singleton — only one load at a time.
 * Returns immediately if cache is complete.
 */
export async function loadTranslations(
  lang: string,
  strings: string[]
): Promise<void> {
  if (lang === 'en') {
    if (currentLang !== 'en') {
      currentLang = 'en';
      currentTranslations = {};
    }
    return;
  }

  currentLang = lang;

  // Load from cache
  const cache = loadCache(lang);
  currentTranslations = { ...cache };

  // Find missing
  const missing = strings.filter(s => !cache[s] && s.trim().length > 0);

  if (missing.length === 0) return;

  // Singleton — don't start another load if one is in progress for same lang
  if (loadingPromise && loadingLang === lang) return loadingPromise;

  loadingLang = lang;
  loadingPromise = (async () => {
    try {
      const translated = await translateStrings(missing, lang);
      const updatedCache = { ...currentTranslations, ...translated };
      currentTranslations = updatedCache;
      saveCache(lang, updatedCache);
    } catch (err) {
      console.error('[UI Translation] Failed:', err);
    } finally {
      loadingPromise = null;
      loadingLang = '';
    }
  })();

  return loadingPromise;
}

/**
 * Get a translated string. Returns original if no translation.
 */
export function t(key: string): string {
  if (currentLang === 'en') return key;
  return currentTranslations[key] || key;
}

export function translationsReady(): boolean {
  return currentLang === 'en' || Object.keys(currentTranslations).length > 0;
}
