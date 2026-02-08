"""Clause-specific chat via Dedalus ADK + Brave MCP, with Vultr RAG+K2 fallback.

Primary: Dedalus agent with Brave search MCP for web research.
Fallback: Vultr RAG (legal knowledge base) + K2 Think (reasoning) — always works.
"""

import asyncio
import os
import re
from pathlib import Path

from dedalus_labs import AsyncDedalus, DedalusRunner
from dotenv import load_dotenv
from openai import AsyncOpenAI

from vultr_rag import query_legal_knowledge

load_dotenv(Path(__file__).parent / ".env")

_chat_client = AsyncDedalus(
    api_key=os.environ.get("DEDALUS_API_KEY", ""),
    timeout=45.0,
)

_k2 = AsyncOpenAI(
    api_key=os.environ.get("VULTR_INFERENCE_API_KEY", ""),
    base_url="https://api.vultrinference.com/v1",
    timeout=60.0,
)

BRAVE_TIMEOUT = 40.0
FAIL_PHRASES = ("unable to access", "cannot access", "couldn't access", "can't access",
                "not available", "tool is not", "no search results")


async def chat_about_clause(
    question: str,
    clause_text: str,
    clause_type: str,
    contract_type: str,
    chat_history: list[dict] | None = None,
) -> dict:
    """Answer a user question about a contract clause.

    Tries Brave MCP first, falls back to Vultr RAG + K2.
    Returns: {"answer": str, "sources": list[str]}
    """
    history = chat_history or []
    recent = history[-4:] if len(history) > 4 else history
    history_text = ""
    if recent:
        history_text = "\n\nRecent conversation:\n" + "\n".join(
            f"{'User' if m.get('role') == 'user' else 'Assistant'}: {m.get('content', '')}"
            for m in recent
        )

    # --- Try Brave MCP via Dedalus ---
    if os.environ.get("DEDALUS_API_KEY"):
        try:
            result = await _brave_mcp_chat(
                question, clause_text, clause_type, contract_type, history_text
            )
            # Check if MCP actually worked
            answer = result.get("answer", "")
            if answer and not any(p in answer.lower() for p in FAIL_PHRASES):
                print(f"  Chat: Brave MCP OK ({len(answer)} chars)")
                return result
            print("  Chat: Brave MCP returned unhelpful response, falling back")
        except Exception as e:
            print(f"  Chat: Brave MCP failed ({e}), falling back")

    # --- Fallback: Vultr RAG + K2 ---
    print("  Chat: Using Vultr RAG + K2 fallback")
    return await _rag_k2_chat(
        question, clause_text, clause_type, contract_type, history_text
    )


async def _brave_mcp_chat(
    question: str,
    clause_text: str,
    clause_type: str,
    contract_type: str,
    history_text: str,
) -> dict:
    """Primary path: Dedalus + Brave search MCP."""
    prompt = (
        f"The user is reviewing a {contract_type} contract and has a question about "
        f"a specific clause.\n\n"
        f"Clause type: {clause_type}\n"
        f"Clause text: {clause_text[:1500]}\n"
        f"{history_text}\n\n"
        f"User question: {question}\n\n"
        f"Search for relevant legal information, precedents, and examples "
        f"related to this question and clause. Then answer the question clearly, "
        f"citing what you found."
    )

    runner = DedalusRunner(_chat_client)
    response = await asyncio.wait_for(
        runner.run(
            model="anthropic/claude-sonnet-4-5",
            input=prompt,
            instructions=(
                "You are a legal research assistant helping a user understand "
                "a contract clause. Use the brave_web_search tool to find relevant "
                "legal standards, case examples, and best practices. "
                "Answer in plain English, 2-4 paragraphs. "
                "Cite sources where possible with URLs. "
                "If you find relevant examples, include them."
            ),
            tools=[],
            mcp_servers=["brave-search/brave-search"],
            max_steps=3,
            stream=False,
        ),
        timeout=BRAVE_TIMEOUT,
    )

    answer = getattr(response, "final_output", "") or ""
    sources = _extract_sources(response)
    return {"answer": answer, "sources": sources}


async def _rag_k2_chat(
    question: str,
    clause_text: str,
    clause_type: str,
    contract_type: str,
    history_text: str,
) -> dict:
    """Fallback path: Vultr RAG for context + K2 for reasoning."""
    # Get RAG context (always works, returns error string on failure)
    rag_context = await query_legal_knowledge(clause_text[:1000], clause_type)

    user_prompt = (
        f"You are a legal research assistant. A user is reviewing a {contract_type} "
        f"contract and has a question about a clause.\n\n"
        f"Clause type: {clause_type}\n"
        f"Clause text:\n{clause_text[:1500]}\n\n"
        f"Legal research context:\n{rag_context}\n"
        f"{history_text}\n\n"
        f"User question: {question}\n\n"
        f"Answer in plain English, 2-4 paragraphs. Be specific and practical. "
        f"Reference the legal context above where relevant."
    )

    try:
        response = await _k2.chat.completions.create(
            model="kimi-k2-instruct",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful legal assistant explaining contract clauses "
                        "to non-lawyers. Be direct, practical, and specific. "
                        "Reference legal standards and common practices."
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=1024,
        )
        answer = response.choices[0].message.content or ""
        print(f"  Chat: K2 fallback OK ({len(answer)} chars)")
        return {"answer": answer, "sources": []}
    except Exception as e:
        print(f"  Chat: K2 fallback also failed: {e}")
        return {
            "answer": (
                "I can provide some guidance based on the clause analysis. "
                f"This {clause_type} clause in your {contract_type} contract "
                "should be reviewed carefully with a legal professional for "
                "specific advice about your situation."
            ),
            "sources": [],
        }


def _extract_sources(response) -> list[str]:
    """Pull URLs from MCP tool results if available."""
    sources = []
    tool_results = getattr(response, "tool_results", []) or []
    for tr in tool_results:
        result_text = tr.get("result", "") if isinstance(tr, dict) else str(tr)
        urls = re.findall(r'https?://[^\s"\'<>]+', result_text)
        sources.extend(urls)
    return list(dict.fromkeys(sources))[:5]  # dedupe, max 5
