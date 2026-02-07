"""Vultr RAG client — legal knowledge base queries.

Queries the Vultr vector store seeded with CUAD + Legal Clauses data.
Uses llama-3.3-70b (RAG-supported model), NOT kimi-k2-instruct.
"""

import os

import httpx
from dotenv import load_dotenv

load_dotenv()

VULTR_BASE = "https://api.vultrinference.com/v1"
VULTR_API_KEY = os.environ.get("VULTR_INFERENCE_API_KEY", "")
COLLECTION_ID = os.environ.get("VULTR_LEGAL_COLLECTION_ID", "")
HEADERS = {
    "Authorization": f"Bearer {VULTR_API_KEY}",
    "Content-Type": "application/json",
}


async def query_legal_knowledge(clause_text: str, clause_type: str) -> str:
    """Query Vultr RAG for relevant legal standards and precedent.

    Args:
        clause_text: The clause text to research.
        clause_type: Type of clause (e.g., "non-compete").

    Returns:
        Legal context string from the knowledge base.
    """
    if not VULTR_API_KEY or not COLLECTION_ID:
        return "Legal knowledge base not configured."

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.post(
                f"{VULTR_BASE}/chat/completions/RAG",
                headers=HEADERS,
                json={
                    "collection": COLLECTION_ID,
                    "model": "llama-3.3-70b-instruct-fp8",
                    "messages": [
                        {
                            "role": "user",
                            "content": (
                                f"Find relevant legal standards, typical language, and risk "
                                f"indicators for this {clause_type} clause:\n\n{clause_text}"
                            ),
                        }
                    ],
                    "max_tokens": 1024,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError) as e:
            return f"RAG query failed: {e}"
