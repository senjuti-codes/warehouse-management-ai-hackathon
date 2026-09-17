"""
Central configuration. Everything is read from environment variables (or a
.env file in local dev) so the same image runs unchanged on EC2 -- only the
.env differs between environments.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    app_name: str = "Warehouse AI Control Center"
    api_v1_prefix: str = "/api/v1"
    environment: str = "local"  # local | staging | production
    cors_origins: str = "http://localhost:3000"  # comma-separated, Next.js dev server by default

    # --- Database ---
    # e.g. postgresql+psycopg2://warehouse:warehouse@localhost:5432/warehouse_ai
    database_url: str = "postgresql+psycopg2://warehouse:warehouse@localhost:5432/warehouse_ai"

    # --- Dataset ---
    # Snapshot date used for every overdue / expired / stale calculation.
    # This MUST come from config, never datetime.now(), so judging against a
    # re-dated copy of the workbook still produces correct results.
    dataset_snapshot_date: str = "2026-09-05"

    # --- LLMaaS ---
    # We don't yet know the exact wire format of the org's LLMaaS gateway.
    # llm_base_url / llm_api_key / llm_model are read here and passed into
    # app.llm.client.get_llm_client(), which is the ONLY place that needs to
    # change once the real spec is known. See app/llm/client.py.
    llm_base_url: str = "https://llmaas.internal.example.com/v1"
    llm_api_key: str = "changeme"
    llm_model: str = "gpt-4o-mini"
    llm_embedding_model: str = "text-embedding-3-small"

    # --- Agent behaviour ---
    # Below this similarity score, two material descriptions are not
    # considered possible duplicates (anomaly A3).
    duplicate_material_similarity_threshold: float = 0.86
    # Below this confidence, the agent should say so rather than assert a
    # root cause -- judges explicitly reward defensible, not confident-sounding.
    root_cause_min_confidence: float = 0.5

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
