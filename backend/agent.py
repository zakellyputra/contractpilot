"""Dedalus ADK agent orchestration for contract analysis.

Hybrid pipeline: runs classify/extract/RAG/K2 directly in Python for speed,
uses Dedalus for a single LLM call (summary + action items) to keep prize eligibility.

Timeline: ~1.5 min instead of ~8 min.
"""

import asyncio
import json
import os
import time
from pathlib import Path

from convex import ConvexClient
from dedalus_labs import AsyncDedalus, DedalusRunner
from dotenv import load_dotenv

from exa_search import search_legal_context
from k2_client import analyze_clause_risk
from prompts import AGENT_SYSTEM_PROMPT
from tools import categorize_risk, classify_contract, extract_clause_positions, extract_clauses
from vultr_rag import query_legal_knowledge

load_dotenv(Path(__file__).parent / ".env")

# Dedalus client — used for summary generation (single call)
client = AsyncDedalus(
    api_key=os.environ.get("DEDALUS_API_KEY", ""),
    timeout=120.0,
)

# Convex client for writing results
convex = ConvexClient(os.environ.get("CONVEX_URL", ""))


CLAUSE_CONCURRENCY = 4  # Max concurrent K2+RAG calls


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
    exa_context: str = "",
) -> str:
    """Build the summary prompt used by both Dedalus and K2 fallback."""
    clause_summary = ""
    for i, c in enumerate(clause_results):
        clause_summary += (
            f"\n{i+1}. [{c['riskLevel'].upper()}] {c['clauseType']}: "
            f"{c['explanation'][:200]}"
        )

    exa_section = ""
    if exa_context:
        exa_section = (
            f"\n\nIndustry standards and comparable contracts (via Exa research):\n"
            f"{exa_context[:2000]}\n"
        )

    return (
        f"Contract type: {contract_type}\n\n"
        f"Analyzed clauses:{clause_summary}\n\n"
        f"Contract preview (first 3000 chars):\n{contract_text_preview[:3000]}\n\n"
        f"{exa_section}"
        f"Generate:\n"
        f"1. A 2-3 sentence executive summary in plain English (no jargon)\n"
        f"2. An overall risk score (0-100) and scores for: financial, compliance, operational, reputational\n"
        f"3. 3-5 prioritized action items (what the signer should do)\n"
        f"4. Key dates from the contract (deadlines, renewals, termination windows)\n\n"
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
    exa_context: str = "",
) -> dict:
    """Generate summary + action items + key dates via K2 Think.

    Falls back to Dedalus, then local computation.
    """
    prompt = _build_summary_prompt(contract_type, clause_results, contract_text_preview, exa_context)

    # ── Attempt 1: K2 Think via Vultr (60s timeout built-in) ────────
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
        print("  Summary via K2 OK")
        return result
    except Exception as e:
        print(f"  K2 summary failed: {e}, falling back to Dedalus")

    # ── Attempt 2: Dedalus (45s hard timeout) ───────────────────────
    try:
        runner = DedalusRunner(client)
        response = await asyncio.wait_for(
            runner.run(
                model="anthropic/claude-sonnet-4-5",
                input=prompt,
                instructions=(
                    "You are ContractPilot. Write in plain English, no legal jargon. "
                    "Be direct and practical. Respond ONLY with valid JSON, no markdown."
                ),
                tools=[],
                max_steps=1,
                stream=False,
            ),
            timeout=45.0,
        )
        output = getattr(response, "final_output", "") or ""
        result = _parse_llm_json(output)
        print("  Summary via Dedalus OK")
        return result
    except asyncio.TimeoutError:
        print("  Dedalus timed out (45s), using local fallback")
    except Exception as e:
        print(f"  Dedalus also failed: {e}, using local fallback")

    # ── Attempt 3: Local computation (instant, no LLM) ──────────────
    return _local_fallback_summary(contract_type, clause_results)


async def run_contract_analysis(
    review_id: str,
    pdf_text: str,
    user_id: str,
    ocr_used: bool = False,
    pdf_bytes: bytes = b"",
) -> dict:
    """Run the hybrid contract analysis pipeline.

    Direct Python for speed + single Dedalus call for prize eligibility.
    ~1.5 min instead of ~8 min.
    """
    t_start = time.time()

    # Update status to processing
    try:
        convex.mutation("reviews:updateStatus", {"id": review_id, "status": "processing"})
    except Exception:
        pass

    try:
        # ── Phase 1: Local extraction (instant) ──────────────────────
        print(f"[{review_id}] Phase 1: classify + extract")
        contract_type = classify_contract(pdf_text[:5000])
        all_clauses = extract_clauses(pdf_text)
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

        # Extract clause positions from PDF (instant, no API calls)
        clause_positions = []
        if pdf_bytes:
            try:
                clause_positions = extract_clause_positions(pdf_bytes, all_clauses)
                print(f"  Extracted positions for {len(clause_positions)} clauses")
            except Exception as e:
                print(f"  Position extraction failed: {e}")

        # ── Phase 2: Analyze ALL clauses (semaphore-throttled) + Exa ──
        print(f"[{review_id}] Phase 2: analyzing {len(all_clauses)} clauses (max {CLAUSE_CONCURRENCY} concurrent) + Exa MCP")
        t_phase2 = time.time()

        sem = asyncio.Semaphore(CLAUSE_CONCURRENCY)
        counter = {"completed": 0}

        clause_headings = [c["heading"] for c in all_clauses[:10]]  # Exa only needs a sample
        clause_results_nested, exa_context = await asyncio.gather(
            asyncio.gather(
                *[
                    _analyze_one_clause_throttled(
                        sem, clause, contract_type, i,
                        clause_positions[i] if i < len(clause_positions) else None,
                        review_id, counter, len(all_clauses),
                    )
                    for i, clause in enumerate(all_clauses)
                ]
            ),
            search_legal_context(contract_type, clause_headings),
        )
        clause_results = list(clause_results_nested)

        if exa_context:
            print(f"  Exa context: {len(exa_context)} chars")
        else:
            print("  Exa context: empty (timed out or unavailable)")
        print(f"  Phase 2 done in {time.time() - t_phase2:.1f}s")

        # ── Phase 3: K2 summary (single LLM call) ────────────────────
        print(f"[{review_id}] Phase 3: K2 summary")
        t_phase3 = time.time()

        summary_data = await _generate_summary(
            contract_type, clause_results, pdf_text, exa_context
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
