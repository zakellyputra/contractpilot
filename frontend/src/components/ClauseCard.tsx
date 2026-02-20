"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { expandCollapse } from "@/lib/motion";

interface ClauseCardProps {
  clauseType: string;
  riskLevel: string;
  riskCategory: string;
  explanation: string;
  concern?: string;
  suggestion?: string;
  k2Reasoning?: string;
}

const riskColors: Record<string, { bg: string; text: string; border: string }> = {
  high: { bg: "bg-red-50 dark:bg-red-950", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
  medium: { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
  low: { bg: "bg-green-50 dark:bg-green-950", text: "text-green-700 dark:text-green-400", border: "border-green-200 dark:border-green-800" },
};

const categoryColors: Record<string, string> = {
  financial: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  compliance: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  operational: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  reputational: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

export default function ClauseCard({
  clauseType,
  riskLevel,
  riskCategory,
  explanation,
  concern,
  suggestion,
  k2Reasoning,
}: ClauseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const risk = riskColors[riskLevel] || riskColors.medium;
  const catClass = categoryColors[riskCategory] || categoryColors.operational;

  return (
    <div className={`border rounded-xl p-5 ${risk.border} ${risk.bg}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{clauseType}</h4>
        <div className="flex gap-2 shrink-0">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${catClass}`}>
            {riskCategory}
          </span>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${risk.text}`}
            style={{
              backgroundColor:
                riskLevel === "high"
                  ? "#fecaca"
                  : riskLevel === "medium"
                    ? "#fde68a"
                    : "#bbf7d0",
            }}
          >
            {riskLevel.toUpperCase()}
          </span>
        </div>
      </div>

      <p className="text-gray-700 dark:text-gray-300 mb-2">
        <span className="font-medium">What this means: </span>
        {explanation}
      </p>

      {concern && (
        <p className="text-red-700 dark:text-red-400 mb-2">
          <span className="font-medium">Watch out: </span>
          {concern}
        </p>
      )}

      {suggestion && (
        <p className="text-green-700 dark:text-green-400 mb-2">
          <span className="font-medium">Suggestion: </span>
          {suggestion}
        </p>
      )}

      {k2Reasoning && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1"
          >
            {expanded ? "Hide" : "Show"} Deep Analysis
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="deep-analysis"
                variants={expandCollapse}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
              >
                <div className="mt-2 p-3 bg-white/70 dark:bg-gray-800/70 rounded-lg text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                  {k2Reasoning}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
