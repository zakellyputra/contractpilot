# ContractPilot

**Sign smarter. Sign safer.**

AI-powered contract reviewer. Upload any contract  -  even scanned paper documents  -  and get instant risk analysis with plain-English summaries, interactive clause highlighting, and a downloadable PDF report.

## Architecture

```
Browser → Next.js (port 3000) → Python FastAPI (port 8000)
            │                        │
        Credit system           Dedalus ADK agent
        Convex Auth                ├── Native tools: compute_risk_breakdown,
        Convex (real-time)         │   find_key_dates, search_legal_knowledge_base
                                   ├── MCP: Brave Search (broad legal context, via DAuth)
                                   ├── MCP: Exa (deep legal research, via DAuth)
                                   ├── K2 Think via Vultr (clause analysis)
                                   ├── Vultr RAG (legal knowledge base)
                                   └── Tesseract OCR (scanned docs, local)
```

### Pipeline

1. **Phase 1**  -  Local classify + extract via PyMuPDF/Tesseract OCR (instant)
2. **Phase 2**  -  Parallel: Vultr RAG + K2 Think per clause (6 concurrent) + Exa MCP legal research (~35s)
3. **Phase 3**  -  Dedalus ADK agent: summary enrichment with native tools + Exa MCP (single multi-step agent, ~15s)
4. **Phase 4**  -  Save results to Convex + generate PDF report via jsPDF

## Features

- **Risk Score (0–100)**  -  animated gauge with 4-category breakdown (Financial, Compliance, Operational, Reputational)
- **Clause-by-Clause Analysis**  -  plain English, no legal jargon. "What this means for you" + "What to watch out for" + "Suggested change"
- **Deep Review Mode**  -  side-by-side PDF viewer with color-coded clause highlights. Hover to see analysis, click to chat
- **Clause Chat**  -  ask follow-up questions about any clause. Dedalus agent with RAG + Brave + Exa searches for sourced answers
- **OCR Support**  -  Tesseract runs locally (no cloud API costs), with word-level bounding boxes for clause highlighting
- **Sub-clause Detection**  -  splits 3.1, 3.2, (a), (b), (i), (ii) into individually analyzed sub-clauses
- **Action Items**  -  prioritized checklist of what to negotiate
- **Key Dates Timeline**  -  renewal deadlines, termination windows, obligation milestones
- **PDF Report**  -  downloadable risk analysis via jsPDF
- **Credit System**  -  first review free, then 5 reviews for $2.99
- **Dark Mode**  -  full dark theme

## Prerequisites

- **Node.js** >= 18
- **Python** >= 3.11
- **npm**
- API keys for: Dedalus, Vultr, Convex

## Quick Start (Docker)

Requires [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/).

### 1. Clone

```bash
git clone https://github.com/zakellyputra/contractpilot.git && cd contractpilot
```

### 2. Configure environment

Create `backend/.env`:

```env
DEDALUS_API_KEY=sk-ded-...
DEDALUS_AS_URL=https://as.dedaluslabs.ai
VULTR_INFERENCE_API_KEY=your-vultr-key
VULTR_LEGAL_COLLECTION_ID=your-collection-id
CONVEX_URL=https://your-project.convex.cloud
FRONTEND_URL=http://localhost:3000
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
CONVEX_DEPLOYMENT=dev:your-project
```

### 3. Build and run

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend health: http://localhost:8000/health

### 4. Seed legal knowledge base (one-time)

```bash
docker compose exec backend python seed_vultr_rag.py
```

## Quick Start (Local Development)

### 1. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### 2. Convex

```bash
cd frontend
npx convex dev
# → watches for schema changes
```

### 3. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn main:app --reload --port 8000
# → http://localhost:8000
```

### 4. Seed legal knowledge base (one-time)

```bash
cd backend
python seed_vultr_rag.py
```

Downloads CUAD (500+ contracts, 41 clause types) + Legal Clauses (21K+ clauses) from Kaggle and uploads to Vultr vector store.

## Project Structure

```
contractpilot/
├── frontend/                  # Next.js 16 (App Router + Tailwind v4)
│   ├── src/app/               # Pages and API routes
│   │   ├── page.tsx           # Landing + PDF upload
│   │   ├── review/[id]/       # Real-time review results
│   │   ├── dashboard/         # Past reviews
│   │   └── billing/           # Credit purchase
│   ├── src/components/
│   │   ├── RiskDashboard.tsx  # Main review dashboard
│   │   ├── RiskScoreGauge.tsx # Animated 0-100 gauge
│   │   ├── RiskBreakdownChart.tsx  # 4-category breakdown
│   │   ├── ClauseCard.tsx     # Individual clause analysis
│   │   ├── ClauseChat.tsx     # AI chat about clauses
│   │   ├── ClauseSidebar.tsx  # Clause navigation
│   │   ├── PDFViewer.tsx      # Side-by-side PDF with highlights
│   │   ├── DeepReviewView.tsx # Deep review mode
│   │   ├── QuickSummaryView.tsx # Quick summary mode
│   │   ├── SummaryPanel.tsx   # Executive summary
│   │   ├── ActionItems.tsx    # What to negotiate
│   │   ├── RiskTimeline.tsx   # Key dates timeline
│   │   ├── UploadDropzone.tsx # Drag-and-drop upload
│   │   ├── BillingGate.tsx    # Credit paywall
│   │   └── ErrorBoundary.tsx  # Error handling
│   ├── convex/                # Convex schema + queries/mutations
│   │   ├── schema.ts
│   │   ├── reviews.ts
│   │   └── clauses.ts
│   └── Dockerfile
├── backend/                   # Python FastAPI
│   ├── main.py                # FastAPI app + routes
│   ├── agent.py               # Dedalus ADK agent (hybrid pipeline)
│   ├── tools.py               # Native Dedalus tools
│   ├── exa_search.py          # Exa MCP search integration
│   ├── k2_client.py           # K2 Think via Vultr Inference
│   ├── vultr_rag.py           # Vultr RAG legal knowledge queries
│   ├── seed_vultr_rag.py      # Kaggle data seeder (CUAD + Legal Clauses)
│   ├── chat.py                # Clause chat agent
│   ├── report_generator.py    # PDF report generation
│   ├── ocr.py                 # Tesseract OCR (local)
│   ├── docx_extractor.py      # Word document support
│   ├── prompts.py             # System prompts
│   ├── models.py              # Pydantic models
│   ├── Dockerfile
│   └── pyproject.toml
├── docker-compose.yml
└── README.md
```

## Stack

| Category | Tools |
|----------|-------|
| Agent Framework | Dedalus ADK  -  orchestrator with native tools + MCP servers |
| MCP Servers | Brave Search (via DAuth), Exa (via DAuth) |
| Native Dedalus Tools | compute_risk_breakdown, find_key_dates, search_legal_knowledge_base |
| AI Models | K2 Think / kimi-k2-instruct (Vultr Serverless Inference) |
| RAG | Vultr RAG with llama-3.3-70b  -  legal knowledge base |
| Legal Data | CUAD (500+ contracts) + Legal Clauses (21K+ clauses) |
| Auth | Convex Auth (Google OAuth) + Dedalus Auth (DAuth) for MCP credentials |
| Database | Convex  -  real-time reactive, shared by frontend + backend |
| Frontend | Next.js 16, Tailwind CSS v4, Framer Motion, react-pdf, jsPDF |
| Backend | Python, FastAPI, PyMuPDF, Tesseract OCR |
| Deployment | Vultr (compute + inference) |

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DEDALUS_API_KEY` | Dedalus Labs API key |
| `DEDALUS_AS_URL` | Dedalus Auth Server endpoint |
| `VULTR_INFERENCE_API_KEY` | Vultr Serverless Inference API key |
| `VULTR_LEGAL_COLLECTION_ID` | Vultr RAG collection ID |
| `CONVEX_URL` | Convex deployment URL |
| `FRONTEND_URL` | Frontend URL for CORS |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL (public) |
| `NEXT_PUBLIC_BACKEND_URL` | Python backend URL |
| `CONVEX_DEPLOYMENT` | Convex deployment identifier |

## Built at DevFest 2026  -  Columbia University