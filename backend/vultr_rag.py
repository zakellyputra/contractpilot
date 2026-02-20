"""Vultr RAG client — legal knowledge base queries.

Queries the Vultr vector store seeded with curated legal reference data.
Uses kimi-k2-instruct model for RAG queries.
"""

import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

VULTR_BASE = "https://api.vultrinference.com/v1"
VULTR_API_KEY = os.environ.get("VULTR_INFERENCE_API_KEY", "")
COLLECTION_ID = os.environ.get("VULTR_LEGAL_COLLECTION_ID", "")
HEADERS = {
    "Authorization": f"Bearer {VULTR_API_KEY}",
    "Content-Type": "application/json",
}


async def query_legal_knowledge(
    clause_text: str, clause_type: str, contract_type: str = "General Contract"
) -> str:
    """Query Vultr RAG for relevant legal standards and precedent.

    Args:
        clause_text: The clause text to research.
        clause_type: Type of clause (e.g., "non-compete").
        contract_type: Type of contract (e.g., "NDA", "Lease Agreement").

    Returns:
        Legal context string from the knowledge base.
    """
    if not VULTR_API_KEY or not COLLECTION_ID:
        return "Legal knowledge base not configured."

    query = (
        f"For a {clause_type} clause in a {contract_type}, find:\n"
        f"1. Standard market language and common deviations\n"
        f"2. Risk indicators and red flags\n"
        f"3. Relevant legal standards or regulations\n"
        f"4. Typical negotiation points\n\n"
        f"Clause text:\n{clause_text}"
    )

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.post(
                f"{VULTR_BASE}/chat/completions/RAG",
                headers=HEADERS,
                json={
                    "collection": COLLECTION_ID,
                    "model": "kimi-k2-instruct",
                    "messages": [
                        {"role": "user", "content": query}
                    ],
                    "max_tokens": 1024,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError) as e:
            return f"RAG query failed: {e}"
