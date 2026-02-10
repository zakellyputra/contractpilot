"use client";

import { useState, useMemo } from "react";
import PDFViewer, { ClauseHighlight } from "./PDFViewer";
import ClausePanel from "./ClausePanel";
import ClauseChat from "./ClauseChat";
import PaywallBlur from "./PaywallBlur";
import { usePlan } from "@/contexts/PlanContext";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface Clause {
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
  rects?: string; // JSON string
  pageWidth?: number;
  pageHeight?: number;
  parentHeading?: string;
  subClauseIndex?: number;
}

interface DeepReviewViewProps {
  pdfUrl: string;
  clauses: Clause[];
  contractType: string;
  reviewId?: string;
  unlocked?: boolean;
}

export default function DeepReviewView({ pdfUrl, clauses, contractType, reviewId, unlocked }: DeepReviewViewProps) {
  const [activeClauseId, setActiveClauseId] = useState<string | null>(null);
  const { isOverride, credits } = usePlan();
  const isLocked = !unlocked && !isOverride;
  const unlock = useMutation(api.credits.unlockReview);

  const handleUnlockPdf = async () => {
    if (!reviewId) return;
    try {
      await unlock({ reviewId: reviewId as Id<"reviews"> });
    } catch (err) {
      console.error("Unlock error:", err);
    }
  };

  // Transform clause data into highlight format for the PDF viewer
  const highlights: ClauseHighlight[] = useMemo(() => {
    return clauses
      .filter((c) => c.rects && c.pageNumber !== undefined)
      .map((c) => {
        let rects: { x0: number; y0: number; x1: number; y1: number }[] = [];
        try {
          rects = JSON.parse(c.rects || "[]");
        } catch {
          rects = [];
        }
        return {
          clauseId: c._id,
          pageNumber: c.pageNumber ?? 0,
          rects,
          pageWidth: c.pageWidth ?? 612,
          pageHeight: c.pageHeight ?? 792,
          riskLevel: c.riskLevel,
          clauseType: c.clauseType || "Clause",
          explanation: c.explanation,
        };
      });
  }, [clauses]);

  const handleClauseHover = (clauseId: string | null) => {
    setActiveClauseId(clauseId);
  };

  const handleClauseClick = (clauseId: string) => {
    setActiveClauseId(clauseId);
  };

  return (
    <div className="flex h-[calc(100vh-180px)] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Left: PDF Viewer (55%) */}
      <div className="w-[55%] border-r border-gray-200 dark:border-gray-700 overflow-hidden">
        <PDFViewer
          pdfUrl={pdfUrl}
          highlights={highlights}
          activeClauseId={activeClauseId}
          onClauseHover={handleClauseHover}
          onClauseClick={handleClauseClick}
          scrollLocked={isLocked}
          credits={credits}
          onUnlock={handleUnlockPdf}
        />
      </div>

      {/* Right column (45%): Clause analysis + Chat */}
      <div className="w-[45%] flex flex-col overflow-hidden">
        {/* Top: Clause analysis panel */}
        <div className="flex-1 min-h-0 overflow-hidden border-b border-gray-200 dark:border-gray-700">
          <ClausePanel
            clauses={clauses}
            activeClauseId={activeClauseId}
          />
        </div>

        {/* Bottom: Chat interface */}
        <div className="h-[45%] min-h-[200px] flex flex-col overflow-hidden">
          <PaywallBlur featureLabel="AI Clause Chat" className="h-full" reviewId={reviewId} unlocked={unlocked}>
            <ClauseChat
              activeClauseId={activeClauseId}
              clauses={clauses}
              contractType={contractType}
            />
          </PaywallBlur>
        </div>
      </div>
    </div>
  );
}
