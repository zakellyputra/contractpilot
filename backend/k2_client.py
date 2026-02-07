"""K2 Think client via Vultr Serverless Inference.

K2 Think (kimi-k2-instruct) is used for deep clause-by-clause legal analysis.
Called TWICE in the pipeline:
  - Step 5: Initial clause-by-clause analysis
  - Step 9: Enrichment with all gathered context (Brave, Exa, context7, RAG)
"""

import os
import json

from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

k2 = AsyncOpenAI(
    api_key=os.environ.get("VULTR_INFERENCE_API_KEY", ""),
    base_url="https://api.vultrinference.com/v1",
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

    response = await k2.chat.completions.create(
        model="kimi-k2-instruct",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=2048,
    )

    content = response.choices[0].message.content or "{}"

    # Parse JSON from response (handle markdown code blocks)
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]

    try:
        return json.loads(content.strip())
    except json.JSONDecodeError:
        return {
            "riskLevel": "medium",
            "riskCategory": "operational",
            "explanation": content[:500],
            "concern": "Could not parse structured analysis",
            "suggestion": "Manual review recommended",
            "reasoning": content,
        }
