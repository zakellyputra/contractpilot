"use client";

import { useState } from "react";

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
  high: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  low: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
};

const categoryColors: Record<string, string> = {
  financial: "bg-red-100 text-red-700",
  compliance: "bg-amber-100 text-amber-700",
  operational: "bg-blue-100 text-blue-700",
  reputational: "bg-purple-100 text-purple-700",
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
        <h4 className="font-semibold text-gray-900">{clauseType}</h4>
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

      <p className="text-gray-700 mb-2">
        <span className="font-medium">What this means: </span>
        {explanation}
      </p>

      {concern && (
        <p className="text-red-700 mb-2">
          <span className="font-medium">Watch out: </span>
          {concern}
        </p>
      )}

      {suggestion && (
        <p className="text-green-700 mb-2">
          <span className="font-medium">Suggestion: </span>
          {suggestion}
        </p>
      )}

      {k2Reasoning && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
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
          {expanded && (
            <div className="mt-2 p-3 bg-white/70 rounded-lg text-sm text-gray-600 border border-gray-200">
              {k2Reasoning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
