# Codebase Guide: How This All Works

A walkthrough of the starter repo — what each file does, and how a request
actually flows through the system from end to end. Read this before you
start editing; it'll save you from hunting through files to understand how
they connect.

---

## 1. The five layers

```
Excel workbook
     |  app/ingestion/load_workbook.py
     v
PostgreSQL raw tables          app/models/raw.py
     |  app/detection/rules.py + cross_system.py
     v
Anomaly rows                   app/models/workflow.py
     |  app/agents/orchestrator.py  (clusters anomalies)
     v
LangGraph agent pipeline       app/agents/graph.py
     |  (pauses for human approval, resumes on decision)
     v
Incident + Action rows  <--->  app/api/v1/*.py  <--->  Next.js frontend
```

Everything upstream of the agent pipeline is **deterministic** (plain
pandas/SQL, no LLM, fully unit-testable). Everything from the agent
pipeline onward involves the LLM and is where the "agentic" behavior lives.

---

## 2. Folder-by-folder tour

### `app/config.py`
One `Settings` class, populated from environment variables (or
`backend/.env` locally). Nothing else in the codebase reads `os.environ`
directly — if you need a new config value, add it here first.

### `app/db/session.py`
- `engine` / `SessionLocal`: standard SQLAlchemy setup.
- `get_db()`: the FastAPI dependency every router uses to get a
  request-scoped session.
- `init_db()`: creates tables if they don't exist. Called once on startup
  (`app/main.py`).

### `app/models/raw.py`
Six SQLAlchemy models, one per source sheet (`MaterialMaster`,
`InventoryStock`, `WarehouseBin`, `DeliveriesDispatch`, `PurchaseReplenish`,
`VendorMaster`). Column names are snake_case versions of the workbook's
headers — see `app/ingestion/load_workbook.py` for the exact mapping.

### `app/models/workflow.py`
The tables with no equivalent in the workbook — everything the agent layer
and the approval workflow produce:
- `Anomaly` — one row per detected issue (from either the rule engine or,
  in principle, an agent — see `detected_by`).
- `Incident` — a root-cause grouping of one or more anomalies.
- `IncidentAnomaly` — the many-to-many join between the two above.
- `Action` — a proposed corrective action, with a `status` that moves
  `PENDING_APPROVAL → APPROVED/REJECTED → EXECUTED`.
- `AuditLog` — append-only; every detection, correlation, proposal,
  approval, and execution writes a row here. Never updated, never deleted.
- `AgentTrace` — every thought/tool call/tool result/final answer an agent
  produces, for the live reasoning panel.

### `app/schemas/`
Pydantic models — the shapes the API actually returns. These are separate
from the SQLAlchemy models on purpose: it keeps "what's in the database"
and "what the frontend sees" independently changeable.

### `app/ingestion/load_workbook.py`
Reads all 6 sheets with pandas, renames columns via the `_..._COLS` dicts
at the top of the file, truncates the matching raw table, and bulk-inserts
the fresh rows. **If a judge's copy of the workbook renames a column
header**, this is the only file that needs a matching update — the
column-map dicts, not the detection rules.

### `app/detection/rules.py`
One function per single-sheet anomaly (`detect_a1_missing_uom`,
`detect_b2_expired_with_stock`, etc.), each taking a plain pandas
DataFrame and returning a list of anomaly dicts. `run_all()` at the bottom
calls every one of them. These are pure functions — no database, no LLM —
which is why `tests/test_detection_rules.py` can test them directly against
hand-built DataFrames in milliseconds.

### `app/detection/cross_system.py`
The X-series: anomalies that only exist once you join sheets together
(orphan materials, dispatch quantity exceeding available stock). Same
pattern as `rules.py` — pure functions, DataFrame in, anomaly dicts out.

### `app/detection/engine.py`
The only file in `detection/` that touches the database. `run_detection()`
pulls all 6 raw tables into DataFrames, calls `rules.run_all()` +
`cross_system.run_all()`, and persists the results as `Anomaly` rows —
clearing out the previous rule-engine pass first so re-running detection
never duplicates anomalies.

### `app/agents/tools.py`
The functions the LLM can call during its investigation
(`get_material_master`, `get_inventory_for_material`,
`get_open_anomalies_for_material`, etc.), each decorated with LangChain's
`@tool`. **This is what makes the system agentic**: the model decides which
of these to call and in what order based on what it finds, rather than
following a fixed script.

### `app/agents/prompts.py`
The system prompt for each of the three reasoning agents (root cause,
impact, resolution). If the LLM's output quality needs tuning once you have
a real LLMaaS key, this is the first place to look.

### `app/agents/outputs.py`
Pydantic schemas (`RootCauseFinding`, `ImpactFinding`, `ResolutionFinding`)
that each agent is forced into at the end of its reasoning, via LangChain's
`.with_structured_output()`. This is what turns "the model said some text"
into "a `confidence: float` field I can reliably read."

### `app/agents/trace.py`
One function, `log_trace()`, called from every agent node to write a row to
`AgentTrace`. This is the plumbing behind the live reasoning panel — see
`app/api/v1/ws.py`.

### `app/agents/graph.py` — the core of the whole system
Builds the LangGraph pipeline:
```
root_cause_node → impact_node → resolution_node → human_approval_node → apply_action_node
```
- `root_cause_node`: runs the ReAct tool-calling loop (`_run_react_loop`),
  then does one more structured-output call to extract a `RootCauseFinding`,
  then creates the `Incident` row and links the seed anomalies to it.
- `impact_node`: scores business impact, writes `impact_score`/`impact_label`
  onto the incident.
- `resolution_node`: proposes exactly one action, creates the `Action` row
  with status `PENDING_APPROVAL`.
- `human_approval_node`: calls LangGraph's `interrupt()` — **this is where
  execution actually pauses** until something calls `resume_pipeline()`.
- `apply_action_node`: runs after resume, marks the action
  `EXECUTED`/`REJECTED`, writes the final audit log entries.

`start_pipeline()` and `resume_pipeline()` at the bottom are the two entry
points everything else calls — you should never need to call the graph's
`.invoke()` directly from outside this file.

### `app/agents/orchestrator.py`
`find_candidate_clusters()` groups all currently-OPEN anomalies by shared
Material (or Vendor, for vendor-only anomalies) — this is what guarantees
at least one incident spans multiple source sheets, satisfying the
cross-system correlation requirement structurally. `run_all_pipelines()`
calls `start_pipeline()` once per cluster.

### `app/llm/client.py`
The one file to edit once you know your LLMaaS's real API shape. See its
docstring — everything else in `app/agents/` calls `get_chat_model()` /
`get_embeddings_model()` from here and never imports `langchain_openai`
directly.

### `app/api/v1/`
One file per resource. Thin routers — they call into `app/detection/`,
`app/ingestion/`, or `app/agents/` and shape the result with a schema from
`app/schemas/`. `actions.py` is the one with real logic: it's what calls
`resume_pipeline()` when an operator clicks approve/reject.

### `app/main.py`
Wires the FastAPI app together: CORS, the startup hook that calls
`init_db()`, and mounting `api_router` under `/api/v1`.

---

## 3. Trace a request: `POST /api/v1/ingest/run`

1. `app/api/v1/ingest.py::trigger_ingest` saves the uploaded file to
   `data/workbook.xlsx` and schedules `_run_full_pipeline` as a
   **background task** — the HTTP response returns immediately.
2. In the background: `load_workbook()` truncates and reloads the 6 raw
   tables.
3. `run_detection()` runs all 22 detection functions and writes fresh
   `Anomaly` rows (deleting the previous rule-engine pass first).
4. `run_all_pipelines()` clusters the new anomalies and calls
   `start_pipeline()` once per cluster.
5. Each `start_pipeline()` call runs `root_cause → impact → resolution`
   synchronously (several LLM calls), then pauses at `human_approval`.
6. Nothing more happens until a human calls `/actions/{id}/approve` or
   `/reject`.

## 4. Trace an incident: from raw anomaly to an approved fix

1. Two anomalies get detected for `MAT-100003` — say, `A4` (safety stock >
   reorder point) from `rules.py`, and `X2` (dispatch exceeds stock) from
   `cross_system.py`. Both land in the `anomalies` table with
   `status=OPEN`.
2. `orchestrator.find_candidate_clusters()` groups both under
   `material=MAT-100003` (same key, so same cluster) and calls
   `start_pipeline(seed_anomaly_ids=[id_a4, id_x2], material="MAT-100003", ...)`.
3. `root_cause_node` runs the ReAct loop: the model calls
   `get_material_master("MAT-100003")`, then
   `get_deliveries_for_material(...)`, then
   `get_open_anomalies_for_material(...)` to confirm nothing else is
   linked, then produces a `RootCauseFinding`. An `Incident` row is created
   and both anomalies are marked `status=CORRELATED`.
4. `impact_node` scores it, e.g. 72/100, "Replenishment failure."
5. `resolution_node` proposes, say,
   `action_type="update_master_field"`,
   `proposed_change={"table": "material_master", "key": "MAT-100003", "field": "safety_stock", "new_value": 80}`.
   An `Action` row is created with `status=PENDING_APPROVAL`.
6. `human_approval_node` calls `interrupt(...)` — the graph run is now
   paused, and `start_pipeline()`'s original call returns with that
   paused state.
7. The frontend polls/queries `GET /api/v1/actions?status=pending_approval`,
   shows it to an operator, who clicks Approve.
8. `POST /api/v1/actions/{id}/approve` calls
   `resume_pipeline(run_id=action.run_id, decision="approved", decided_by="jane")`.
9. `apply_action_node` runs: marks the `Action` `EXECUTED`, the `Incident`
   `RESOLVED`, and writes the final `AuditLog` entries.

---

## 5. How to extend this

**Add a new single-sheet detection rule**: write a new
`detect_xN_whatever(df)` function in `app/detection/rules.py` following the
existing pattern (take a DataFrame, return a list of anomaly dicts), add it
to `run_all()`, and add a unit test in `tests/test_detection_rules.py`.
Nothing else needs to change — it'll automatically flow through
`engine.py` → the orchestrator → the agent pipeline.

**Add a new agent tool**: write a new `@tool`-decorated function in
`app/agents/tools.py`, add it to `ALL_TOOLS`. The root-cause agent will
have access to it on the next run — no graph changes needed.

**Add a new API endpoint**: add a route function in the relevant file
under `app/api/v1/`, or create a new file and register it in
`app/api/v1/router.py`.

**Change what the agents reason about or how strict they are**: edit
`app/agents/prompts.py`. This is pure prompt engineering — no code
structure changes needed.

**Add a new stage to the pipeline** (e.g. a "notification" step after
approval): add a node function in `app/agents/graph.py`, add it with
`builder.add_node(...)`, and rewire the `add_edge()` calls.

---

## 6. Running and debugging

```bash
cd backend
pytest                          # detection rules only, no DB/LLM needed
python scripts/run_pipeline.py /path/to/workbook.xlsx   # full pipeline, CLI
uvicorn app.main:app --reload   # API server with auto-reload
```

To watch an agent actually think in real time, connect to the WebSocket
while a pipeline is running:
```bash
# using websocat, or any WS client
websocat ws://localhost:8000/api/v1/ws/agent-trace
```
Every `thought` / `tool_call` / `tool_result` / `final` step streams as
it's written to `agent_traces` — this is the same feed the frontend's live
reasoning panel should consume.

If something looks wrong, the audit log is your source of truth for "what
actually happened and when":
```bash
curl "http://localhost:8000/api/v1/audit-log?entity_type=incident"
```
