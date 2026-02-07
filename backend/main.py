import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

load_dotenv()

app = FastAPI(title="ContractPilot Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_contract(
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    """Upload a contract PDF and start AI analysis."""
    # TODO: Phase 2 — wire up Dedalus agent pipeline
    pdf_bytes = await file.read()
    return {
        "review_id": "placeholder",
        "filename": file.filename,
        "size": len(pdf_bytes),
        "status": "pending",
    }


@app.get("/report/{review_id}")
async def get_report(review_id: str):
    """Download the PDF risk analysis report."""
    # TODO: Phase 2 — generate and return PDF report
    return Response(content=b"", media_type="application/pdf")
