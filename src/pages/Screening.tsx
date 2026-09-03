import { useState, useCallback } from 'react';
import { useAppStore } from '../store';
import { runScreeningPipeline } from '../services/pipeline';
import { runVerificationTests } from '../services/verification';
import type { TraditionalReference, InnovationType } from '../types';
import {
  ChevronRight,
  ChevronLeft,
  Play,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const DEMO_SCENARIOS = {
  A: {
    productName: 'Triphala-Nano Hair Vitalizer',
    ingredients: ['Amla', 'Haritaki', 'Bibhitaki'],
    description: 'A nano-formulation hair vitalizer based on the traditional Triphala combination, enhanced with modern nano-delivery technology.',
    traditionalReference: 'modified' as TraditionalReference,
    innovationType: 'new_dosage' as InnovationType,
  },
  B: {
    productName: 'Modified Neem-Turmeric Formulation',
    ingredients: ['Neem', 'Turmeric'],
    description: 'A modified topical formulation combining neem and turmeric extracts with enhanced bioavailability.',
    traditionalReference: 'modified' as TraditionalReference,
    innovationType: 'new_process' as InnovationType,
  },
};

export function Screening() {
  const {
    jurisdiction,
    currentInput,
    setCurrentInput,
    currentResult,
    setCurrentResult,
    addScreeningResult,
    traceEvents,
    clearTrace,
    showTrace,
    setShowTrace,
    isProcessing,
    setIsProcessing,
    openEvidenceModal,
    setEscalationModalOpen,
  } = useAppStore();

  const [step, setStep] = useState(1);
  const [showResults, setShowResults] = useState(false);
  const [showTests, setShowTests] = useState(false);

  const loadScenario = (key: 'A' | 'B') => {
    const scenario = DEMO_SCENARIOS[key];
    setCurrentInput({
      ...scenario,
      jurisdiction,
    });
    setStep(1);
  };

  const handleRunScreening = useCallback(async () => {
    setIsProcessing(true);
    clearTrace();
    setShowResults(true);
    setStep(4); // Move to results view

    try {
      const input = { ...currentInput, jurisdiction };
      const result = await runScreeningPipeline(input, (event) => {
        // This is called by the pipeline to emit trace events
        useAppStore.getState().addTraceEvent(event);
      });
      setCurrentResult(result);
      addScreeningResult(result);
    } catch (err) {
      console.error('Screening failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [currentInput, jurisdiction, setIsProcessing, clearTrace, setCurrentResult, addScreeningResult]);

  const tests = runVerificationTests();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {!showResults && (
        <>
          {/* Demo Scenarios */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                Prototype Demonstration Scenarios
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => loadScenario('A')}
                className="px-4 py-2 bg-white border border-amber-300 rounded-lg text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                Scenario A: Triphala-Nano Hair Vitalizer
              </button>
              <button
                onClick={() => loadScenario('B')}
                className="px-4 py-2 bg-white border border-amber-300 rounded-lg text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                Scenario B: Modified Neem-Turmeric
              </button>
            </div>
          </div>

          {/* Wizard Steps */}
          <div className="bg-white rounded-xl border border-border">
            {/* Step indicator */}
            <div className="flex items-center gap-2 p-4 border-b border-border">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      step >= s
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {s}
                  </div>
                  <span
                    className={`text-xs ${
                      step === s ? 'text-primary font-medium' : 'text-text-secondary'
                    }`}
                  >
                    {s === 1 ? 'Formulation' : s === 2 ? 'Traditional Knowledge' : 'Innovation'}
                  </span>
                  {s < 3 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                </div>
              ))}
            </div>

            <div className="p-6">
              {/* Step 1: Formulation */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-text">
                    Step 1: Formulation Details
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={currentInput.productName}
                      onChange={(e) =>
                        setCurrentInput({ ...currentInput, productName: e.target.value })
                      }
                      placeholder="e.g., Triphala-Nano Hair Vitalizer"
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Ingredients (comma-separated) *
                    </label>
                    <input
                      type="text"
                      value={currentInput.ingredients.join(', ')}
                      onChange={(e) =>
                        setCurrentInput({
                          ...currentInput,
                          ingredients: e.target.value.split(',').map(s => s.trim()),
                        })
                      }
                      placeholder="e.g., Amla, Haritaki, Bibhitaki"
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={currentInput.description}
                      onChange={(e) =>
                        setCurrentInput({ ...currentInput, description: e.target.value })
                      }
                      placeholder="Describe your formulation..."
                      rows={3}
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Traditional Knowledge */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-text">
                    Step 2: Traditional Knowledge
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Is the formulation connected to a traditional formulation or
                    traditional knowledge?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: 'yes' as TraditionalReference, label: 'Yes', desc: 'Directly based on traditional knowledge' },
                      { value: 'modified' as TraditionalReference, label: 'Modified', desc: 'Modified from a traditional formulation' },
                      { value: 'no' as TraditionalReference, label: 'No known reference', desc: 'No traditional knowledge connection' },
                      { value: 'unsure' as TraditionalReference, label: 'Not sure', desc: 'Uncertain about TK connection' },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setCurrentInput({
                            ...currentInput,
                            traditionalReference: opt.value,
                          })
                        }
                        className={`p-4 border rounded-lg text-left transition-all cursor-pointer ${
                          currentInput.traditionalReference === opt.value
                            ? 'border-primary bg-blue-50 ring-1 ring-primary/20'
                            : 'border-border hover:border-gray-300'
                        }`}
                      >
                        <div className="text-sm font-medium text-text">{opt.label}</div>
                        <div className="text-xs text-text-secondary mt-0.5">
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Innovation */}
              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-text">
                    Step 3: Innovation Type
                  </h3>
                  <p className="text-sm text-text-secondary">
                    What is the main innovation?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: 'traditional_formulation' as InnovationType, label: 'Traditional formulation' },
                      { value: 'new_combination' as InnovationType, label: 'New combination' },
                      { value: 'new_dosage' as InnovationType, label: 'New dosage/formulation' },
                      { value: 'new_process' as InnovationType, label: 'New extraction/process' },
                      { value: 'new_composition' as InnovationType, label: 'New composition' },
                      { value: 'other' as InnovationType, label: 'Other' },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setCurrentInput({
                            ...currentInput,
                            innovationType: opt.value,
                          })
                        }
                        className={`p-3 border rounded-lg text-left text-sm font-medium transition-all cursor-pointer ${
                          currentInput.innovationType === opt.value
                            ? 'border-primary bg-blue-50 ring-1 ring-primary/20 text-primary'
                            : 'border-border hover:border-gray-300 text-text'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Jurisdiction display */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs text-text-secondary">Active Jurisdiction: </span>
                    <span className="text-sm font-medium text-text">
                      {jurisdiction === 'India' ? '🇮🇳' : '🌍'} {jurisdiction}
                    </span>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between mt-6 pt-4 border-t border-border">
                <button
                  onClick={() => setStep(Math.max(1, step - 1))}
                  disabled={step === 1}
                  className="flex items-center gap-1 px-4 py-2 text-sm text-text-secondary hover:text-text disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex gap-2">
                  {step < 3 ? (
                    <button
                      onClick={() => setStep(step + 1)}
                      disabled={
                        (step === 1 && !currentInput.productName) ||
                        (step === 1 && currentInput.ingredients.filter(Boolean).length === 0)
                      }
                      className="flex items-center gap-1 px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleRunScreening}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-6 py-2.5 bg-accent text-primary-dark rounded-lg text-sm font-semibold hover:bg-accent-light disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" /> Run Screening
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Results */}
      {showResults && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text">Screening Results</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowResults(false);
                  setStep(1);
                  setCurrentResult(null);
                  clearTrace();
                }}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                New Screening
              </button>
              {currentResult && (
                <>
                  <button
                    onClick={() => setEscalationModalOpen(true)}
                    className="px-4 py-2 text-sm bg-warning text-white rounded-lg hover:bg-warning/90 cursor-pointer"
                  >
                    Escalate to IP Expert
                  </button>
                </>
              )}
            </div>
          </div>

          {isProcessing && (
            <div className="bg-white rounded-xl border border-border p-8 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
              <p className="text-sm text-text-secondary">
                Running screening pipeline...
              </p>
              <p className="text-xs text-text-secondary mt-1">
                {traceEvents.length > 0
                  ? traceEvents[traceEvents.length - 1]?.label
                  : 'Initializing...'}
              </p>
            </div>
          )}

          {currentResult && !isProcessing && (
            <>
              {/* Risk Card */}
              <div
                className={`rounded-xl border-2 p-6 ${
                  currentResult.risk_level === 'LOWER_INITIAL_RISK'
                    ? 'bg-green-50 border-green-200'
                    : currentResult.risk_level === 'FURTHER_ASSESSMENT'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  {currentResult.risk_level === 'LOWER_INITIAL_RISK' ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : currentResult.risk_level === 'FURTHER_ASSESSMENT' ? (
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                  <h3 className="text-lg font-bold">
                    {currentResult.risk_level.replace(/_/g, ' ')}
                  </h3>
                </div>
                <p className="text-sm mb-3">{currentResult.risk_reason}</p>
                <div className="text-xs text-text-secondary italic">
                  These are preliminary screening labels only and do not constitute a patentability opinion.
                </div>
              </div>

              {/* Summary */}
              <div className="bg-white rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold text-text mb-3">
                  Screening Summary
                </h3>
                <div className="text-sm text-text leading-relaxed whitespace-pre-wrap">
                  {currentResult.generated_answer.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) {
                      return (
                        <h4 key={i} className="text-base font-semibold text-primary mt-4 mb-2">
                          {line.replace('## ', '')}
                        </h4>
                      );
                    }
                    if (line.startsWith('- **')) {
                      const parts = line.replace(/^- /, '').split('**');
                      return (
                        <div key={i} className="ml-4 mb-1 text-sm">
                          {parts.map((p, j) =>
                            j % 2 === 1 ? (
                              <strong key={j} className="text-text">{p}</strong>
                            ) : (
                              <span key={j}>{p}</span>
                            )
                          )}
                        </div>
                      );
                    }
                    if (line.startsWith('- ')) {
                      return (
                        <div key={i} className="ml-4 mb-1 text-sm text-text-secondary">
                          {line}
                        </div>
                      );
                    }
                    if (line.startsWith('---')) {
                      return <hr key={i} className="my-4 border-border" />;
                    }
                    if (line.startsWith('**Disclaimer')) {
                      return (
                        <div key={i} className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                          {line.replace(/\*\*/g, '')}
                        </div>
                      );
                    }
                    if (line.trim()) {
                      return (
                        <p key={i} className="mb-1 text-sm">
                          {line}
                        </p>
                      );
                    }
                    return <br key={i} />;
                  })}
                </div>
              </div>

              {/* Claim Verification */}
              <div className="bg-white rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold text-text mb-3">
                  Claim Verification Summary
                </h3>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-xl font-bold text-text">
                      {currentResult.verification_summary.total}
                    </div>
                    <div className="text-xs text-text-secondary">Total</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-600">
                      {currentResult.verification_summary.supported}
                    </div>
                    <div className="text-xs text-text-secondary">Supported</div>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                    <div className="text-xl font-bold text-amber-600">
                      {currentResult.verification_summary.partially_supported}
                    </div>
                    <div className="text-xs text-text-secondary">Partial</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-xl font-bold text-red-600">
                      {currentResult.verification_summary.unsupported}
                    </div>
                    <div className="text-xs text-text-secondary">Unsupported</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {currentResult.claim_verifications.map((v) => (
                    <div
                      key={v.claim_id}
                      className={`p-4 rounded-lg border ${
                        v.status === 'SUPPORTED'
                          ? 'bg-green-50 border-green-200'
                          : v.status === 'PARTIALLY_SUPPORTED'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-text">
                              Claim: {v.claim_text.substring(0, 100)}
                              {v.claim_text.length > 100 ? '...' : ''}
                            </span>
                          </div>
                          <div className="text-xs text-text-secondary mb-1">
                            Source: {v.source_name}, {v.provision}
                          </div>
                          <div className="text-xs text-text-secondary">
                            Evidence: {v.evidence_text.substring(0, 150)}...
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`text-xs font-bold ${
                              v.status === 'SUPPORTED'
                                ? 'text-green-600'
                                : v.status === 'PARTIALLY_SUPPORTED'
                                ? 'text-amber-600'
                                : 'text-red-600'
                            }`}
                          >
                            {v.status === 'SUPPORTED'
                              ? '✓ Supported'
                              : v.status === 'PARTIALLY_SUPPORTED'
                              ? '⚠ Partially Supported'
                              : '✕ Unsupported'}
                          </div>
                          <div className="text-xs text-text-secondary">
                            {(v.confidence * 100).toFixed(0)}% confidence
                          </div>
                          <div className="text-[10px] mt-0.5">
                            {v.method === 'openrouter' ? (
                              <span className="text-blue-600 font-medium">OpenRouter Verification</span>
                            ) : v.method === 'gemini' ? (
                              <span className="text-blue-600 font-medium">Gemini Verification</span>
                            ) : (
                              <span className="text-amber-600">Demo Verification — Local Fallback</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-text-secondary mt-2 italic">
                        Reason: {v.reason}
                      </div>
                      <button
                        onClick={() =>
                          openEvidenceModal({
                            evidence: currentResult.selected_evidence.find(
                              (e) => e.chunk.chunk_id === v.evidence_chunk_id
                            ) || currentResult.selected_evidence[0],
                            claim: v,
                          })
                        }
                        className="mt-2 flex items-center gap-1 text-xs text-primary hover:text-primary-light cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> View Full Evidence
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Step */}
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Recommended Next Step
                </h3>
                <p className="text-sm text-blue-800">
                  {currentResult.recommended_next_step}
                </p>
              </div>

              {/* Retrieved Evidence */}
              <div className="bg-white rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold text-text mb-3">
                  Retrieved Evidence ({currentResult.selected_evidence.length} items)
                </h3>
                <div className="space-y-3">
                  {currentResult.selected_evidence.slice(0, 6).map((e) => (
                    <div
                      key={e.chunk.chunk_id}
                      className="p-3 border border-border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => openEvidenceModal({ evidence: e })}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-primary">
                            {e.chunk.source_name}
                          </span>
                          <span className="text-xs text-text-secondary">
                            {e.chunk.provision}, p.{e.chunk.page_number}
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary">
                          Score: {e.finalScore.toFixed(4)}
                        </div>
                      </div>
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                        {e.chunk.actual_text.substring(0, 200)}...
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Retrieval Trace */}
              <div className="bg-white rounded-xl border border-border">
                <button
                  onClick={() => setShowTrace(!showTrace)}
                  className="w-full flex items-center justify-between p-4 cursor-pointer"
                >
                  <h3 className="text-lg font-semibold text-text">
                    Retrieval Trace ({traceEvents.length} stages)
                  </h3>
                  {showTrace ? (
                    <ChevronUp className="w-5 h-5 text-text-secondary" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-text-secondary" />
                  )}
                </button>
                {showTrace && (
                  <div className="border-t border-border p-4 space-y-3">
                    {traceEvents.map((event, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                            event.status === 'complete'
                              ? 'bg-green-100 text-green-600'
                              : event.status === 'running'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-text">
                            {event.label}
                          </div>
                          {event.data && (
                            <pre className="text-xs text-text-secondary mt-1 overflow-x-auto">
                              {JSON.stringify(event.data, null, 2)}
                            </pre>
                          )}
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            event.status === 'complete'
                              ? 'bg-green-100 text-green-700'
                              : event.status === 'running'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {event.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Verification Engine Tests */}
      <div className="bg-white rounded-xl border border-border">
        <button
          onClick={() => setShowTests(!showTests)}
          className="w-full flex items-center justify-between p-4 cursor-pointer"
        >
          <h3 className="text-sm font-semibold text-text">
            Verification Engine Test
          </h3>
          {showTests ? (
            <ChevronUp className="w-4 h-4 text-text-secondary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          )}
        </button>
        {showTests && (
          <div className="border-t border-border p-4 space-y-3">
            <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
              These are synthetic test cases to verify the verification engine. They do not present real legal evidence.
            </div>
            {tests.map((t) => (
              <div
                key={t.testId}
                className={`p-4 rounded-lg border ${
                  t.passed
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-text">{t.testId}: {t.description}</span>
                  <span
                    className={`text-xs font-bold ${
                      t.passed ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {t.passed ? '✓ PASSED' : '✕ FAILED'}
                  </span>
                </div>
                <div className="text-xs text-text-secondary">
                  Expected: <strong>{t.expected}</strong> | Actual: <strong>{t.actual}</strong>
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  Confidence: {(t.details.confidence * 100).toFixed(0)}% | Demo: {t.details.is_demo ? 'Yes' : 'No'}
                </div>
                <div className="text-xs text-text-secondary mt-1 italic">
                  {t.details.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
