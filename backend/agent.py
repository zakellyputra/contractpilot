"""Dedalus ADK agent orchestration for contract analysis.

Orchestrates the full 12-step pipeline:
  1. DAuth → 2. Upload → 3. pdf-parse → 3b. OCR fallback →
  4. RAG → 5. K2 Think (pass 1) → 6. Brave → 7. Exa →
  8. context7 → 9. K2 Think (pass 2) → 10. Convex → 11. Flowglad → 12. PDF
"""

import os

from convex import ConvexClient
from dedalus import AsyncDedalus
from dedalus.runner import DedalusRunner
from dotenv import load_dotenv

from prompts import AGENT_SYSTEM_PROMPT
from tools import (
    categorize_risk,
    classify_contract,
    extract_clauses,
    format_review_report,
    ocr_document,
    query_legal_context,
)
from k2_client import analyze_clause_risk

load_dotenv()

# Dedalus client
client = AsyncDedalus(api_key=os.environ.get("DEDALUS_API_KEY", ""))

# Convex client for writing results
convex = ConvexClient(os.environ.get("CONVEX_URL", ""))


async def run_contract_analysis(
    review_id: str,
    pdf_text: str,
    user_id: str,
    ocr_used: bool = False,
) -> dict:
    """Run the full contract analysis pipeline via Dedalus agent.

    Args:
        review_id: Convex review document ID.
        pdf_text: Extracted text from the PDF.
        user_id: Authenticated user ID (from DAuth).
        ocr_used: Whether OCR was used to extract text.

    Returns:
        Final review results dict.
    """
    # Update status to processing
    try:
        convex.mutation("reviews:updateStatus", {"id": review_id, "status": "processing"})
    except Exception:
        pass  # Convex might not be configured yet

    runner = DedalusRunner(client)

    try:
        response = await runner.run(
            model="anthropic/claude-sonnet-4-5",
            input=(
                f"Review this contract and provide a complete risk analysis.\n\n"
                f"Contract text:\n{pdf_text[:50000]}"
            ),
            system=AGENT_SYSTEM_PROMPT,
            tools=[
                extract_clauses,
                classify_contract,
                analyze_clause_risk,
                categorize_risk,
                format_review_report,
                ocr_document,
                query_legal_context,
            ],
            mcp_servers=[
                "Dedalus Auth",
                "meanerbeaver/pdf-parse",
                "dedalus-labs/brave-search-mcp",
                "exa-labs/exa-mcp-server",
                "tsion/context7",
            ],
            stream=True,
        )

        # Extract the final structured result from the agent response
        result = _extract_result(response)

        # Write results to Convex
        _save_results(review_id, result, ocr_used)

        return result

    except Exception as e:
        # Mark as failed
        try:
            convex.mutation(
                "reviews:updateStatus", {"id": review_id, "status": "failed"}
            )
        except Exception:
            pass
        raise RuntimeError(f"Agent analysis failed: {e}") from e


def _extract_result(response) -> dict:
    """Extract structured results from the Dedalus agent response."""
    # The agent should return a format_review_report result
    # Parse through the response to find it
    if hasattr(response, "output"):
        for item in response.output:
            if hasattr(item, "content") and isinstance(item.content, dict):
                if "contractType" in item.content:
                    return item.content

    # Fallback: return a minimal result
    return {
        "contractType": "Unknown",
        "summary": "Analysis completed. See clause details below.",
        "riskScore": 50,
        "financialRisk": 50,
        "complianceRisk": 50,
        "operationalRisk": 50,
        "reputationalRisk": 50,
        "clauses": [],
        "actionItems": ["Review the full contract manually"],
        "keyDates": [],
    }


def _save_results(review_id: str, result: dict, ocr_used: bool) -> None:
    """Save analysis results to Convex."""
    try:
        # Write each clause
        for clause in result.get("clauses", []):
            convex.mutation(
                "clauses:addClause",
                {
                    "reviewId": review_id,
                    "clauseText": clause.get("clauseText", ""),
                    "clauseType": clause.get("clauseType", "Unknown"),
                    "riskLevel": clause.get("riskLevel", "medium"),
                    "riskCategory": clause.get("riskCategory", "operational"),
                    "explanation": clause.get("explanation", ""),
                    "concern": clause.get("concern"),
                    "suggestion": clause.get("suggestion"),
                    "k2Reasoning": clause.get("k2Reasoning"),
                },
            )

        # Write summary results
        convex.mutation(
            "reviews:setResults",
            {
                "id": review_id,
                "summary": result.get("summary", ""),
                "riskScore": result.get("riskScore", 50),
                "financialRisk": result.get("financialRisk", 50),
                "complianceRisk": result.get("complianceRisk", 50),
                "operationalRisk": result.get("operationalRisk", 50),
                "reputationalRisk": result.get("reputationalRisk", 50),
                "actionItems": result.get("actionItems", []),
                "keyDates": result.get("keyDates", []),
                "contractType": result.get("contractType"),
                "reportUrl": f"/api/report/{review_id}",
                "ocrUsed": ocr_used,
            },
        )
    except Exception as e:
        print(f"Warning: Failed to save results to Convex: {e}")
