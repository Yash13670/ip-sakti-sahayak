/**
 * OpenRouter Embeddings Client Service
 * All OpenRouter calls go through the server-side proxy (/api/openrouter/*).
 * The API key is NEVER exposed to the browser.
 *
 * Uses openai/text-embedding-3-small (1536 dimensions) via OpenRouter.
 */

const PROXY_BASE = '/api/openrouter';
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const EMBEDDING_DIMS = 1536;

// ─── Status Check ─────────────────────────────────────────────────────────

let cachedStatus: { configured: boolean } = { configured: false };
let statusChecked = false;

export async function checkOpenRouterStatus(): Promise<{ configured: boolean }> {
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

export function isOpenRouterConfigured(): boolean {
  return cachedStatus.configured;
}

export function getEmbeddingModel(): string {
  return EMBEDDING_MODEL;
}

export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMS;
}

// ─── Single Embedding ─────────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${PROXY_BASE}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model: EMBEDDING_MODEL }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `OpenRouter embed error: ${res.status}`);
  }

  const data = await res.json();
  return data.embedding;
}

// ─── Batch Embeddings ─────────────────────────────────────────────────────

export async function generateEmbeddings(
  texts: string[],
  onProgress?: (done: number, total: number) => void
): Promise<number[][]> {
  const BATCH_SIZE = 20; // Conservative batch size for rate limits
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${PROXY_BASE}/embed-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: batch, model: EMBEDDING_MODEL }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `OpenRouter embed batch error: ${res.status}`);
    }

    const data = await res.json();
    allEmbeddings.push(...data.embeddings);
    onProgress?.(allEmbeddings.length, texts.length);

    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return allEmbeddings;
}
