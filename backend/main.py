import asyncio
import os
from pathlib import Path

import fitz  # pymupdf
from convex import ConvexClient
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from pydantic import BaseModel

from agent import run_contract_analysis
from chat import chat_about_clause
from report_generator import generate_pdf_report

# Load .env from the backend directory regardless of cwd
load_dotenv(Path(__file__).parent / ".env")

# Directory for storing uploaded PDFs (served back for the PDF viewer)
PDF_STORAGE_DIR = Path(__file__).parent / "pdf_storage"
PDF_STORAGE_DIR.mkdir(exist_ok=True)

app = FastAPI(title="ContractPilot Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


async def _run_analysis(review_id: str, pdf_text: str, pdf_bytes: bytes, user_id: str, ocr_used: bool):
    """Background task: run the full agent analysis pipeline."""
    try:
        await run_contract_analysis(review_id, pdf_text, user_id, ocr_used, pdf_bytes)
    except Exception as e:
        import traceback
        print(f"Analysis failed for {review_id}: {e}")
        traceback.print_exc()
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
    user_id: str = Form("dev-user"),
):
    """Upload a contract PDF and start AI analysis."""
    try:
        pdf_bytes = await file.read()
        print(f"Received file: {file.filename}, size: {len(pdf_bytes)} bytes")

        # Extract text (with OCR fallback)
        pdf_text, ocr_used = extract_pdf_text(pdf_bytes)
        print(f"Extracted {len(pdf_text)} chars, ocr_used={ocr_used}")

        # Create review in Convex
        try:
            review_id = convex.mutation(
                "reviews:create",
                {"userId": user_id, "filename": file.filename or "contract.pdf"},
            )
        except Exception:
            # Convex not configured — return placeholder
            return {"review_id": "demo", "status": "pending", "ocr_used": ocr_used}

        # Store PDF for the viewer
        pdf_path = PDF_STORAGE_DIR / f"{review_id}.pdf"
        pdf_path.write_bytes(pdf_bytes)

        # Run analysis in background
        background_tasks.add_task(_run_analysis, review_id, pdf_text, pdf_bytes, user_id, ocr_used)

        return {"review_id": review_id, "status": "pending", "ocr_used": ocr_used}
    except Exception as e:
        import traceback
        traceback.print_exc()
        from fastapi.responses import JSONResponse
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/pdf/{review_id}")
async def get_pdf(review_id: str):
    """Serve the original uploaded PDF for the viewer."""
    pdf_path = PDF_STORAGE_DIR / f"{review_id}.pdf"
    if not pdf_path.exists():
        return Response(content=b"PDF not found", status_code=404)
    return Response(
        content=pdf_path.read_bytes(),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=contract.pdf"},
    )


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


class ChatRequest(BaseModel):
    question: str
    clause_text: str
    clause_type: str = "Clause"
    contract_type: str = "General Contract"
    chat_history: list[dict] = []


@app.post("/chat")
async def chat_clause(request: ChatRequest):
    """Chat about a specific clause using Exa research."""
    result = await chat_about_clause(
        question=request.question,
        clause_text=request.clause_text,
        clause_type=request.clause_type,
        contract_type=request.contract_type,
        chat_history=request.chat_history,
    )
    return result
