/**
 * LLM Client Service
 * All LLM calls go through server-side proxies.
 * API keys are NEVER exposed to the browser.
 *
 * Primary: OpenRouter (google/gemini-2.5-flash)
 * Fallback: Gemini direct API
 */

// ─── OpenRouter ───────────────────────────────────────────────────────────

const OPENROUTER_PROXY = '/api/openrouter';

let orCachedStatus: { configured: boolean } = { configured: false };
let orStatusChecked = false;

export async function checkOpenRouterStatus(): Promise<{ configured: boolean }> {
  if (orStatusChecked) return orCachedStatus;
  try {
    const res = await fetch(`${OPENROUTER_PROXY}/status`);
    if (!res.ok) throw new Error('Status check failed');
    orCachedStatus = await res.json();
    orStatusChecked = true;
    return orCachedStatus;
  } catch {
    orCachedStatus = { configured: false };
    orStatusChecked = true;
    return orCachedStatus;
  }
}

export function isOpenRouterConfigured(): boolean {
  return orCachedStatus.configured;
}

export async function openrouterChatCompletion(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const res = await fetch(`${OPENROUTER_PROXY}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, systemInstruction }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `OpenRouter chat error: ${res.status}`);
  }

  const data = await res.json();
  return data.text;
}

// ─── Gemini (fallback) ────────────────────────────────────────────────────

const GEMINI_PROXY = '/api/gemini';

let gemCachedStatus: { configured: boolean; model: string } = { configured: false, model: 'unchecked' };
let gemStatusChecked = false;

export async function checkGeminiStatus(): Promise<{ configured: boolean; model: string }> {
  if (gemStatusChecked) return gemCachedStatus;
  try {
    const res = await fetch(`${GEMINI_PROXY}/status`);
    if (!res.ok) throw new Error('Status check failed');
    gemCachedStatus = await res.json();
    gemStatusChecked = true;
    return gemCachedStatus;
  } catch {
    gemCachedStatus = { configured: false, model: 'unknown' };
    gemStatusChecked = true;
    return gemCachedStatus;
  }
}

export function isGeminiConfigured(): boolean {
  return gemCachedStatus.configured;
}

// ─── Unified Chat Completions ────────────────────────────────────────────
// Primary: OpenRouter → Fallback: Gemini direct

export async function chatCompletion(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  // Try OpenRouter first
  if (isOpenRouterConfigured()) {
    try {
      return await openrouterChatCompletion(prompt, systemInstruction);
    } catch (err) {
      console.warn('[LLM] OpenRouter chat failed, trying Gemini:', err);
    }
  }

  // Fallback to Gemini
  if (isGeminiConfigured()) {
    const res = await fetch(`${GEMINI_PROXY}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemInstruction }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Gemini chat error: ${res.status}`);
    }

    const data = await res.json();
    return data.text;
  }

  throw new Error('No LLM configured (OpenRouter and Gemini both unavailable)');
}

// ─── Embeddings ───────────────────────────────────────────────────────────
// These remain Gemini-only for now (OpenRouter embeddings handled separately)

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${GEMINI_PROXY}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Gemini embed error: ${res.status}`);
  }

  const data = await res.json();
  return data.embedding;
}

export async function generateEmbeddings(
  texts: string[],
  onProgress?: (done: number, total: number) => void
): Promise<number[][]> {
  const BATCH_SIZE = 50;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${GEMINI_PROXY}/embed-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: batch }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Gemini embed batch error: ${res.status}`);
    }

    const data = await res.json();
    allEmbeddings.push(...data.embeddings);
    onProgress?.(allEmbeddings.length, texts.length);
  }

  return allEmbeddings;
}
