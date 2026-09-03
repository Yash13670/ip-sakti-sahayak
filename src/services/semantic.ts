/**
 * Semantic Retrieval Service
 *
 * Primary: OpenRouter embeddings (openai/text-embedding-3-small, 1536 dims)
 * Fallback: TF-IDF cosine similarity (local, no API needed)
 *
 * Mode indicator: 'openrouter' | 'tfidf'
 */

import type { KnowledgeChunk } from '../types';
import {
  isOpenRouterConfigured,
  checkOpenRouterStatus,
  generateEmbedding as orGenerateEmbedding,
  generateEmbeddings as orGenerateEmbeddings,
  getEmbeddingModel,
  getEmbeddingDimensions,
} from './openrouter';

// ─── TF-IDF Fallback ──────────────────────────────────────────────────────

interface TFIDFIndex {
  chunks: KnowledgeChunk[];
  tfidfVectors: Map<string, number>[];
  vocabulary: string[];
  idf: Map<string, number>;
}

let tfidfIndex: TFIDFIndex | null = null;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function buildTFIDFVector(
  tokens: string[],
  idf: Map<string, number>
): Map<string, number> {
  const termCounts = new Map<string, number>();
  for (const t of tokens) {
    termCounts.set(t, (termCounts.get(t) ?? 0) + 1);
  }
  const vector = new Map<string, number>();
  for (const [term, count] of termCounts.entries()) {
    const tfVal = count / tokens.length;
    const idfVal = idf.get(term) ?? 0;
    if (idfVal > 0) vector.set(term, tfVal * idfVal);
  }
  return vector;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, valA] of a.entries()) {
    dot += valA * (b.get(term) ?? 0);
    normA += valA * valA;
  }
  for (const valB of b.values()) {
    normB += valB * valB;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function buildTFIDFIndex(chunks: KnowledgeChunk[]): void {
  const docTokens = chunks.map(c => tokenize(c.actual_text));
  const docCount = chunks.length;

  const dfMap = new Map<string, number>();
  for (const tokens of docTokens) {
    const seen = new Set(tokens);
    for (const t of seen) {
      dfMap.set(t, (dfMap.get(t) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, df] of dfMap.entries()) {
    idf.set(term, Math.log((docCount + 1) / (df + 1)) + 1);
  }

  const tfidfVectors = docTokens.map(tokens => buildTFIDFVector(tokens, idf));
  const vocabulary = [...dfMap.keys()];

  tfidfIndex = { chunks, tfidfVectors, vocabulary, idf };
  console.log(`[Semantic-TFIDF] Index built: ${docCount} docs, ${vocabulary.length} terms`);
}

function tfidfRetrieve(
  query: string,
  topK: number,
  jurisdictionFilter?: string
): Array<{ chunk: KnowledgeChunk; score: number }> {
  if (!tfidfIndex) return [];

  const queryTokens = tokenize(query);
  const queryVector = buildTFIDFVector(queryTokens, tfidfIndex.idf);

  const scores = tfidfIndex.tfidfVectors.map((vec, i) => {
    let score = cosineSimilarity(queryVector, vec);
    const chunk = tfidfIndex!.chunks[i];
    if (jurisdictionFilter && chunk.jurisdiction === jurisdictionFilter) {
      score *= 1.2;
    }
    return { chunk, score };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores.filter(r => r.score > 0).slice(0, topK);
}

// ─── OpenRouter Embeddings ─────────────────────────────────────────────────

interface OpenRouterIndex {
  chunks: KnowledgeChunk[];
  embeddings: number[][];
}

let openrouterIndex: OpenRouterIndex | null = null;

function cosineSimilarityVec(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

async function buildOpenRouterIndex(chunks: KnowledgeChunk[]): Promise<void> {
  console.log(`[Semantic-OpenRouter] Generating embeddings for ${chunks.length} chunks...`);
  const texts = chunks.map(c => c.actual_text.substring(0, 2000));
  const embeddings = await orGenerateEmbeddings(texts, (done, total) => {
    console.log(`[Semantic-OpenRouter] Embeddings: ${done}/${total}`);
  });

  openrouterIndex = { chunks, embeddings };
  const actualDims = embeddings.length > 0 ? embeddings[0].length : 0;
  console.log(`[Semantic-OpenRouter] Index built: ${chunks.length} docs, ${embeddings.length} embeddings`);
  console.log(`[Semantic-OpenRouter] Expected dims: ${getEmbeddingDimensions()}, Actual dims: ${actualDims}`);
  if (actualDims !== getEmbeddingDimensions()) {
    console.error(`[Semantic-OpenRouter] DIMENSION MISMATCH! Expected ${getEmbeddingDimensions()} but got ${actualDims}`);
  }
}

async function openrouterRetrieve(
  query: string,
  topK: number,
  jurisdictionFilter?: string
): Promise<Array<{ chunk: KnowledgeChunk; score: number }>> {
  if (!openrouterIndex) {
    console.error('[Semantic-OpenRouter] No index available for retrieval');
    return [];
  }

  console.log(`[Semantic-OpenRouter] Retrieval: index has ${openrouterIndex.chunks.length} chunks, ${openrouterIndex.embeddings.length} embeddings`);
  if (openrouterIndex.embeddings.length > 0) {
    console.log(`[Semantic-OpenRouter] Corpus embedding dims: ${openrouterIndex.embeddings[0].length}`);
  }

  let queryEmbedding: number[];
  try {
    queryEmbedding = await orGenerateEmbedding(query);
    console.log(`[Semantic-OpenRouter] Query embedding dims: ${queryEmbedding.length}`);
  } catch (err) {
    console.error('[Semantic-OpenRouter] Query embedding FAILED:', err);
    return [];
  }

  if (!queryEmbedding || queryEmbedding.length === 0) {
    console.error('[Semantic-OpenRouter] Query embedding is empty/null');
    return [];
  }

  const scores = openrouterIndex.chunks.map((chunk, i) => {
    const corpusEmb = openrouterIndex!.embeddings[i];
    if (!corpusEmb || corpusEmb.length === 0) return { chunk, score: 0 };
    if (corpusEmb.length !== queryEmbedding.length) {
      console.error(`[Semantic-OpenRouter] DIM MISMATCH: query=${queryEmbedding.length}, corpus[${i}]=${corpusEmb.length}`);
      return { chunk, score: 0 };
    }
    let score = cosineSimilarityVec(queryEmbedding, corpusEmb);
    if (jurisdictionFilter && chunk.jurisdiction === jurisdictionFilter) {
      score *= 1.2;
    }
    return { chunk, score };
  });

  scores.sort((a, b) => b.score - a.score);
  const filtered = scores.filter(r => r.score > 0).slice(0, topK);
  console.log(`[Semantic-OpenRouter] Results: ${filtered.length} above threshold (from ${scores.length} total)`);
  if (filtered.length > 0) {
    console.log(`[Semantic-OpenRouter] Top score: ${filtered[0].score.toFixed(4)}, Bottom: ${filtered[filtered.length-1].score.toFixed(4)}`);
  }
  if (scores.length > 0) {
    const allScores = scores.map(s => s.score);
    console.log(`[Semantic-OpenRouter] Score range: min=${Math.min(...allScores).toFixed(6)}, max=${Math.max(...allScores).toFixed(6)}, avg=${(allScores.reduce((a,b)=>a+b,0)/allScores.length).toFixed(6)}`);
  }
  return filtered;
}

// ─── Public API ────────────────────────────────────────────────────────────

export type SemanticMode = 'openrouter' | 'tfidf';
let currentMode: SemanticMode = 'tfidf';

export function getSemanticMode(): SemanticMode {
  return currentMode;
}

export async function buildSemanticIndex(chunks: KnowledgeChunk[]): Promise<void> {
  // Check OpenRouter status first
  await checkOpenRouterStatus();

  if (isOpenRouterConfigured()) {
    try {
      currentMode = 'openrouter';
      await buildOpenRouterIndex(chunks);
      return;
    } catch (err) {
      console.warn('[Semantic] OpenRouter embeddings failed, falling back to TF-IDF:', err);
      currentMode = 'tfidf';
    }
  }

  currentMode = 'tfidf';
  buildTFIDFIndex(chunks);
}

export async function semanticRetrieve(
  query: string,
  topK = 10,
  jurisdictionFilter?: string
): Promise<Array<{ chunk: KnowledgeChunk; score: number }>> {
  if (currentMode === 'openrouter' && openrouterIndex) {
    return openrouterRetrieve(query, topK, jurisdictionFilter);
  }
  return tfidfRetrieve(query, topK, jurisdictionFilter);
}

export function getSemanticIndexStats(): {
  built: boolean;
  docCount: number;
  mode: string;
  model?: string;
  dimensions?: number;
} {
  if (currentMode === 'openrouter' && openrouterIndex) {
    return {
      built: true,
      docCount: openrouterIndex.chunks.length,
      mode: 'OpenRouter Embeddings',
      model: getEmbeddingModel(),
      dimensions: getEmbeddingDimensions(),
    };
  }
  if (tfidfIndex) {
    return {
      built: true,
      docCount: tfidfIndex.chunks.length,
      mode: 'TF-IDF Local Fallback',
    };
  }
  return { built: false, docCount: 0, mode: 'Not initialized' };
}
