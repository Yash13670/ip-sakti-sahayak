/**
 * UI Translation Service — Shared Store Version
 * Single source of truth for all translations.
 * All components read from the same translations map.
 * When language changes, ALL translations update atomically.
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

// ─── Bhashini Translation ──────────────────────────────────────────────────

async function callBhashiniTranslate(text: string, targetLang: string): Promise<string> {
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
    const errData = await res.json().catch(() => ({}));
    // Surface specific error types so callers can handle them
    const errorMsg = errData.error || `Translation API error: ${res.status}`;
    throw new Error(errorMsg);
  }
  const data = await res.json();
  return data.translatedText || text;
}

let translationQuotaExhausted = false;

export function isTranslationQuotaExhausted(): boolean {
  return translationQuotaExhausted;
}

async function translateStrings(
  strings: string[],
  targetLang: string
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const BATCH = 5;

  // If we already know quota is exhausted, don't bother retrying
  if (translationQuotaExhausted) {
    for (const str of strings) results[str] = str;
    return results;
  }

  for (let i = 0; i < strings.length; i += BATCH) {
    const batch = strings.slice(i, i + BATCH);
    const promises = batch.map(async (str) => {
      try {
        results[str] = await callBhashiniTranslate(str, targetLang);
      } catch (err: any) {
        // IMPORTANT: do NOT cache the fallback as if it were a real translation.
        // Leaving it out of `results` keeps it "missing" so it gets retried
        // on the next load instead of being permanently stuck in English.
        console.error(`[UI Translation] Failed to translate "${str}" to ${targetLang}:`, err);
        // Detect quota/API exhaustion
        if (err?.message?.includes('quota') || err?.message?.includes('402') || err?.message?.includes('503')) {
          translationQuotaExhausted = true;
          console.warn('[Translation] Bhashini API unavailable — translations paused');
        }
      }
    });
    await Promise.all(promises);
    // Stop early if quota is exhausted
    if (translationQuotaExhausted) break;
    if (i + BATCH < strings.length) {
      await new Promise(r => setTimeout(r, 150));
    }
  }
  return results;
}

// ─── Shared Translation State ─────────────────────────────────────────────

let currentLang = 'en';
// ALL translations merged into one map — shared by all components
let allTranslations: Record<string, string> = {};
let version = 0;


export function getTranslationVersion(): number {
  return version;
}

export function getCurrentLanguage(): string {
  return currentLang;
}

/**
 * Register strings from a component.
 * Loads from cache immediately, then fetches missing from API.
 * All results merge into the shared allTranslations map.
 */
export async function registerStrings(
  lang: string,
  strings: string[]
): Promise<void> {
  if (lang === 'en') return;

  currentLang = lang;

  // 1. Load from cache synchronously
  const cache = loadCache(lang);
  let changed = false;
  for (const [key, val] of Object.entries(cache)) {
    if (!allTranslations[key] || allTranslations[key] !== val) {
      allTranslations[key] = val;
      changed = true;
    }
  }
  if (changed) version++;

  // 2. Find missing strings
  const missing = strings.filter(s => !allTranslations[s] && s.trim().length > 0);
  if (missing.length === 0) return;

  // 3. Fetch from API
  try {
    const translated = await translateStrings(missing, lang);
    let updated = false;
    for (const [key, val] of Object.entries(translated)) {
      if (allTranslations[key] !== val) {
        allTranslations[key] = val;
        updated = true;
      }
    }
    if (updated) {
      // Save merged cache
      const mergedCache: Record<string, string> = {};
      for (const [k, v] of Object.entries(allTranslations)) {
        if (typeof v === 'string') mergedCache[k] = v;
      }
      saveCache(lang, mergedCache);
      version++;
    }
  } catch (err) {
    console.error('[Translation] API failed:', err);
  }
}

/**
 * Switch language — clears old translations and loads new ones.
 */
export async function switchLanguage(lang: string): Promise<void> {
  if (lang === currentLang && Object.keys(allTranslations).length > 0) return;

  currentLang = lang;
  allTranslations = {};
  version++;

  if (lang === 'en') return;

  // Load from cache
  const cache = loadCache(lang);
  allTranslations = { ...cache };
  version++;
}

/**
 * Get a translated string. Returns original if no translation.
 */
export function t(key: string): string {
  if (currentLang === 'en') return key;
  return allTranslations[key] || key;
}

/**
 * Reset quota exhaustion flag (e.g. after user tops up credits).
 */
export function resetQuotaFlag(): void {
  translationQuotaExhausted = false;
}

export function translationsReady(): boolean {
  return currentLang === 'en' || Object.keys(allTranslations).length > 0;
}
