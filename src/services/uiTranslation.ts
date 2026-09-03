/**
 * UI Translation Service
 * Uses Sarvam AI translation API to translate UI strings.
 * Caches translations in localStorage to avoid repeated API calls.
 * Sends individual strings to avoid batch separator merging issues.
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
  } catch { /* quota exceeded, ignore */ }
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

// ─── Global Translation Change Event ──────────────────────────────────────

const TRANSLATION_EVENT = 'ipsakti-translations-updated';

export function onTranslationsChanged(callback: () => void): () => void {
  window.addEventListener(TRANSLATION_EVENT, callback);
  return () => window.removeEventListener(TRANSLATION_EVENT, callback);
}

function emitTranslationsChanged(): void {
  window.dispatchEvent(new CustomEvent(TRANSLATION_EVENT));
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

  if (!res.ok) {
    throw new Error(`Translation API error: ${res.status}`);
  }

  const data = await res.json();
  return data.translatedText || text;
}

/**
 * Translate strings individually to avoid batch separator merging issues.
 * Uses concurrent requests with a small delay to avoid rate limits.
 */
async function translateStrings(
  strings: string[],
  targetLang: string
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  // Translate in small concurrent batches of 5
  const BATCH_SIZE = 5;
  for (let i = 0; i < strings.length; i += BATCH_SIZE) {
    const batch = strings.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (str) => {
      try {
        const translated = await callSarvamTranslate(str, targetLang);
        results[str] = translated;
      } catch {
        results[str] = str; // Fallback to original
      }
    });
    await Promise.all(promises);
    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < strings.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────

let currentLang = 'en';
let currentTranslations: Record<string, string> = {};
let translationPromise: Promise<void> | null = null;

export function getCurrentTranslations(): Record<string, string> {
  return currentTranslations;
}

export function getCurrentLanguage(): string {
  return currentLang;
}

/**
 * Load translations for a language.
 * English returns empty map (no translation needed).
 * Other languages load from cache first, then translate any missing strings.
 */
export async function loadTranslations(
  lang: string,
  strings: string[]
): Promise<void> {
  if (lang === 'en') {
    currentLang = lang;
    currentTranslations = {};
    emitTranslationsChanged();
    return;
  }

  currentLang = lang;

  // Load from cache
  const cache = loadCache(lang);
  currentTranslations = { ...cache };

  // Find strings not yet translated
  const missing = strings.filter(s => !cache[s] && s.trim().length > 0);

  console.log(`[UI Translation] lang=${lang}, cached=${Object.keys(cache).length}, missing=${missing.length}, total=${strings.length}`);

  if (missing.length === 0) {
    emitTranslationsChanged();
    return;
  }

  // Translate missing strings individually
  if (translationPromise) return translationPromise;

  translationPromise = (async () => {
    try {
      const translated = await translateStrings(missing, lang);
      // Update cache
      const updatedCache = { ...currentTranslations, ...translated };
      currentTranslations = updatedCache;
      saveCache(lang, updatedCache);
      emitTranslationsChanged();
    } catch (err) {
      console.error('[UI Translation] Translate failed:', err);
    } finally {
      translationPromise = null;
    }
  })();

  return translationPromise;
}

/**
 * Get a translated string. Returns original if no translation available.
 */
export function t(key: string): string {
  if (currentLang === 'en') return key;
  return currentTranslations[key] || key;
}

/**
 * Check if translations are loaded for a language.
 */
export function translationsReady(): boolean {
  return currentLang === 'en' || Object.keys(currentTranslations).length > 0;
}
