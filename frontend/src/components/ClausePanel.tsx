"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { expandCollapse } from "@/lib/motion";

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
  parentHeading?: string;
  subClauseIndex?: number;
}

interface ClausePanelProps {
  clauses: ClauseData[];
  activeClauseId: string | null;
}

const RISK_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-800",
  low: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800",
};

const CATEGORY_BADGE: Record<string, string> = {
  financial: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  compliance: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  operational: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  reputational: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
};

function CollapsibleSection({
  label,
  content,
  colors,
}: {
  label: string;
  content: string;
  colors: { bg: string; text: string; border: string; hoverText: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`text-xs ${colors.text} ${colors.bg} rounded-lg border ${colors.border}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full px-3 py-2 text-left font-semibold hover:${colors.hoverText} flex items-center justify-between`}
      >
        {label}
        <motion.svg
          className="w-3 h-3"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            variants={expandCollapse}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
          >
            <p className="px-3 pb-2 leading-relaxed">{content}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ClausePanel({ clauses, activeClauseId }: ClausePanelProps) {
  const clause = clauses.find((c) => c._id === activeClauseId);

  // Empty state
  if (!clause) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <svg
          className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3"
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
        <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">
          Hover over a highlighted clause in the PDF to view its analysis
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {/* Breadcrumb for sub-clauses */}
      {clause.parentHeading && (
        <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <span className="truncate max-w-[160px]">{clause.parentHeading}</span>
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="truncate max-w-[160px] text-gray-600 dark:text-gray-400">{clause.clauseType || "Sub-clause"}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate max-w-[240px]">
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
          <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
            p.{clause.pageNumber + 1}
          </span>
        )}
      </div>

      {/* Explanation */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Explanation
        </h4>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{clause.explanation}</p>
      </div>

      {/* Concern */}
      {clause.concern && (
        <CollapsibleSection
          label="Watch out"
          content={clause.concern}
          colors={{
            bg: "bg-amber-50 dark:bg-amber-950",
            text: "text-amber-700 dark:text-amber-400",
            border: "border-amber-100 dark:border-amber-800",
            hoverText: "text-amber-800 dark:hover:text-amber-300",
          }}
        />
      )}

      {/* Suggestion */}
      {clause.suggestion && (
        <CollapsibleSection
          label="Suggestion"
          content={clause.suggestion}
          colors={{
            bg: "bg-blue-50 dark:bg-blue-950",
            text: "text-blue-700 dark:text-blue-400",
            border: "border-blue-100 dark:border-blue-800",
            hoverText: "text-blue-800 dark:hover:text-blue-300",
          }}
        />
      )}

      {/* K2 Reasoning (collapsible) */}
      {clause.k2Reasoning && (
        <CollapsibleSection
          label="Advanced Analysis"
          content={clause.k2Reasoning}
          colors={{
            bg: "bg-gray-50 dark:bg-gray-800",
            text: "text-gray-600 dark:text-gray-400",
            border: "border-gray-100 dark:border-gray-700",
            hoverText: "text-gray-700 dark:hover:text-gray-200",
          }}
        />
      )}
    </div>
  );
}
