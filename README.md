# VW LogiMind Warehouse AI

Full-stack warehouse control tower that ingests the supplied Excel workbook, mirrors it into SQLite, detects operational anomalies, and supports AI-assisted triage, investigation, approvals, and workbook actions.

## Stack

- Backend: Node.js 24 native TypeScript HTTP server, SQLite, and ExcelJS
- Frontend: Next.js 16, React 19, Tailwind CSS 4, Base UI, and Lucide icons
- AI: VW Group LLMaaS with OAuth token caching and deterministic fallback behavior
- Data: `data/Warehouse_AI_Hackathon_Synthetic_Dataset_FINAL.xlsx`

## Prerequisites

- Node.js 24+
- npm
- Docker Desktop only when using Docker Compose

## Local Setup

Install dependencies:

```bash
npm --prefix backend install
npm --prefix frontend install
```

Optional environment configuration:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.local.example frontend/.env.local
```

The frontend defaults to `http://localhost:8000`; set `NEXT_PUBLIC_API_URL` before building to use another backend. LLMaaS credentials are optional. Without them, deterministic detection, recommendations, and assistant fallbacks remain available.

Start the backend and frontend in separate terminals:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

Open `http://localhost:3000`. The backend health endpoint is `http://localhost:8000/health`.

The first **Run AI scan** ingests the workbook and refreshes SQLite. The database is created as `warehouse_ai.sqlite` in the backend process working directory.

## Docker

```bash
docker compose up --build
```

Open `http://localhost:3000`. Compose mounts `data/` into the backend and persists SQLite state in the `backend-data` volume. Set `NEXT_PUBLIC_API_URL` in the shell before building when the browser must reach the API at a different public address.

## Product Surfaces

| Surface | Route | Capabilities |
|---|---|---|
| Control Tower | `/` | Workbook scan, AI cascade, KPI cards, anomaly queue, impact, audit activity, graphs, and export |
| Anomaly Center | `/anomalies` | Search, filters, decision status, quick details, and investigation links |
| Investigation | `/anomalies/{id}` | Workbook evidence and on-demand LLM analysis |
| Approvals | `/approvals` | Filter recommendations and approve or reject with audit comments |
| Inventory Health | `/?view=inventory-health` | Material risk, stock health, and replenishment recommendations |
| Dispatch Flow | `/dispatch-flow` | Dispatch filtering, selectable timelines, and status/risk actions |
| Vendors | `/?view=vendors` | Enriched supplier performance and risk |
| Data Sources | `/?view=data-sources` | Workbook table health, sync details, and quality scans |
| Settings | `/?view=settings` | Monitoring, AI, notification, landing-page, and density preferences |

All surfaces include responsive navigation. Settings and approval state persist in browser storage; operational workbook and audit state persist in SQLite.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Service health |
| `POST` | `/api/ingest` | Ingest workbook and run deterministic rules |
| `GET` | `/api/dashboard` | Record, severity, triage, and decision KPIs |
| `GET` | `/api/anomalies` | Enriched anomaly queue |
| `POST` | `/api/anomalies/{id}/decision` | Record operator approval or rejection |
| `POST` | `/api/anomalies/{id}/ai-analysis` | Generate investigation analysis |
| `POST` | `/api/ai-cascade/run` | Run batch triage, safe auto-fix, and solution generation |
| `GET` | `/api/workbook/{table}` | Read a validated workbook mirror table |
| `GET` | `/api/audit-log` | Read decision, ingestion, and AI activity |
| `GET` | `/api/impact` | Compute operational impact metrics |
| `GET` | `/api/correlations` | Find anomaly clusters by business key |
| `GET` | `/api/vendors/enriched` | Join vendor, purchase, and material signals |
| `POST` | `/api/assistant` | Ask questions and perform validated workbook actions |

## AI Cascade

The cascade performs batch triage, automatically approves only explicitly safe low-risk reorder-threshold cases at confidence 0.85 or higher, and generates ranked options plus approval checklists for manual review. These safety thresholds are constants in `backend/src/services/cascadeService.ts`.

Configure optional LLMaaS access in `backend/.env`:

```dotenv
LLMAAS_BASE_URL=https://llmaas-api.vwgroup.io
LLMAAS_API_KEY=
LLMAAS_MODEL=gpt-4o
LLMAAS_IDP_CLIENT_ID=
LLMAAS_IDP_CLIENT_SECRET=
LLMAAS_TIMEOUT_MS=30000
```

Secrets belong only in the backend environment. Never expose them through `NEXT_PUBLIC_*` variables.

## Validation

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
node --experimental-strip-types --check backend/src/server.ts
node --experimental-strip-types --check backend/src/api.ts
```

Inspect the workbook schema with:

```bash
npm --prefix backend run inspect
```
