import { create } from 'zustand';
import type {
  Jurisdiction,
  ScreeningResult,
  ChatMessage,
  EscalationRequest,
  ParsedInput,
  TraceEvent,
  RetrievedEvidence,
  ClaimVerificationResult,
} from '../types';

export interface AppState {
  // Global
  jurisdiction: Jurisdiction;
  setJurisdiction: (j: Jurisdiction) => void;
  currentScreen: string;
  setCurrentScreen: (s: string) => void;
  language: string;
  setLanguage: (l: string) => void;

  // Screening
  currentInput: ParsedInput;
  setCurrentInput: (input: ParsedInput) => void;
  screeningResults: ScreeningResult[];
  currentResult: ScreeningResult | null;
  setCurrentResult: (r: ScreeningResult | null) => void;
  addScreeningResult: (r: ScreeningResult) => void;

  // Trace
  traceEvents: TraceEvent[];
  addTraceEvent: (e: TraceEvent) => void;
  clearTrace: () => void;
  showTrace: boolean;
  setShowTrace: (show: boolean) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (m: ChatMessage) => void;
  clearChat: () => void;

  // Escalation
  escalationRequests: EscalationRequest[];
  addEscalationRequest: (r: EscalationRequest) => void;

  // Evidence modal
  evidenceModalOpen: boolean;
  evidenceModalData: {
    evidence: RetrievedEvidence;
    claim?: ClaimVerificationResult;
  } | null;
  openEvidenceModal: (data: { evidence: RetrievedEvidence; claim?: ClaimVerificationResult }) => void;
  closeEvidenceModal: () => void;

  // Escalation modal
  escalationModalOpen: boolean;
  setEscalationModalOpen: (open: boolean) => void;

  // Loading
  isProcessing: boolean;
  setIsProcessing: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  jurisdiction: 'India',
  setJurisdiction: (j) => set({ jurisdiction: j }),
  currentScreen: 'dashboard',
  setCurrentScreen: (s) => set({ currentScreen: s }),
  language: 'en',
  setLanguage: (l) => set({ language: l }),

  currentInput: {
    productName: '',
    ingredients: [],
    description: '',
    traditionalReference: 'unsure',
    innovationType: 'other',
    jurisdiction: 'India',
  },
  setCurrentInput: (input) => set({ currentInput: input }),
  screeningResults: [],
  currentResult: null,
  setCurrentResult: (r) => set({ currentResult: r }),
  addScreeningResult: (r) =>
    set((state) => ({ screeningResults: [...state.screeningResults, r] })),

  traceEvents: [],
  addTraceEvent: (e) =>
    set((state) => ({ traceEvents: [...state.traceEvents, e] })),
  clearTrace: () => set({ traceEvents: [] }),
  showTrace: false,
  setShowTrace: (show) => set({ showTrace: show }),

  chatMessages: [],
  addChatMessage: (m) =>
    set((state) => ({ chatMessages: [...state.chatMessages, m] })),
  clearChat: () => set({ chatMessages: [] }),

  escalationRequests: [],
  addEscalationRequest: (r) =>
    set((state) => ({ escalationRequests: [...state.escalationRequests, r] })),

  evidenceModalOpen: false,
  evidenceModalData: null,
  openEvidenceModal: (data) =>
    set({ evidenceModalOpen: true, evidenceModalData: data }),
  closeEvidenceModal: () =>
    set({ evidenceModalOpen: false, evidenceModalData: null }),

  escalationModalOpen: false,
  setEscalationModalOpen: (open) => set({ escalationModalOpen: open }),

  isProcessing: false,
  setIsProcessing: (loading) => set({ isProcessing: loading }),
}));
