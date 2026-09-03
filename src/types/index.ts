// Core TypeScript types for IP-SAKTI SAHAYAK

export interface KnowledgeChunk {
  chunk_id: string;
  document_id: string;
  source_name: string;
  document_title: string;
  source_type: SourceType;
  jurisdiction: Jurisdiction;
  provision: string;
  page_number: string;
  actual_text: string;
  source_url: string;
  source_status: string;
  keywords: string[];
  char_count: number;
}

export type SourceType = 'Statute' | 'Treaty' | 'Guideline' | 'Pharmacopoeia' | 'Case' | 'Reference';
export type Jurisdiction = 'India' | 'Global';
export type RiskLevel = 'LOWER_INITIAL_RISK' | 'FURTHER_ASSESSMENT' | 'REVIEW_REQUIRED';
export type VerificationStatus = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'UNSUPPORTED' | 'PENDING' | 'DEMO';
export type TraditionalReference = 'yes' | 'modified' | 'no' | 'unsure';
export type InnovationType =
  | 'traditional_formulation'
  | 'new_combination'
  | 'new_dosage'
  | 'new_process'
  | 'new_composition'
  | 'other';

export interface ParsedInput {
  productName: string;
  ingredients: string[];
  description: string;
  traditionalReference: TraditionalReference;
  innovationType: InnovationType;
  jurisdiction: Jurisdiction;
}

export interface RetrievedEvidence {
  chunk: KnowledgeChunk;
  bm25Score: number;
  semanticScore: number;
  finalScore: number;
  rank: number;
}

export interface ExtractedClaim {
  claim_id: string;
  claim_text: string;
  citation: string;
  source_id: string;
  evidence_chunk_id: string;
}

export interface ClaimVerificationResult {
  claim_id: string;
  claim_text: string;
  evidence_chunk_id: string;
  evidence_text: string;
  source_name: string;
  provision: string;
  status: VerificationStatus;
  confidence: number;
  reason: string;
  is_demo: boolean;
  method?: 'openrouter' | 'gemini' | 'local_fallback';
}

export interface CitationValidation {
  claim_id: string;
  source_exists: boolean;
  provision_exists: boolean;
  chunk_exists: boolean;
  chunk_belongs_to_source: boolean;
  citation_points_to_correct_evidence: boolean;
  verification_result_available: boolean;
  final_status: 'VERIFIED' | 'PARTIALLY_SUPPORTED' | 'UNSUPPORTED' | 'INVALID';
}

export interface ScreeningRule {
  rule_id: string;
  name: string;
  description: string;
  triggered: boolean;
  risk_contribution: 'low' | 'medium' | 'high';
}

export interface ScreeningResult {
  session_id: string;
  timestamp: string;
  parsed_input: ParsedInput;
  jurisdiction_route: Jurisdiction;
  bm25_results: RetrievedEvidence[];
  semantic_results: RetrievedEvidence[];
  reranked_evidence: RetrievedEvidence[];
  selected_evidence: RetrievedEvidence[];
  generated_answer: string;
  extracted_claims: ExtractedClaim[];
  claim_verifications: ClaimVerificationResult[];
  citation_validations: CitationValidation[];
  triggered_rules: ScreeningRule[];
  risk_level: RiskLevel;
  risk_reason: string;
  recommended_next_step: string;
  escalation_request?: EscalationRequest;
  mode: 'demo' | 'ai_verified';
  verification_summary: {
    total: number;
    supported: number;
    partially_supported: number;
    unsupported: number;
  };
}

export interface EscalationRequest {
  id: string;
  timestamp: string;
  session_id: string;
  reason: EscalationReason;
  notes: string;
  status: 'pending' | 'in_review' | 'resolved';
}

export type EscalationReason =
  | 'traditional_knowledge_overlap'
  | 'legal_interpretation'
  | 'filing_decision'
  | 'other';

export interface TraceEvent {
  stage: string;
  label: string;
  status: 'running' | 'complete' | 'error';
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface KnowledgeBaseMetadata {
  generated_at: string;
  extraction_method: string;
  total_chunks: number;
  total_documents: number;
  documents: DocumentSummary[];
}

export interface DocumentSummary {
  document_id: string;
  source_name: string;
  source_type: SourceType;
  jurisdiction: Jurisdiction;
  source_url: string;
  total_pages: number;
  total_chunks: number;
  source_status: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  evidence?: RetrievedEvidence[];
  claims?: ClaimVerificationResult[];
  jurisdiction?: Jurisdiction;
}
