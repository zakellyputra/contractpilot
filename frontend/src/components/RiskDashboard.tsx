"use client";

import { useState } from "react";
import RiskScoreGauge from "./RiskScoreGauge";
import RiskBreakdownChart from "./RiskBreakdownChart";
import SummaryPanel from "./SummaryPanel";
import ClauseCard from "./ClauseCard";
import RiskTimeline from "./RiskTimeline";
import ActionItems from "./ActionItems";
import { generateReport } from "@/lib/report";

interface Clause {
  _id: string;
  clauseType?: string;
  riskLevel: string;
  riskCategory: string;
  explanation: string;
  concern?: string;
  suggestion?: string;
  k2Reasoning?: string;
  parentHeading?: string;
  subClauseIndex?: number;
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
  keyDates?: { date: string; label: string; type: string }[];
  status: string;
}

interface RiskDashboardProps {
  review: Review;
  clauses: Clause[];
}

export default function RiskDashboard({ review, clauses }: RiskDashboardProps) {
  const [generating, setGenerating] = useState(false);

  function handleDownload() {
    setGenerating(true);
    try {
      generateReport(review, clauses);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <SummaryPanel
        summary={review.summary || "Analysis in progress..."}
        contractType={review.contractType || "Contract"}
        filename={review.filename}
      />

      {/* Risk overview: gauge + breakdown side by side */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex items-center justify-center">
          <RiskScoreGauge score={review.riskScore ?? 0} />
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <RiskBreakdownChart
            financial={review.financialRisk ?? 0}
            compliance={review.complianceRisk ?? 0}
            operational={review.operationalRisk ?? 0}
            reputational={review.reputationalRisk ?? 0}
          />
        </div>
      </div>

      {/* Action items + Timeline side by side */}
      {((review.actionItems && review.actionItems.length > 0) ||
        (review.keyDates && review.keyDates.length > 0)) && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <ActionItems items={review.actionItems || []} />
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <RiskTimeline keyDates={review.keyDates || []} />
          </div>
        </div>
      )}

      {/* Clause cards */}
      {clauses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Clause Analysis ({clauses.length} clauses)
          </h3>
          <div className="space-y-3">
            {clauses.map((clause) => (
              <ClauseCard
                key={clause._id}
                clauseType={clause.clauseType || "Clause"}
                riskLevel={clause.riskLevel}
                riskCategory={clause.riskCategory}
                explanation={clause.explanation}
                concern={clause.concern}
                suggestion={clause.suggestion}
                k2Reasoning={clause.k2Reasoning}
              />
            ))}
          </div>
        </div>
      )}

      {/* Download PDF */}
      <div className="flex justify-center">
        <button
          onClick={handleDownload}
          disabled={generating}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {generating ? "Generating..." : "Download PDF Report"}
        </button>
      </div>
    </div>
  );
}
