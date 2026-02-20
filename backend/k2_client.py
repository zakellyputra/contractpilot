"""K2 Think client via Vultr Serverless Inference.

K2 Think (kimi-k2-instruct) is used for deep clause-by-clause legal analysis.
Called TWICE in the pipeline:
  - Step 5: Initial clause-by-clause analysis
  - Step 9: Enrichment with all gathered context (Brave, Exa, context7, RAG)
"""

import os
import json
from pathlib import Path

from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

k2 = AsyncOpenAI(
    api_key=os.environ.get("VULTR_INFERENCE_API_KEY", ""),
    base_url="https://api.vultrinference.com/v1",
    timeout=60.0,
)

SYSTEM_PROMPT = """\
You are an expert contract attorney analyzing legal clauses. For each clause:

1. Identify the clause type (e.g., non-compete, indemnification, termination)
2. Assess risk level: HIGH, MEDIUM, or LOW
3. Categorize risk: financial, compliance, operational, or reputational
4. Explain in plain English what this clause means — no legal jargon
5. Identify specific concerns — what could go wrong for the signer
6. Suggest concrete improvements or negotiation points
7. Note any unusual or non-standard language

Be direct and practical. Write as if explaining to a friend, not a lawyer.\
"""

CONTRACT_TYPE_FOCUS = {
    "NDA": (
        "Focus especially on: scope of confidential information, exclusions from "
        "confidentiality, term and duration, obligations upon termination (return or "
        "destruction of materials), enforceability of injunctive relief, and whether "
        "the NDA is mutual or one-sided."
    ),
    "Employment Agreement": (
        "Focus especially on: at-will vs. for-cause provisions, non-compete scope "
        "(duration, geography, activity), non-solicitation breadth, IP assignment "
        "clauses (present vs. future work), compensation and bonus structures, "
        "termination conditions, and severance terms."
    ),
    "Lease Agreement": (
        "Focus especially on: rent escalation clauses, maintenance and repair "
        "obligations, early termination penalties, renewal terms and auto-renewal, "
        "security deposit return conditions, subleasing restrictions, and "
        "insurance requirements."
    ),
    "Service Agreement": (
        "Focus especially on: SLA commitments and remedies for breach, liability "
        "caps (especially relative to contract value), indemnification scope, "
        "payment terms and late fees, data handling obligations, and termination "
        "for convenience vs. cause."
    ),
    "Freelance/Contractor Agreement": (
        "Focus especially on: worker classification risks (independent contractor "
        "vs. employee), IP ownership and work-for-hire provisions, payment milestones "
        "and late payment terms, scope of work boundaries, and termination notice."
    ),
    "Purchase Agreement": (
        "Focus especially on: warranties and representations, inspection and "
        "acceptance periods, risk of loss transfer, return and refund policies, "
        "price adjustment mechanisms, and limitation of liability."
    ),
    "Partnership Agreement": (
        "Focus especially on: profit and loss distribution, capital contribution "
        "obligations, decision-making authority, exit and buyout provisions, "
        "non-compete obligations between partners, and dispute resolution."
    ),
    "License Agreement": (
        "Focus especially on: scope of licensed rights (exclusive vs. non-exclusive), "
        "territory and field-of-use restrictions, royalty structure and audit rights, "
        "sublicensing permissions, termination triggers, and IP infringement indemnity."
    ),
}


async def analyze_clause_risk(
    clause_text: str,
    clause_type: str,
    contract_type: str,
    additional_context: str = "",
) -> dict:
    """Analyze a single clause using K2 Think for deep reasoning.

    Args:
        clause_text: The raw clause text.
        clause_type: Type of clause (e.g., "non-compete").
        contract_type: Type of contract (e.g., "NDA", "lease").
        additional_context: Extra context from research (Brave, Exa, RAG, context7).

    Returns:
        Dict with riskLevel, riskCategory, explanation, concern, suggestion, reasoning.
    """
    user_prompt = f"""Contract type: {contract_type}
Clause type: {clause_type}

Clause text:
{clause_text}
"""

    if additional_context:
        user_prompt += f"""
Additional legal context and research:
{additional_context}
"""

    user_prompt += """
Respond in this exact JSON format:
{
    "riskLevel": "high" | "medium" | "low",
    "riskCategory": "financial" | "compliance" | "operational" | "reputational",
    "explanation": "Plain-English explanation of what this clause means",
    "concern": "What to watch out for — specific risks",
    "suggestion": "Recommended changes or negotiation points",
    "reasoning": "Detailed legal reasoning (for advanced users)"
}"""

    # Append contract-type-specific focus if available
    system = SYSTEM_PROMPT
    type_focus = CONTRACT_TYPE_FOCUS.get(contract_type)
    if type_focus:
        system += f"\n\n{type_focus}"

    response = await k2.chat.completions.create(
        model="kimi-k2-instruct",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=1024,
    )

    content = response.choices[0].message.content or "{}"

    # Parse JSON from response (handle markdown code blocks)
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]

    try:
        result = json.loads(content.strip())
    except json.JSONDecodeError:
        return {
            "riskLevel": "medium",
            "riskCategory": "operational",
            "explanation": content[:500],
            "concern": "Could not parse structured analysis",
            "suggestion": "Manual review recommended",
            "reasoning": content,
        }

    # Validate and normalize required fields
    valid_risk_levels = {"high", "medium", "low"}
    valid_categories = {"financial", "compliance", "operational", "reputational"}

    risk_level = str(result.get("riskLevel", "")).lower()
    if risk_level not in valid_risk_levels:
        result["riskLevel"] = "medium"
    else:
        result["riskLevel"] = risk_level

    risk_category = str(result.get("riskCategory", "")).lower()
    if risk_category not in valid_categories:
        result["riskCategory"] = "operational"
    else:
        result["riskCategory"] = risk_category

    if not result.get("explanation"):
        result["explanation"] = "Analysis incomplete — manual review recommended"
    if not result.get("concern"):
        result["concern"] = "No specific concerns identified"
    if not result.get("suggestion"):
        result["suggestion"] = "Review this clause carefully"
    if not result.get("reasoning"):
        result["reasoning"] = ""

    return result
