import { useAppStore } from '../../store';
import { X, ExternalLink, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export function EvidenceModal() {
  const { evidenceModalOpen, evidenceModalData, closeEvidenceModal } =
    useAppStore();

  if (!evidenceModalOpen || !evidenceModalData) return null;

  const { evidence, claim } = evidenceModalData;
  const chunk = evidence.chunk;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={closeEvidenceModal}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-bold text-text">Evidence Detail</h3>
          <button
            onClick={closeEvidenceModal}
            className="p-1 hover:bg-gray-100 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Source Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-[10px] text-text-secondary uppercase font-medium mb-0.5">
                Source Name
              </div>
              <div className="text-sm font-semibold text-text">
                {chunk.source_name}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-[10px] text-text-secondary uppercase font-medium mb-0.5">
                Document Title
              </div>
              <div className="text-sm text-text leading-tight">
                {chunk.document_title}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-[10px] text-text-secondary uppercase font-medium mb-0.5">
                Provision / Section
              </div>
              <div className="text-sm text-text">{chunk.provision}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-[10px] text-text-secondary uppercase font-medium mb-0.5">
                Page
              </div>
              <div className="text-sm text-text">{chunk.page_number}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-[10px] text-text-secondary uppercase font-medium mb-0.5">
                Source Type
              </div>
              <div className="text-sm text-text">{chunk.source_type}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-[10px] text-text-secondary uppercase font-medium mb-0.5">
                Jurisdiction
              </div>
              <div className="text-sm text-text">{chunk.jurisdiction}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-[10px] text-text-secondary uppercase font-medium mb-0.5">
                Source Status
              </div>
              <div className="text-sm text-text">{chunk.source_status}</div>
            </div>
            {chunk.source_url && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-[10px] text-text-secondary uppercase font-medium mb-0.5">
                  Source URL
                </div>
                <a
                  href={chunk.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:text-primary-light flex items-center gap-1"
                >
                  View Source <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Exact Source Passage */}
          <div>
            <h4 className="text-xs font-bold text-text uppercase mb-2">
              Exact Source Passage
            </h4>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-text leading-relaxed max-h-48 overflow-auto">
              {chunk.actual_text}
            </div>
          </div>

          {/* AI Claim (if available) */}
          {claim && (
            <>
              <div>
                <h4 className="text-xs font-bold text-text uppercase mb-2">
                  AI Claim
                </h4>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm text-text">
                  {claim.claim_text}
                </div>
              </div>

              {/* Verification Result */}
              <div>
                <h4 className="text-xs font-bold text-text uppercase mb-2">
                  Verification Result
                </h4>
                <div
                  className={`p-4 rounded-lg border ${
                    claim.status === 'SUPPORTED'
                      ? 'bg-green-50 border-green-200'
                      : claim.status === 'PARTIALLY_SUPPORTED'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {claim.status === 'SUPPORTED' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : claim.status === 'PARTIALLY_SUPPORTED' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span
                      className={`text-sm font-bold ${
                        claim.status === 'SUPPORTED'
                          ? 'text-green-600'
                          : claim.status === 'PARTIALLY_SUPPORTED'
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {claim.status === 'SUPPORTED'
                        ? '✓ Citation Verified'
                        : claim.status === 'PARTIALLY_SUPPORTED'
                        ? '⚠ Partially Supported'
                        : '✕ Unsupported'}
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary mb-1">
                    Confidence: {(claim.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-text-secondary italic">
                    Reason: {claim.reason}
                  </div>
                  <div className="text-[10px] mt-2 font-medium">
                    {claim.method === 'openrouter' ? (
                      <span className="text-blue-600">OpenRouter Verification</span>
                    ) : claim.method === 'gemini' ? (
                      <span className="text-blue-600">Gemini Verification</span>
                    ) : (
                      <span className="text-amber-600">Demo Verification — Local Fallback</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Visual Flow */}
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="px-3 py-1.5 bg-purple-100 rounded-lg text-xs font-medium text-purple-700">
                  AI Claim
                </div>
                <div className="text-text-secondary">↓</div>
                <div className="px-3 py-1.5 bg-blue-100 rounded-lg text-xs font-medium text-blue-700">
                  Exact Source Evidence
                </div>
                <div className="text-text-secondary">↓</div>
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    claim.status === 'SUPPORTED'
                      ? 'bg-green-100 text-green-700'
                      : claim.status === 'PARTIALLY_SUPPORTED'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {claim.status.replace(/_/g, ' ')}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
