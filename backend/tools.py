"""Custom tool functions for the Dedalus agent.

Each function is a tool the agent can call. Dedalus auto-extracts schemas
from the type hints and docstrings.
"""

import base64
import json
import re

import fitz

from k2_client import analyze_clause_risk
from ocr import ocr_pdf
from vultr_rag import query_legal_knowledge


def extract_clauses(contract_text: str) -> list[dict]:
    """Extract individual clauses from a contract's full text.

    Splits the contract into logical sections based on numbered headings,
    section markers, or paragraph structure.

    Args:
        contract_text: The full contract text.

    Returns:
        List of dicts with 'text' and 'heading' for each clause.
    """
    clauses = []
    # Split on common section patterns:
    #   "1.1", "2.14" (decimal numbering — common in legal docs)
    #   "1.", "2)" (single-level numbering)
    #   "Section 1", "ARTICLE I"
    #   "ALL CAPS HEADING:"
    pattern = (
        r"(?:^|\n)"
        r"(?="
        r"\d+\.\d+(?:\.\d+)*[\.\)]*\s"   # 1.1, 2.14, 1.2.3 (decimal)
        r"|\d+[\.\)]\s"                    # 1., 2) (single-level)
        r"|Section\s+\d"                    # Section 1
        r"|ARTICLE\s+[IVX\d]"              # ARTICLE I, ARTICLE 1
        r"|[A-Z][A-Z\s]{3,}:"              # ALL CAPS HEADING:
        r")"
    )
    sections = re.split(pattern, contract_text)

    for section in sections:
        section = section.strip()
        if len(section) < 30:
            continue

        # Extract heading from first line; if it's just a number (e.g. "1.2"),
        # combine with the next line to form a descriptive heading
        lines = section.split("\n", 2)
        heading = lines[0].strip()[:100]
        if re.match(r"^\d+[\.\d]*[\.\)]*$", heading) and len(lines) > 1:
            next_line = lines[1].strip()[:80]
            heading = f"{heading} {next_line}"[:100]
        text = section[:3000]  # Cap clause length

        clauses.append({"heading": heading, "text": text})

    # If no sections found, split by double newlines
    if not clauses:
        paragraphs = contract_text.split("\n\n")
        for i, para in enumerate(paragraphs):
            para = para.strip()
            if len(para) < 30:
                continue
            clauses.append({"heading": f"Section {i + 1}", "text": para[:3000]})

    return clauses


MAX_CLAUSES = 60  # Hard cap on total clauses (including sub-clauses)


def _cap_clauses(clauses: list[dict], limit: int = MAX_CLAUSES) -> list[dict]:
    """Cap clause list to limit, prioritizing top-level clauses over sub-clauses.

    Ensures broad document coverage by keeping all top-level clauses first,
    then filling remaining slots with sub-clauses in order.
    """
    if len(clauses) <= limit:
        return clauses

    top_level = [c for c in clauses if not c.get("parentHeading")]
    sub_clauses = [c for c in clauses if c.get("parentHeading")]

    if len(top_level) >= limit:
        return top_level[:limit]

    remaining = limit - len(top_level)
    kept_subs = sub_clauses[:remaining]

    # Rebuild in original order
    kept_set = set(id(c) for c in top_level) | set(id(c) for c in kept_subs)
    return [c for c in clauses if id(c) in kept_set]


_SUB_CLAUSE_PATTERN = re.compile(
    r"(?:^|\n)\s*(?:"
    r"\d+\.\d+[\.\)]*\s"           # 3.1, 3.1., 3.1)
    r"|\([a-z]\)\s"                 # (a), (b)
    r"|\([ivxlc]+\)\s"             # (i), (ii), (iv)
    r"|\([A-Z]\)\s"                 # (A), (B)
    r"|[a-z][\.\)]\s"              # a., b)
    r"|\d+\.\d+\.\d+[\.\)]*\s"    # 3.1.1, 3.1.1.
    r")",
    re.MULTILINE,
)


def split_into_subclauses(clauses: list[dict]) -> list[dict]:
    """Split clauses that contain sub-parts into individual sub-clause entries.

    Detects sub-clause patterns like 3.1, 3.2, (a), (b), (i), (ii) within
    each clause's text. Clauses with detected sub-parts are expanded into
    separate entries with a parentHeading field.

    Args:
        clauses: List of clause dicts with 'heading' and 'text'.

    Returns:
        Expanded list where multi-part clauses are split into sub-entries.
    """
    result = []
    for clause in clauses:
        text = clause["text"]
        heading = clause["heading"]

        matches = list(_SUB_CLAUSE_PATTERN.finditer(text))

        # If fewer than 2 sub-parts found, keep clause as-is
        if len(matches) < 2:
            result.append(clause)
            continue

        # Keep preamble text (before first sub-clause) as standalone entry
        preamble_end = matches[0].start()
        preamble = text[:preamble_end].strip()
        if len(preamble) > 30:
            result.append({
                "heading": heading,
                "text": preamble[:3000],
            })

        # Split into individual sub-clauses
        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            sub_text = text[start:end].strip()

            if len(sub_text) < 20:
                continue

            sub_lines = sub_text.split("\n", 1)
            sub_heading = sub_lines[0].strip()[:100]

            result.append({
                "heading": sub_heading,
                "text": sub_text[:3000],
                "parentHeading": heading,
                "subClauseIndex": i,
            })

    return result


async def extract_clauses_k2(contract_text: str) -> list[dict]:
    """Extract clauses using full-text regex + K2 intelligent filtering.

    For short documents (< 6000 chars): sends full text to K2 directly,
    then splits sub-clauses.
    For large documents: runs regex on full text, splits sub-clauses,
    then uses K2 to filter out non-substantive sections.

    Args:
        contract_text: The full contract text.

    Returns:
        List of dicts with 'text' and 'heading' for each clause.
        Sub-clause entries also have 'parentHeading' and 'subClauseIndex'.
    """
    from k2_client import k2

    # ── Short documents: K2 single-pass (existing proven approach) ────
    if len(contract_text) <= 6000:
        prompt = (
            "You are a contract analyst. Given the contract text below, identify ONLY "
            "the actual numbered or titled clauses/sections that contain substantive "
            "legal terms and obligations.\n\n"
            "EXCLUDE:\n"
            "- Preambles, recitals, 'WHEREAS' sections\n"
            "- Title pages, headers, footers\n"
            "- Signature blocks, witness sections, acknowledgments\n"
            "- 'KNOW ALL MEN BY THESE PRESENTS' and similar boilerplate\n\n"
            "For each clause, return its heading (the section number and title) and its "
            "full text.\n\n"
            f"CONTRACT TEXT:\n{contract_text}\n\n"
            "Respond ONLY with a valid JSON array. No markdown, no explanation:\n"
            '[{"heading": "1. Scope of Work", "text": "full clause text here..."}, ...]'
        )

        try:
            response = await k2.chat.completions.create(
                model="kimi-k2-instruct",
                messages=[
                    {"role": "system", "content": "Extract contract clauses. Return JSON only."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2048,
            )
            content = response.choices[0].message.content or "[]"

            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            clauses = json.loads(content.strip())

            if isinstance(clauses, list) and len(clauses) > 0:
                validated = []
                for c in clauses:
                    if isinstance(c, dict) and "text" in c:
                        validated.append({
                            "heading": c.get("heading", "Clause")[:100],
                            "text": c["text"][:3000],
                        })
                if validated:
                    return _cap_clauses(split_into_subclauses(validated))
        except Exception as e:
            print(f"  K2 clause extraction failed: {e}, falling back to regex")

        return _cap_clauses(split_into_subclauses(extract_clauses(contract_text)))

    # ── Large documents: hybrid regex-first + K2 filtering ────────────
    print(f"  Large document ({len(contract_text)} chars), using hybrid extraction")

    # Step A: Full-text regex extraction (instant, no limits)
    raw_clauses = extract_clauses(contract_text)
    print(f"  Regex extracted {len(raw_clauses)} top-level sections")

    # Step B: Split into sub-clauses
    expanded = split_into_subclauses(raw_clauses)
    print(f"  After sub-clause split: {len(expanded)} total entries")

    # Step C: Build compact TOC for K2 filtering
    toc_lines = []
    for i, c in enumerate(expanded):
        prefix = f"  (sub of: {c['parentHeading'][:40]})" if c.get("parentHeading") else ""
        preview = c["text"][:150].replace("\n", " ")
        toc_lines.append(f"{i}: {c['heading'][:60]}{prefix} | {preview}")

    toc = "\n".join(toc_lines)

    # Step D: K2 filters the TOC
    filter_prompt = (
        "You are a contract analyst. Below is a table of contents of sections "
        "extracted from a contract. Each line has format: INDEX: HEADING | PREVIEW\n\n"
        "Return a JSON object with:\n"
        '- "keep": list of index numbers to KEEP (substantive clauses with legal obligations)\n'
        '- "remove": list of index numbers to REMOVE (preambles, signatures, boilerplate, '
        "table of contents, headers, footers, blank sections, witness blocks)\n\n"
        f"TABLE OF CONTENTS ({len(expanded)} sections):\n{toc}\n\n"
        'Respond ONLY with valid JSON: {"keep": [0, 2, 3], "remove": [1, 4]}'
    )

    try:
        response = await k2.chat.completions.create(
            model="kimi-k2-instruct",
            messages=[
                {"role": "system", "content": "Filter contract sections. Return JSON only."},
                {"role": "user", "content": filter_prompt},
            ],
            max_tokens=512,
        )
        content = response.choices[0].message.content or "{}"

        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        filter_result = json.loads(content.strip())
        keep_indices = set(filter_result.get("keep", range(len(expanded))))

        filtered = [expanded[i] for i in range(len(expanded)) if i in keep_indices]
        print(f"  K2 filtered to {len(filtered)} clauses (removed {len(expanded) - len(filtered)})")

        if filtered:
            return _cap_clauses(filtered)
    except Exception as e:
        print(f"  K2 filtering failed: {e}, using all regex-extracted clauses")

    return _cap_clauses(expanded)


def classify_contract(contract_text: str) -> str:
    """Classify the type of contract based on its content.

    Args:
        contract_text: The full contract text.

    Returns:
        Contract type string (e.g., "NDA", "Employment Agreement", "Lease").
    """
    text_lower = contract_text[:5000].lower()

    if any(term in text_lower for term in ["non-disclosure", "nda", "confidential information"]):
        return "NDA"
    elif any(term in text_lower for term in ["employment", "employee", "employer", "at-will"]):
        return "Employment Agreement"
    elif any(term in text_lower for term in ["lease", "landlord", "tenant", "premises", "rent"]):
        return "Lease Agreement"
    elif any(term in text_lower for term in ["freelance", "independent contractor", "scope of work"]):
        return "Freelance/Contractor Agreement"
    elif any(term in text_lower for term in ["service agreement", "services", "service level"]):
        return "Service Agreement"
    elif any(term in text_lower for term in ["purchase", "buyer", "seller", "sale"]):
        return "Purchase Agreement"
    elif any(term in text_lower for term in ["partnership", "joint venture"]):
        return "Partnership Agreement"
    elif any(term in text_lower for term in ["license", "licensor", "licensee"]):
        return "License Agreement"
    else:
        return "General Contract"


def categorize_risk(clause_text: str, clause_type: str) -> dict:
    """Assign risk category per the MetricStream framework.

    Categories:
      - financial: clauses that could cost money (penalties, liability, payment)
      - compliance: regulatory/legal exposure (privacy, non-compete enforceability)
      - operational: limits on what you can do (exclusivity, IP, termination)
      - reputational: potential for brand damage (confidentiality gaps, indemnification)

    Args:
        clause_text: The clause text.
        clause_type: The type of clause.

    Returns:
        Dict with category and rationale.
    """
    ct = clause_type.lower()
    text = clause_text.lower()

    if any(term in ct for term in ["liability", "payment", "penalty", "damages", "fee", "cost"]):
        return {"category": "financial", "rationale": "Direct monetary impact"}
    elif any(term in text for term in ["liquidated damages", "cap on liability", "indemnif"]):
        return {"category": "financial", "rationale": "Financial exposure clause"}
    elif any(term in ct for term in ["non-compete", "compliance", "privacy", "data", "regulatory"]):
        return {"category": "compliance", "rationale": "Regulatory or legal compliance risk"}
    elif any(term in ct for term in ["exclusivity", "assignment", "ip", "termination", "non-solicit"]):
        return {"category": "operational", "rationale": "Restricts operational freedom"}
    elif any(term in ct for term in ["confidential", "non-disparage", "publicity"]):
        return {"category": "reputational", "rationale": "Reputation or brand risk"}
    elif any(term in text for term in ["penalt", "fine", "fee", "cost", "payment"]):
        return {"category": "financial", "rationale": "Contains financial terms"}
    elif any(term in text for term in ["shall not", "restricted", "prohibited", "exclusive"]):
        return {"category": "operational", "rationale": "Contains operational restrictions"}
    else:
        return {"category": "operational", "rationale": "General operational clause"}


def compute_risk_breakdown(clause_results_json: str) -> str:
    """Compute risk category breakdown scores from analyzed clause results.

    Calculates weighted financial, compliance, operational, and reputational
    risk scores based on clause-level analysis. High-risk clauses contribute
    more weight to their category score.

    Args:
        clause_results_json: JSON array of analyzed clauses, each with
            riskLevel ('high'|'medium'|'low') and riskCategory
            ('financial'|'compliance'|'operational'|'reputational').

    Returns:
        JSON object with category scores (0-100), overall score, and distribution.
    """
    try:
        clauses = json.loads(clause_results_json)
    except (json.JSONDecodeError, TypeError):
        return json.dumps({"error": "Invalid JSON input"})

    risk_weights = {"high": 85, "medium": 50, "low": 15}
    categories = {
        "financial": [], "compliance": [],
        "operational": [], "reputational": [],
    }

    for c in clauses:
        cat = c.get("riskCategory", "operational")
        level = c.get("riskLevel", "medium")
        score = risk_weights.get(level, 50)
        if cat in categories:
            categories[cat].append(score)
        # Every clause also contributes partially to its level
        categories.setdefault(cat, []).append(score)

    result = {}
    all_scores = []
    for cat, scores in categories.items():
        if scores:
            avg = int(sum(scores) / len(scores))
            result[f"{cat}Risk"] = avg
            all_scores.extend(scores)
        else:
            result[f"{cat}Risk"] = 25  # default low if no clauses in category

    result["riskScore"] = int(sum(all_scores) / len(all_scores)) if all_scores else 50
    result["distribution"] = {
        cat: len(scores) for cat, scores in categories.items()
    }
    result["totalClauses"] = len(clauses)

    return json.dumps(result)


def find_key_dates(contract_text: str) -> str:
    """Extract dates, deadlines, and time-sensitive terms from contract text.

    Searches for date patterns (MM/DD/YYYY, Month DD YYYY, etc.), renewal
    windows, termination notice periods, and milestone deadlines.

    Args:
        contract_text: The full contract text to search for dates.

    Returns:
        JSON array of date objects with date, label, and type fields.
    """
    dates = []
    text = contract_text[:10000]  # cap for performance

    # Date patterns: "January 1, 2025", "01/01/2025", "2025-01-01"
    date_pattern = re.compile(
        r"(?:(?:January|February|March|April|May|June|July|August|September|"
        r"October|November|December)\s+\d{1,2},?\s+\d{4})"
        r"|(?:\d{1,2}/\d{1,2}/\d{2,4})"
        r"|(?:\d{4}-\d{2}-\d{2})"
    )

    # Find dates with surrounding context
    for match in date_pattern.finditer(text):
        date_str = match.group()
        start = max(0, match.start() - 100)
        end = min(len(text), match.end() + 100)
        context = text[start:end].replace("\n", " ").strip()

        # Classify the date type
        ctx_lower = context.lower()
        if any(w in ctx_lower for w in ["terminat", "expir", "end date"]):
            dtype = "termination"
        elif any(w in ctx_lower for w in ["renew", "extend", "auto-renew"]):
            dtype = "renewal"
        elif any(w in ctx_lower for w in ["deadline", "due", "by", "no later than"]):
            dtype = "deadline"
        elif any(w in ctx_lower for w in ["effective", "commence", "start"]):
            dtype = "milestone"
        else:
            dtype = "milestone"

        # Extract a label from context
        label_start = max(0, match.start() - 60)
        label_text = text[label_start:match.end()].replace("\n", " ").strip()
        # Take the sentence fragment containing the date
        sentences = re.split(r"[.;]", label_text)
        label = sentences[-1].strip() if sentences else label_text
        label = label[:120]

        dates.append({"date": date_str, "label": label, "type": dtype})

    # Deduplicate by date string
    seen = set()
    unique = []
    for d in dates:
        if d["date"] not in seen:
            seen.add(d["date"])
            unique.append(d)

    return json.dumps(unique[:15])  # cap at 15 dates


def format_review_report(
    contract_type: str,
    clauses: list[dict],
    risk_scores: dict,
    summary: str,
    action_items: list[str],
    key_dates: list[dict],
) -> dict:
    """Format the final review report for storage in Convex.

    Args:
        contract_type: Type of contract.
        clauses: List of analyzed clause results.
        risk_scores: Dict with overall, financial, compliance, operational, reputational scores.
        summary: Executive summary in plain English.
        action_items: Prioritized list of recommended actions.
        key_dates: List of key dates extracted from the contract.

    Returns:
        Formatted review report dict.
    """
    return {
        "contractType": contract_type,
        "summary": summary,
        "riskScore": risk_scores.get("overall", 50),
        "financialRisk": risk_scores.get("financial", 50),
        "complianceRisk": risk_scores.get("compliance", 50),
        "operationalRisk": risk_scores.get("operational", 50),
        "reputationalRisk": risk_scores.get("reputational", 50),
        "clauses": clauses,
        "actionItems": action_items,
        "keyDates": key_dates,
    }


def ocr_document(pdf_base64: str) -> str:
    """Extract text from a scanned PDF using Tesseract OCR.

    Use this when pdf-parse returns poor or empty results (scanned documents).

    Args:
        pdf_base64: Base64-encoded PDF bytes.

    Returns:
        Extracted text from the scanned document.
    """
    pdf_bytes = base64.b64decode(pdf_base64)
    return ocr_pdf(pdf_bytes)


def _expand_to_paragraph(page, start_rect, clause_text: str) -> list[dict]:
    """Expand a single-line rect to cover the full clause paragraph.

    Uses page.get_text("dict") to find consecutive lines that overlap
    with the clause text, starting from the line containing start_rect.

    Args:
        page: PyMuPDF page object.
        start_rect: The fitz.Rect of the first matched snippet.
        clause_text: Full clause text to match against.

    Returns:
        List of rect dicts [{x0, y0, x1, y1}] covering the paragraph.
    """
    # Get all text blocks/lines on the page
    page_dict = page.get_text("dict")
    all_lines = []
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:  # text blocks only
            continue
        for line in block.get("lines", []):
            bbox = line["bbox"]
            line_text = " ".join(span["text"] for span in line.get("spans", []))
            all_lines.append({"bbox": bbox, "text": line_text})

    if not all_lines:
        return [{"x0": start_rect.x0, "y0": start_rect.y0,
                 "x1": start_rect.x1, "y1": start_rect.y1}]

    # Build a set of words from the clause text for overlap checking
    clause_words = set(re.findall(r"[a-zA-Z]{3,}", clause_text.lower()[:500]))

    # Find the starting line (the one containing start_rect's y-center)
    start_y = (start_rect.y0 + start_rect.y1) / 2
    start_idx = 0
    min_dist = float("inf")
    for i, line in enumerate(all_lines):
        line_y = (line["bbox"][1] + line["bbox"][3]) / 2
        dist = abs(line_y - start_y)
        if dist < min_dist:
            min_dist = dist
            start_idx = i

    # Collect consecutive lines that overlap with clause words
    rects = []
    for i in range(start_idx, min(start_idx + 30, len(all_lines))):
        line = all_lines[i]
        line_words = set(re.findall(r"[a-zA-Z]{3,}", line["text"].lower()))
        overlap = len(line_words & clause_words)

        if i == start_idx:
            # Always include the start line
            rects.append({
                "x0": line["bbox"][0], "y0": line["bbox"][1],
                "x1": line["bbox"][2], "y1": line["bbox"][3],
            })
        elif overlap >= 2 or (overlap >= 1 and len(line_words) <= 3):
            rects.append({
                "x0": line["bbox"][0], "y0": line["bbox"][1],
                "x1": line["bbox"][2], "y1": line["bbox"][3],
            })
        else:
            break  # No more overlap, stop expanding

    return rects if rects else [{"x0": start_rect.x0, "y0": start_rect.y0,
                                  "x1": start_rect.x1, "y1": start_rect.y1}]


def extract_clause_positions(pdf_bytes: bytes, clauses: list[dict]) -> list[dict]:
    """Find the page and bounding boxes for each clause in the PDF.

    Uses PyMuPDF text search to locate each clause's opening text,
    then expands to cover the full paragraph.

    Args:
        pdf_bytes: Raw PDF file bytes.
        clauses: List of clause dicts with 'text' and 'heading' keys.

    Returns:
        List of position dicts (same order as input clauses), each with:
        pageNumber (0-indexed), rects ([{x0,y0,x1,y1}]), pageWidth, pageHeight.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    positions = []

    for clause in clauses:
        raw = clause["text"].strip()
        found = False

        # Try progressively shorter snippets
        for snippet_len in (80, 50, 30):
            snippet = " ".join(raw[:snippet_len].split())  # normalize whitespace
            if len(snippet) < 10:
                continue

            for page_num in range(len(doc)):
                page = doc[page_num]
                rects = page.search_for(snippet)
                if rects:
                    # Expand from the first match to cover the full paragraph
                    expanded_rects = _expand_to_paragraph(page, rects[0], raw)
                    positions.append({
                        "pageNumber": page_num,
                        "rects": expanded_rects,
                        "pageWidth": page.rect.width,
                        "pageHeight": page.rect.height,
                    })
                    found = True
                    break
            if found:
                break

        if not found:
            # Fallback: no position data for this clause
            positions.append({
                "pageNumber": 0,
                "rects": [],
                "pageWidth": 612,
                "pageHeight": 792,
            })

    doc.close()
    return positions


def match_clauses_to_ocr_boxes(
    clauses: list[dict],
    ocr_words: list[dict],
    pdf_bytes: bytes,
) -> list[dict]:
    """Match clause text to OCR word bounding boxes for scanned PDFs.

    Uses fuzzy sliding-window matching to find clause positions from
    OCR word data, then groups words into line-level highlight rects.

    Args:
        clauses: List of clause dicts with 'text' and 'heading'.
        ocr_words: Flat list of word dicts from ocr_pdf_with_positions().
        pdf_bytes: Raw PDF bytes (used to get page dimensions).

    Returns:
        List of position dicts matching extract_clause_positions() format.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_dims = {}
    for i in range(len(doc)):
        page_dims[i] = {"width": doc[i].rect.width, "height": doc[i].rect.height}
    doc.close()

    positions = []

    for clause in clauses:
        raw = clause["text"].strip()
        clause_words_lower = re.findall(r"[a-z0-9]+", raw[:200].lower())
        if len(clause_words_lower) < 3:
            positions.append({
                "pageNumber": 0, "rects": [],
                "pageWidth": 612, "pageHeight": 792,
            })
            continue

        # Sliding window: match first 8 words of clause against OCR words
        target = clause_words_lower[:8]
        best_idx = -1
        best_score = 0

        for i in range(len(ocr_words) - len(target)):
            score = 0
            for j, tw in enumerate(target):
                if i + j < len(ocr_words) and ocr_words[i + j]["text"].lower().startswith(tw[:4]):
                    score += 1
            if score > best_score:
                best_score = score
                best_idx = i

        if best_score < 3 or best_idx < 0:
            positions.append({
                "pageNumber": 0, "rects": [],
                "pageWidth": 612, "pageHeight": 792,
            })
            continue

        # Collect words from match point (~40 words on same page)
        page_num = ocr_words[best_idx]["page"]
        matched_words = []
        for k in range(best_idx, min(best_idx + 40, len(ocr_words))):
            w = ocr_words[k]
            if w["page"] != page_num:
                break
            matched_words.append(w)

        if not matched_words:
            dims = page_dims.get(page_num, {"width": 612, "height": 792})
            positions.append({
                "pageNumber": page_num, "rects": [],
                "pageWidth": dims["width"], "pageHeight": dims["height"],
            })
            continue

        # Group words into line-level rects (merge words with similar y)
        lines = []
        current_line = [matched_words[0]]
        for w in matched_words[1:]:
            prev_y = (current_line[-1]["y0"] + current_line[-1]["y1"]) / 2
            curr_y = (w["y0"] + w["y1"]) / 2
            if abs(curr_y - prev_y) < 8:
                current_line.append(w)
            else:
                lines.append(current_line)
                current_line = [w]
        lines.append(current_line)

        rects = []
        for line_words in lines:
            rects.append({
                "x0": min(w["x0"] for w in line_words),
                "y0": min(w["y0"] for w in line_words),
                "x1": max(w["x1"] for w in line_words),
                "y1": max(w["y1"] for w in line_words),
            })

        dims = page_dims.get(page_num, {"width": 612, "height": 792})
        positions.append({
            "pageNumber": page_num,
            "rects": rects,
            "pageWidth": dims["width"],
            "pageHeight": dims["height"],
        })

    return positions


async def query_legal_context(clause_text: str, clause_type: str) -> str:
    """Query the Vultr RAG legal knowledge base for relevant standards.

    Args:
        clause_text: The clause text to research.
        clause_type: Type of clause.

    Returns:
        Relevant legal standards and context from CUAD/Legal Clauses datasets.
    """
    return await query_legal_knowledge(clause_text, clause_type)
