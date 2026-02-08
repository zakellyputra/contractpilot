"use client";

import { useState, useMemo } from "react";
import PDFViewer, { ClauseHighlight } from "./PDFViewer";
import ClausePanel from "./ClausePanel";
import ClauseChat from "./ClauseChat";

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
}

interface DeepReviewViewProps {
  pdfUrl: string;
  clauses: Clause[];
  contractType: string;
}

export default function DeepReviewView({ pdfUrl, clauses, contractType }: DeepReviewViewProps) {
  const [activeClauseId, setActiveClauseId] = useState<string | null>(null);

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
    <div className="flex h-[calc(100vh-180px)] rounded-xl overflow-hidden border border-gray-200 bg-white">
      {/* Left: PDF Viewer (55%) */}
      <div className="w-[55%] border-r border-gray-200 overflow-hidden">
        <PDFViewer
          pdfUrl={pdfUrl}
          highlights={highlights}
          activeClauseId={activeClauseId}
          onClauseHover={handleClauseHover}
          onClauseClick={handleClauseClick}
        />
      </div>

      {/* Right column (45%): Clause analysis + Chat */}
      <div className="w-[45%] flex flex-col overflow-hidden">
        {/* Top: Clause analysis panel */}
        <div className="flex-1 min-h-0 overflow-hidden border-b border-gray-200">
          <ClausePanel
            clauses={clauses}
            activeClauseId={activeClauseId}
          />
        </div>

        {/* Bottom: Chat interface */}
        <div className="h-[45%] min-h-[200px] flex flex-col overflow-hidden">
          <ClauseChat
            activeClauseId={activeClauseId}
            clauses={clauses}
            contractType={contractType}
          />
        </div>
      </div>
    </div>
  );
}
