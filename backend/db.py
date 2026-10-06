"""Database engine and session management."""
import logging
from contextlib import contextmanager
from typing import Generator

from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import NullPool

from .config import settings

logger = logging.getLogger(__name__)


def get_database_url() -> str:
    """Get database URL with postgres:// -> postgresql:// fix for Render."""
    url = settings.DATABASE_URL
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


# Create engine with appropriate pooling
# For SQLite: use NullPool to avoid threading issues
# For PostgreSQL: use default pool with pre_ping
connect_args = {}
if get_database_url().startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        get_database_url(),
        connect_args=connect_args,
        poolclass=NullPool,
        echo=settings.ENV == "dev",
    )
else:
    engine = create_engine(
        get_database_url(),
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        echo=settings.ENV == "dev",
    )


def create_db_and_tables() -> None:
    """Create all database tables."""
    logger.info("Creating database tables...")
    SQLModel.metadata.create_all(engine)
    logger.info("Database tables created successfully.")


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency for database session."""
    with Session(engine) as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Context manager for database session outside of FastAPI requests."""
    session = Session(engine)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()