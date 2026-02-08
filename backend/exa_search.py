"""Exa MCP search integration via Dedalus ADK.

DEPRECATED: Exa search is now integrated directly into the Dedalus summary
agent (agent.py) and chat agent (chat.py) via MCP server registration.
The agents invoke Exa organically through their multi-step tool loops.

This module is kept for backward compatibility but is no longer called
by the main pipeline.
"""

import asyncio
import os
import warnings
from pathlib import Path

from dedalus_labs import AsyncDedalus, DedalusRunner
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

_exa_client = AsyncDedalus(
    api_key=os.environ.get("DEDALUS_API_KEY", ""),
    timeout=30.0,
)

EXA_TIMEOUT_SECONDS = 30.0


async def search_legal_context(
    contract_type: str,
    clause_headings: list[str],
) -> str:
    """Search Exa for legal context about this contract type and its clauses.

    DEPRECATED: Use the Dedalus summary agent with mcp_servers=["exa-labs/exa-mcp-server"]
    instead. The agent handles Exa research as part of its multi-step reasoning.
    """
    warnings.warn(
        "search_legal_context is deprecated. Exa search is now handled by the "
        "Dedalus summary agent via MCP server integration.",
        DeprecationWarning,
        stacklevel=2,
    )

    if not os.environ.get("DEDALUS_API_KEY"):
        return ""

    clauses_text = ", ".join(clause_headings[:3])
    search_prompt = (
        f"Search for legal standards, common risks, and best practices for "
        f"{contract_type} contracts, specifically regarding these clause types: "
        f"{clauses_text}. "
        f"Find examples of how these clauses are typically written in fair, "
        f"balanced contracts versus one-sided ones. "
        f"Return a concise summary of findings."
    )

    try:
        runner = DedalusRunner(_exa_client)

        response = await asyncio.wait_for(
            runner.run(
                model="anthropic/claude-sonnet-4-5",
                input=search_prompt,
                instructions=(
                    "You are a legal research assistant. Use the Exa search tool "
                    "to find relevant legal standards and contract precedents. "
                    "Summarize findings concisely in 3-5 bullet points. "
                    "Focus on practical risks and standard language."
                ),
                tools=[],
                mcp_servers=["exa-labs/exa-mcp-server"],
                max_steps=3,
                stream=False,
            ),
            timeout=EXA_TIMEOUT_SECONDS,
        )

        output = getattr(response, "final_output", "") or ""
        if output:
            print(f"  Exa MCP returned {len(output)} chars")
        return output

    except asyncio.TimeoutError:
        print(f"  Exa MCP timed out ({EXA_TIMEOUT_SECONDS}s)")
        return ""
    except Exception as e:
        print(f"  Exa MCP failed: {e}")
        return ""
