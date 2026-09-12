"""
Activity log — the user-action half of the Logs tab.

ledger_entry records what the *agents* did (one row per model call, with
prompt/model versions). This records what the *user* did: generating
segments, editing an email, approving, changing settings. Both are surfaced
together in the Logs tab as one chronological feed.

The "Acting as" identity picker was removed, so everything is attributed to a
generic operator.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from app.supabase_client import get_supabase

logger = logging.getLogger("mosaic.activity")

DEFAULT_ACTOR = "Operator"

_fallback_entries: list[dict] = []


def log_activity(
    action: str,
    *,
    detail: str = "",
    target_type: str | None = None,
    target_id: str | None = None,
    metadata: dict | None = None,
    actor: str = DEFAULT_ACTOR,
) -> dict:
    row = {
        "id": f"act-{uuid.uuid4().hex[:12]}",
        "actor": actor,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "detail": detail,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase = get_supabase()
    if supabase is None:
        _fallback_entries.append(row)
        logger.info("[activity:in-memory] %s", row)
        return row
    try:
        supabase.table("activity_log").insert(row).execute()
    except Exception as exc:
        # A logging failure must never take down the action being logged.
        logger.warning("Could not write activity_log row (%s): %s", action, exc)
    return row


def list_activity(limit: int = 200) -> list[dict]:
    supabase = get_supabase()
    if supabase is None:
        return sorted(_fallback_entries, key=lambda r: r["created_at"], reverse=True)[:limit]
    try:
        return (
            supabase.table("activity_log")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
            .data
        )
    except Exception as exc:
        logger.warning("Could not read activity_log: %s", exc)
        return []


def clear_activity() -> None:
    """Wipes the user-action feed. Only a full workspace reset calls this —
    the log is append-only in every other code path."""
    _fallback_entries.clear()
    supabase = get_supabase()
    if supabase is None:
        return
    # activity_log has no campaign_id, so scope by a filter that matches
    # every row — PostgREST rejects a delete with no filter at all.
    supabase.table("activity_log").delete().neq("id", "").execute()

