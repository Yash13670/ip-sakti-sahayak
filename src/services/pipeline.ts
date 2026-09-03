/**
 * Screening Pipeline Service
 * Orchestrates the full IP/TK screening workflow.
 */

import type {
  ParsedInput,
  Jurisdiction,
  ScreeningResult,
  TraceEvent,
  RetrievedEvidence,
  ExtractedClaim,
  ClaimVerificationResult,
  CitationValidation,
  KnowledgeChunk,
  SourceType,
} from '../types';
import { bm25Retrieve, buildBM25Index } from './bm25';
import { semanticRetrieve, buildSemanticIndex, getSemanticMode, getSemanticIndexStats } from './semantic';
import { knowledgeBaseData } from '../data/kb';
import { verifyClaimAgainstEvidence } from './verification';
import { applyScreeningRules, calculateRisk } from './rules';
import { generateGroundedAnswer } from './llm';
import { checkGeminiStatus, checkOpenRouterStatus } from './gemini';

let semanticModeModel = '';let chunksLoaded = false;
let initPromise: Promise<void> | null = null;

let typedChunks: KnowledgeChunk[] = [];

function getTypedChunks(): KnowledgeChunk[] {
  if (typedChunks.length > 0) return typedChunks;
  const raw = knowledgeBaseData as unknown as { chunks: Record<string, unknown>[] };
  typedChunks = raw.chunks.map(c => ({
    chunk_id: c.chunk_id as string,
    document_id: c.document_id as string,
    source_name: c.source_name as string,
    document_title: c.document_title as string,
    source_type: c.source_type as SourceType,
    jurisdiction: c.jurisdiction as Jurisdiction,
    provision: c.provision as string,
    page_number: c.page_number as string,
    actual_text: c.actual_text as string,
    source_url: c.source_url as string,
    source_status: c.source_status as string,
    keywords: c.keywords as string[],
    char_count: c.char_count as number,
  }));
  return typedChunks;
}

export async function initKnowledgeBase(): Promise<void> {
  if (chunksLoaded) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const chunks = getTypedChunks();
    buildBM25Index(chunks);
    await Promise.all([checkGeminiStatus(), checkOpenRouterStatus()]);
    await buildSemanticIndex(chunks).catch(err =>
      console.error('[Pipeline] Semantic index build failed:', err)
    );
    const stats = getSemanticIndexStats();
    semanticModeModel = stats.model ?? '';
    chunksLoaded = true;
    console.log(`[Pipeline] Knowledge base initialized: ${chunks.length} chunks from ${knowledgeBaseData.documents.length} documents`);
  })();

  return initPromise;
}

export function getChunks(): KnowledgeChunk[] {
  return getTypedChunks();
}

export function getDocuments() {
  return knowledgeBaseData.documents;
}

let traceCallback: ((event: TraceEvent) => void) | null = null;

export function setTraceCallback(cb: (event: TraceEvent) => void) {
  traceCallback = cb;
}

function emitTrace(stage: string, label: string, status: 'running' | 'complete' | 'error', data?: Record<string, unknown>) {
  if (traceCallback) {
    traceCallback({ stage, label, status, data, timestamp: Date.now() });
  }
}

// ─── Step 1: Input Parser ────────────────────────────────────────────────

function parseInput(input: ParsedInput): ParsedInput {
  emitTrace('input_parser', 'Screening Input Parser', 'running', {
    productName: input.productName,
    ingredients: input.ingredients,
    traditionalReference: input.traditionalReference,
    innovationType: input.innovationType,
    jurisdiction: input.jurisdiction,
  });

  const parsed: ParsedInput = {
    productName: input.productName.trim(),
    ingredients: input.ingredients.map(i => i.trim()).filter(Boolean),
    description: input.description?.trim() ?? '',
    traditionalReference: input.traditionalReference,
    innovationType: input.innovationType,
    jurisdiction: input.jurisdiction,
  };

  emitTrace('input_parser', 'Screening Input Parser', 'complete', {
    productName: parsed.productName,
    ingredients: parsed.ingredients,
    traditionalReference: parsed.traditionalReference,
    innovationType: parsed.innovationType,
    jurisdiction: parsed.jurisdiction,
  });

  return parsed;
}

// ─── Step 2: Jurisdiction Router ──────────────────────────────────────────

function routeJurisdiction(jurisdiction: Jurisdiction): Jurisdiction {
  emitTrace('jurisdiction', 'Jurisdiction Router', 'running', { jurisdiction });
  emitTrace('jurisdiction', 'Jurisdiction Router', 'complete', {
    routedTo: jurisdiction,
    label: `Routed to ${jurisdiction}`,
  });
  return jurisdiction;
}

// ─── Build better query from input ────────────────────────────────────────

function buildQuery(input: ParsedInput): string {
  const parts: string[] = [];

  // Core product name
  if (input.productName) parts.push(input.productName);

  // Ingredients (important for retrieval)
  if (input.ingredients.length > 0) {
    parts.push(input.ingredients.join(' '));
  }

  // Add IP-specific terms based on context
  if (input.traditionalReference === 'yes' || input.traditionalReference === 'modified') {
    parts.push('traditional knowledge traditional formulation ayurvedic');
  }

  if (input.innovationType === 'new_dosage') {
    parts.push('dosage form formulation new dosage');
  } else if (input.innovationType === 'new_process') {
    parts.push('extraction process method');
  } else if (input.innovationType === 'new_combination') {
    parts.push('combination composition');
  } else if (input.innovationType === 'traditional_formulation') {
    parts.push('traditional knowledge prior art');
  }

  // Add patent-specific terms
  parts.push('patentability novelty inventive step traditional knowledge biological resources biodiversity');

  if (input.description) {
    parts.push(input.description);
  }

  return parts.filter(Boolean).join(' ');
}

// ─── Step 3: BM25 Retrieval ───────────────────────────────────────────────

function retrieveBM25(query: string, jurisdiction: Jurisdiction): RetrievedEvidence[] {
  emitTrace('bm25', 'BM25 Keyword Retrieval', 'running', { query: query.substring(0, 200) });

  const results = bm25Retrieve(query, 20, jurisdiction);

  const evidence: RetrievedEvidence[] = results.map((r, i) => ({
    chunk: r.chunk,
    bm25Score: r.score,
    semanticScore: 0,
    finalScore: 0,
    rank: i + 1,
  }));

  emitTrace('bm25', 'BM25 Keyword Retrieval', 'complete', {
    totalResults: evidence.length,
    topResults: evidence.slice(0, 8).map(e => ({
      source: e.chunk.source_name,
      provision: e.chunk.provision,
      page: e.chunk.page_number,
      score: e.bm25Score.toFixed(4),
    })),
  });

  return evidence;
}

// ─── Step 4: Semantic Retrieval ───────────────────────────────────────────

async function retrieveSemantic(query: string, jurisdiction: Jurisdiction): Promise<RetrievedEvidence[]> {
  const mode = getSemanticMode();
  const modeLabel = mode === 'openrouter'
    ? `OpenRouter Embeddings (${semanticModeModel})`
    : 'TF-IDF Local Fallback';

  emitTrace('semantic', 'Semantic Retrieval', 'running', {
    mode: modeLabel,
    model: mode === 'openrouter' ? 'openai/text-embedding-3-small' : undefined,
    dimensions: mode === 'openrouter' ? 1536 : undefined,
    query: query.substring(0, 200),
  });

  const results = await semanticRetrieve(query, 20, jurisdiction);

  const evidence: RetrievedEvidence[] = results.map((r, i) => ({
    chunk: r.chunk,
    bm25Score: 0,
    semanticScore: r.score,
    finalScore: 0,
    rank: i + 1,
  }));

  emitTrace('semantic', 'Semantic Retrieval', 'complete', {
    mode: modeLabel,
    model: mode === 'openrouter' ? 'openai/text-embedding-3-small' : undefined,
    dimensions: mode === 'openrouter' ? 1536 : undefined,
    totalResults: evidence.length,
    topResults: evidence.slice(0, 8).map(e => ({
      source: e.chunk.source_name,
      provision: e.chunk.provision,
      page: e.chunk.page_number,
      score: e.semanticScore.toFixed(4),
    })),
  });

  return evidence;
}

// ─── Step 5: Score Fusion / Re-ranking with provision boost ───────────────

function rerankEvidence(
  bm25Results: RetrievedEvidence[],
  semanticResults: RetrievedEvidence[]
): RetrievedEvidence[] {
  emitTrace('reranking', 'Score Fusion / Re-ranking', 'running');

  const BM25_WEIGHT = 0.45;
  const SEMANTIC_WEIGHT = 0.55;

  // Normalize BM25 scores
  const bm25Max = Math.max(...bm25Results.map(r => r.bm25Score), 0.001);
  const bm25Map = new Map<string, number>();
  for (const r of bm25Results) {
    bm25Map.set(r.chunk.chunk_id, r.bm25Score / bm25Max);
  }

  // Normalize semantic scores
  const semMax = Math.max(...semanticResults.map(r => r.semanticScore), 0.001);
  const semMap = new Map<string, number>();
  for (const r of semanticResults) {
    semMap.set(r.chunk.chunk_id, r.semanticScore / semMax);
  }

  // Merge all unique chunks
  const allChunks = new Map<string, RetrievedEvidence>();
  for (const r of bm25Results) allChunks.set(r.chunk.chunk_id, { ...r });
  for (const r of semanticResults) {
    if (!allChunks.has(r.chunk.chunk_id)) allChunks.set(r.chunk.chunk_id, { ...r });
  }

  // Calculate final scores with provision-aware boost
  const merged: RetrievedEvidence[] = [];
  for (const [, evidence] of allChunks) {
    const bm25Norm = bm25Map.get(evidence.chunk.chunk_id) ?? 0;
    const semNorm = semMap.get(evidence.chunk.chunk_id) ?? 0;
    let finalScore = BM25_WEIGHT * bm25Norm + SEMANTIC_WEIGHT * semNorm;

    // Boost for IP/TK-relevant provisions
    const prov = evidence.chunk.provision.toLowerCase();
    const text = evidence.chunk.actual_text.toLowerCase();
    const src = evidence.chunk.source_name;
    const pageNum = parseInt(evidence.chunk.page_number) || 0;

    // ── HIGH PRIORITY: Patents Act Section 3 (non-patentable inventions) ──
    // PA1970-0003 contains Section 3(a-p) including 3(p) TK exclusion
    if (src.includes('Patents Act') && text.includes('traditional knowledge')) {
      finalScore *= 1.30;
    }
    if (src.includes('Patents Act') && (text.includes('not patentable') || text.includes('not inventions'))) {
      finalScore *= 1.20;
    }
    if (src.includes('Patents Act') && text.includes('mere admixture')) {
      finalScore *= 1.15; // Section 3(e)
    }

    // ── HIGH PRIORITY: Biological Diversity Act operative sections ──
    // Pages 3-6 contain Sections 3-7 (access, benefit sharing, IP application)
    if (src.includes('Biological Diversity') && pageNum >= 3 && pageNum <= 6) {
      finalScore *= 1.25;
    }
    if (src.includes('Biological Diversity') && text.includes('intellectual property right')) {
      finalScore *= 1.20; // Section 6 — IP application requires NBA approval
    }
    if (src.includes('Biological Diversity') && text.includes('benefit sharing')) {
      finalScore *= 1.15;
    }

    // ── MEDIUM: General IP/TK keyword boosts ──
    if (prov.includes('section 3') || text.includes('section 3')) finalScore *= 1.10;
    if (text.includes('traditional knowledge')) finalScore *= 1.08;
    if (text.includes('biological diversity') || text.includes('genetic resource')) finalScore *= 1.06;
    if (text.includes('novelty') || text.includes('inventive step')) finalScore *= 1.05;
    if (text.includes('patentability') || text.includes('not patentable')) finalScore *= 1.08;

    // ── MEDIUM: Source-level boosts for statutes ──
    if (src.includes('Patents Act')) finalScore *= 1.10;
    if (src.includes('Biological Diversity')) finalScore *= 1.08;
    if (src.includes('Drugs and Cosmetics')) finalScore *= 1.05;

    // ── LOW: Demote generic pharmacopoeia/reference content ──
    if (src.includes('Pharmacopoeia') && prov === 'general') {
      finalScore *= 0.85; // Generic API pages about Ayurveda history, not legal provisions
    }
    if (src.includes('AYUSH Guidelines') && prov === 'general' && !text.includes('schedule')) {
      finalScore *= 0.90; // Generic GMP text, not IP/TK-relevant
    }

    evidence.bm25Score = bm25Norm;
    evidence.semanticScore = semNorm;
    evidence.finalScore = finalScore;
    merged.push(evidence);
  }

  merged.sort((a, b) => b.finalScore - a.finalScore);
  merged.forEach((e, i) => (e.rank = i + 1));

  emitTrace('reranking', 'Score Fusion / Re-ranking', 'complete', {
    formula: '0.45 * BM25 + 0.55 * Semantic + provision boost',
    totalCandidates: merged.length,
    topResults: merged.slice(0, 8).map(e => ({
      source: e.chunk.source_name,
      provision: e.chunk.provision,
      page: e.chunk.page_number,
      bm25: e.bm25Score.toFixed(4),
      semantic: e.semanticScore.toFixed(4),
      final: e.finalScore.toFixed(4),
    })),
  });

  return merged;
}

// ─── Step 6: Evidence Selection with relevance threshold ──────────────────

function selectEvidence(reranked: RetrievedEvidence[]): RetrievedEvidence[] {
  emitTrace('evidence_selection', 'Evidence Selection', 'running');

  // Minimum relevance threshold — skip very low-scoring chunks
  const threshold = 0.15;
  const selected = reranked.filter(e => e.finalScore > threshold).slice(0, 8);

  emitTrace('evidence_selection', 'Evidence Selection', 'complete', {
    selectedCount: selected.length,
    threshold,
    sources: selected.map(e => ({
      source: e.chunk.source_name,
      provision: e.chunk.provision,
      page: e.chunk.page_number,
      score: e.finalScore.toFixed(4),
    })),
  });

  return selected;
}

// ─── Step 7: Answer Generation ────────────────────────────────────────────

async function generateAnswer(
  input: ParsedInput,
  evidence: RetrievedEvidence[]
): Promise<string> {
  emitTrace('answer_generation', 'Grounded Answer Generation', 'running');

  // Check if evidence is sufficient
  const topScore = evidence.length > 0 ? evidence[0].finalScore : 0;
  const hasStrongEvidence = topScore > 0.3 && evidence.length >= 2;

  if (!hasStrongEvidence && evidence.length === 0) {
    const answer = 'Insufficient directly relevant evidence found in the current knowledge base for this formulation. A detailed prior-art search and expert consultation is recommended before proceeding with any IP filing.';
    emitTrace('answer_generation', 'Grounded Answer Generation', 'complete', {
      answerLength: answer.length,
      note: 'Insufficient evidence',
    });
    return answer;
  }

  const answer = await generateGroundedAnswer(input, evidence);

  emitTrace('answer_generation', 'Grounded Answer Generation', 'complete', {
    answerLength: answer.length,
    evidenceCount: evidence.length,
    topScore: topScore.toFixed(4),
  });

  return answer;
}

// ─── Step 8: Claim Extraction (improved) ──────────────────────────────────

function extractClaims(answer: string, evidence: RetrievedEvidence[]): ExtractedClaim[] {
  emitTrace('claim_extraction', 'Claim Extraction', 'running');

  const claims: ExtractedClaim[] = [];

  // Split into sentences
  const sentences = answer
    .replace(/#{1,6}\s+/g, '')           // Remove markdown headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')    // Remove bold markers
    .split(/(?<=[.!?])\s+/)               // Split on sentence boundaries
    .map(s => s.trim())
    .filter(s => s.length > 25);           // Minimum sentence length

  const excludePatterns = [
    /^these are preliminary/i,
    /^disclaimer/i,
    /^ip-sakti/i,
    /^the system/i,
    /^this assessment/i,
    /^consult a qualified/i,
    /^not constitute/i,
    /^does not constitute/i,
    /^provided that/i,
    /^for example/i,
    /^in summary/i,
    /^step \d/i,
    /^\d+\.\s/,
    /^-\s/,
  ];

  const includePatterns = [
    /section\s+\d/i,
    /act[,.\s]/i,
    /article\s+\d/i,
    /rule\s+\d/i,
    /may be relevant/i,
    /may apply/i,
    /should be considered/i,
    /relevant provision/i,
    /traditional knowledge/i,
    /biological/i,
    /genetic resource/i,
    /patent/i,
    /novelty/i,
    /inventive/i,
    /protect/i,
    /compliance/i,
    /requirement/i,
    /obligation/i,
    /formulation/i,
    /ayurvedic/i,
    /ayush/i,
    /screening/i,
    /evidence/i,
  ];

  let claimId = 1;
  for (const sentence of sentences) {
    // Skip excluded patterns
    if (excludePatterns.some(p => p.test(sentence))) continue;

    // Must match at least one include pattern
    if (!includePatterns.some(p => p.test(sentence))) continue;

    // Must not contain ## or be a heading
    if (sentence.includes('##') || sentence.startsWith('#')) continue;

    // Find best matching evidence
    let bestEvidence = evidence[0];
    let bestOverlap = 0;
    const claimWords = sentence.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    for (const e of evidence) {
      const evidenceText = e.chunk.actual_text.toLowerCase();
      let overlap = 0;
      for (const word of claimWords) {
        if (evidenceText.includes(word)) overlap++;
      }
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestEvidence = e;
      }
    }

    if (bestEvidence) {
      claims.push({
        claim_id: `claim_${claimId}`,
        claim_text: sentence,
        citation: `${bestEvidence.chunk.source_name}, ${bestEvidence.chunk.provision}, p.${bestEvidence.chunk.page_number}`,
        source_id: bestEvidence.chunk.document_id,
        evidence_chunk_id: bestEvidence.chunk.chunk_id,
      });
      claimId++;
    }
  }

  // Limit to top 5 most relevant claims
  const limitedClaims = claims.slice(0, 5);

  emitTrace('claim_extraction', 'Claim Extraction', 'complete', {
    totalClaims: limitedClaims.length,
    claims: limitedClaims.map(c => ({
      id: c.claim_id,
      text: c.claim_text.substring(0, 120),
      citation: c.citation,
    })),
  });

  return limitedClaims;
}

// ─── Step 9 & 10: Claim-Evidence Verification + Citation Validation ───────

async function verifyClaims(
  claims: ExtractedClaim[],
  evidence: RetrievedEvidence[]
): Promise<{
  verifications: ClaimVerificationResult[];
  citations: CitationValidation[];
}> {
  emitTrace('claim_verification', 'Claim-Evidence Cross-Verification', 'running');

  const verifications: ClaimVerificationResult[] = [];

  for (const claim of claims) {
    const matchingEvidence = evidence.find(e => e.chunk.chunk_id === claim.evidence_chunk_id);
    if (!matchingEvidence) continue;

    const result = await verifyClaimAgainstEvidence(claim, matchingEvidence);

    verifications.push({
      claim_id: claim.claim_id,
      claim_text: claim.claim_text,
      evidence_chunk_id: claim.evidence_chunk_id,
      evidence_text: matchingEvidence.chunk.actual_text.substring(0, 500),
      source_name: matchingEvidence.chunk.source_name,
      provision: matchingEvidence.chunk.provision,
      status: result.status,
      confidence: result.confidence,
      reason: result.reason,
      is_demo: result.is_demo,
      method: result.method,
    });
  }

  emitTrace('claim_verification', 'Claim-Evidence Cross-Verification', 'complete', {
    method: verifications.length > 0
      ? (verifications[0].method === 'openrouter' ? 'OpenRouter Verification'
        : verifications[0].method === 'gemini' ? 'Gemini Verification'
        : 'Local Fallback')
      : 'N/A',
    total: verifications.length,
    supported: verifications.filter(v => v.status === 'SUPPORTED').length,
    partial: verifications.filter(v => v.status === 'PARTIALLY_SUPPORTED').length,
    unsupported: verifications.filter(v => v.status === 'UNSUPPORTED').length,
  });

  // Citation validation
  emitTrace('citation_validation', 'Citation Validation', 'running');

  const citations: CitationValidation[] = verifications.map(v => {
    const sourceExists = evidence.some(e => e.chunk.source_name === v.source_name);
    const provisionExists = evidence.some(e => e.chunk.provision === v.provision);
    const chunkExists = evidence.some(e => e.chunk.chunk_id === v.evidence_chunk_id);

    let finalStatus: CitationValidation['final_status'] = 'INVALID';
    if (v.status === 'SUPPORTED' && sourceExists && provisionExists && chunkExists) {
      finalStatus = 'VERIFIED';
    } else if (v.status === 'PARTIALLY_SUPPORTED') {
      finalStatus = 'PARTIALLY_SUPPORTED';
    } else if (v.status === 'UNSUPPORTED') {
      finalStatus = 'UNSUPPORTED';
    }

    return {
      claim_id: v.claim_id,
      source_exists: sourceExists,
      provision_exists: provisionExists,
      chunk_exists: chunkExists,
      chunk_belongs_to_source: chunkExists,
      citation_points_to_correct_evidence: chunkExists,
      verification_result_available: true,
      final_status: finalStatus,
    };
  });

  emitTrace('citation_validation', 'Citation Validation', 'complete', {
    total: citations.length,
    verified: citations.filter(c => c.final_status === 'VERIFIED').length,
    partial: citations.filter(c => c.final_status === 'PARTIALLY_SUPPORTED').length,
    unsupported: citations.filter(c => c.final_status === 'UNSUPPORTED').length,
  });

  return { verifications, citations };
}

// ─── Main Pipeline ────────────────────────────────────────────────────────

export async function runScreeningPipeline(
  input: ParsedInput,
  onTrace?: (event: TraceEvent) => void
): Promise<ScreeningResult> {
  if (onTrace) traceCallback = onTrace;

  await initKnowledgeBase();
  const sessionId = `session_${Date.now()}`;

  // Step 1
  const parsed = parseInput(input);

  // Step 2
  const routedJurisdiction = routeJurisdiction(parsed.jurisdiction);

  // Build query
  const query = buildQuery(parsed);

  // Step 3: BM25
  const bm25Results = retrieveBM25(query, routedJurisdiction);

  // Step 4: Semantic
  const semanticResults = await retrieveSemantic(query, routedJurisdiction);

  // Step 5: Rerank
  const reranked = rerankEvidence(bm25Results, semanticResults);

  // Step 6: Select
  const selected = selectEvidence(reranked);

  // Step 7: Generate answer
  const answer = await generateAnswer(parsed, selected);

  // Step 8: Extract claims
  const claims = extractClaims(answer, selected);

  // Step 9-10: Verify
  const { verifications, citations } = await verifyClaims(claims, selected);

  // Step 11: Rules
  emitTrace('screening_rules', 'Screening Rules', 'running');
  const rules = applyScreeningRules(parsed, selected);
  emitTrace('screening_rules', 'Screening Rules', 'complete', {
    triggered: rules.filter(r => r.triggered).map(r => ({
      name: r.name,
      risk: r.risk_contribution,
    })),
  });

  // Step 12: Risk
  emitTrace('risk_classification', 'Risk Classification', 'running');
  const { level: riskLevel, reason: riskReason, nextStep } = calculateRisk(parsed, rules, verifications, selected);
  emitTrace('risk_classification', 'Risk Classification', 'complete', {
    riskLevel,
    reason: riskReason,
    nextStep,
  });

  const isDemo = !verifications.some(v => !v.is_demo);

  const result: ScreeningResult = {
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    parsed_input: parsed,
    jurisdiction_route: routedJurisdiction,
    bm25_results: bm25Results,
    semantic_results: semanticResults,
    reranked_evidence: reranked,
    selected_evidence: selected,
    generated_answer: answer,
    extracted_claims: claims,
    claim_verifications: verifications,
    citation_validations: citations,
    triggered_rules: rules,
    risk_level: riskLevel,
    risk_reason: riskReason,
    recommended_next_step: nextStep,
    mode: isDemo ? 'demo' : 'ai_verified',
    verification_summary: {
      total: verifications.length,
      supported: verifications.filter(v => v.status === 'SUPPORTED').length,
      partially_supported: verifications.filter(v => v.status === 'PARTIALLY_SUPPORTED').length,
      unsupported: verifications.filter(v => v.status === 'UNSUPPORTED').length,
    },
  };

  console.log(`[Pipeline] Screening complete`);
  return result;
}

// ─── Chat Pipeline ────────────────────────────────────────────────────────

export async function runChatPipeline(
  query: string,
  jurisdiction: Jurisdiction,
  onTrace?: (event: TraceEvent) => void
): Promise<ScreeningResult> {
  const input: ParsedInput = {
    productName: query,
    ingredients: [],
    description: query,
    traditionalReference: 'unsure',
    innovationType: 'other',
    jurisdiction,
  };
  return runScreeningPipeline(input, onTrace);
}
