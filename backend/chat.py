"""Clause-specific chat via Dedalus ADK with combined native + MCP tools.

Primary: Dedalus agent with:
- Native tool: search_legal_knowledge_base (Vultr RAG for CUAD/legal standards)
- MCP servers: Brave Search + Exa (via DAuth-secured connections)
- Multi-step reasoning (agent decides which tools to call)

The agent dynamically chooses between:
- Searching the legal knowledge base (native RAG tool) for clause standards
- Searching the web (Brave MCP) for recent legal developments
- Searching academic/legal sources (Exa MCP) for deeper research
- Synthesizing all sources into a coherent answer

Fallback: Direct K2 Think + RAG (always works, no Dedalus required).
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

# Dedalus client — primary chat agent orchestrator.
# MCP servers (Brave, Exa) use Dedalus Auth (DAuth) — OAuth 2.1 credentials
# are managed securely by the Dedalus platform. No third-party API keys needed.
_chat_client = AsyncDedalus(
    api_key=os.environ.get("DEDALUS_API_KEY", ""),
    timeout=60.0,
)

_k2 = AsyncOpenAI(
    api_key=os.environ.get("VULTR_INFERENCE_API_KEY", ""),
    base_url="https://api.vultrinference.com/v1",
    timeout=60.0,
)

AGENT_TIMEOUT = 50.0


# ── Native tool for Dedalus agent ──────────────────────────────────────
async def search_legal_knowledge_base(clause_text: str, clause_type: str) -> str:
    """Search the legal knowledge base for relevant standards and precedents.

    Queries the Vultr RAG system containing CUAD dataset and legal clause
    standards to find relevant legal context for a specific clause.

    Args:
        clause_text: The contract clause text to research.
        clause_type: Type of clause (e.g., "Indemnification", "Non-compete").

    Returns:
        Relevant legal standards, common practices, and risk factors.
    """
    return await query_legal_knowledge(clause_text[:1000], clause_type)


async def chat_about_clause(
    question: str,
    clause_text: str,
    clause_type: str,
    contract_type: str,
    chat_history: list[dict] | None = None,
) -> dict:
    """Answer a user question about a contract clause.

    Primary: Dedalus agent with native RAG tool + dual MCP (Brave + Exa).
    Fallback: Direct K2 Think + RAG (no Dedalus required).
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

    # --- Primary: Dedalus agent with native + MCP tools ---
    if os.environ.get("DEDALUS_API_KEY"):
        try:
            result = await _dedalus_multi_tool_chat(
                question, clause_text, clause_type, contract_type, history_text
            )
            answer = result.get("answer", "")
            if answer:
                print(f"  Chat: Dedalus multi-tool agent OK ({len(answer)} chars)")
                return result
            print("  Chat: Dedalus returned empty response, falling back")
        except Exception as e:
            print(f"  Chat: Dedalus agent failed ({e}), falling back")

    # --- Fallback: Direct RAG + K2 ---
    print("  Chat: Using direct RAG + K2 fallback")
    return await _rag_k2_chat(
        question, clause_text, clause_type, contract_type, history_text
    )


async def _dedalus_multi_tool_chat(
    question: str,
    clause_text: str,
    clause_type: str,
    contract_type: str,
    history_text: str,
) -> dict:
    """Primary path: Dedalus agent with native RAG tool + Brave + Exa MCP.

    The agent dynamically decides which tools to call:
    - search_legal_knowledge_base (native): query CUAD/legal clause standards
    - brave_web_search (Brave MCP): search the web for recent legal info
    - exa search (Exa MCP): search academic/legal sources for deeper research
    """
    prompt = (
        f"The user is reviewing a {contract_type} contract and has a question about "
        f"a specific clause.\n\n"
        f"Clause type: {clause_type}\n"
        f"Clause text: {clause_text[:1500]}\n"
        f"{history_text}\n\n"
        f"User question: {question}\n\n"
        f"Use your available tools to research this question:\n"
        f"- search_legal_knowledge_base: query the legal knowledge base for standards and precedents\n"
        f"- Web search tools: find recent legal information and examples\n"
        f"Then synthesize your findings into a clear, well-sourced answer."
    )

    runner = DedalusRunner(_chat_client)
    response = await asyncio.wait_for(
        runner.run(
            model="anthropic/claude-sonnet-4-5",
            input=prompt,
            instructions=(
                "You are a legal research assistant helping a user understand "
                "a contract clause. You have access to:\n"
                "1. A legal knowledge base tool (search_legal_knowledge_base) — use this "
                "to find legal standards, CUAD dataset context, and clause benchmarks.\n"
                "2. Web search tools (Brave, Exa) — use these for recent legal "
                "developments, case examples, and best practices.\n\n"
                "Use at least one tool before answering. Combine multiple sources "
                "when possible for a comprehensive answer.\n"
                "Answer in plain English, 2-4 paragraphs. "
                "Cite sources where possible with URLs."
            ),
            tools=[search_legal_knowledge_base],
            mcp_servers=["brave-search/brave-search", "exa-labs/exa-mcp-server"],
            max_steps=5,
            stream=False,
        ),
        timeout=AGENT_TIMEOUT,
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
