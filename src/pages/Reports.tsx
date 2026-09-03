import { useAppStore } from '../store';
import { downloadReport } from '../services/report';
import { FileText, Download, AlertTriangle, Clock } from 'lucide-react';

export function Reports() {
  const { screeningResults } = useAppStore();

  const handleDownload = (result: typeof screeningResults[0]) => {
    downloadReport(result);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">Screening Reports</h2>
        <p className="text-xs text-text-secondary mt-1">
          View and download preliminary IP/TK screening reports generated from completed sessions.
        </p>
      </div>

      {screeningResults.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            No screening reports yet. Complete a screening to generate a report.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {screeningResults.map((result) => (
            <div
              key={result.session_id}
              className="bg-white rounded-xl border border-border p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-text">
                      {result.parsed_input.productName}
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        result.risk_level === 'LOWER_INITIAL_RISK'
                          ? 'bg-green-100 text-green-700'
                          : result.risk_level === 'FURTHER_ASSESSMENT'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {result.risk_level.replace(/_/g, ' ')}
                    </span>
                    {result.mode === 'demo' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                        Demo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-secondary mb-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(result.timestamp).toLocaleString()}
                    </span>
                    <span>{result.jurisdiction_route}</span>
                    <span>{result.parsed_input.ingredients.join(', ')}</span>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2">
                    {result.risk_reason}
                  </p>

                  {/* Verification summary */}
                  <div className="flex gap-3 mt-2">
                    <span className="text-[10px] text-green-600">
                      ✓ {result.verification_summary.supported} supported
                    </span>
                    <span className="text-[10px] text-amber-600">
                      ⚠ {result.verification_summary.partially_supported} partial
                    </span>
                    <span className="text-[10px] text-red-600">
                      ✕ {result.verification_summary.unsupported} unsupported
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(result)}
                    className="flex items-center gap-1 px-3 py-2 text-xs border border-border rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Download
                  </button>
                </div>
              </div>

              {/* Escalation status */}
              {result.escalation_request && (
                <div className="mt-3 p-2 bg-purple-50 rounded-lg text-xs text-purple-800">
                  Expert Review: {result.escalation_request.status} —{' '}
                  {result.escalation_request.reason.replace(/_/g, ' ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Disclaimer:</strong> These reports provide preliminary IP/TK
            screening assistance only. They do not constitute legal advice or a
            patentability opinion. Consult a qualified IP professional for final
            legal assessment.
          </div>
        </div>
      </div>
    </div>
  );
}
