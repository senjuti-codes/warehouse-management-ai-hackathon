# Warehouse AI Control Center — backend starter

Agentic data-quality control center for the Warehouse AI hackathon: ingests
the 6-sheet SAP-style workbook, runs deterministic anomaly detection,
correlates related issues across sheets with an LLM-driven agent pipeline,
scores business impact, proposes a corrective action, and pauses for human
approval before anything is "executed." Everything is logged to an
append-only audit trail.

This repo is the **backend only**. The Next.js frontend is a separate app
that talks to this API — see `docs/API.md`-equivalent at `/docs` once the
server is running (FastAPI auto-generates it).

## Architecture at a glance

```
Excel workbook -> ingestion (pandas) -> PostgreSQL (raw mirror tables)
                                              |
                                   deterministic rule engine
                                    (app/detection/*.py)
                                              |
                                        Anomaly rows
                                              |
                              app/agents/orchestrator.py
                          clusters anomalies by Material/Vendor
                                              |
                        LangGraph pipeline (app/agents/graph.py)
              root_cause -> impact -> resolution -> [PAUSE: human approval] -> apply_action
                                              |
                                     Incident + Action rows
                                              |
                                   FastAPI (app/api/v1/*)  <----->  Next.js frontend
```

## Prerequisites

- Python 3.11+ (3.12 used in the Dockerfile)
- Docker + Docker Compose (for the easy path), or a local PostgreSQL 16
- An LLMaaS API key. **We don't yet know the exact wire format** — the
  client at `app/llm/client.py` assumes an OpenAI-compatible
  `/chat/completions` + `/embeddings` API (the common case for internal
  LLM gateways). If yours is different, that file is the only place you
  need to change — see its docstring.

## Quickstart (Docker Compose)

```bash
cd warehouse-ai
cp backend/.env.example backend/.env
# edit backend/.env: set LLM_BASE_URL / LLM_API_KEY / LLM_MODEL to your real LLMaaS values

docker compose up --build
```

This starts Postgres and the backend on `http://localhost:8000`. Interactive
API docs: `http://localhost:8000/docs`.

Then load the dataset and run detection + agent correlation:

```bash
curl -X POST http://localhost:8000/api/v1/ingest/run \
  -F "file=@/path/to/Warehouse_AI_Hackathon_Synthetic_Dataset_FINAL_2.xlsx"
```

This ingests, detects, and kicks off one agent pipeline run per anomaly
cluster in the background. Each run pauses at the human-approval step —
check `GET /api/v1/actions?status=pending_approval` to see what's waiting,
then:

```bash
curl -X POST http://localhost:8000/api/v1/actions/<action_id>/approve \
  -H "Content-Type: application/json" \
  -d '{"decided_by": "your-name"}'
```

## Quickstart (no Docker — local Postgres already running)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # edit DATABASE_URL to point at your local Postgres, and set LLM_* values

# One-shot CLI demo (ingest -> detect -> correlate), no frontend needed:
python scripts/run_pipeline.py /path/to/workbook.xlsx

# Or run the API server:
uvicorn app.main:app --reload
```

Run the test suite (no DB or LLM key needed — pure unit tests on the
detection rules):

```bash
pytest
```

## What's already verified working

Before handing this off, the following was run for real against your actual
dataset (not just imagined):

- Full ingestion of all 6 sheets into Postgres — row counts match the
  workbook exactly (61 / 82 / 50 / 120 / 80 / 25).
- The full deterministic detection engine — **168 anomalies across 23 type
  codes** (A1–F2 plus X1/X2), matching hand-verified counts from the raw
  workbook (e.g. 11 blocked-qty-exceeds-on-hand, 22 over-capacity bins, 18
  dispatch-exceeds-stock cross-system anomalies).
- `pytest` — 8/8 unit tests passing on the rule functions.
- Every module imports cleanly, including the full LangGraph pipeline and
  every FastAPI route.
- Live API calls against real ingested data: `/health`, `/api/v1/kpis`,
  `/api/v1/anomalies`, `/api/v1/audit-log`, `/api/v1/materials/{id}/360` all
  return correct, sane data.

**Not yet verified**: the LLM-driven part of the agent pipeline
(root-cause/impact/resolution nodes and the human-approval interrupt/resume
cycle), since that requires a real LLMaaS key, which wasn't available yet.
The graph compiles and imports correctly; run
`python scripts/run_pipeline.py <workbook>` once you've filled in real
`LLM_*` values in `.env` to exercise it end-to-end for the first time — and
budget time for prompt-tuning, since this is the one part that hasn't run
against a live model yet.

## Known limitations to be aware of (not bugs — deliberate hackathon-timeline tradeoffs)

1. **LangGraph's `MemorySaver` checkpointer is in-process only.** A paused
   (awaiting-approval) run lives in the backend process's memory. This is
   fine for a single `uvicorn --workers 1` process (already the default —
   see the Dockerfile), but a restart loses any run that's mid-approval,
   and it will not work with multiple workers. If you have time, swap it
   for `langgraph-checkpoint-postgres` before the final demo so a restart
   doesn't lose in-flight approvals.
2. **No Alembic migrations** — the schema is created via
   `Base.metadata.create_all()` on startup. Fine since there's exactly one
   schema version; add Alembic only if the schema needs to evolve after
   data already exists in a deployed instance.
3. **`find_similar_material_descriptions` uses fuzzy string matching**
   (`difflib`), not real embeddings yet, since the LLMaaS embeddings
   endpoint spec wasn't available. The function signature and return shape
   are already what the embeddings version would return — swapping the
   implementation later doesn't require changing any agent prompt.
4. **`data_health_pct` in `/api/v1/kpis`** is a simple proxy (% of distinct
   materials touched by zero anomalies). Because this dataset is densely
   seeded with issues on purpose, this number will look low (~6-7%) — that's
   expected, not a bug, but tune the formula if it reads as too alarming
   for a demo audience.
5. **D5 (route vs. ship-to mismatch)** is a light heuristic in the absence
   of a customer-country field in this simplified extract — documented
   inline in `app/detection/rules.py`.

## Suggested 2-developer split

**Dev A — Data & Platform**
Owns: `app/models/`, `app/ingestion/`, `app/detection/`, `app/api/v1/kpis.py`,
`app/api/v1/anomalies.py`, `app/api/v1/materials.py`, Docker/EC2 deployment.
Best first tasks: confirm the detection rules against any dataset variant
judges introduce; add any additional single-sheet checks you want beyond
the 20 already implemented.

**Dev B — Agentic AI**
Owns: `app/agents/`, `app/llm/`, `app/api/v1/actions.py`,
`app/api/v1/ingest.py`, `app/api/v1/ws.py`.
Best first tasks: once you have the real LLMaaS key, run
`scripts/run_pipeline.py` and tune the prompts in `app/agents/prompts.py`
based on actual model output; consider swapping `MemorySaver` for a
persistent checkpointer if time allows.

Agree the API contract in `app/schemas/` on day one (it's already written —
treat changes to those files as requiring a quick sync between you two)
so the Next.js frontend developer(s) can build against mocked responses
from `/docs` without waiting on either of you.

## Repo layout

```
backend/
  app/
    api/v1/          FastAPI routers (kpis, incidents, anomalies, actions, audit, ingest, materials, ws)
    agents/           LangGraph pipeline, tools, prompts, structured outputs
    detection/        Deterministic rule engine (single-sheet + cross-system)
    ingestion/        Excel -> Postgres loader
    llm/              LLMaaS client abstraction (the one file to change per real API spec)
    models/           SQLAlchemy models (raw mirrors + workflow tables)
    schemas/          Pydantic API request/response models
    config.py         Env-driven settings
    main.py           FastAPI app
  scripts/run_pipeline.py   CLI end-to-end demo run
  tests/                     Unit tests for detection rules
  Dockerfile
  requirements.txt
  .env.example
data/                  Drop the workbook here for docker-compose's volume mount
docker-compose.yml
```
