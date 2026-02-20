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


def extract_text(file_bytes: bytes, filename: str, use_ocr: bool) -> tuple[str, bool, list]:
    """Extract text from a PDF or DOCX file. Returns (text, ocr_used, ocr_words).

    For PDFs: uses PyMuPDF direct extraction, or Tesseract OCR if use_ocr is True.
    For DOCX: uses python-docx (OCR is never needed).
    ocr_words is a list of word dicts with positions (empty if OCR not used).
    """
    if filename.lower().endswith(".docx"):
        from docx_extractor import extract_docx_text

        return extract_docx_text(file_bytes), False, []

    # PDF path — use Tesseract if user toggled OCR on
    if use_ocr:
        from ocr import ocr_pdf_with_positions

        text, words = ocr_pdf_with_positions(file_bytes)
        return text, True, words

    doc = fitz.open(stream=file_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()

    return text, False, []


async def _run_analysis(review_id: str, pdf_text: str, pdf_bytes: bytes, user_id: str, ocr_used: bool, ocr_words: list = None):
    """Background task: run the full agent analysis pipeline."""
    try:
        await asyncio.wait_for(
            run_contract_analysis(review_id, pdf_text, user_id, ocr_used, pdf_bytes, ocr_words or []),
            timeout=300.0,
        )
    except asyncio.TimeoutError:
        print(f"Analysis timed out for {review_id} (5-minute cap)")
        try:
            convex.mutation("reviews:updateStatus", {"id": review_id, "status": "failed"})
        except Exception:
            pass
    except BaseException as e:
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
    use_ocr: str = Form("false"),
):
    """Upload a contract (PDF or DOCX) and start AI analysis."""
    try:
        filename = file.filename or "document"
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in ("pdf", "docx"):
            from fastapi.responses import JSONResponse

            return JSONResponse(
                {"error": "Unsupported file type. Upload a PDF or Word (.docx) file."},
                status_code=400,
            )

        file_bytes = await file.read()
        print(f"Received file: {filename}, size: {len(file_bytes)} bytes")

        # Extract text (OCR only applies to PDFs when toggled on by user)
        ocr_flag = use_ocr.lower() in ("true", "1", "yes")
        doc_text, ocr_used, ocr_words = extract_text(file_bytes, filename, ocr_flag)
        print(f"Extracted {len(doc_text)} chars, ocr_used={ocr_used}, ocr_words={len(ocr_words)}")

        # Create review in Convex
        try:
            review_id = convex.mutation(
                "reviews:create",
                {"userId": user_id, "filename": filename},
            )
        except Exception:
            # Convex not configured — return placeholder
            return {"review_id": "demo", "status": "pending", "ocr_used": ocr_used}

        # Store PDF for the viewer
        pdf_path = PDF_STORAGE_DIR / f"{review_id}.pdf"
        pdf_path.write_bytes(file_bytes)

        # Run analysis in background
        background_tasks.add_task(_run_analysis, review_id, doc_text, file_bytes, user_id, ocr_used, ocr_words)

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
