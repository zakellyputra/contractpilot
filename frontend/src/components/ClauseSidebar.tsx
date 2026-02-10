"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { fadeUp, staggerContainer, expandCollapse } from "@/lib/motion";

interface ClauseData {
  _id: string;
  clauseType?: string;
  riskLevel: string;
  riskCategory: string;
  explanation: string;
  concern?: string;
  suggestion?: string;
  pageNumber?: number;
  parentHeading?: string;
  subClauseIndex?: number;
}

interface ClauseSidebarProps {
  clauses: ClauseData[];
  activeClauseId: string | null;
  onClauseHover: (clauseId: string | null) => void;
  onClauseClick: (clauseId: string) => void;
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

const RISK_PRIORITY: Record<string, number> = { high: 0, medium: 1, low: 2 };

function highestRisk(clauses: ClauseData[]): string {
  let best = "low";
  for (const c of clauses) {
    if ((RISK_PRIORITY[c.riskLevel] ?? 2) < (RISK_PRIORITY[best] ?? 2)) {
      best = c.riskLevel;
    }
  }
  return best;
}

export default function ClauseSidebar({
  clauses,
  activeClauseId,
  onClauseHover,
  onClauseClick,
}: ClauseSidebarProps) {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group clauses: top-level vs sub-clauses under parent headings
  const { orderedItems } = useMemo(() => {
    const subMap = new Map<string, ClauseData[]>();
    const topLevel: ClauseData[] = [];

    for (const clause of clauses) {
      if (clause.parentHeading) {
        const existing = subMap.get(clause.parentHeading) || [];
        existing.push(clause);
        subMap.set(clause.parentHeading, existing);
      } else {
        topLevel.push(clause);
      }
    }

    // Build ordered list: each top-level clause followed by its children
    const items: Array<
      | { type: "clause"; clause: ClauseData; hasChildren: boolean; children: ClauseData[] }
      | { type: "subclause"; clause: ClauseData; parentHeading: string }
    > = [];

    for (const clause of topLevel) {
      const children = subMap.get(clause.clauseType || "") || [];
      items.push({ type: "clause", clause, hasChildren: children.length > 0, children });
      for (const child of children) {
        items.push({ type: "subclause", clause: child, parentHeading: clause.clauseType || "" });
      }
    }

    // Handle orphan sub-clauses whose parent wasn't extracted as top-level
    const usedParents = new Set(topLevel.map((c) => c.clauseType || ""));
    for (const [parent, children] of subMap) {
      if (!usedParents.has(parent)) {
        // Render orphans as a group header + sub-clauses
        items.push({
          type: "clause",
          clause: { _id: `group-${parent}`, clauseType: parent, riskLevel: highestRisk(children), riskCategory: children[0]?.riskCategory || "operational", explanation: `${children.length} sub-clauses` },
          hasChildren: true,
          children,
        });
        for (const child of children) {
          items.push({ type: "subclause", clause: child, parentHeading: parent });
        }
      }
    }

    return { orderedItems: items };
  }, [clauses]);

  const toggleGroup = (heading: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(heading)) {
        next.delete(heading);
      } else {
        next.add(heading);
      }
      return next;
    });
  };

  // Auto-scroll to active clause card
  useEffect(() => {
    if (!activeClauseId) return;
    const el = cardRefs.current.get(activeClauseId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // Auto-expand parent group if active clause is a sub-clause
    const activeItem = orderedItems.find(
      (item) => item.clause._id === activeClauseId && item.type === "subclause"
    );
    if (activeItem && activeItem.type === "subclause") {
      setExpandedGroups((prev) => {
        if (prev.has(activeItem.parentHeading)) return prev;
        return new Set([...prev, activeItem.parentHeading]);
      });
    }
  }, [activeClauseId, orderedItems]);

  const renderClauseCard = (clause: ClauseData, isActive: boolean, indent: boolean) => (
    <div
      key={clause._id}
      ref={(el) => {
        if (el) cardRefs.current.set(clause._id, el);
      }}
      className={`rounded-lg border p-4 cursor-pointer transition-all duration-150 ${
        indent ? "ml-4 border-l-2 border-l-blue-200 dark:border-l-blue-700" : ""
      } ${
        isActive
          ? "border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md ring-1 ring-blue-200 dark:ring-blue-800"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm"
      }`}
      onMouseEnter={() => onClauseHover(clause._id)}
      onMouseLeave={() => onClauseHover(null)}
      onClick={() => onClauseClick(clause._id)}
    >
      {/* Header: type + badges */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
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
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
        {clause.explanation}
      </p>

      {/* Concern */}
      {clause.concern && (
        <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded px-2 py-1">
          <span className="font-medium">Watch out:</span> {clause.concern}
        </div>
      )}

      {/* Suggestion */}
      {clause.suggestion && (
        <div className="mt-1.5 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 rounded px-2 py-1">
          <span className="font-medium">Suggestion:</span> {clause.suggestion}
        </div>
      )}
    </div>
  );

  return (
    <motion.div className="h-full overflow-y-auto p-4 space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        Clause Analysis ({clauses.length})
      </h3>

      {orderedItems.map((item) => {
        if (item.type === "clause") {
          const isActive = activeClauseId === item.clause._id;

          if (item.hasChildren) {
            const groupKey = item.clause.clauseType || "";
            const isExpanded = expandedGroups.has(groupKey);
            const worstRisk = highestRisk(item.children);
            const highCount = item.children.filter((c) => c.riskLevel === "high").length;

            return (
              <motion.div key={item.clause._id} variants={fadeUp}>
                {/* Parent clause card with expand toggle */}
                <div className="relative">
                  {renderClauseCard(item.clause, isActive, false)}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroup(groupKey);
                    }}
                    className="absolute top-3 right-3 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={isExpanded ? "Collapse sub-clauses" : "Expand sub-clauses"}
                  >
                    <svg
                      className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Collapsed summary badge */}
                {!isExpanded && (
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="ml-4 mt-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {item.children.length} sub-clause{item.children.length !== 1 ? "s" : ""}
                    {highCount > 0 && (
                      <span className={`px-1 py-0.5 rounded text-[10px] font-bold uppercase ${RISK_BADGE[worstRisk]}`}>
                        {highCount} high risk
                      </span>
                    )}
                  </button>
                )}
              </motion.div>
            );
          }

          // Regular clause without children
          return <motion.div key={item.clause._id} variants={fadeUp}>{renderClauseCard(item.clause, isActive, false)}</motion.div>;
        }

        // Sub-clause: only render if parent is expanded
        if (item.type === "subclause") {
          const isExpanded = expandedGroups.has(item.parentHeading);
          return (
            <AnimatePresence key={item.clause._id} initial={false}>
              {isExpanded && (
                <motion.div
                  variants={expandCollapse}
                  initial="collapsed"
                  animate="expanded"
                  exit="collapsed"
                >
                  {renderClauseCard(item.clause, activeClauseId === item.clause._id, true)}
                </motion.div>
              )}
            </AnimatePresence>
          );
        }

        return null;
      })}
    </motion.div>
  );
}
