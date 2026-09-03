import { useState } from 'react';
import { useAppStore } from '../../store';
import type { EscalationReason } from '../../types';
import { X, Send, CheckCircle } from 'lucide-react';

const reasons: { value: EscalationReason; label: string; desc: string }[] = [
  {
    value: 'traditional_knowledge_overlap',
    label: 'Traditional Knowledge overlap',
    desc: 'Concerns about TK overlap with existing knowledge',
  },
  {
    value: 'legal_interpretation',
    label: 'Legal interpretation',
    desc: 'Need expert interpretation of legal provisions',
  },
  {
    value: 'filing_decision',
    label: 'Filing decision',
    desc: 'Decision needed on whether to proceed with filing',
  },
  {
    value: 'other',
    label: 'Other',
    desc: 'Other reason requiring expert review',
  },
];

export function EscalationModal() {
  const {
    escalationModalOpen,
    setEscalationModalOpen,
    currentResult,
    addEscalationRequest,
  } = useAppStore();

  const [selectedReason, setSelectedReason] =
    useState<EscalationReason>('traditional_knowledge_overlap');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!escalationModalOpen) return null;

  const handleSubmit = () => {
    if (!currentResult) return;

    addEscalationRequest({
      id: `esc_${Date.now()}`,
      timestamp: new Date().toISOString(),
      session_id: currentResult.session_id,
      reason: selectedReason,
      notes,
      status: 'pending',
    });

    setSubmitted(true);
    setTimeout(() => {
      setEscalationModalOpen(false);
      setSubmitted(false);
      setNotes('');
      setSelectedReason('traditional_knowledge_overlap');
    }, 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => setEscalationModalOpen(false)}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-bold text-text">
            Escalate to IP Expert
          </h3>
          <button
            onClick={() => setEscalationModalOpen(false)}
            className="p-1 hover:bg-gray-100 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
            <p className="text-lg font-semibold text-text">
              Review request created.
            </p>
            <p className="text-sm text-text-secondary mt-1">
              An IP expert will review your screening results.
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Reason for escalation
              </label>
              <div className="space-y-2">
                {reasons.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setSelectedReason(r.value)}
                    className={`w-full p-3 border rounded-lg text-left transition-all cursor-pointer ${
                      selectedReason === r.value
                        ? 'border-primary bg-blue-50 ring-1 ring-primary/20'
                        : 'border-border hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-medium text-text">{r.label}</div>
                    <div className="text-xs text-text-secondary">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Additional notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe any specific concerns or questions..."
                rows={3}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
            </div>

            {currentResult && (
              <div className="p-3 bg-gray-50 rounded-lg text-xs text-text-secondary">
                <strong>Session:</strong> {currentResult.session_id}
                <br />
                <strong>Product:</strong> {currentResult.parsed_input.productName}
                <br />
                <strong>Risk:</strong> {currentResult.risk_level.replace(/_/g, ' ')}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!currentResult}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" /> Create Review Request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
