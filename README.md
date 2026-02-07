# ContractPilot

AI-powered contract reviewer. Upload any contract — even scanned paper documents — and get instant risk analysis with plain-English summaries and a downloadable PDF report.

## Architecture

```
Browser → Next.js (port 3000) → Python FastAPI (port 8000)
            │                        │
        Flowglad billing        Dedalus ADK agent
        Convex (real-time)         ├── MCP: DAuth (security)
                                   ├── MCP: pdf-parse (doc parsing)
                                   ├── MCP: brave-search (broad search)
                                   ├── MCP: exa-mcp (deep search)
                                   ├── MCP: context7 (template comparison)
                                   ├── K2 Think via Vultr (clause analysis)
                                   ├── Vultr RAG (legal knowledge base)
                                   └── Google Vision OCR (scanned docs)
```

## Prerequisites

- **Node.js** >= 18
- **Python** >= 3.11
- **npm**
- API keys for: Dedalus, Vultr, Google Cloud Vision, Flowglad, Convex

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url> && cd contractpilot
```

### 2. Frontend setup

```bash
cd frontend
npm install
```

Copy `.env.local` and fill in your keys:

```
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
FLOWGLAD_SECRET_KEY=sk_test_...
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### 3. Convex setup

```bash
cd frontend
npx convex dev
```

This will prompt you to create a Convex project and deploy the schema. Keep this running — it watches for changes.

### 4. Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

Copy `.env` and fill in your keys:

```
DEDALUS_API_KEY=sk-ded-...
DEDALUS_AS_URL=https://as.dedaluslabs.ai
VULTR_INFERENCE_API_KEY=your-vultr-key
VULTR_LEGAL_COLLECTION_ID=your-collection-id
CONVEX_URL=https://your-project.convex.cloud
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
FRONTEND_URL=http://localhost:3000
```

### 5. Seed legal knowledge base (one-time)

```bash
cd backend
python seed_vultr_rag.py
```

Downloads CUAD + Legal Clauses datasets from Kaggle and uploads to Vultr vector store.

### 6. Run the app

Open three terminals:

```bash
# Terminal 1 — Frontend
cd frontend
npm run dev
# → http://localhost:3000

# Terminal 2 — Convex
cd frontend
npx convex dev
# → watches for schema changes

# Terminal 3 — Backend
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
# → http://localhost:8000
```

### 7. Verify

- Frontend: http://localhost:3000
- Backend health: http://localhost:8000/health → `{"status": "ok"}`
- Convex dashboard: shown in terminal output

## Project Structure

```
contractpilot/
├── frontend/                # Next.js 14 (App Router + Tailwind)
│   ├── app/                 # Pages and API routes
│   ├── components/          # React components
│   └── lib/                 # Utilities (auth, billing, API client)
├── convex/                  # Convex schema + queries/mutations
├── backend/                 # Python FastAPI
│   ├── main.py              # FastAPI app + routes
│   ├── agent.py             # Dedalus ADK agent orchestration
│   ├── tools.py             # Custom tool functions
│   ├── k2_client.py         # K2 Think via Vultr Inference
│   ├── vultr_rag.py         # Vultr RAG legal knowledge queries
│   ├── seed_vultr_rag.py    # One-time Kaggle data seeder
│   ├── report_generator.py  # PDF report (WeasyPrint)
│   ├── ocr.py               # Google Vision OCR
│   ├── models.py            # Pydantic models
│   └── prompts.py           # System prompts
└── README.md
```

## Stack

| Category | Tools |
|----------|-------|
| MCPs (5) | DAuth + pdf-parse + brave-search + exa-mcp + context7 |
| AI Models (3) | K2 Think (Vultr) + Google Vision OCR + Vultr RAG |
| Billing | Flowglad — first review free, then $2.99/contract |
| Database | Convex — real-time, frontend + backend read/write |
| Frontend | Next.js 14 + Tailwind CSS |
| Backend | Python FastAPI + Dedalus ADK |
