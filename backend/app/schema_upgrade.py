"""Lightweight additive DDL for existing deployments (PostgreSQL)."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.config import settings


async def apply_schema_upgrades(conn: AsyncConnection) -> None:
    """Add columns introduced after initial MVP without Alembic."""
    if not settings.database_url.startswith("postgresql"):
        return
    await conn.execute(
        text("ALTER TABLE metrics ADD COLUMN IF NOT EXISTS observation JSONB")
    )
    await conn.execute(
        text(
            "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS severity VARCHAR(16) "
            "NOT NULL DEFAULT 'medium'"
        )
    )
