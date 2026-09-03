/**
 * Bhashini Client Service
 * All Bhashini calls go through the server-side proxy (/api/bhashini/*).
 * API keys are NEVER exposed to the browser.
 *
 * Services:
 * - Translation (NMT) — Indian language translation
 * - Speech-to-Text (ASR) — Voice input in Indian languages
 * - Text-to-Speech (TTS) — Read results aloud
 * - Text Language Detection — Auto-detect input language
 */

const PROXY_BASE = '/api/bhashini';

// ─── Supported Languages ──────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

// ─── Status Check ─────────────────────────────────────────────────────────

let cachedStatus: { configured: boolean } = { configured: false };
let statusChecked = false;

export async function checkBhashiniStatus(): Promise<{ configured: boolean }> {
  if (statusChecked) return cachedStatus;
  try {
    const res = await fetch(`${PROXY_BASE}/status`);
    if (!res.ok) throw new Error('Status check failed');
    cachedStatus = await res.json();
    statusChecked = true;
    return cachedStatus;
  } catch {
    cachedStatus = { configured: false };
    statusChecked = true;
    return cachedStatus;
  }
}

export function isBhashiniConfigured(): boolean {
  return cachedStatus.configured;
}

// ─── Translation ──────────────────────────────────────────────────────────

export async function translate(
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode
): Promise<{ translatedText: string; sourceLanguage: string; targetLanguage: string }> {
  const res = await fetch(`${PROXY_BASE}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, sourceLanguage, targetLanguage }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Bhashini translate error: ${res.status}`);
  }

  return res.json();
}

// ─── Speech-to-Text ───────────────────────────────────────────────────────

export async function speechToText(
  audioBase64: string,
  language: LanguageCode
): Promise<{ text: string; language: string }> {
  const res = await fetch(`${PROXY_BASE}/stt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, language }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Bhashini STT error: ${res.status}`);
  }

  return res.json();
}

// ─── Text-to-Speech ───────────────────────────────────────────────────────

export async function textToSpeech(
  text: string,
  language: LanguageCode,
  gender: 'male' | 'female' = 'female'
): Promise<{ audioContent: string; language: string; gender: string }> {
  const res = await fetch(`${PROXY_BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, gender }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Bhashini TTS error: ${res.status}`);
  }

  return res.json();
}

// ─── Language Detection ────────────────────────────────────────────────────

export async function detectLanguage(
  text: string
): Promise<{ language: string; confidence: number }> {
  const res = await fetch(`${PROXY_BASE}/detect-language`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Bhashini detect language error: ${res.status}`);
  }

  return res.json();
}

// ─── Utility: Get language name from code ──────────────────────────────────

export function getLanguageName(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang ? lang.name : code;
}

export function getLanguageNativeName(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang ? lang.nativeName : code;
}
