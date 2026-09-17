# Deployment Guide: Database, LLMaaS Key, and EC2

This covers three things: (1) your options for hosting the database, not
just the one wired up by default, (2) exactly how the database and the
LLMaaS key are used in the code, and (3) a step-by-step walkthrough of
getting the whole stack running on your EC2 instance.

---

## 1. Your database hosting options

The starter ships with **Option A** already wired up in `docker-compose.yml`.
The other three are genuine alternatives — pick based on how much AWS setup
you want to do versus how "production-grade" you want the demo to look.

### Option A (default): Postgres in Docker, on the same EC2 instance
Already done for you. `docker compose up` starts a `postgres` container
right alongside the `backend` container, on one instance.

- **Pros**: zero extra AWS console work, one instance to manage, free.
- **Cons**: if the EC2 instance is terminated, the data goes with it unless
  you back up the `pgdata` Docker volume (see §5 below). Can't scale the
  backend to multiple instances later without also moving the DB off-box.
- **When to use it**: this is the right default for a hackathon. Use it
  unless you have a specific reason not to.

### Option B: AWS RDS for PostgreSQL (managed)
A separate, managed Postgres instance in AWS, decoupled from your EC2 box.

- **Pros**: automatic backups and snapshots, survives EC2 instance
  restarts/termination, looks more "production" to judges who ask about it.
- **Cons**: a few extra console steps, and a small ongoing cost (though the
  `db.t3.micro` free-tier-eligible size is enough for this dataset).
- **How to switch to it**:
  1. AWS Console → RDS → Create database → PostgreSQL → pick a free-tier
     template → set a master username/password → note the **endpoint**
     it gives you once created (looks like
     `warehouse-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com`).
  2. In the RDS instance's security group, add an inbound rule allowing
     port `5432` from your **EC2 instance's security group** (not the
     whole internet).
  3. In `backend/.env`, change `DATABASE_URL` to:
     `postgresql+psycopg2://<user>:<password>@<rds-endpoint>:5432/warehouse_ai`
  4. In `docker-compose.yml`, delete (or comment out) the whole `postgres:`
     service block and the `depends_on: postgres` line under `backend` —
     you no longer need a local Postgres container.

### Option C: External managed free-tier Postgres (Neon, Supabase, Railway)
Skip AWS entirely for the database — use a free hosted Postgres from
[neon.tech](https://neon.tech) or [supabase.com](https://supabase.com).

- **Pros**: genuinely the fastest path — sign up, get a connection string,
  done in under 5 minutes. No AWS security group juggling.
- **Cons**: one more third-party account to manage; free tiers sometimes
  pause the database after inactivity (a few seconds of "cold start" on
  the next request, not a real problem for a demo).
- **How to switch to it**: sign up, create a project, copy the connection
  string it gives you (already in `postgresql://...` form — just add
  `+psycopg2` after `postgresql`), paste it into `DATABASE_URL` in
  `backend/.env`, and remove the `postgres:` service from
  `docker-compose.yml` exactly as in Option B, step 4.

### Option D: SQLite (no server at all)
Technically possible, **not recommended** for the actual deployment.

- **Why not**: `app/models/workflow.py` uses Postgres's `JSONB` column type
  for `record_ref`, `proposed_change`, `before`/`after` — SQLite doesn't
  have this natively, so you'd need to change those to a generic `JSON`
  type first. SQLite also handles concurrent writes from multiple API
  requests poorly, which matters once your team + frontend are all hitting
  it at once during the demo.
- **When it's actually fine**: a solo developer doing a quick local
  rehearsal of the detection rules only (no agent pipeline, no concurrent
  users). If you want this, ask and I'll make the JSONB→JSON swap for you.

**Recommendation for the hackathon**: stay on Option A for the live demo —
it's already built, tested, and one less thing to debug on demo day. Keep
Option C in your back pocket as a 5-minute fallback if the EC2 instance
turns out to be too small to comfortably run both Postgres and the backend.

---

## 2. How the database is actually used in the code

| What | Where | Notes |
|---|---|---|
| Connection string | `backend/.env` → `DATABASE_URL` | Read into `app/config.py`'s `Settings.database_url` |
| Engine/session setup | `app/db/session.py` | One `SessionLocal()` per request/task, always closed in a `finally` block |
| Table creation | `app/db/session.py` → `init_db()` | Called on FastAPI startup (`app/main.py`) — creates tables if they don't exist, no migration tool needed for a single schema version |
| Raw sheet mirrors written | `app/ingestion/load_workbook.py` | Truncates and reloads `material_master`, `inventory_stock`, etc. on every ingestion run |
| Anomalies written | `app/detection/engine.py` | One `Anomaly` row per detected issue, plus one `AuditLog` row per detection |
| Incidents/Actions written | `app/agents/graph.py` | Each LangGraph node (`root_cause_node`, `impact_node`, `resolution_node`, `apply_action_node`) opens its own session and commits |
| Everything read back out | `app/api/v1/*.py` | Every router takes `db: Session = Depends(get_db)` |

**The one thing to remember**: nothing in this codebase talks to Postgres
directly with raw SQL strings — it's all through SQLAlchemy ORM models, so
if you ever need to change a column, you edit the model in `app/models/`
and the table picks it up automatically on next `init_db()` (as long as the
table doesn't exist yet — see the migrations note in the main README).

---

## 3. How the LLMaaS key flows through the system

```
backend/.env  (LLM_API_KEY=sk-...)
       |
app/config.py        Settings.llm_api_key  (read once, cached)
       |
app/llm/client.py     get_chat_model() / get_embeddings_model()
       |               builds a ChatOpenAI(...) / OpenAIEmbeddings(...)
       |               using base_url + api_key + model from settings
       |
app/agents/graph.py    every node (root_cause_node, impact_node,
                        resolution_node) calls get_chat_model() to
                        get an LLM instance, then either binds tools
                        to it (root cause) or calls .with_structured_output()
                        on it (all three)
```

**If your LLMaaS turns out not to be OpenAI-compatible**, the only file
that needs to change is `app/llm/client.py` — see its docstring for what
to do instead. Nothing else imports `langchain_openai` directly.

**Security note**: `backend/.env` is already in `.gitignore` — never commit
it. On EC2, after you create it, lock down its permissions:

```bash
chmod 600 backend/.env
```

---

## 4. Step-by-step: EC2 setup

### Step 1 — Launch the instance
- AMI: **Ubuntu 24.04 LTS**
- Instance type: **t3.medium** minimum (2 vCPU / 4GB RAM — Postgres +
  backend + the LLM calls' overhead need more than a t2.micro comfortably).
  Go to `t3.large` if your team also runs the Next.js frontend on the same
  box.
- Storage: 20GB gp3 is plenty for this dataset size.
- Key pair: create/download one if you don't have one — you'll need it to
  SSH in.

### Step 2 — Configure the security group
Allow inbound:
| Port | Source | Why |
|---|---|---|
| 22 | Your IP only | SSH |
| 8000 | Your team's IPs, or `0.0.0.0/0` for a public demo | Backend API |
| 3000 | Same as above | Next.js frontend, if hosted on this same instance |
| 80, 443 | `0.0.0.0/0` | Only if you set up Nginx + a domain (optional, see §6) |

### Step 3 — SSH in and install Docker
```bash
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# so you don't need `sudo` before every docker command
sudo usermod -aG docker $USER
newgrp docker
```

### Step 4 — Get the code onto the instance
Easiest path: from your own machine, upload the zip you already have.
```bash
scp -i your-key.pem warehouse-ai-starter.zip ubuntu@<EC2-PUBLIC-IP>:~
```
Then on the instance:
```bash
sudo apt-get install -y unzip
unzip warehouse-ai-starter.zip
cd warehouse-ai
```
(If you've since pushed this to a GitHub repo, `git clone` it instead —
that makes the next demo update a `git pull` + `docker compose up -d --build`
instead of re-uploading a zip each time.)

### Step 5 — Configure the environment
```bash
cp backend/.env.example backend/.env
nano backend/.env      # or vim, whatever you're comfortable with
```
At minimum, set:
- `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` — your real LLMaaS values
- `CORS_ORIGINS` — add wherever your Next.js frontend will actually run
  from, e.g. `http://<EC2-PUBLIC-IP>:3000,http://localhost:3000`
- Leave `DATABASE_URL` as-is if you're using Option A above; change it if
  you picked B or C.

```bash
chmod 600 backend/.env
```

### Step 6 — Start the stack
```bash
docker compose up -d --build
docker compose ps          # both services should show "healthy"/"running"
docker compose logs -f backend    # watch it come up; Ctrl+C to stop watching
```

### Step 7 — Verify
```bash
curl http://localhost:8000/health
# {"status":"ok","environment":"local"}
```
From your own machine (not the instance): `http://<EC2-PUBLIC-IP>:8000/health`
and `http://<EC2-PUBLIC-IP>:8000/docs` for the interactive API explorer.

### Step 8 — Load the dataset
```bash
curl -X POST http://localhost:8000/api/v1/ingest/run \
  -F "file=@/path/to/Warehouse_AI_Hackathon_Synthetic_Dataset_FINAL_2.xlsx"
```
This ingests, runs detection, and kicks off the agent pipelines in the
background — check progress with:
```bash
curl http://localhost:8000/api/v1/kpis
curl http://localhost:8000/api/v1/actions?status=pending_approval
```

### Step 9 — Point the Next.js frontend at it
In your frontend's env config:
```
NEXT_PUBLIC_API_BASE_URL=http://<EC2-PUBLIC-IP>:8000/api/v1
```
If you deploy the frontend on the same EC2 instance, uncomment the
`frontend:` service block already sketched (commented out) in
`docker-compose.yml` once your Next.js app has its own `Dockerfile`.

---

## 5. Backups (Option A only)

Before the demo, snapshot the Postgres volume so a bad `docker compose down -v`
doesn't wipe your data:
```bash
docker run --rm \
  -v warehouse-ai_pgdata:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/pgdata-backup.tar.gz /data
```
Restore with the same command in reverse (`tar xzf` into the volume) if
needed.

---

## 6. Optional: a real domain + HTTPS

Not necessary for a hackathon demo on the raw IP, but if you want a clean
URL: point a domain's A record at your EC2 IP, install Nginx + Certbot,
and reverse-proxy port 80/443 to `localhost:8000` (backend) and
`localhost:3000` (frontend) by path or subdomain. Ask if you want the
exact Nginx config for this — it's about 20 lines.

---

## 7. Restarting safely

Because of the in-memory `MemorySaver` checkpointer (see the main README's
"known limitations"), **any incident pipeline run that's currently paused
waiting for approval is lost if you restart the backend container.**
Before running `docker compose restart backend` or redeploying:
1. Check `GET /api/v1/actions?status=pending_approval` for anything
   waiting.
2. Approve or reject everything pending.
3. Then restart.

Rotating the LLMaaS key doesn't need any of this — just edit `.env` and:
```bash
docker compose up -d --build backend
```
