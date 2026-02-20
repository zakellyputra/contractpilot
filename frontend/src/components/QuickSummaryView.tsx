"use client";

import { useState } from "react";
import { motion } from "motion/react";
import RiskScoreGauge from "./RiskScoreGauge";
import RiskBreakdownChart from "./RiskBreakdownChart";
import SummaryPanel from "./SummaryPanel";
import ActionItems from "./ActionItems";
import PaywallBlur from "./PaywallBlur";
import { generateReport } from "@/lib/report";
import { fadeUp, staggerContainer } from "@/lib/motion";

interface Clause {
  _id: string;
  clauseType?: string;
  riskLevel: string;
  riskCategory: string;
  explanation: string;
  concern?: string;
  suggestion?: string;
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

interface QuickSummaryViewProps {
  review: Review;
  clauses: Clause[];
  allClauses?: Clause[];
  totalClauseCount?: number;
  reviewId?: string;
  unlocked?: boolean;
}

const RISK_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export default function QuickSummaryView({ review, clauses, allClauses, totalClauseCount, reviewId, unlocked }: QuickSummaryViewProps) {
  const [generating, setGenerating] = useState(false);
  const hasGatedContent = clauses.length > 1 || (review.actionItems && review.actionItems.length > 0);

  function handleDownload() {
    setGenerating(true);
    try {
      generateReport(review, allClauses ?? clauses);
    } finally {
      setGenerating(false);
    }
  }

  function renderClauseCard(clause: Clause) {
    return (
      <motion.div
        key={clause._id}
        whileHover={{ y: -2 }}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
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
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {clause.explanation}
        </p>
        {clause.suggestion && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
            <span className="font-medium">Action:</span> {clause.suggestion}
          </p>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="visible">
      {/* Summary */}
      <motion.div variants={fadeUp}>
      <SummaryPanel
        summary={review.summary || "Analysis in progress..."}
        contractType={review.contractType || "Contract"}
        filename={review.filename}
      />
      </motion.div>

      {/* Risk overview: gauge + breakdown side by side */}
      <motion.div variants={fadeUp} className="grid md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex items-center justify-center">
          <RiskScoreGauge score={review.riskScore ?? 0} />
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <RiskBreakdownChart
            financial={review.financialRisk ?? 0}
            compliance={review.complianceRisk ?? 0}
            operational={review.operationalRisk ?? 0}
            reputational={review.reputationalRisk ?? 0}
          />
        </div>
      </motion.div>

      {/* Top clauses */}
      {clauses.length > 0 && (
        <motion.div variants={fadeUp}>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Top Findings ({clauses.length}{totalClauseCount ? ` of ${totalClauseCount}` : ""})
          </h3>

          {/* 1st finding — always visible */}
          <div className="space-y-2">
            {clauses[0] && renderClauseCard(clauses[0])}
          </div>

          {/* Remaining findings + action items — single gated section */}
          {hasGatedContent && (
            <div className="mt-2">
              <PaywallBlur featureLabel="Full Analysis" reviewId={reviewId} unlocked={unlocked}>
                <div className="space-y-2">
                  {clauses.slice(1).map((clause) => renderClauseCard(clause))}
                </div>
                {review.actionItems && review.actionItems.length > 0 && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mt-4">
                    <ActionItems items={review.actionItems} />
                  </div>
                )}
              </PaywallBlur>
            </div>
          )}
        </motion.div>
      )}

      {/* Action items (only if no clauses to gate with) */}
      {clauses.length <= 1 && review.actionItems && review.actionItems.length > 0 && (
        <PaywallBlur featureLabel="Action Items" reviewId={reviewId} unlocked={unlocked}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <ActionItems items={review.actionItems} />
          </div>
        </PaywallBlur>
      )}

      {/* Download PDF */}
      <div className="flex justify-center">
        <button
          onClick={handleDownload}
          disabled={generating}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          {generating ? "Generating..." : "Download PDF Report"}
        </button>
      </div>
    </motion.div>
  );
}
