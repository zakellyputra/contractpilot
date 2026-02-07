"""Custom tool functions for the Dedalus agent.

Each function is a tool the agent can call. Dedalus auto-extracts schemas
from the type hints and docstrings.
"""

import base64
import json
import re

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


async def query_legal_context(clause_text: str, clause_type: str) -> str:
    """Query the Vultr RAG legal knowledge base for relevant standards.

    Args:
        clause_text: The clause text to research.
        clause_type: Type of clause.

    Returns:
        Relevant legal standards and context from CUAD/Legal Clauses datasets.
    """
    return await query_legal_knowledge(clause_text, clause_type)
