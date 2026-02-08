"""Dedalus ADK agent orchestration for contract analysis.

Uses Dedalus as the primary AI orchestrator with:
- Native Python tools (risk computation, date extraction) registered via ADK
- MCP server (Exa) via DAuth-secured connections for legal research
- Non-linear multi-step reasoning (agent decides tool usage dynamically)

Clause-level analysis uses direct K2+RAG for speed (6-concurrent parallelism),
while Dedalus owns the intelligence layer for summary generation, tool
orchestration, and cross-clause reasoning.
"""

import asyncio
import json
import os
import time
from pathlib import Path

from convex import ConvexClient
from dedalus_labs import AsyncDedalus, DedalusRunner
from dotenv import load_dotenv

from k2_client import analyze_clause_risk
from prompts import AGENT_SYSTEM_PROMPT
from tools import (
    categorize_risk,
    classify_contract,
    compute_risk_breakdown,
    extract_clause_positions,
    extract_clauses,
    extract_clauses_k2,
    find_key_dates,
    match_clauses_to_ocr_boxes,
)
from vultr_rag import query_legal_knowledge

load_dotenv(Path(__file__).parent / ".env")

# Dedalus client — primary orchestrator for summary generation.
# MCP servers (Exa) use Dedalus Auth (DAuth) — OAuth 2.1 credentials are
# managed securely by the Dedalus platform (intent-based, zero-trust).
# No third-party API keys are stored in this application.
client = AsyncDedalus(
    api_key=os.environ.get("DEDALUS_API_KEY", ""),
    timeout=120.0,
)

# Convex client for writing results
convex = ConvexClient(os.environ.get("CONVEX_URL", ""))


CLAUSE_CONCURRENCY = 6  # Max concurrent K2+RAG calls (raised for sub-clauses)


async def _analyze_one_clause(
    clause: dict, contract_type: str, index: int
) -> dict:
    """Analyze a single clause: RAG lookup then K2 Think. Runs concurrently."""
    clause_text = clause["text"]
    heading = clause["heading"]
    t0 = time.time()

    # Step 1: RAG lookup for legal context
    try:
        rag_context = await query_legal_knowledge(clause_text, heading)
    except Exception as e:
        rag_context = f"RAG unavailable: {e}"
        print(f"  Clause {index+1} RAG failed: {e}")

    # Step 2: K2 Think deep analysis (with RAG context)
    try:
        k2_result = await analyze_clause_risk(
            clause_text=clause_text,
            clause_type=heading,
            contract_type=contract_type,
            additional_context=rag_context,
        )
    except Exception as e:
        print(f"  Clause {index+1} K2 failed: {e}")
        k2_result = {
            "riskLevel": "medium",
            "riskCategory": "operational",
            "explanation": f"Analysis timed out for: {heading}",
            "concern": "Could not complete deep analysis",
            "suggestion": "Manual review recommended",
            "reasoning": str(e),
        }

    # Step 3: Categorize risk (local, instant)
    risk_cat = categorize_risk(clause_text, heading)

    elapsed = time.time() - t0
    print(f"  Clause {index+1} ({heading[:40]}) done in {elapsed:.1f}s")

    return {
        "clauseText": clause_text[:2000],
        "clauseType": heading,
        "riskLevel": k2_result.get("riskLevel", "medium"),
        "riskCategory": k2_result.get("riskCategory", risk_cat["category"]),
        "explanation": k2_result.get("explanation", ""),
        "concern": k2_result.get("concern", ""),
        "suggestion": k2_result.get("suggestion", ""),
        "k2Reasoning": k2_result.get("reasoning", ""),
        "parentHeading": clause.get("parentHeading"),
        "subClauseIndex": clause.get("subClauseIndex"),
    }


async def _analyze_one_clause_throttled(
    sem: asyncio.Semaphore,
    clause: dict,
    contract_type: str,
    index: int,
    position: dict | None,
    review_id: str,
    counter: dict,
    total: int,
) -> dict:
    """Analyze a clause with semaphore throttling and incremental save."""
    async with sem:
        result = await _analyze_one_clause(clause, contract_type, index)

    # Merge position data
    if position:
        result["pageNumber"] = position.get("pageNumber", 0)
        result["rects"] = json.dumps(position.get("rects", []))
        result["pageWidth"] = position.get("pageWidth", 612)
        result["pageHeight"] = position.get("pageHeight", 792)

    # Save clause to Convex immediately
    try:
        _save_one_clause(review_id, result)
    except Exception as e:
        print(f"  Warning: Failed to save clause {index+1}: {e}")

    # Update progress counter
    counter["completed"] += 1
    try:
        convex.mutation("reviews:updateProgress", {
            "id": review_id,
            "completedClauses": counter["completed"],
        })
    except Exception:
        pass

    print(f"  Progress: {counter['completed']}/{total}")
    return result


def _build_summary_prompt(
    contract_type: str,
    clause_results: list[dict],
    contract_text_preview: str,
) -> str:
    """Build the summary prompt for the Dedalus agent (and K2 fallback).

    The prompt includes clause analysis data in JSON so the agent can pass it
    to compute_risk_breakdown(), and contract text for find_key_dates().
    """
    clause_summary = ""
    for i, c in enumerate(clause_results):
        clause_summary += (
            f"\n{i+1}. [{c['riskLevel'].upper()}] {c['clauseType']}: "
            f"{c['explanation'][:200]}"
        )

    # Include clause results as JSON so the agent can feed it to tools
    clause_json = json.dumps([
        {"riskLevel": c["riskLevel"], "riskCategory": c["riskCategory"],
         "clauseType": c["clauseType"]}
        for c in clause_results
    ])

    return (
        f"Contract type: {contract_type}\n\n"
        f"Analyzed clauses:{clause_summary}\n\n"
        f"Clause data (JSON for tools):\n{clause_json}\n\n"
        f"Contract preview (first 3000 chars):\n{contract_text_preview[:3000]}\n\n"
        f"Instructions:\n"
        f"1. Use compute_risk_breakdown with the clause data JSON above to get precise risk scores.\n"
        f"2. Use find_key_dates with the contract preview to extract important dates.\n"
        f"3. Optionally search for legal standards relevant to this {contract_type} via Exa.\n"
        f"4. Synthesize everything into:\n"
        f"   - A 2-3 sentence executive summary in plain English (no jargon)\n"
        f"   - Overall risk score (0-100) and category scores from the tool\n"
        f"   - 3-5 prioritized action items (what the signer should do)\n"
        f"   - Key dates from the tool output\n\n"
        f"Respond ONLY with valid JSON, no markdown:\n"
        f'{{"summary": "...", "riskScore": N, "financialRisk": N, '
        f'"complianceRisk": N, "operationalRisk": N, "reputationalRisk": N, '
        f'"actionItems": ["..."], "keyDates": [{{"date": "...", "label": "...", "type": "deadline|renewal|termination|milestone"}}]}}'
    )


def _parse_llm_json(output: str) -> dict:
    """Parse JSON from an LLM response, stripping code fences if present."""
    if "```json" in output:
        output = output.split("```json")[1].split("```")[0]
    elif "```" in output:
        output = output.split("```")[1].split("```")[0]
    return json.loads(output.strip())


def _local_fallback_summary(contract_type: str, clause_results: list[dict]) -> dict:
    """Compute summary locally from clause results (no LLM, instant)."""
    risk_levels = {"high": 80, "medium": 50, "low": 20}
    scores = [risk_levels.get(c.get("riskLevel", "medium"), 50) for c in clause_results]
    avg = int(sum(scores) / len(scores)) if scores else 50
    return {
        "summary": f"This {contract_type} contains {len(clause_results)} clauses requiring attention.",
        "riskScore": avg,
        "financialRisk": avg,
        "complianceRisk": avg,
        "operationalRisk": avg,
        "reputationalRisk": avg,
        "actionItems": [
            c.get("suggestion", "Review this clause")
            for c in clause_results
            if c.get("riskLevel") in ("high", "medium")
        ][:5] or ["Review the full contract with a lawyer"],
        "keyDates": [],
    }


async def _generate_summary(
    contract_type: str,
    clause_results: list[dict],
    contract_text_preview: str,
) -> dict:
    """Generate summary + action items + key dates via Dedalus agent.

    Dedalus is the primary orchestrator with native tools (compute_risk_breakdown,
    find_key_dates) and MCP server (Exa) for legal research. The agent dynamically
    decides which tools to invoke based on the analysis context — genuine non-linear
    multi-step reasoning.

    Falls back to K2 Think, then local computation.
    """
    prompt = _build_summary_prompt(contract_type, clause_results, contract_text_preview)

    # ── Attempt 1: Dedalus agent with native tools + Exa MCP (60s) ──
    # The agent can:
    #   - Call compute_risk_breakdown() to calculate precise category scores
    #   - Call find_key_dates() to extract dates from the contract text
    #   - Use Exa MCP (via DAuth) to research legal standards and precedents
    #   - Synthesize all tool outputs into the final summary
    try:
        runner = DedalusRunner(client)
        response = await asyncio.wait_for(
            runner.run(
                model="anthropic/claude-sonnet-4-5",
                input=prompt,
                instructions=AGENT_SYSTEM_PROMPT,
                tools=[compute_risk_breakdown, find_key_dates],
                mcp_servers=["exa-labs/exa-mcp-server"],
                max_steps=5,
                stream=False,
            ),
            timeout=60.0,
        )
        output = getattr(response, "final_output", "") or ""
        result = _parse_llm_json(output)
        print("  Summary via Dedalus OK (multi-tool agent)")
        return result
    except asyncio.TimeoutError:
        print("  Dedalus timed out (60s), falling back to K2")
    except Exception as e:
        print(f"  Dedalus summary failed: {e}, falling back to K2")

    # ── Attempt 2: K2 Think via Vultr (direct LLM, no tools) ────────
    try:
        from k2_client import k2

        response = await k2.chat.completions.create(
            model="kimi-k2-instruct",
            messages=[
                {"role": "system", "content": "You are ContractPilot. Respond ONLY with valid JSON."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=1024,
        )
        output = response.choices[0].message.content or "{}"
        result = _parse_llm_json(output)
        print("  Summary via K2 fallback OK")
        return result
    except Exception as e:
        print(f"  K2 summary also failed: {e}, using local fallback")

    # ── Attempt 3: Local computation (instant, no LLM) ──────────────
    return _local_fallback_summary(contract_type, clause_results)


async def run_contract_analysis(
    review_id: str,
    pdf_text: str,
    user_id: str,
    ocr_used: bool = False,
    pdf_bytes: bytes = b"",
    ocr_words: list = None,
) -> dict:
    """Run the hybrid contract analysis pipeline.

    Phase 1: Classification + K2-powered clause extraction (direct Python)
    Phase 2: Concurrent clause analysis via K2+RAG (6 parallel, direct Python)
    Phase 3: Dedalus agent summary with native tools + Exa MCP (multi-step)

    Clause-level analysis uses direct K2+RAG for speed (parallelism can't go
    through an agent loop). Dedalus owns the intelligence layer — dynamically
    choosing between compute_risk_breakdown, find_key_dates, and Exa research
    to generate the final summary.
    """
    t_start = time.time()

    # Update status to processing
    try:
        convex.mutation("reviews:updateStatus", {"id": review_id, "status": "processing"})
    except Exception:
        pass

    try:
        # ── Phase 1: Classification + K2-powered extraction ─────────
        print(f"[{review_id}] Phase 1: classify + extract (K2)")
        contract_type = classify_contract(pdf_text[:5000])
        all_clauses = await extract_clauses_k2(pdf_text)
        print(f"  Type: {contract_type}, Clauses found: {len(all_clauses)}")

        # Report total clause count to frontend
        try:
            convex.mutation("reviews:updateProgress", {
                "id": review_id,
                "totalClauses": len(all_clauses),
                "completedClauses": 0,
            })
        except Exception:
            pass

        # Extract clause positions from PDF
        clause_positions = []
        if pdf_bytes:
            try:
                if ocr_used and ocr_words:
                    clause_positions = match_clauses_to_ocr_boxes(all_clauses, ocr_words, pdf_bytes)
                    print(f"  Matched OCR positions for {len(clause_positions)} clauses")
                else:
                    clause_positions = extract_clause_positions(pdf_bytes, all_clauses)
                    print(f"  Extracted positions for {len(clause_positions)} clauses")
            except Exception as e:
                print(f"  Position extraction failed: {e}")

        # ── Phase 2: Analyze ALL clauses (semaphore-throttled) ──────
        # Direct K2+RAG for speed — 6-concurrent parallelism requires
        # direct execution, not an agent loop.
        print(f"[{review_id}] Phase 2: analyzing {len(all_clauses)} clauses (max {CLAUSE_CONCURRENCY} concurrent)")
        t_phase2 = time.time()

        sem = asyncio.Semaphore(CLAUSE_CONCURRENCY)
        counter = {"completed": 0}

        clause_results = list(await asyncio.gather(
            *[
                _analyze_one_clause_throttled(
                    sem, clause, contract_type, i,
                    clause_positions[i] if i < len(clause_positions) else None,
                    review_id, counter, len(all_clauses),
                )
                for i, clause in enumerate(all_clauses)
            ]
        ))

        print(f"  Phase 2 done in {time.time() - t_phase2:.1f}s")

        # ── Phase 3: Dedalus agent summary (multi-tool orchestration) ─
        # Dedalus agent with native tools + Exa MCP. The agent decides
        # which tools to call: risk computation, date extraction, and/or
        # web research via Exa (DAuth-secured). This is genuine non-linear
        # multi-step reasoning — the core Dedalus showcase.
        print(f"[{review_id}] Phase 3: Dedalus agent summary (tools + Exa MCP)")
        t_phase3 = time.time()

        summary_data = await _generate_summary(
            contract_type, clause_results, pdf_text,
        )

        print(f"  Phase 3 done in {time.time() - t_phase3:.1f}s")

        # ── Phase 4: Assemble + save ─────────────────────────────────
        result = {
            "contractType": contract_type,
            "summary": summary_data.get("summary", ""),
            "riskScore": summary_data.get("riskScore", 50),
            "financialRisk": summary_data.get("financialRisk", 50),
            "complianceRisk": summary_data.get("complianceRisk", 50),
            "operationalRisk": summary_data.get("operationalRisk", 50),
            "reputationalRisk": summary_data.get("reputationalRisk", 50),
            "clauses": clause_results,
            "actionItems": summary_data.get("actionItems", []),
            "keyDates": summary_data.get("keyDates", []),
        }

        _save_results(review_id, result, ocr_used)

        elapsed = time.time() - t_start
        print(f"[{review_id}] DONE in {elapsed:.1f}s — {contract_type}, score {result['riskScore']}, {len(clause_results)} clauses")

        return result

    except Exception as e:
        try:
            convex.mutation(
                "reviews:updateStatus", {"id": review_id, "status": "failed"}
            )
        except Exception:
            pass
        raise RuntimeError(f"Agent analysis failed: {e}") from e


def _save_one_clause(review_id: str, clause: dict) -> None:
    """Save a single analyzed clause to Convex."""
    clause_data = {
        "reviewId": review_id,
        "clauseText": clause.get("clauseText", ""),
        "clauseType": clause.get("clauseType", "Unknown"),
        "riskLevel": clause.get("riskLevel", "medium"),
        "riskCategory": clause.get("riskCategory", "operational"),
        "explanation": clause.get("explanation", ""),
        "concern": clause.get("concern"),
        "suggestion": clause.get("suggestion"),
        "k2Reasoning": clause.get("k2Reasoning"),
    }
    if "pageNumber" in clause:
        clause_data["pageNumber"] = clause["pageNumber"]
        clause_data["rects"] = clause.get("rects", "[]")
        clause_data["pageWidth"] = clause.get("pageWidth", 612)
        clause_data["pageHeight"] = clause.get("pageHeight", 792)
    if clause.get("parentHeading"):
        clause_data["parentHeading"] = clause["parentHeading"]
    if clause.get("subClauseIndex") is not None:
        clause_data["subClauseIndex"] = clause["subClauseIndex"]
    convex.mutation("clauses:addClause", clause_data)


def _save_results(review_id: str, result: dict, ocr_used: bool) -> None:
    """Save summary results to Convex. Clauses are already saved incrementally."""
    try:
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
                "pdfUrl": f"/pdf/{review_id}",
                "ocrUsed": ocr_used,
            },
        )
    except Exception as e:
        print(f"Warning: Failed to save results to Convex: {e}")
