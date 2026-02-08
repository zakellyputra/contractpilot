"use client";

import RiskScoreGauge from "./RiskScoreGauge";
import RiskBreakdownChart from "./RiskBreakdownChart";
import SummaryPanel from "./SummaryPanel";
import ActionItems from "./ActionItems";
import { getReportUrl } from "@/lib/api";

interface Clause {
  _id: string;
  clauseType?: string;
  riskLevel: string;
  riskCategory: string;
  explanation: string;
  concern?: string;
  suggestion?: string;
}

interface Review {
  _id: string;
  filename: string;
  contractType?: string;
  summary?: string;
  riskScore?: number;
  financialRisk?: number;
  complianceRisk?: number;
  operationalRisk?: number;
  reputationalRisk?: number;
  actionItems?: string[];
  status: string;
}

interface QuickSummaryViewProps {
  review: Review;
  clauses: Clause[];
  totalClauseCount?: number;
}

const RISK_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-green-100 text-green-700",
};

export default function QuickSummaryView({ review, clauses, totalClauseCount }: QuickSummaryViewProps) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <SummaryPanel
        summary={review.summary || "Analysis in progress..."}
        contractType={review.contractType || "Contract"}
        filename={review.filename}
      />

      {/* Risk overview: gauge + breakdown side by side */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-center">
          <RiskScoreGauge score={review.riskScore ?? 0} />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <RiskBreakdownChart
            financial={review.financialRisk ?? 0}
            compliance={review.complianceRisk ?? 0}
            operational={review.operationalRisk ?? 0}
            reputational={review.reputationalRisk ?? 0}
          />
        </div>
      </div>

      {/* Top clauses — condensed cards */}
      {clauses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Top Findings ({clauses.length}{totalClauseCount ? ` of ${totalClauseCount}` : ""})
          </h3>
          <div className="space-y-2">
            {clauses.map((clause) => (
              <div
                key={clause._id}
                className="bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-medium text-sm text-gray-900">
                    {clause.clauseType || "Clause"}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      RISK_BADGE[clause.riskLevel] || RISK_BADGE.medium
                    }`}
                  >
                    {clause.riskLevel}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {clause.explanation}
                </p>
                {clause.suggestion && (
                  <p className="text-xs text-blue-600 mt-1.5">
                    <span className="font-medium">Action:</span> {clause.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action items */}
      {review.actionItems && review.actionItems.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <ActionItems items={review.actionItems} />
        </div>
      )}

      {/* Download PDF */}
      <div className="flex justify-center">
        <a
          href={getReportUrl(review._id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Download PDF Report
        </a>
      </div>
    </div>
  );
}
