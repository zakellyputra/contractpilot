import asyncio
import os

import fitz  # pymupdf
from convex import ConvexClient
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from agent import run_contract_analysis
from report_generator import generate_pdf_report

load_dotenv()

app = FastAPI(title="ContractPilot Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Convex client for creating reviews and fetching results
convex = ConvexClient(os.environ.get("CONVEX_URL", ""))


def extract_pdf_text(pdf_bytes: bytes) -> tuple[str, bool]:
    """Extract text from PDF. Returns (text, ocr_used).

    First tries PyMuPDF direct extraction. If text is too short,
    falls back to Google Vision OCR.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()

    # If direct extraction got reasonable text, use it
    if len(text.strip()) > 100:
        return text, False

    # Fallback to OCR for scanned documents
    from ocr import ocr_pdf

    ocr_text = ocr_pdf(pdf_bytes)
    return ocr_text, True


async def _run_analysis(review_id: str, pdf_text: str, user_id: str, ocr_used: bool):
    """Background task: run the full agent analysis pipeline."""
    try:
        await run_contract_analysis(review_id, pdf_text, user_id, ocr_used)
    except Exception as e:
        print(f"Analysis failed for {review_id}: {e}")
        try:
            convex.mutation("reviews:updateStatus", {"id": review_id, "status": "failed"})
        except Exception:
            pass


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_contract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    """Upload a contract PDF and start AI analysis."""
    pdf_bytes = await file.read()

    # Extract text (with OCR fallback)
    pdf_text, ocr_used = extract_pdf_text(pdf_bytes)

    # Create review in Convex
    try:
        review_id = convex.mutation(
            "reviews:create",
            {"userId": user_id, "filename": file.filename or "contract.pdf"},
        )
    except Exception:
        # Convex not configured — return placeholder
        return {"review_id": "demo", "status": "pending", "ocr_used": ocr_used}

    # Run analysis in background
    background_tasks.add_task(_run_analysis, review_id, pdf_text, user_id, ocr_used)

    return {"review_id": review_id, "status": "pending", "ocr_used": ocr_used}


@app.get("/report/{review_id}")
async def get_report(review_id: str):
    """Download the PDF risk analysis report."""
    try:
        review = convex.query("reviews:get", {"id": review_id})
        clauses = convex.query("clauses:getByReview", {"reviewId": review_id})
    except Exception:
        return Response(content=b"Report not available", status_code=404)

    if not review or review.get("status") != "completed":
        return Response(content=b"Review not completed yet", status_code=202)

    pdf_bytes = generate_pdf_report(review, clauses or [])
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=contractpilot-report.pdf"},
    )
