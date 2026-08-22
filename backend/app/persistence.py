"""
Supabase persistence helpers — every pipeline stage's real output lands in
these tables as it runs, not just in the in-memory LangGraph state.

Everything is scoped to the single implicit workspace (config.WORKSPACE_ID),
so callers never pass a campaign id around. Raises if Supabase isn't
configured; callers should only reach this once Settings.supabase_configured
is true (checked at the API boundary).
"""
from __future__ import annotations

from datetime import datetime, timezone

from postgrest.exceptions import APIError

from app.config import WORKSPACE_ID
from app.supabase_client import get_supabase

# Defaults used when the workspace has never been configured in Settings.
DEFAULT_BRAND_PALETTE = {
    "primary": "#C2703D",
    "accent": "#C2703D",
    "background": "#FFF8F0",
    "text": "#1f2937",
}

# The company profile is collected in step 1 (Company Info) and is the only
# source of brand/campaign context in the app — every agent prompt, the email
# footer links and the nav gating all read from here.
DEFAULT_COMPANY_PROFILE = {
    "name": "",
    "website": "",
    "description": "",
    "campaign_intent": "",
    # Column the operator nominated as the personalisation attribute, e.g.
    # "first_name". Emails address the reader through it as a merge tag.
    "dynamic_attribute": "",
    # Brand assets chosen in Creative Review; the email composer centres them.
    "logo_url": "",
    "hero_image_url": "",
    # Column profile of the uploaded CSV — see csv_ingest.profile_columns.
    "columns": [],
    "csv_filename": "",
    "csv_row_count": 0,
    "uploaded_at": None,
}

_BRAND_PALETTE_KEY = "brand_palette"
_COMPANY_KEY = "company_profile"


def _sb():
    sb = get_supabase()
    if sb is None:
        raise RuntimeError("Supabase is not configured — set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.")
    return sb


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Settings (brand palette, company profile) ─────────────────────────────


def get_setting(key: str, default):
    res = _sb().table("app_setting").select("value").eq("key", key).limit(1).execute()
    if not res.data:
        return default
    return res.data[0].get("value", default)


def set_setting(key: str, value) -> None:
    _sb().table("app_setting").upsert({"key": key, "value": value, "updated_at": _now()}).execute()


def get_brand_palette() -> dict:
    return {**DEFAULT_BRAND_PALETTE, **(get_setting(_BRAND_PALETTE_KEY, {}) or {})}


def set_brand_palette(palette: dict) -> None:
    set_setting(_BRAND_PALETTE_KEY, {**DEFAULT_BRAND_PALETTE, **palette})


# ── Company profile (step 1) ──────────────────────────────────────────────


def get_company_profile() -> dict:
    stored = get_setting(_COMPANY_KEY, {}) or {}
    return {**DEFAULT_COMPANY_PROFILE, **stored}


def set_company_profile(patch: dict) -> dict:
    """Merges into the stored profile — every caller only ever owns a few
    fields (the upload owns `columns`, Creative Review owns the assets), so a
    whole-object write would clobber the others."""
    merged = {**get_company_profile(), **{k: v for k, v in patch.items() if v is not None}}
    set_setting(_COMPANY_KEY, merged)
    return merged


def company_is_configured(profile: dict | None = None) -> bool:
    """Gate for the rest of the pipeline: a named company with a stated
    campaign intent and an uploaded audience."""
    profile = profile if profile is not None else get_company_profile()
    return bool(profile.get("name", "").strip() and profile.get("campaign_intent", "").strip())




# ── Audience ──────────────────────────────────────────────────────────────


def bulk_insert_customers(rows: list[dict], on_progress=None) -> None:
    sb = _sb()
    # Supabase/PostgREST has a practical payload-size sweet spot; chunk large loads.
    for i in range(0, len(rows), 500):
        sb.table("customer_profile").insert(rows[i : i + 500]).execute()
        if on_progress:
            on_progress(min(i + 500, len(rows)))


def clear_customers() -> None:
    _sb().table("customer_profile").delete().eq("campaign_id", WORKSPACE_ID).execute()


def fetch_customers() -> list[dict]:
    """Pages through the whole audience. PostgREST caps a single response at
    1,000 rows by default, so a plain select would silently truncate the
    5,000-row base and quietly change the clustering input."""
    sb = _sb()
    rows: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        res = (
            sb.table("customer_profile")
            .select("*")
            .eq("campaign_id", WORKSPACE_ID)
            .order("id")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows.extend(res.data)
        if len(res.data) < page_size:
            return rows
        offset += page_size


def count_customers() -> int:
    res = (
        _sb()
        .table("customer_profile")
        .select("id", count="exact")
        .eq("campaign_id", WORKSPACE_ID)
        .limit(1)
        .execute()
    )
    return res.count or 0


def page_customers(offset: int, limit: int) -> tuple[list[dict], int]:
    """One page of the audience for the Company Info tab's contact preview."""
    sb = _sb()
    query = sb.table("customer_profile").select("*", count="exact").eq("campaign_id", WORKSPACE_ID)
    res = query.order("id").range(offset, offset + limit - 1).execute()
    return res.data, (res.count or 0)


def assign_customers_to_segment(customer_ids: list[str], segment_brief_id: str) -> None:
    sb = _sb()
    for i in range(0, len(customer_ids), 200):
        batch = customer_ids[i : i + 200]
        sb.table("customer_profile").update({"segment_brief_id": segment_brief_id}).in_("id", batch).execute()


def consent_stats_for_segment(segment_brief_id: str) -> dict:
    res = (
        _sb()
        .table("customer_profile")
        .select("consent_state")
        .eq("segment_brief_id", segment_brief_id)
        .execute()
    )
    rows = res.data
    total = len(rows)
    withdrawn = sum(1 for r in rows if r.get("consent_state") == "withdrawn")
    return {
        "total": total,
        "withdrawn": withdrawn,
        "withdrawn_pct": round(withdrawn / total, 3) if total else 0.0,
    }


# ── Offers ────────────────────────────────────────────────────────────────


def fetch_offers() -> list[dict]:
    res = _sb().table("offer_catalogue").select("*").eq("campaign_id", WORKSPACE_ID).order("id").execute()
    return res.data


def upsert_offers(rows: list[dict]) -> None:
    if rows:
        _sb().table("offer_catalogue").upsert(rows).execute()


def delete_offer(offer_id: str) -> None:
    _sb().table("offer_catalogue").delete().eq("id", offer_id).eq("campaign_id", WORKSPACE_ID).execute()


# ── Segments ──────────────────────────────────────────────────────────────


def insert_segment_briefs(rows: list[dict]) -> None:
    if rows:
        _sb().table("segment_brief").insert(rows).execute()


def fetch_segments() -> list[dict]:
    res = (
        _sb()
        .table("segment_brief")
        .select("*")
        .eq("campaign_id", WORKSPACE_ID)
        .order("size", desc=True)
        .execute()
    )
    return res.data


def clear_segments() -> None:
    """Regenerating segments replaces the previous set. Cascades wipe
    creative_direction / segment_email / proxy_check_result along with it, so
    the console can't show a segment card whose email belongs to a stale
    clustering run."""
    sb = _sb()
    sb.table("customer_profile").update({"segment_brief_id": None}).eq("campaign_id", WORKSPACE_ID).execute()
    sb.table("segment_brief").delete().eq("campaign_id", WORKSPACE_ID).execute()


def insert_proxy_check_results(rows: list[dict]) -> None:
    if rows:
        _sb().table("proxy_check_result").upsert(rows).execute()


def fetch_proxy_check(segment_brief_id: str) -> dict | None:
    res = (
        _sb()
        .table("proxy_check_result")
        .select("*")
        .eq("segment_brief_id", segment_brief_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def fetch_proxy_checks() -> list[dict]:
    segment_ids = [s["id"] for s in fetch_segments()]
    if not segment_ids:
        return []
    return _sb().table("proxy_check_result").select("*").in_("segment_brief_id", segment_ids).execute().data


# ── Creative direction ────────────────────────────────────────────────────


def upsert_creative_directions(rows: list[dict]) -> None:
    if rows:
        for row in rows:
            row["updated_at"] = _now()
        _sb().table("creative_direction").upsert(rows).execute()


def fetch_creative_directions() -> list[dict]:
    segment_ids = [s["id"] for s in fetch_segments()]
    if not segment_ids:
        return []
    return _sb().table("creative_direction").select("*").in_("segment_brief_id", segment_ids).execute().data


def update_creative_direction(segment_brief_id: str, patch: dict) -> dict:
    patch = {**patch, "updated_at": _now()}
    _sb().table("creative_direction").update(patch).eq("segment_brief_id", segment_brief_id).execute()
    res = (
        _sb()
        .table("creative_direction")
        .select("*")
        .eq("segment_brief_id", segment_brief_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else {}


# ── Segment emails ────────────────────────────────────────────────────────


def replace_segment_emails(segment_ids: list[str], rows: list[dict]) -> None:
    """Regenerating emails for a set of segments discards the previous drafts
    for exactly those segments — other segments' emails (and any manual edits
    to them) are untouched."""
    sb = _sb()
    if segment_ids:
        sb.table("segment_email").delete().in_("segment_brief_id", segment_ids).execute()
    if rows:
        sb.table("segment_email").insert(rows).execute()


def fetch_segment_emails() -> list[dict]:
    segment_ids = [s["id"] for s in fetch_segments()]
    if not segment_ids:
        return []
    return (
        _sb()
        .table("segment_email")
        .select("*")
        .in_("segment_brief_id", segment_ids)
        .order("created_at")
        .execute()
        .data
    )


def fetch_segment_email(email_id: str) -> dict | None:
    res = _sb().table("segment_email").select("*").eq("id", email_id).limit(1).execute()
    return res.data[0] if res.data else None


def update_segment_email(email_id: str, patch: dict) -> dict | None:
    patch = {**patch, "updated_at": _now()}
    _sb().table("segment_email").update(patch).eq("id", email_id).execute()
    return fetch_segment_email(email_id)


# ── Sends ─────────────────────────────────────────────────────────────────

SEND_TABLE_MISSING = (
    "The email_send table doesn't exist yet — run "
    "supabase/migrations/0007_email_send.sql in the Supabase SQL Editor."
)


def _table_missing(exc: APIError) -> bool:
    return exc.code == "PGRST205" or "schema cache" in str(exc.message or exc)


def insert_send(row: dict) -> None:
    _sb().table("email_send").insert(row).execute()


def fetch_sends() -> list[dict]:
    """Delivery history for the whole workspace.

    Tolerates the table being absent: this is read on every /api/state, and a
    pending migration should not take down every tab in the console. The send
    endpoint checks explicitly and says what to run.
    """
    try:
        return (
            _sb()
            .table("email_send")
            .select("*")
            .eq("campaign_id", WORKSPACE_ID)
            .order("created_at", desc=True)
            .execute()
            .data
        )
    except APIError as exc:
        if _table_missing(exc):
            return []
        raise


def sends_table_ready() -> bool:
    try:
        _sb().table("email_send").select("id").limit(1).execute()
        return True
    except APIError as exc:
        if _table_missing(exc):
            return False
        raise


def sample_contact_for_segment(segment_brief_id: str) -> dict | None:
    """One real, still-opted-in contact from this segment.

    Dispatch fills the email's merge tags from this row, so a `{{first_name}}`
    lands as a name from the operator's own uploaded CSV rather than as
    literal braces. Returns None for a segment with no reachable contacts.
    """
    res = (
        _sb()
        .table("customer_profile")
        .select("*")
        .eq("segment_brief_id", segment_brief_id)
        .eq("consent_state", "active")
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


# ── Approvals ─────────────────────────────────────────────────────────────


def insert_approval(row: dict) -> None:
    _sb().table("approval").insert(row).execute()


def fetch_approvals() -> list[dict]:
    return (
        _sb()
        .table("approval")
        .select("*")
        .eq("campaign_id", WORKSPACE_ID)
        .order("created_at", desc=True)
        .execute()
        .data
    )


def delete_approval_for(target_id: str) -> None:
    _sb().table("approval").delete().eq("campaign_id", WORKSPACE_ID).eq("target_id", target_id).execute()
