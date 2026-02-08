"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ClauseHighlight {
  clauseId: string;
  pageNumber: number; // 0-indexed
  rects: Rect[];
  pageWidth: number;
  pageHeight: number;
  riskLevel: string;
  clauseType: string;
  explanation: string;
}

interface PDFViewerProps {
  pdfUrl: string;
  highlights: ClauseHighlight[];
  activeClauseId: string | null;
  onClauseHover: (clauseId: string | null) => void;
  onClauseClick: (clauseId: string) => void;
}

const RISK_COLORS: Record<string, { bg: string; activeBg: string; border: string }> = {
  high: { bg: "rgba(239,68,68,0.15)", activeBg: "rgba(239,68,68,0.35)", border: "rgb(239,68,68)" },
  medium: { bg: "rgba(245,158,11,0.15)", activeBg: "rgba(245,158,11,0.35)", border: "rgb(245,158,11)" },
  low: { bg: "rgba(34,197,94,0.15)", activeBg: "rgba(34,197,94,0.35)", border: "rgb(34,197,94)" },
};

export default function PDFViewer({
  pdfUrl,
  highlights,
  activeClauseId,
  onClauseHover,
  onClauseClick,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(600);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    clauseType: string;
    riskLevel: string;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // No auto-scroll — let the user scroll the PDF freely

  const getHighlightsForPage = useCallback(
    (pageNum: number) => highlights.filter((h) => h.pageNumber === pageNum),
    [highlights]
  );

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-gray-100 p-4">
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 rounded-lg shadow-lg text-xs bg-gray-900 text-white pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <span className="font-medium">{tooltip.clauseType}</span>
          <span
            className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
              tooltip.riskLevel === "high"
                ? "bg-red-500/20 text-red-300"
                : tooltip.riskLevel === "medium"
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-green-500/20 text-green-300"
            }`}
          >
            {tooltip.riskLevel}
          </span>
        </div>
      )}

      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        loading={
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        }
        error={
          <div className="flex items-center justify-center h-64 text-red-500">
            Failed to load PDF
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              if (el) pageRefs.current.set(i, el);
            }}
            className="relative mb-4 shadow-md bg-white mx-auto"
            style={{ width: containerWidth - 32 }}
          >
            <Page
              pageNumber={i + 1}
              width={containerWidth - 32}
              renderTextLayer={true}
              renderAnnotationLayer={false}
            />
            {/* Highlight overlays for this page */}
            {getHighlightsForPage(i).map((highlight) => {
              const scale = (containerWidth - 32) / highlight.pageWidth;
              const colors = RISK_COLORS[highlight.riskLevel] || RISK_COLORS.medium;
              const isActive = activeClauseId === highlight.clauseId;

              return highlight.rects.map((rect, ri) => (
                <div
                  key={`${highlight.clauseId}-${ri}`}
                  className="absolute cursor-pointer transition-all duration-150"
                  style={{
                    left: rect.x0 * scale,
                    top: rect.y0 * scale,
                    width: (rect.x1 - rect.x0) * scale,
                    height: (rect.y1 - rect.y0) * scale,
                    backgroundColor: isActive ? colors.activeBg : colors.bg,
                    border: isActive ? `2px solid ${colors.border}` : "1px solid transparent",
                    borderRadius: 2,
                    zIndex: 10,
                  }}
                  onMouseEnter={(e) => {
                    onClauseHover(highlight.clauseId);
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      clauseType: highlight.clauseType,
                      riskLevel: highlight.riskLevel,
                    });
                  }}
                  onMouseMove={(e) => {
                    setTooltip((t) =>
                      t ? { ...t, x: e.clientX, y: e.clientY } : null
                    );
                  }}
                  onMouseLeave={() => {
                    setTooltip(null);
                  }}
                  onClick={() => onClauseClick(highlight.clauseId)}
                />
              ));
            })}
          </div>
        ))}
      </Document>
    </div>
  );
}
