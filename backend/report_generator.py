"""PDF report generation using WeasyPrint.

Generates a styled risk analysis PDF from review + clause data.
"""

import html


def _risk_color(score: int) -> str:
    """Return a color hex based on risk score (0=green, 100=red)."""
    if score >= 70:
        return "#ef4444"  # red
    elif score >= 40:
        return "#f59e0b"  # amber
    else:
        return "#22c55e"  # green


def _risk_badge(level: str) -> str:
    """Return styled HTML badge for risk level."""
    colors = {"high": "#ef4444", "medium": "#f59e0b", "low": "#22c55e"}
    bg = colors.get(level, "#6b7280")
    return (
        f'<span style="background:{bg};color:white;padding:2px 8px;'
        f'border-radius:4px;font-size:12px;font-weight:bold;">'
        f"{level.upper()}</span>"
    )


def generate_pdf_report(review: dict, clauses: list[dict]) -> bytes:
    """Generate a PDF risk analysis report.

    Args:
        review: Review data from Convex (summary, scores, action items, etc.)
        clauses: List of clause analysis results.

    Returns:
        PDF bytes.
    """
    risk_score = review.get("riskScore", 50)
    summary = html.escape(review.get("summary", ""))
    contract_type = html.escape(review.get("contractType", "Contract"))
    filename = html.escape(review.get("filename", "document.pdf"))

    # Build clause cards HTML — group sub-clauses under parent headings
    clause_cards = ""
    current_parent = None
    for clause in clauses:
        parent = clause.get("parentHeading")

        # Render parent group header when entering a new parent group
        if parent and parent != current_parent:
            current_parent = parent
            clause_cards += (
                f'<h4 style="margin-top:16px;margin-bottom:4px;color:#374151;'
                f'font-size:14px;">{html.escape(parent)}</h4>'
            )
        elif not parent:
            current_parent = None

        indent = "margin-left:24px;border-left:3px solid #bfdbfe;" if parent else ""
        clause_cards += f"""
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;{indent}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <strong>{html.escape(clause.get('clauseType', 'Clause'))}</strong>
                {_risk_badge(clause.get('riskLevel', 'medium'))}
            </div>
            <p style="color:#374151;margin:4px 0;"><strong>What this means:</strong>
                {html.escape(clause.get('explanation', ''))}</p>
            {"<p style='color:#dc2626;margin:4px 0;'><strong>Watch out:</strong> "
             + html.escape(clause.get('concern', '')) + "</p>" if clause.get('concern') else ""}
            {"<p style='color:#059669;margin:4px 0;'><strong>Suggestion:</strong> "
             + html.escape(clause.get('suggestion', '')) + "</p>" if clause.get('suggestion') else ""}
        </div>
        """

    # Build action items HTML
    action_items_html = ""
    for i, item in enumerate(review.get("actionItems", []), 1):
        action_items_html += f"<li>{html.escape(item)}</li>"

    # Build key dates HTML
    key_dates_html = ""
    for kd in review.get("keyDates", []):
        key_dates_html += (
            f"<tr><td>{html.escape(kd.get('date', ''))}</td>"
            f"<td>{html.escape(kd.get('label', ''))}</td>"
            f"<td>{html.escape(kd.get('type', ''))}</td></tr>"
        )

    report_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
               margin: 40px; color: #1f2937; line-height: 1.5; }}
        h1 {{ color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }}
        h2 {{ color: #374151; margin-top: 24px; }}
        .score-box {{ display: inline-block; padding: 12px 24px; border-radius: 12px;
                      font-size: 32px; font-weight: bold; color: white;
                      background: {_risk_color(risk_score)}; }}
        .risk-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }}
        .risk-item {{ padding: 12px; border-radius: 8px; background: #f9fafb;
                      border: 1px solid #e5e7eb; }}
        .risk-item .label {{ font-size: 12px; color: #6b7280; text-transform: uppercase; }}
        .risk-item .value {{ font-size: 24px; font-weight: bold; }}
        table {{ width: 100%; border-collapse: collapse; margin: 12px 0; }}
        th, td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }}
        th {{ background: #f9fafb; font-weight: 600; }}
        .footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb;
                   color: #9ca3af; font-size: 12px; }}
    </style>
</head>
<body>
    <h1>ContractPilot Risk Analysis</h1>
    <p><strong>Document:</strong> {filename} &nbsp;|&nbsp;
       <strong>Type:</strong> {contract_type}</p>

    <h2>Overall Risk Score</h2>
    <div class="score-box">{risk_score}/100</div>

    <div class="risk-grid">
        <div class="risk-item">
            <div class="label">Financial Risk</div>
            <div class="value" style="color:{_risk_color(review.get('financialRisk', 50))}">
                {review.get('financialRisk', 50)}</div>
        </div>
        <div class="risk-item">
            <div class="label">Compliance Risk</div>
            <div class="value" style="color:{_risk_color(review.get('complianceRisk', 50))}">
                {review.get('complianceRisk', 50)}</div>
        </div>
        <div class="risk-item">
            <div class="label">Operational Risk</div>
            <div class="value" style="color:{_risk_color(review.get('operationalRisk', 50))}">
                {review.get('operationalRisk', 50)}</div>
        </div>
        <div class="risk-item">
            <div class="label">Reputational Risk</div>
            <div class="value" style="color:{_risk_color(review.get('reputationalRisk', 50))}">
                {review.get('reputationalRisk', 50)}</div>
        </div>
    </div>

    <h2>Executive Summary</h2>
    <p>{summary}</p>

    <h2>Clause Analysis</h2>
    {clause_cards}

    {"<h2>What to Do Next</h2><ol>" + action_items_html + "</ol>" if action_items_html else ""}

    {"<h2>Key Dates</h2><table><tr><th>Date</th><th>Description</th><th>Type</th></tr>"
     + key_dates_html + "</table>" if key_dates_html else ""}

    <div class="footer">
        Generated by ContractPilot &mdash; AI-powered contract review.
        This is not legal advice. Consult a qualified attorney for legal decisions.
    </div>
</body>
</html>"""

    from weasyprint import HTML  # lazy import — requires pango/glib system libs

    return HTML(string=report_html).write_pdf()
