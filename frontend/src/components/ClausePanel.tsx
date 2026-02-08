"use client";

interface ClauseData {
  _id: string;
  clauseType?: string;
  clauseText?: string;
  riskLevel: string;
  riskCategory: string;
  explanation: string;
  concern?: string;
  suggestion?: string;
  k2Reasoning?: string;
  pageNumber?: number;
}

interface ClausePanelProps {
  clauses: ClauseData[];
  activeClauseId: string | null;
}

const RISK_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

const CATEGORY_BADGE: Record<string, string> = {
  financial: "bg-red-50 text-red-600",
  compliance: "bg-amber-50 text-amber-600",
  operational: "bg-blue-50 text-blue-600",
  reputational: "bg-purple-50 text-purple-600",
};

export default function ClausePanel({ clauses, activeClauseId }: ClausePanelProps) {
  const clause = clauses.find((c) => c._id === activeClauseId);

  // Empty state
  if (!clause) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <svg
          className="w-12 h-12 text-gray-300 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
          />
        </svg>
        <p className="text-gray-400 text-sm font-medium">
          Hover over a highlighted clause in the PDF to view its analysis
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm text-gray-900 truncate max-w-[240px]">
          {clause.clauseType || "Clause"}
        </span>
        <span
          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
            RISK_BADGE[clause.riskLevel] || RISK_BADGE.medium
          }`}
        >
          {clause.riskLevel}
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            CATEGORY_BADGE[clause.riskCategory] || CATEGORY_BADGE.operational
          }`}
        >
          {clause.riskCategory}
        </span>
        {clause.pageNumber !== undefined && (
          <span className="text-[10px] text-gray-400 ml-auto">
            p.{clause.pageNumber + 1}
          </span>
        )}
      </div>

      {/* Explanation */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Explanation
        </h4>
        <p className="text-sm text-gray-700 leading-relaxed">{clause.explanation}</p>
      </div>

      {/* Concern */}
      {clause.concern && (
        <details className="text-xs text-amber-700 bg-amber-50 rounded-lg border border-amber-100">
          <summary className="px-3 py-2 cursor-pointer font-semibold hover:text-amber-800">
            Watch out
          </summary>
          <p className="px-3 pb-2 leading-relaxed">{clause.concern}</p>
        </details>
      )}

      {/* Suggestion */}
      {clause.suggestion && (
        <details className="text-xs text-blue-700 bg-blue-50 rounded-lg border border-blue-100">
          <summary className="px-3 py-2 cursor-pointer font-semibold hover:text-blue-800">
            Suggestion
          </summary>
          <p className="px-3 pb-2 leading-relaxed">{clause.suggestion}</p>
        </details>
      )}

      {/* K2 Reasoning (collapsible) */}
      {clause.k2Reasoning && (
        <details className="text-xs text-gray-600 bg-gray-50 rounded-lg border border-gray-100">
          <summary className="px-3 py-2 cursor-pointer font-semibold text-gray-500 hover:text-gray-700">
            Advanced Analysis
          </summary>
          <p className="px-3 pb-2 leading-relaxed">{clause.k2Reasoning}</p>
        </details>
      )}
    </div>
  );
}
