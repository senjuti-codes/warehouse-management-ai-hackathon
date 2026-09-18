# Warehouse AI Control Center

A real-time **warehouse data-quality & anomaly control center** powered by a
Node.js/TypeScript backend, a Next.js frontend, and a small fleet of
agentic AI helpers. The system ingests an SAP-style xlsx workbook covering
inventory, master data, deliveries and vendors, mirrors it into SQLite,
runs a deterministic rule engine to detect anomalies, correlates them by
material/vendor, and — when the operator asks for it — calls an LLM to
generate a plain-English root cause + business impact + recommended
action. Nothing is executed automatically: every change is captured in an
append-only audit log and gated behind an operator approve/reject step.

Authoritative workbook: [`data/Warehouse_AI_Hackathon_Synthetic_Dataset_FINAL.xlsx`](data/Warehouse_AI_Hackathon_Synthetic_Dataset_FINAL.xlsx). Override via `WORKBOOK_PATH` in `backend/.env`.

---

## Repo layout

```
backend/                Node 24 + TypeScript (native --experimental-strip-types)
  src/
    server.ts           entry point
    api.ts              HTTP router (no Express)
    db.ts               SQLite schema + audit-log helpers
    config.ts           env-driven settings
    workbook/           excelReader.ts + schemaValidator.ts
    services/
      ingestionService.ts  workbook -> SQLite mirror tables
      ruleEngine.ts        5 deterministic detection rules
      llmService.ts        LLMaaS IDP OAuth + chat completions
    scripts/inspectWorkbook.ts

frontend/               Next.js 16 + React 19 + Tailwind (Turbopack)
  app/                  route groups: /, /anomalies, /approvals, /dispatch-flow
  components/           control-tower, anomaly-*, approvals, vendors, etc.
  lib/api.ts            typed API client (types are shared with backend)
  lib/workbook-api.ts   thin helper for /api/workbook/:table

data/                   authoritative xlsx workbook
docker-compose.yml      Postgres + backend + frontend (optional path)
```

---

## Prerequisites

- **Node.js 24+** (uses the native `--experimental-strip-types` flag and the
  built-in `node:sqlite` module — no external SQLite binary needed).
- No native compilation. The only backend dep is `exceljs` (pure JS xlsx
  parser, cross-platform). Everything else uses Node built-ins.
- Optional: an LLMaaS OAuth client id / secret if you want the on-demand LLM
  analysis button to work. Without it the deterministic rule engine still
  runs; only the "Generate AI analysis" button is disabled.

---

## Running backend + frontend (macOS / Linux / Windows)

Open **two terminals**.

**Terminal 1 — backend (port 8000):**

```bash
cd backend
npm install           # first time only
cp .env.example .env  # then edit .env: workbook path is optional; LLMAAS_IDP_* only needed for on-demand AI analysis
npm run dev
```

Expected log lines:

```
Warehouse AI backend starting...
Environment: development
Workbook path: .../data/Warehouse_AI_Hackathon_Synthetic_Dataset_FINAL.xlsx
Pipeline status: ready
Warehouse AI API listening on http://localhost:8000
```

**Terminal 2 — frontend (port 3000):**

```bash
cd frontend
npm install     # first time only
npm run dev
```

Expected: `Ready in <ms>` from Next.js + `Local: http://localhost:3000`.

**One-time step — ingest the workbook** so the SQLite mirror + anomalies
are populated (only needed once per fresh checkout; the sqlite file persists):

```bash
curl -X POST http://localhost:8000/api/ingest -H 'Content-Type: application/json' -d '{}'
```

You can also click **Run AI scan** on the Control Tower to do the same
through the UI.

### Confirm both are up

```bash
curl http://localhost:8000/health            # {"status":"ok","service":"warehouse-ai-backend"}
curl http://localhost:8000/api/dashboard     # counts + sourceTables
curl -o /dev/null -w '%{http_code}\n' http://localhost:3000   # 200
```

Then open http://localhost:3000 — Control Tower should show the KPI cards
populated from real workbook data.

### Docker Compose (optional single-command path)

```bash
docker compose up --build
```

Boots Postgres + backend + frontend together — but note the current backend
code targets SQLite (`node:sqlite`), so use the two-terminal flow above
unless you're actively porting the backend to Postgres.

---

## How the pieces talk to each other

```
                +-----------------------------+
                |  data/*.xlsx (authoritative)|
                +--------------+--------------+
                               |  exceljs (pure JS)
                               v
+------------------+   ingest  +--------------------+
|  Next.js UI (3000)|<---HTTP--| Node backend (8000)|
+------------------+   /api/*  +---------+----------+
     ^         ^                          |
     |         |                          v
     |         |                +---------+---------+
     |         |                |  SQLite (mirror)  |
     |         |                |  material_master  |
     |         |                |  inventory_stock  |
     |         |                |  warehouse_bin    |
     |         |                |  deliveries_...   |
     |         |                |  purchase_replen. |
     |         |                |  vendor_master    |
     |         |                |  anomalies        |
     |         |                |  anomaly_decisions|
     |         |                |  audit_log        |
     |         |                +---------+---------+
     |         |                          |
     |         |     rule engine (5 rules, deterministic)
     |         |                          |
     |         |                          v
     |         |                     anomalies rows
     |         |                          |
     |         +--------- POST -----------+
     |          /api/anomalies/:id/decision  (approve / reject)
     |
     +---------- POST /api/anomalies/:id/ai-analysis
                 --> LLM (Root Cause + Impact + Resolution)
```

---

## HTTP API (all live routes)

| Method | Path                                | Purpose                                         |
| ------ | ----------------------------------- | ----------------------------------------------- |
| GET    | `/health`                           | liveness probe                                  |
| GET    | `/api/dashboard`                    | KPI counts + list of ingested source tables     |
| POST   | `/api/ingest`                       | (re)ingest the workbook + rerun detection       |
| GET    | `/api/anomalies`                    | all detected anomalies + decision status        |
| POST   | `/api/anomalies/:id/decision`       | operator approve / reject (audit-logged)        |
| POST   | `/api/anomalies/:id/ai-analysis`    | on-demand LLM narrative (audit-logged)          |
| GET    | `/api/workbook/:table`              | paginated raw workbook rows for a mirrored sheet |
| GET    | `/api/impact`                       | live business-impact figures (€ at risk, hrs, coverage) |
| GET    | `/api/correlations`                 | anomaly clusters grouped by `material\|plant` — the root-cause tree data |
| GET    | `/api/vendors/enriched`             | vendor master joined with purchase & material data |
| GET    | `/api/audit-log?limit=N`            | append-only trail: ingest / decision / AI-analysis events |

CORS is open to any origin (`*`). No auth on the API — this is a
hackathon prototype, not production.

---

## Agentic AI — how the three "agents" actually work

The problem statement asks for a Data Validation Agent, a Root Cause Agent
and a Resolution Agent. Here's what each one maps to in this codebase:

### 1. Data Validation Agent → deterministic rule engine
Location: [ruleEngine.ts](backend/src/services/ruleEngine.ts). Runs
every time `/api/ingest` is called. Five SQL-driven checks against the
mirrored workbook tables:

| Rule id                    | Sheet joined                    | Fires when                                                | Severity |
| -------------------------- | ------------------------------- | --------------------------------------------------------- | -------- |
| `missing-unit-of-measure`  | Material_Master                 | `base_uom` is null/blank                                  | high     |
| `impossible-stock-state`   | Inventory_Stock                 | `qty_on_hand < 0` **or** `blocked_qty > qty_on_hand`      | critical |
| `dispatch-exceeds-stock`   | Deliveries_Dispatch ↔ Inventory | delivery `order_qty > qty_on_hand` for that material+plant | critical |
| `vendor-risk`              | Vendor_Master                   | `procurement_block=Y` **or** quality `D`/`E` **or** `on_time_delivery<90` | high     |
| `reorder-threshold-risk`   | Material_Master ↔ Inventory     | `qty_on_hand <= reorder_point`                            | medium   |

Every detected anomaly is upserted into the `anomalies` table with a
`business_key` (e.g. `MAT-100003|1710`) so cross-sheet issues on the same
material can be correlated later.

### 2. Root Cause Agent → correlation + LLM narrative
- **Deterministic layer** ([`GET /api/correlations`](backend/src/api.ts)):
  groups anomalies by `business_key`, returning clusters where the same
  material+plant is flagged by multiple rules across multiple sheets. That's
  the "single root-cause tree" the problem statement describes — e.g. one
  MAT-100003 cluster surfaces `impossible-stock-state` + `dispatch-exceeds-stock`
  + `reorder-threshold-risk` at once.
- **LLM layer** ([`llmService.ts`](backend/src/services/llmService.ts)):
  invoked from `POST /api/anomalies/:id/ai-analysis` when the operator
  clicks *Generate AI analysis*. Calls the LLMaaS OAuth token endpoint
  (VW Group Keycloak realm) to get a bearer token, then hits the
  OpenAI-compatible `/chat/completions` API with a strict
  `response_format: json_object` prompt. Returns `{summary, rootCause,
  businessImpact, recommendedAction, confidence}` grounded strictly in the
  evidence JSON captured at detection time.

### 3. Resolution Agent → deterministic recommendation + operator approval
- Every anomaly is enriched with a deterministic recommendation via
  `recommendationFor(type)` in [api.ts](backend/src/api.ts) (e.g.
  "Split the delivery and trigger replenishment before goods issue.").
- The operator sees it on the Approvals / Anomaly Investigation page.
  `POST /api/anomalies/:id/decision` writes to `anomaly_decisions` **and**
  appends an `audit_log` entry so nothing is executed silently.
- The LLM's `recommendedAction` (from step 2) sits alongside the
  deterministic one as an advisory second opinion — the operator remains
  the final decision maker.

### Where the LLM is (and isn't) invoked
- ✅ On-demand: user clicks *Generate AI analysis* on the investigation page.
- ✅ Every LLM call is audit-logged with model name + confidence.
- ❌ NOT during ingest, NOT during rule evaluation, NOT on schedule. This
  is deliberate — deterministic detection stays hermetic and reproducible;
  the LLM only adds narrative on operator demand.

---

## Which UI page renders which xlsx sheet

The frontend previously had a lot of hardcoded/dummy figures. As of this
revision each surface renders real data:

| Page                          | Driven by                                                           |
| ----------------------------- | ------------------------------------------------------------------- |
| Control Tower KPI cards       | `/api/dashboard` (SQLite `anomalies` + `workbook_runs`)             |
| Control Tower business impact | `/api/impact` (computed shortfall × unit-price assumption)          |
| Control Tower recent actions  | `/api/audit-log` (last 6 events: ingest, approve, reject, AI)       |
| Control Tower priority queue  | `/api/anomalies` (severity-sorted, confidence-filtered)             |
| Control Tower pipeline health | `/api/dashboard` (sourceTables count + totalRecords)                |
| Anomaly Queue                 | `/api/anomalies`                                                    |
| Anomaly Investigation         | `/api/anomalies` + `POST /api/anomalies/:id/ai-analysis`. Evidence JSON is parsed and displayed field-by-field. |
| Approvals                     | `/api/anomalies` + `POST /api/anomalies/:id/decision`               |
| Inventory Health              | `/api/workbook/{material_master,inventory_stock,warehouse_bin}`     |
| Dispatch Flow                 | `/api/workbook/{deliveries_dispatch,material_master,inventory_stock}` |
| Vendors                       | `/api/vendors/enriched` (Vendor_Master + Purchase_Replenish + Material_Master joined server-side) |
| Data Sources                  | `/api/workbook/*` — counts per sheet                                |
| Sidebar anomaly count         | `/api/dashboard`                                                    |

The type-only files under `frontend/data/` remain as shared TypeScript
interfaces; no runtime dummy arrays are exported from them.

---

## How well does this solve the problem statement?

| Problem-statement claim                                             | Status in this repo                                                                                |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| "Continuously ingests inventory, master data, and dispatch streams" | ✅ Ingestion covers all 6 SAP-style sheets. Continuous = re-run `POST /api/ingest`; no scheduler yet. |
| "Catches bad records early"                                         | ✅ 5-rule deterministic engine runs on every ingest, producing typed `anomalies` rows.              |
| "Correlates isolated anomalies into single root-cause trees"        | ✅ `/api/correlations` groups by `business_key` (`material\|plant`) across sheets. Cluster count / severity mix visible. |
| "Live Radar dashboard"                                              | ✅ Control Tower KPI cards, priority queue, pipeline health — all live.                            |
| "Actionable, automated fix recommendations"                         | ✅ Deterministic per-rule recommendations + optional LLM-generated narrative.                       |
| "One-click database write-back approval workflow"                   | 🟡 One-click Approve / Reject wired to the audit log **and** the decision table, but there is no actual write-back to a source-of-truth ERP — the workbook is read-only. See enhancements below. |
| "Full audit logging"                                                | ✅ `audit_log` table + `GET /api/audit-log`. Every ingest, decision and LLM call is captured.       |
| "Human always in control of execution"                              | ✅ Nothing runs automatically. LLM narrative is generated only on operator demand.                  |

---

## Enhancement opportunities (functional, not cosmetic)

1. **Auto-run correlations on ingest** — expose `/api/correlations` on the
   Control Tower as a "Root cause trees" panel so operators see clusters
   without having to hit the endpoint by hand.
2. **Explain-any-anomaly with cluster context** — pass the full cluster
   evidence (not just the single anomaly) into `analyzeAnomalyWithLlm`
   when the LLM is asked to explain a member of a cluster.
3. **Scheduled re-ingest** — a small `setInterval` in `server.ts` or a
   file-watcher on the workbook path would give true "continuous"
   monitoring without a manual POST.
4. **Persist LLM analyses** — currently transient. Add an
   `anomaly_ai_analyses` table so the same anomaly doesn't get re-billed
   to the LLM every time it's viewed.
5. **Real ERP write-back** — the "approved" path today only marks the
   anomaly; wire in a mock ERP endpoint or a CSV export so an operator can
   see the corrective payload that *would* be pushed.
6. **Bulk decision endpoint** — `POST /api/anomalies/bulk-decision` for
   whole-cluster approvals when the operator trusts the correlation.
7. **Workbook diff on re-ingest** — track row-level changes between runs so
   the audit trail shows which records changed, not just totals.
8. **Server-side pagination** on `/api/anomalies` (currently returns all).

---

## Edge cases and known limitations

Handled today:

- **Cross-platform xlsx** — parser is `exceljs` (pure JS); no PowerShell /
  Excel COM, no `xlsx` package (that one has open prototype-pollution
  and ReDoS advisories).
- **Header sanitisation** — sheet column names are lowercased and
  snake_cased on ingest so `"Qty On Hand"` → `qty_on_hand` regardless of
  workbook capitalisation.
- **Rule dedup** — every rule checks for an existing anomaly with the
  same `(type, business_key, sheet)` before inserting.
- **CORS** — open with correct preflight for GET/POST/OPTIONS.
- **LLM outage** — `/api/anomalies/:id/ai-analysis` returns 502 with a
  human-readable message; UI shows it inline; deterministic recommendation
  is still visible.
- **Missing LLM config** — the LLM route throws a clear
  `LLM IDP is not configured` message; nothing else is affected.
- **Empty vendor purchase history** — `/api/vendors/enriched` returns
  `open_orders: 0`, `next_delivery: null`, and the UI shows "No open PO"
  rather than a fake date.
- **Missing workbook sheet** — ingestion fails loudly with the missing
  sheet names; the DB is left in its previous state.
- **`.env` secret exposure** — `backend/.env` is git-ignored; only
  `.env.example` is committed. The `--env-file-if-exists` flag on the npm
  scripts means the app also boots without a `.env`.

Known limitations (documented, not bugs):

- **Re-ingest wipes anomaly history** — `runDetection()` deletes the
  `anomalies` table before rerunning. Historical trending isn't supported
  today. Approval decisions on prior anomalies are orphaned when their id
  is re-issued.
- **Business-impact `€` figure uses a fixed unit-price assumption** (see
  `unitPriceAssumptionEuros` in `/api/impact`). Judged demo-appropriate;
  swap for real per-material pricing when the workbook has it.
- **Row numbering** in the SQLite mirror is 1-based including headers
  (`__rowNumber: index + 2`) — matches what an operator sees in Excel.
- **Correlation clusters only fire when `business_key` matches exactly**
  — a plant-suffix mismatch across sheets would break the join. Sheet
  loaders trim whitespace but do not normalise plant codes.
- **Frontend dev restarts are Turbopack-based** — module edits hot-reload,
  but a change to a `use client` component's exported name still needs a
  full refresh.

---

## Quick test loop

```bash
# 1) start both processes (two terminals — see above)

# 2) reingest + verify anomalies detected
curl -X POST http://localhost:8000/api/ingest -H 'Content-Type: application/json' -d '{}'
curl -s http://localhost:8000/api/dashboard

# 3) see clusters (root-cause trees)
curl -s http://localhost:8000/api/correlations | head -c 400

# 4) approve the first anomaly and see it in the audit log
curl -X POST http://localhost:8000/api/anomalies/1/decision \
  -H 'Content-Type: application/json' \
  -d '{"status":"approved","comment":"looks legit","actor":"demo"}'
curl -s 'http://localhost:8000/api/audit-log?limit=3'

# 5) (only if LLMAAS_IDP_* is configured)
curl -X POST http://localhost:8000/api/anomalies/1/ai-analysis
```

