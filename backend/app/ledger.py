"""
Append-only Decision Ledger writer.

Writes to the `ledger_entry` table (see supabase/migrations/0001_init.sql) when
Supabase is configured; otherwise falls back to an in-process list plus a log
line, so the rest of the Orchestrator can run before the DB is wired up.
Every entry carries the prompt/model versions live at generation time —
never overwrite a row, only insert.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

from app.supabase_client import get_supabase

logger = logging.getLogger("mosaic.ledger")

_fallback_entries: list[dict] = []


@dataclass
class LedgerEntry:
    campaign_id: str
    stage: str
    agent: str
    prompt_version: str
    model_version: str
    input_artifact_ids: list[str] = field(default_factory=list)
    output_artifact_id: str | None = None
    verdict: str | None = None
    actor: str | None = None
    checks: list[dict] | None = None
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def write_entry(entry: LedgerEntry) -> LedgerEntry:
    supabase = get_supabase()
    row = asdict(entry)
    if supabase is None:
        _fallback_entries.append(row)
        logger.info("[ledger:in-memory] %s", row)
        return entry
    try:
        supabase.table("ledger_entry").insert(row).execute()
    except Exception as exc:
        if "checks" in str(exc):
            # supabase/migrations/0002_segment_membership.sql hasn't added
            # the checks column yet — retry without it rather than losing
            # the whole ledger entry.
            row.pop("checks", None)
            supabase.table("ledger_entry").insert(row).execute()
        else:
            raise
    return entry


def list_entries(campaign_id: str | None = None) -> list[dict]:
    supabase = get_supabase()
    if supabase is None:
        rows = _fallback_entries
    else:
        query = supabase.table("ledger_entry").select("*").order("created_at", desc=True)
        if campaign_id:
            query = query.eq("campaign_id", campaign_id)
        rows = query.execute().data
    if campaign_id:
        rows = [r for r in rows if r.get("campaign_id") == campaign_id]
    return rows


def clear_entries(campaign_id: str) -> None:
    """Empties the Decision Ledger for one workspace.

    The ledger is append-only by design — this exists solely for the reset
    button, which puts the app back to a first-run state, and is the only
    caller permitted to remove an entry.
    """
    _fallback_entries.clear()
    supabase = get_supabase()
    if supabase is None:
        return
    supabase.table("ledger_entry").delete().eq("campaign_id", campaign_id).execute()

