"""Custom tool functions for the Dedalus agent.

Each function is a tool the agent can call. Dedalus auto-extracts schemas
from the type hints and docstrings.
"""

import base64
import json
import re

import fitz

from k2_client import analyze_clause_risk
from ocr import ocr_pdf
from vultr_rag import query_legal_knowledge


def extract_clauses(contract_text: str) -> list[dict]:
    """Extract individual clauses from a contract's full text.

    Splits the contract into logical sections based on numbered headings,
    section markers, or paragraph structure.

    Args:
        contract_text: The full contract text.

    Returns:
        List of dicts with 'text' and 'heading' for each clause.
    """
    clauses = []
    # Split on common section patterns: "1.", "Section 1", "ARTICLE I", etc.
    pattern = r"(?:^|\n)(?=\d+[\.\)]\s|Section\s+\d|ARTICLE\s+[IVX\d]|[A-Z][A-Z\s]{3,}:)"
    sections = re.split(pattern, contract_text)

    for section in sections:
        section = section.strip()
        if len(section) < 30:
            continue

        # Extract heading from first line
        lines = section.split("\n", 1)
        heading = lines[0].strip()[:100]
        text = section[:3000]  # Cap clause length

        clauses.append({"heading": heading, "text": text})

    # If no sections found, split by double newlines
    if not clauses:
        paragraphs = contract_text.split("\n\n")
        for i, para in enumerate(paragraphs):
            para = para.strip()
            if len(para) < 30:
                continue
            clauses.append({"heading": f"Section {i + 1}", "text": para[:3000]})

    return clauses


def classify_contract(contract_text: str) -> str:
    """Classify the type of contract based on its content.

    Args:
        contract_text: The full contract text.

    Returns:
        Contract type string (e.g., "NDA", "Employment Agreement", "Lease").
    """
    text_lower = contract_text[:5000].lower()

    if any(term in text_lower for term in ["non-disclosure", "nda", "confidential information"]):
        return "NDA"
    elif any(term in text_lower for term in ["employment", "employee", "employer", "at-will"]):
        return "Employment Agreement"
    elif any(term in text_lower for term in ["lease", "landlord", "tenant", "premises", "rent"]):
        return "Lease Agreement"
    elif any(term in text_lower for term in ["freelance", "independent contractor", "scope of work"]):
        return "Freelance/Contractor Agreement"
    elif any(term in text_lower for term in ["service agreement", "services", "service level"]):
        return "Service Agreement"
    elif any(term in text_lower for term in ["purchase", "buyer", "seller", "sale"]):
        return "Purchase Agreement"
    elif any(term in text_lower for term in ["partnership", "joint venture"]):
        return "Partnership Agreement"
    elif any(term in text_lower for term in ["license", "licensor", "licensee"]):
        return "License Agreement"
    else:
        return "General Contract"


def categorize_risk(clause_text: str, clause_type: str) -> dict:
    """Assign risk category per the MetricStream framework.

    Categories:
      - financial: clauses that could cost money (penalties, liability, payment)
      - compliance: regulatory/legal exposure (privacy, non-compete enforceability)
      - operational: limits on what you can do (exclusivity, IP, termination)
      - reputational: potential for brand damage (confidentiality gaps, indemnification)

    Args:
        clause_text: The clause text.
        clause_type: The type of clause.

    Returns:
        Dict with category and rationale.
    """
    ct = clause_type.lower()
    text = clause_text.lower()

    if any(term in ct for term in ["liability", "payment", "penalty", "damages", "fee", "cost"]):
        return {"category": "financial", "rationale": "Direct monetary impact"}
    elif any(term in text for term in ["liquidated damages", "cap on liability", "indemnif"]):
        return {"category": "financial", "rationale": "Financial exposure clause"}
    elif any(term in ct for term in ["non-compete", "compliance", "privacy", "data", "regulatory"]):
        return {"category": "compliance", "rationale": "Regulatory or legal compliance risk"}
    elif any(term in ct for term in ["exclusivity", "assignment", "ip", "termination", "non-solicit"]):
        return {"category": "operational", "rationale": "Restricts operational freedom"}
    elif any(term in ct for term in ["confidential", "non-disparage", "publicity"]):
        return {"category": "reputational", "rationale": "Reputation or brand risk"}
    elif any(term in text for term in ["penalt", "fine", "fee", "cost", "payment"]):
        return {"category": "financial", "rationale": "Contains financial terms"}
    elif any(term in text for term in ["shall not", "restricted", "prohibited", "exclusive"]):
        return {"category": "operational", "rationale": "Contains operational restrictions"}
    else:
        return {"category": "operational", "rationale": "General operational clause"}


def format_review_report(
    contract_type: str,
    clauses: list[dict],
    risk_scores: dict,
    summary: str,
    action_items: list[str],
    key_dates: list[dict],
) -> dict:
    """Format the final review report for storage in Convex.

    Args:
        contract_type: Type of contract.
        clauses: List of analyzed clause results.
        risk_scores: Dict with overall, financial, compliance, operational, reputational scores.
        summary: Executive summary in plain English.
        action_items: Prioritized list of recommended actions.
        key_dates: List of key dates extracted from the contract.

    Returns:
        Formatted review report dict.
    """
    return {
        "contractType": contract_type,
        "summary": summary,
        "riskScore": risk_scores.get("overall", 50),
        "financialRisk": risk_scores.get("financial", 50),
        "complianceRisk": risk_scores.get("compliance", 50),
        "operationalRisk": risk_scores.get("operational", 50),
        "reputationalRisk": risk_scores.get("reputational", 50),
        "clauses": clauses,
        "actionItems": action_items,
        "keyDates": key_dates,
    }


def ocr_document(pdf_base64: str) -> str:
    """Extract text from a scanned PDF using Google Vision OCR.

    Use this when pdf-parse returns poor or empty results (scanned documents).

    Args:
        pdf_base64: Base64-encoded PDF bytes.

    Returns:
        Extracted text from the scanned document.
    """
    pdf_bytes = base64.b64decode(pdf_base64)
    return ocr_pdf(pdf_bytes)


def _expand_to_paragraph(page, start_rect, clause_text: str) -> list[dict]:
    """Expand a single-line rect to cover the full clause paragraph.

    Uses page.get_text("dict") to find consecutive lines that overlap
    with the clause text, starting from the line containing start_rect.

    Args:
        page: PyMuPDF page object.
        start_rect: The fitz.Rect of the first matched snippet.
        clause_text: Full clause text to match against.

    Returns:
        List of rect dicts [{x0, y0, x1, y1}] covering the paragraph.
    """
    # Get all text blocks/lines on the page
    page_dict = page.get_text("dict")
    all_lines = []
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:  # text blocks only
            continue
        for line in block.get("lines", []):
            bbox = line["bbox"]
            line_text = " ".join(span["text"] for span in line.get("spans", []))
            all_lines.append({"bbox": bbox, "text": line_text})

    if not all_lines:
        return [{"x0": start_rect.x0, "y0": start_rect.y0,
                 "x1": start_rect.x1, "y1": start_rect.y1}]

    # Build a set of words from the clause text for overlap checking
    clause_words = set(re.findall(r"[a-zA-Z]{3,}", clause_text.lower()[:500]))

    # Find the starting line (the one containing start_rect's y-center)
    start_y = (start_rect.y0 + start_rect.y1) / 2
    start_idx = 0
    min_dist = float("inf")
    for i, line in enumerate(all_lines):
        line_y = (line["bbox"][1] + line["bbox"][3]) / 2
        dist = abs(line_y - start_y)
        if dist < min_dist:
            min_dist = dist
            start_idx = i

    # Collect consecutive lines that overlap with clause words
    rects = []
    for i in range(start_idx, min(start_idx + 30, len(all_lines))):
        line = all_lines[i]
        line_words = set(re.findall(r"[a-zA-Z]{3,}", line["text"].lower()))
        overlap = len(line_words & clause_words)

        if i == start_idx:
            # Always include the start line
            rects.append({
                "x0": line["bbox"][0], "y0": line["bbox"][1],
                "x1": line["bbox"][2], "y1": line["bbox"][3],
            })
        elif overlap >= 2 or (overlap >= 1 and len(line_words) <= 3):
            rects.append({
                "x0": line["bbox"][0], "y0": line["bbox"][1],
                "x1": line["bbox"][2], "y1": line["bbox"][3],
            })
        else:
            break  # No more overlap, stop expanding

    return rects if rects else [{"x0": start_rect.x0, "y0": start_rect.y0,
                                  "x1": start_rect.x1, "y1": start_rect.y1}]


def extract_clause_positions(pdf_bytes: bytes, clauses: list[dict]) -> list[dict]:
    """Find the page and bounding boxes for each clause in the PDF.

    Uses PyMuPDF text search to locate each clause's opening text,
    then expands to cover the full paragraph.

    Args:
        pdf_bytes: Raw PDF file bytes.
        clauses: List of clause dicts with 'text' and 'heading' keys.

    Returns:
        List of position dicts (same order as input clauses), each with:
        pageNumber (0-indexed), rects ([{x0,y0,x1,y1}]), pageWidth, pageHeight.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    positions = []

    for clause in clauses:
        raw = clause["text"].strip()
        found = False

        # Try progressively shorter snippets
        for snippet_len in (80, 50, 30):
            snippet = " ".join(raw[:snippet_len].split())  # normalize whitespace
            if len(snippet) < 10:
                continue

            for page_num in range(len(doc)):
                page = doc[page_num]
                rects = page.search_for(snippet)
                if rects:
                    # Expand from the first match to cover the full paragraph
                    expanded_rects = _expand_to_paragraph(page, rects[0], raw)
                    positions.append({
                        "pageNumber": page_num,
                        "rects": expanded_rects,
                        "pageWidth": page.rect.width,
                        "pageHeight": page.rect.height,
                    })
                    found = True
                    break
            if found:
                break

        if not found:
            # Fallback: no position data for this clause
            positions.append({
                "pageNumber": 0,
                "rects": [],
                "pageWidth": 612,
                "pageHeight": 792,
            })

    doc.close()
    return positions


async def query_legal_context(clause_text: str, clause_type: str) -> str:
    """Query the Vultr RAG legal knowledge base for relevant standards.

    Args:
        clause_text: The clause text to research.
        clause_type: Type of clause.

    Returns:
        Relevant legal standards and context from CUAD/Legal Clauses datasets.
    """
    return await query_legal_knowledge(clause_text, clause_type)
