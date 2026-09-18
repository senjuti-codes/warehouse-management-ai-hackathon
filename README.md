This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
 
## Architecture Overview
 
This is a full-stack warehouse anomaly detection and approval system with multi-LLM cascade orchestration:
 
- **Backend**: Node.js 24 with native TypeScript (no build step, no Express)
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS + Turbopack
- **Database**: SQLite with automatic schema migration
- **LLM Integration**: VW Group OAuth + gpt-4o with multi-stage cascade
 
## Backend API Configuration
 
This app communicates with the Node.js backend in `../backend` through the typed client in `lib/api.ts`. Configure the environment:
 
```bash
cp .env.local.example .env.local
```
 
Set `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000` for local dev):
 
```bash
# Local development (backend running on localhost)
NEXT_PUBLIC_API_URL=http://localhost:8000
 
# Deployed environment (EC2 instance)
NEXT_PUBLIC_API_URL=http://<EC2-PUBLIC-IP>:8000
```
 
⚠️ This value is baked in at build time (it's a `NEXT_PUBLIC_*` var), so rebuild the frontend after changing it. Never put LLM/API secret keys here — only the backend talks to the LLM provider.
 
## Multi-LLM Cascade Architecture
 
The backend implements a 4-stage AI cascade for autonomous anomaly resolution:
 
1. **Input Stage**: Workbook ingestion → SQLite mirror
2. **Detection Stage**: SQL rules (5 deterministic rules) + LLMaaS batch triage
3. **Triage Stage**: LLMaaS judges auto-fix eligibility and risk level
4. **Solution Stage**: LLMaaS generates ranked recommendations for manual approval
 
### Auto-Fix Decision Logic
 
Anomalies auto-approve when:
- Confidence ≥ 0.85 **AND**
- Risk level = 'low' **AND**
- Type = 'reorder-threshold-risk' (heuristic safe category)
 
### Fallback Strategy
 
If LLMaaS is unreachable, the cascade uses deterministic heuristics per anomaly type:
- `reorder-threshold-risk`: Auto-fixable (low risk)
- Others: Routed to Approvals for manual review
 
### API Endpoints
 
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/anomalies` | GET | List all anomalies with triage + solution metadata |
| `/api/dashboard` | GET | KPI summary (total, critical, auto-fixed, pending) |
| `/api/ai-cascade/run` | POST | Trigger full cascade (triage → auto-fix → solutions) |
| `/api/anomalies/{id}/decision` | POST | Record approval/rejection decision |
 
## Getting Started
 
### Terminal 1: Backend Server
 
```bash
cd backend
npm run dev
# Runs on http://localhost:8000
# Watches src/server.ts and auto-reloads on changes
# Uses Node 24 native TypeScript stripping (--experimental-strip-types)
```
 
### Terminal 2: Frontend Server
 
```bash
cd frontend
npm run dev
# Runs on http://localhost:3000 (or next available port)
# Opens http://localhost:3000 in your browser
```
 
### Terminal 3: Optional Workbook Inspector
 
```bash
cd backend
npx ts-node src/scripts/inspectWorkbook.ts
# Analyzes the Excel workbook schema and detected anomalies
```
 
## Pages & Features
 
- **Control Tower** (`/`): Dashboard with scan workflow, cascade button, KPI cards
- **Approvals** (`/approvals`): Review AI recommendations, approve/reject decisions
- **Anomaly Center** (`/anomalies`): Searchable anomaly queue with filters and details
- **Approvals Detail** (`/approvals/[id]`): Deep-dive anomaly investigation with LLM analysis
 
## Configuration
 
Backend environment variables (`.env`):
 
```bash
# LLMaaS Integration
LLMAAS_BASE_URL=https://llmaas-api.vwgroup.io  # OAuth endpoint
LLMAAS_API_KEY=your_api_key
LLMAAS_MODEL=gpt-4o
LLMAAS_IDP_CLIENT_ID=your_client_id
LLMAAS_IDP_CLIENT_SECRET=your_client_secret
LLMAAS_TIMEOUT_MS=30000
 
# Workbook Path
WORKBOOK_PATH=../data/Warehouse_AI_Hackathon_Synthetic_Dataset_FINAL.xlsx
 
# Auto-Fix Thresholds (tunable)
AUTO_FIX_CONFIDENCE_THRESHOLD=0.85
AUTO_FIX_RISK_CEILING=low
```
 
## What We Built (Phase 1→2→3)
 
### Phase 1: Single LLM On-Demand
- Manual anomaly investigation via `/anomalies/[id]` page
- Direct LLMaaS call for each investigation
- Performance: ~10s per anomaly analysis
 
### Phase 2: Batch Triage + Auto-Fix (Current)
- **New**: Cascade orchestration service (`backend/src/services/cascadeService.ts`)
- **New**: Batch triage endpoint (`POST /api/ai-cascade/run`)
- **New**: Auto-fix approval workflow (confidence + risk thresholds)
- **New**: OAuth token caching (5m TTL, refresh 60s before expiry)
- Performance: 98 anomalies triaged in 346s (with LLM calls), reconciliation 7ms
- Result: 6 auto-fixed, 92 routed to Approvals with full AI solutions
 
### Phase 3: Multi-Option Solution Generation (Current)
- **New**: Per-anomaly solution generation with ranked options
- **New**: Executive summary + root cause + business impact for each anomaly
- **New**: Approval checklist auto-generated per solution
- **New**: Decided-by tracking ('ai-auto-fix' vs 'operator' for audit)
 
### Performance Optimizations
- **OAuth Token Caching**: Was causing 5m46s delays (fetching per LLM call) → now milliseconds
- **Batch Triage**: 20 anomalies per batch to reduce API overhead
- **Concurrency Limits**: 6 parallel solution generations to avoid LLMaaS throttling
- **Reconciliation Logic**: Retroactive threshold tuning without re-LLM cost
 
## Learn More
 
- [Next.js Documentation](https://nextjs.org/docs) - Next.js features
- [Node.js SQLite](https://nodejs.org/docs/latest/api/sqlite.html) - Native SQLite bindings
- [Tailwind CSS](https://tailwindcss.com) - Styling framework