FROM python:3.12-slim

WORKDIR /app

# psycopg2-binary doesn't need libpq-dev, but build-essential covers any
# wheel that falls back to source builds on an unusual architecture (e.g.
# certain EC2 ARM instance types).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts

# Mounted at runtime via docker-compose (see data/ volume) -- keeping the
# directory here too so `docker run` without compose still has somewhere
# to write an uploaded workbook.
RUN mkdir -p /app/data

EXPOSE 8000

# --workers 1 is deliberate, not a placeholder: the LangGraph MemorySaver
# checkpointer (see app/agents/graph.py) keeps paused runs in this
# process's memory. Multiple workers would each have their own copy, so an
# approval could get routed to a worker that never saw the paused run.
# Move to a persistent (e.g. Postgres) checkpointer before scaling workers.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
