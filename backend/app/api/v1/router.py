from fastapi import APIRouter

from app.api.v1 import actions, anomalies, audit, incidents, ingest, kpis, materials, ws

api_router = APIRouter()
api_router.include_router(kpis.router)
api_router.include_router(incidents.router)
api_router.include_router(anomalies.router)
api_router.include_router(actions.router)
api_router.include_router(audit.router)
api_router.include_router(ingest.router)
api_router.include_router(materials.router)
api_router.include_router(ws.router)  # exposed at {api_v1_prefix}/ws/agent-trace once mounted in main.py
