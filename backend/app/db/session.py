from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Shared declarative base for every ORM model in the app."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: one session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Create all tables if they don't exist yet.

    We use create_all() instead of Alembic for the hackathon timeline --
    there is exactly one schema version and no migration history to manage.
    If this project continues past the hackathon, swap this for Alembic
    before the schema needs its first migration.
    """
    from app.models import raw, workflow  # noqa: F401  (register models on Base.metadata)

    Base.metadata.create_all(bind=engine)
