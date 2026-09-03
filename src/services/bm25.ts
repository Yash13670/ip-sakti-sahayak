/**
 * BM25 Retrieval Service
 * Implements BM25 (Best Match 25) ranking algorithm for keyword-based retrieval.
 * Runs entirely in-browser/in-process — no external dependencies needed.
 */

import type { KnowledgeChunk } from '../types';

interface BM25Index {
  chunks: KnowledgeChunk[];
  termFrequencies: Map<string, number>[];
  docLengths: number[];
  avgDocLength: number;
  docCount: number;
  idf: Map<string, number>;
}

const K1 = 1.5;
const B = 0.75;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

let bm25Index: BM25Index | null = null;

export function buildBM25Index(chunks: KnowledgeChunk[]): void {
  const docCount = chunks.length;
  const termFrequencies: Map<string, number>[] = [];
  const docLengths: number[] = [];
  const dfMap = new Map<string, number>();

  for (const chunk of chunks) {
    const tokens = tokenize(chunk.actual_text);
    docLengths.push(tokens.length);

    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }
    termFrequencies.push(tf);

    // Document frequency
    for (const term of tf.keys()) {
      dfMap.set(term, (dfMap.get(term) ?? 0) + 1);
    }
  }

  const avgDocLength = docLengths.reduce((a, b) => a + b, 0) / docCount;

  // Compute IDF
  const idf = new Map<string, number>();
  for (const [term, df] of dfMap.entries()) {
    idf.set(term, Math.log((docCount - df + 0.5) / (df + 0.5) + 1));
  }

  bm25Index = { chunks, termFrequencies, docLengths, avgDocLength, docCount, idf };
  console.log(`[BM25] Index built: ${docCount} documents, ${dfMap.size} unique terms`);
}

export function bm25Retrieve(
  query: string,
  topK = 10,
  jurisdictionFilter?: string
): Array<{ chunk: KnowledgeChunk; score: number }> {
  if (!bm25Index) {
    console.warn('[BM25] Index not built yet');
    return [];
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scores: number[] = new Array(bm25Index.docCount).fill(0);

  for (const term of queryTokens) {
    const idfScore = bm25Index.idf.get(term) ?? 0;
    if (idfScore === 0) continue;

    for (let i = 0; i < bm25Index.docCount; i++) {
      const termFreq = bm25Index.termFrequencies[i].get(term) ?? 0;
      if (termFreq === 0) continue;

      const dl = bm25Index.docLengths[i];
      const avgdl = bm25Index.avgDocLength;
      const numerator = termFreq * (K1 + 1);
      const denominator = termFreq + K1 * (1 - B + B * (dl / avgdl));
      scores[i] += idfScore * (numerator / denominator);
    }
  }

  // Build results
  const results: Array<{ chunk: KnowledgeChunk; score: number }> = [];
  for (let i = 0; i < bm25Index.docCount; i++) {
    if (scores[i] <= 0) continue;
    const chunk = bm25Index.chunks[i];
    let finalScore = scores[i];
    if (jurisdictionFilter && chunk.jurisdiction !== jurisdictionFilter) {
      finalScore *= 0.5; // Penalise non-matching jurisdiction but don't exclude
    }
    results.push({ chunk, score: finalScore });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

export function getBM25IndexStats(): { built: boolean; docCount: number; termCount: number } {
  if (!bm25Index) return { built: false, docCount: 0, termCount: 0 };
  return {
    built: true,
    docCount: bm25Index.docCount,
    termCount: bm25Index.idf.size,
  };
}
