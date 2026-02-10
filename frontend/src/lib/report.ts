/**
 * Client-side PDF report generation using jsPDF.
 *
 * Generates a compact, readable risk analysis report from review + clause data.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// -- Risk helpers ----------------------------------------------------------

const RISK_COLORS: Record<string, [number, number, number]> = {
  high: [239, 68, 68],    // #ef4444
  medium: [245, 158, 11], // #f59e0b
  low: [34, 197, 94],     // #22c55e
};

function riskColor(level: string): [number, number, number] {
  return RISK_COLORS[level] ?? [107, 114, 128]; // gray fallback
}

function scoreColor(score: number): [number, number, number] {
  if (score >= 70) return RISK_COLORS.high;
  if (score >= 40) return RISK_COLORS.medium;
  return RISK_COLORS.low;
}

function riskLabel(score: number): string {
  if (score >= 70) return "High Risk";
  if (score >= 40) return "Moderate Risk";
  return "Low Risk";
}

// -- Types -----------------------------------------------------------------

interface ReviewData {
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
}

interface ClauseData {
  _id: string;
  clauseType?: string;
  clauseText?: string;
  riskLevel: string;
  riskCategory: string;
  explanation: string;
  concern?: string;
  suggestion?: string;
  parentHeading?: string;
  subClauseIndex?: number;
}

// -- Layout constants ------------------------------------------------------

const MARGIN = 20;
const PAGE_WIDTH = 210; // A4 mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BLUE: [number, number, number] = [59, 130, 246]; // #3b82f6
const GRAY: [number, number, number] = [107, 114, 128];
const DARK: [number, number, number] = [31, 41, 55];
const LIGHT_BG: [number, number, number] = [249, 250, 251];

// -- Text sanitizer (jsPDF built-in fonts only support WinAnsi) ------------

function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A]/g, "'")   // smart single quotes
    .replace(/[\u201C\u201D\u201E]/g, '"')    // smart double quotes
    .replace(/\u2013/g, "-")                   // en dash
    .replace(/\u2014/g, "--")                  // em dash
    .replace(/\u2026/g, "...")                 // ellipsis
    .replace(/\u00B1/g, "+/-")                 // ±
    .replace(/\u00A0/g, " ")                   // non-breaking space
    .replace(/\u2022/g, "-")                   // bullet
    .replace(/\u00AB/g, "<<")                  // «
    .replace(/\u00BB/g, ">>")                  // »
    .replace(/\u2010|\u2011/g, "-")            // hyphens
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "") // zero-width chars
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, "");             // strip remaining non-Latin1
}

// -- Helpers ---------------------------------------------------------------

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 15) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  y = checkPageBreak(doc, y, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  doc.text(title, MARGIN, y);
  y += 2;
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
  return y + 6;
}

function wrapText(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(sanitize(text), maxWidth);
}

// -- Main generator --------------------------------------------------------

export function generateReport(review: ReviewData, clauses: ClauseData[]): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  let y = MARGIN;

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...BLUE);
  doc.text("ContractPilot", MARGIN, y);
  const titleWidth = doc.getTextWidth("ContractPilot");
  doc.setFontSize(12);
  doc.setTextColor(...GRAY);
  doc.text("Risk Analysis", MARGIN + titleWidth + 2, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(
    sanitize(`${review.filename}  |  ${review.contractType ?? "Contract"}  |  ${new Date().toLocaleDateString()}`),
    MARGIN,
    y,
  );
  y += 10;

  // ── Risk Score ──────────────────────────────────────────────────────────
  const score = review.riskScore ?? 0;
  const sc = scoreColor(score);

  // Score box
  doc.setFillColor(...sc);
  doc.roundedRect(MARGIN, y, 40, 20, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(`${score}/100`, MARGIN + 20, y + 13, { align: "center" });

  // Label next to box
  doc.setFontSize(14);
  doc.setTextColor(...sc);
  doc.text(riskLabel(score), MARGIN + 46, y + 10);

  // Risk breakdown inline
  y += 26;
  const categories = [
    { label: "Financial", value: review.financialRisk ?? 0 },
    { label: "Compliance", value: review.complianceRisk ?? 0 },
    { label: "Operational", value: review.operationalRisk ?? 0 },
    { label: "Reputational", value: review.reputationalRisk ?? 0 },
  ];
  const boxW = (CONTENT_WIDTH - 9) / 4; // 3 gaps of 3mm
  categories.forEach((cat, i) => {
    const x = MARGIN + i * (boxW + 3);
    const catColor = scoreColor(cat.value);
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(x, y, boxW, 16, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(cat.label.toUpperCase(), x + boxW / 2, y + 5, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...catColor);
    doc.text(`${cat.value}`, x + boxW / 2, y + 13, { align: "center" });
  });
  y += 22;

  // ── Executive Summary ───────────────────────────────────────────────────
  if (review.summary) {
    y = drawSectionTitle(doc, y, "Executive Summary");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    const lines = wrapText(doc, review.summary, CONTENT_WIDTH, 9);
    for (const line of lines) {
      y = checkPageBreak(doc, y, 5);
      doc.text(line, MARGIN, y);
      y += 4.2;
    }
    y += 4;
  }

  // ── Clause Analysis ─────────────────────────────────────────────────────
  if (clauses.length > 0) {
    y = drawSectionTitle(doc, y, `Clause Analysis (${clauses.length} clauses)`);

    let currentParent: string | null = null;

    for (const clause of clauses) {
      const isSubClause = !!clause.parentHeading;
      const indent = isSubClause ? 6 : 0;
      const cardWidth = CONTENT_WIDTH - indent;

      // Parent heading
      if (clause.parentHeading && clause.parentHeading !== currentParent) {
        currentParent = clause.parentHeading;
        y = checkPageBreak(doc, y, 8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...DARK);
        doc.text(sanitize(clause.parentHeading), MARGIN, y);
        y += 5;
      } else if (!clause.parentHeading) {
        currentParent = null;
      }

      // Estimate height needed
      const explLines = wrapText(doc, clause.explanation, cardWidth - 8, 8);
      let estH = 12 + explLines.length * 3.5;
      if (clause.concern) estH += 8;
      if (clause.suggestion) estH += 8;
      y = checkPageBreak(doc, y, estH);

      const cardX = MARGIN + indent;

      // Card background
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(cardX, y - 1, cardWidth, estH, 2, 2, "F");

      // Sub-clause left accent
      if (isSubClause) {
        doc.setFillColor(...BLUE);
        doc.rect(cardX, y - 1, 1.2, estH, "F");
      }

      // Clause type + risk badge
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      doc.text(sanitize(clause.clauseType ?? "Clause"), cardX + 4, y + 4);

      const rc = riskColor(clause.riskLevel);
      const badgeText = clause.riskLevel.toUpperCase();
      doc.setFontSize(7);
      const badgeW = doc.getTextWidth(badgeText) + 4;
      const badgeX = cardX + cardWidth - badgeW - 4;
      doc.setFillColor(...rc);
      doc.roundedRect(badgeX, y + 0.5, badgeW, 5, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(badgeText, badgeX + 2, y + 4);

      // Category badge
      doc.setFontSize(6);
      doc.setTextColor(...GRAY);
      const catText = sanitize(clause.riskCategory);
      const catW = doc.getTextWidth(catText) + 3;
      doc.setFillColor(229, 231, 235);
      doc.roundedRect(badgeX - catW - 3, y + 0.5, catW, 5, 1, 1, "F");
      doc.setTextColor(...GRAY);
      doc.text(catText, badgeX - catW - 1.5, y + 4);

      let cy = y + 9;

      // Explanation
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      for (const line of explLines) {
        doc.text(line, cardX + 4, cy);
        cy += 3.5;
      }
      cy += 1;

      // Concern
      if (clause.concern) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(220, 38, 38);
        doc.text("Watch out: ", cardX + 4, cy);
        const cOffset = doc.getTextWidth("Watch out: ");
        doc.setFont("helvetica", "normal");
        doc.setTextColor(185, 28, 28);
        const concernLines = wrapText(doc, clause.concern, cardWidth - 8 - cOffset, 7);
        doc.text(concernLines[0] ?? "", cardX + 4 + cOffset, cy);
        cy += 3.5;
        for (let i = 1; i < concernLines.length; i++) {
          doc.text(concernLines[i], cardX + 4, cy);
          cy += 3.5;
        }
      }

      // Suggestion
      if (clause.suggestion) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(5, 150, 105);
        doc.text("Suggestion: ", cardX + 4, cy);
        const sOffset = doc.getTextWidth("Suggestion: ");
        doc.setFont("helvetica", "normal");
        doc.setTextColor(4, 120, 87);
        const sugLines = wrapText(doc, clause.suggestion, cardWidth - 8 - sOffset, 7);
        doc.text(sugLines[0] ?? "", cardX + 4 + sOffset, cy);
        cy += 3.5;
        for (let i = 1; i < sugLines.length; i++) {
          doc.text(sugLines[i], cardX + 4, cy);
          cy += 3.5;
        }
      }

      y += estH + 3;
    }
    y += 2;
  }

  // ── Action Items ────────────────────────────────────────────────────────
  if (review.actionItems && review.actionItems.length > 0) {
    y = drawSectionTitle(doc, y, "What to Do Next");
    review.actionItems.forEach((item, i) => {
      const lines = wrapText(doc, `${i + 1}. ${item}`, CONTENT_WIDTH - 4, 9);
      for (const line of lines) {
        y = checkPageBreak(doc, y, 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...DARK);
        doc.text(line, MARGIN + 2, y);
        y += 4.2;
      }
      y += 1;
    });
    y += 2;
  }

  // ── Key Dates ───────────────────────────────────────────────────────────
  if (review.keyDates && review.keyDates.length > 0) {
    y = drawSectionTitle(doc, y, "Key Dates & Deadlines");
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Date", "Description", "Type"]],
      body: review.keyDates.map((kd) => [kd.date, kd.label, kd.type]),
      styles: { fontSize: 8, cellPadding: 2, textColor: DARK },
      headStyles: {
        fillColor: LIGHT_BG,
        textColor: GRAY,
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      theme: "plain",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 20;
    y += 6;
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(
      "Generated by ContractPilot -- AI-powered contract review. This is not legal advice.",
      MARGIN,
      pageH - 8,
    );
    doc.text(`Page ${p} of ${totalPages}`, PAGE_WIDTH - MARGIN, pageH - 8, { align: "right" });
  }

  // ── Save ────────────────────────────────────────────────────────────────
  const safeName = review.filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_ ]/g, "");
  doc.save(`${safeName}-risk-report.pdf`);
}
