/**
 * Claim Verification Service
 * Primary: OpenRouter LLM → Fallback: Gemini → Fallback: Local heuristic
 */

import type { ExtractedClaim, VerificationStatus, KnowledgeChunk } from '../types';
import type { RetrievedEvidence } from '../types';
import { isOpenRouterConfigured, isGeminiConfigured, chatCompletion } from './gemini';

export type VerificationMethod = 'openrouter' | 'gemini' | 'local_fallback';

export interface VerificationResult {
  status: VerificationStatus;
  confidence: number;
  reason: string;
  is_demo: boolean;
  method: VerificationMethod;
}

// ─── Main verification entry point ────────────────────────────────────────

export async function verifyClaimAgainstEvidence(
  claim: ExtractedClaim,
  evidence: RetrievedEvidence
): Promise<VerificationResult> {
  console.log(`[Verification] OpenRouter: ${isOpenRouterConfigured()}, Gemini: ${isGeminiConfigured()}`);

  // Try OpenRouter first
  if (isOpenRouterConfigured()) {
    try {
      console.log('[Verification] Trying OpenRouter...');
      return await verifyWithLLM(claim, evidence, 'openrouter');
    } catch (err) {
      console.warn('[Verification] OpenRouter failed, trying Gemini:', err);
    }
  }

  // Try Gemini fallback
  if (isGeminiConfigured()) {
    try {
      console.log('[Verification] Trying Gemini...');
      return await verifyWithLLM(claim, evidence, 'gemini');
    } catch (err) {
      console.warn('[Verification] Gemini failed, using local fallback:', err);
    }
  }

  return verifyLocal(claim, evidence);
}

// ─── LLM Verification ───────────────────────────────────────────────────

async function verifyWithLLM(
  claim: ExtractedClaim,
  evidence: RetrievedEvidence,
  method: 'openrouter' | 'gemini'
): Promise<VerificationResult> {
  const prompt = `You are an evidence verification system. Determine whether the supplied evidence supports the supplied claim.

CLAIM:
${claim.claim_text}

SOURCE:
${evidence.chunk.source_name}

PROVISION:
${evidence.chunk.provision}

PAGE:
${evidence.chunk.page_number}

EXACT EVIDENCE:
${evidence.chunk.actual_text.substring(0, 3000)}

Use ONLY the supplied evidence.
Do not use outside knowledge.
Do not infer facts not contained in the evidence.

Return exactly one of these three statuses: SUPPORTED, PARTIALLY_SUPPORTED, or UNSUPPORTED.

Then on a new line, provide:
confidence: <a number from 0 to 1>
reason: <a concise explanation of why you chose this status>

Format your response as:
STATUS: <SUPPORTED|PARTIALLY_SUPPORTED|UNSUPPORTED>
CONFIDENCE: <number>
REASON: <explanation>`;

  const response = await chatCompletion(prompt);

  // Parse the response
  const statusMatch = response.match(/STATUS:\s*(SUPPORTED|PARTIALLY_SUPPORTED|UNSUPPORTED)/i);
  const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
  const reasonMatch = response.match(/REASON:\s*(.+)/i);

  const status = statusMatch
    ? (statusMatch[1].toUpperCase() as VerificationStatus)
    : 'PARTIALLY_SUPPORTED';
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;
  const reason = reasonMatch ? reasonMatch[1].trim() : 'LLM verification completed.';

  return {
    status,
    confidence: Math.max(0, Math.min(1, confidence)),
    reason,
    is_demo: false,
    method,
  };
}

// ─── Local Fallback Verification ──────────────────────────────────────────

function verifyLocal(
  claim: ExtractedClaim,
  evidence: RetrievedEvidence
): VerificationResult {
  const claimText = claim.claim_text.toLowerCase();
  const evidenceText = evidence.chunk.actual_text.toLowerCase();

  // Extract meaningful terms from claim (skip short/common words)
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'must', 'this', 'that',
    'these', 'those', 'it', 'its', 'for', 'and', 'but', 'or', 'nor',
    'not', 'no', 'so', 'if', 'than', 'too', 'very', 'just', 'about',
    'also', 'from', 'with', 'such', 'only', 'other', 'into', 'over',
    'which', 'when', 'where', 'how', 'what', 'who', 'whom', 'whose',
  ]);

  const claimWords = claimText
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  // Count meaningful matches
  let matchCount = 0;
  const matchedTerms: string[] = [];
  for (const word of claimWords) {
    if (evidenceText.includes(word)) {
      matchCount++;
      matchedTerms.push(word);
    }
  }

  const coverage = claimWords.length > 0 ? matchCount / claimWords.length : 0;

  // Check for exact provision/section references
  const claimProvisions = claimText.match(/section\s+\d+\([a-z]\)|article\s+\d+|rule\s+\d+/g) ?? [];
  let provisionMatch = false;
  for (const prov of claimProvisions) {
    if (evidenceText.includes(prov)) {
      provisionMatch = true;
      break;
    }
  }

  let status: VerificationStatus;
  let confidence: number;
  let reason: string;

  if (coverage >= 0.6 && provisionMatch) {
    status = 'SUPPORTED';
    confidence = Math.min(0.6 + coverage * 0.35, 0.95);
    reason = `The supplied passage contains key terms from the claim (${matchedTerms.slice(0, 5).join(', ')}) and the claimed provision is found in the evidence.`;
  } else if (coverage >= 0.6) {
    status = 'SUPPORTED';
    confidence = Math.min(0.55 + coverage * 0.3, 0.9);
    reason = `The supplied passage strongly matches the claim with ${matchCount} of ${claimWords.length} key terms found (${matchedTerms.slice(0, 5).join(', ')}).`;
  } else if (coverage >= 0.35) {
    status = 'PARTIALLY_SUPPORTED';
    confidence = Math.min(0.35 + coverage * 0.35, 0.75);
    reason = `Some key terms from the claim appear in the evidence (${matchedTerms.slice(0, 5).join(', ')}), but the evidence does not fully address all aspects of the claim.`;
  } else {
    status = 'UNSUPPORTED';
    confidence = Math.min(0.5 + (1 - coverage) * 0.3, 0.85);
    reason = `The supplied evidence does not contain sufficient key terms to support the claim. Only ${matchCount} of ${claimWords.length} key terms were found.`;
  }

  return {
    status,
    confidence,
    reason,
    is_demo: true,
    method: 'local_fallback',
  };
}

// ─── Verification Engine Tests ────────────────────────────────────────────

export function runVerificationTests(): Array<{
  testId: string;
  description: string;
  expected: VerificationStatus;
  actual: VerificationStatus;
  passed: boolean;
  details: VerificationResult;
}> {
  const tests = [
    {
      testId: 'TEST_A',
      description: 'Evidence directly supports the claim (Patents Act Section 3(p))',
      claim: {
        claim_id: 'test_a',
        claim_text: 'Section 3(p) of the Patents Act, 1970 excludes inventions that are traditional knowledge or aggregation of known properties of traditionally known components from patentability.',
        citation: 'Patents Act, 1970, Section 3, p.3',
        source_id: 'PA1970',
        evidence_chunk_id: 'PA1970-0003',
      },
      evidence: {
        chunk_id: 'PA1970-0003',
        document_id: 'PA1970',
        source_name: 'Patents Act, 1970',
        document_title: 'The Patents Act, 1970 (as amended)',
        source_type: 'Statute',
        jurisdiction: 'India',
        provision: 'General',
        page_number: '3',
        actual_text: 'Chapter II INVENTIONS NOT PATENTABLE 3. What are not inventions.—The following are not inventions within the meaning of this Act,— ... (p)an invention which in effect, is traditional knowledge or which is an aggregation or duplication of known properties of traditionally known component or components.',
        source_url: 'https://ipindia.gov.in/patents.htm',
        source_status: 'Actual Source Document',
        keywords: ['Traditional Knowledge', 'Patent', 'Non-Patentability'],
        char_count: 3139,
      },
      expected: 'SUPPORTED' as VerificationStatus,
    },
    {
      testId: 'TEST_B',
      description: 'Evidence partially supports claim (Biological Diversity Act related)',
      claim: {
        claim_id: 'test_b',
        claim_text: 'The Biological Diversity Act, 2002 requires prior informed consent and benefit sharing for commercial utilization of biological resources in India.',
        citation: 'Biological Diversity Act, 2002, Section 3, p.1',
        source_id: 'BDA2002',
        evidence_chunk_id: 'BDA2002-0001',
      },
      evidence: {
        chunk_id: 'BDA2002-0001',
        document_id: 'BDA002',
        source_name: 'Biological Diversity Act, 2002',
        document_title: 'The Biological Diversity Act, 2002',
        source_type: 'Statute',
        jurisdiction: 'India',
        provision: 'Section 3(ii)',
        page_number: '1',
        actual_text: 'An Act to provide for conservation of biological diversity, sustainable use of its components and fair and equitable sharing of the benefits arising out of the use of biological resources. ... Whereas it is considered necessary to provide for conservation, sustainable utilisation and equitable sharing of the benefits arising out of utilisation of genetic resources.',
        source_url: 'https://biodiversityindia.org/',
        source_status: 'Actual Source Document',
        keywords: ['Biological Diversity', 'benefit sharing'],
        char_count: 3000,
      },
      expected: 'PARTIALLY_SUPPORTED' as VerificationStatus,
    },
    {
      testId: 'TEST_C',
      description: 'Evidence does not support the claim (unrelated passage)',
      claim: {
        claim_id: 'test_c',
        claim_text: 'Patent filing fees in India are exempted for traditional medicine practitioners under Section 153 of the Patents Act.',
        citation: 'Patent Rules, 2003, Rule 15, p.1',
        source_id: 'PR2003',
        evidence_chunk_id: 'PR2003-0001',
      },
      evidence: {
        chunk_id: 'PA1970-0006',
        document_id: 'PA1970',
        source_name: 'Patents Act, 1970',
        document_title: 'The Patents Act, 1970 (as amended)',
        source_type: 'Statute',
        jurisdiction: 'India',
        provision: 'General',
        page_number: '6',
        actual_text: '10. Contents of specifications.—(1) Every specification, whether provisional of complete, shall describe the invention and shall begin with a title sufficiently indicating the subject-matter to which the invention relates.',
        source_url: 'https://ipindia.gov.in/patents.htm',
        source_status: 'Actual Source Document',
        keywords: ['Patent', 'specification'],
        char_count: 4024,
      },
      expected: 'UNSUPPORTED' as VerificationStatus,
    },
  ];

  return tests.map(test => {
    const wrappedEvidence: RetrievedEvidence = {
      chunk: test.evidence as unknown as KnowledgeChunk,
      bm25Score: 0,
      semanticScore: 0,
      finalScore: 0.5,
      rank: 1,
    };
    const result = verifyLocal(test.claim, wrappedEvidence);
    return {
      testId: test.testId,
      description: test.description,
      expected: test.expected,
      actual: result.status,
      passed: result.status === test.expected,
      details: result,
    };
  });
}
