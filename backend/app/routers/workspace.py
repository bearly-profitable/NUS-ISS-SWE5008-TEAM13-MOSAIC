"""
The console's whole API surface.

One implicit workspace, one stage per tab. Each generate endpoint runs a
single agent against the persisted output of the previous stage, so a user
can re-run just the step they're looking at instead of the whole pipeline.
"""
from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import persistence
from app.activity import list_activity, log_activity
from app.config import WORKSPACE_ID, get_settings
from app.cost_meter import cost_meter
from app.ledger import list_entries
from app.orchestrator.agents.creative_direction import run_creative_direction
from app.orchestrator.agents.email_composer import run_email_composer
from app.orchestrator.agents.guardian import adjudicate
from app.orchestrator.agents.segmentation import run_segmentation
from app.supabase_client import get_supabase
from app.synthetic_data import load_base_csv

router = APIRouter()
settings = get_settings()

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_BASE_CSV_PATH = os.path.join(_BACKEND_ROOT, "data", "m1_synthetic_customers.csv")

_DEFAULT_OFFERS = [
    {"name": "Extra Data Boost", "terms": "Extra 20GB data free for 3 months on eligible plans"},
    {"name": "Early Device Upgrade", "terms": "Upgrade your device early with no re-contract fee"},
    {"name": "Bundle Discount", "terms": "10% off your mobile line when bundled with broadband"},
]


def _require_supabase():
    if get_supabase() is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured on the backend yet.")


def _seed_default_offers_if_empty() -> None:
    if not persistence.fetch_offers():
        persistence.upsert_offers(
            [
                {"id": f"OFFER-{uuid.uuid4().hex[:8]}", "campaign_id": WORKSPACE_ID, **o}
                for o in _DEFAULT_OFFERS
            ]
        )


# ── Console state ─────────────────────────────────────────────────────────


def _latest_verdicts() -> dict[str, dict]:
    """Most recent Guardian verdict per email. list_entries returns newest
    first, so the first hit for an artifact wins — an email edited after
    approval must not surface its stale pre-edit verdict."""
    verdicts: dict[str, dict] = {}
    for entry in list_entries(WORKSPACE_ID):
        if entry.get("stage") != "Compliance Adjudication":
            continue
        artifact_id = entry.get("output_artifact_id")
        if artifact_id and artifact_id not in verdicts:
            verdicts[artifact_id] = {
                "verdict": entry.get("verdict"),
                "checks": entry.get("checks") or [],
                "created_at": entry.get("created_at"),
            }
    return verdicts


@router.get("/api/state")
def get_state():
    """Everything the console renders, in one payload. Each tab slices what
    it needs client-side rather than issuing its own fetch."""
    _require_supabase()
    return {
        "audience_count": persistence.count_customers(),
        "segments": persistence.fetch_segments(),
        "creative_directions": persistence.fetch_creative_directions(),
        "emails": persistence.fetch_segment_emails(),
        "verdicts": _latest_verdicts(),
        "proxy_checks": persistence.fetch_proxy_checks(),
        "manipulation_scores": persistence.fetch_manipulation_scores(),
        "approvals": persistence.fetch_approvals(),
        "offers": persistence.fetch_offers(),
        "objective": persistence.get_objective(),
        "brand_palette": persistence.get_brand_palette(),
        "max_segments": settings.max_segments,
        "spend_usd": cost_meter.total_for(),
    }


# ── Audience ──────────────────────────────────────────────────────────────


@router.get("/api/audience")
def get_audience(offset: int = 0, limit: int = 50, search: str | None = None):
    _require_supabase()
    rows, total = persistence.page_customers(offset, min(limit, 200), search)
    return {"rows": rows, "total": total, "offset": offset, "limit": limit}


class LoadAudienceRequest(BaseModel):
    count: int = Field(default=5000, ge=1, le=5000)


@router.post("/api/audience/load")
def load_audience(body: LoadAudienceRequest):
    """Attaches the fixed M1 synthetic customer base to this workspace, from
    backend/data/m1_synthetic_customers.csv. No random generation happens
    here — the same 5,000 fabricated telco profiles every time. Reloading
    replaces the existing audience (and clears segments, which cascade)."""
    _require_supabase()
    if not os.path.exists(_BASE_CSV_PATH):
        raise HTTPException(
            status_code=500,
            detail=f"Base CSV not found at {_BASE_CSV_PATH} — run synthetic_data.export_base_csv() first.",
        )

    persistence.clear_segments()
    persistence.clear_customers()

    customers = load_base_csv(_BASE_CSV_PATH, WORKSPACE_ID, limit=body.count)
    persistence.bulk_insert_customers(
        [
            {
                "id": c.id,
                "campaign_id": c.campaign_id,
                "structured_attrs": c.structured_attrs,
                "behavioural": c.behavioural,
                "psychographic": c.psychographic,
                "free_text": c.free_text,
                "consent_state": c.consent_state,
            }
            for c in customers
        ]
    )
    _seed_default_offers_if_empty()
    log_activity(
        "audience.load",
        detail=f"Loaded {len(customers)} contacts from the fixed M1 synthetic base",
        target_type="audience",
        metadata={"count": len(customers)},
    )
    return {"loaded": len(customers)}


# ── Stage 1: Segments ─────────────────────────────────────────────────────


class GenerateSegmentsRequest(BaseModel):
    max_segments: int | None = None


@router.post("/api/segments/generate")
def generate_segments(body: GenerateSegmentsRequest):
    _require_supabase()
    max_segments = body.max_segments or settings.max_segments
    try:
        result = run_segmentation({"max_segments": max_segments})
    except Exception as exc:
        log_activity("segments.generate.failed", detail=str(exc), target_type="segment")
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {exc}") from exc

    segments = result["segment_briefs"]
    log_activity(
        "segments.generate",
        detail=f"Discovered {len(segments)} micro-segments via HDBSCAN",
        target_type="segment",
        metadata={"count": len(segments)},
    )
    return {"segments": persistence.fetch_segments()}


@router.get("/api/segments")
def get_segments():
    _require_supabase()
    return {"segments": persistence.fetch_segments()}


# ── Stage 2: Creative direction ───────────────────────────────────────────


@router.post("/api/creative/generate")
def generate_creative():
    _require_supabase()
    segments = persistence.fetch_segments()
    if not segments:
        raise HTTPException(status_code=400, detail="No segments yet — generate segments first.")

    try:
        run_creative_direction({"segment_briefs": segments, "objective": persistence.get_objective()})
    except Exception as exc:
        log_activity("creative.generate.failed", detail=str(exc), target_type="segment")
        raise HTTPException(status_code=500, detail=f"Creative direction failed: {exc}") from exc

    log_activity(
        "creative.generate",
        detail=f"Generated creative direction for {len(segments)} segments",
        target_type="segment",
        metadata={"count": len(segments)},
    )
    return {"creative_directions": persistence.fetch_creative_directions()}


class UpdateCreativeRequest(BaseModel):
    tonality: str | None = None
    language_style: str | None = None
    cta_style: str | None = None
    design_style: str | None = None
    palette: dict | None = None


@router.patch("/api/creative/{segment_id}")
def update_creative(segment_id: str, body: UpdateCreativeRequest):
    _require_supabase()
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    updated = persistence.update_creative_direction(segment_id, patch)
    log_activity(
        "creative.edit",
        detail=f"Edited creative direction ({', '.join(patch)})",
        target_type="segment",
        target_id=segment_id,
        metadata={"fields": list(patch)},
    )
    return updated


# ── Stage 3: Emails ───────────────────────────────────────────────────────


class GenerateEmailsRequest(BaseModel):
    """Omit segment_ids to (re)generate every segment's email."""

    segment_ids: list[str] | None = None


@router.post("/api/emails/generate")
def generate_emails(body: GenerateEmailsRequest):
    _require_supabase()
    segments = persistence.fetch_segments()
    if body.segment_ids:
        segments = [s for s in segments if s["id"] in set(body.segment_ids)]
    if not segments:
        raise HTTPException(status_code=400, detail="No segments to compose for.")

    directions = persistence.fetch_creative_directions()
    if not directions:
        raise HTTPException(
            status_code=400,
            detail="No creative direction yet — generate it in the Creative Review tab first.",
        )

    state = {
        "segment_briefs": segments,
        "creative_directions": [
            {
                "segment_id": d["segment_brief_id"],
                "tonality": d.get("tonality", ""),
                "language_style": d.get("language_style", ""),
                "cta_style": d.get("cta_style", ""),
                "design_style": d.get("design_style", ""),
                "palette": d.get("palette") or {},
                "rationale": d.get("rationale", ""),
            }
            for d in directions
        ],
        "objective": persistence.get_objective(),
    }

    try:
        result = run_email_composer(state)
    except Exception as exc:
        log_activity("emails.generate.failed", detail=str(exc), target_type="email")
        raise HTTPException(status_code=500, detail=f"Email composition failed: {exc}") from exc

    emails = result["segment_emails"]
    # Adjudicate immediately so the Approval Queue has a verdict to show
    # without the user having to trigger a separate pass.
    for row in persistence.fetch_segment_emails():
        if row["segment_brief_id"] in {e["segment_id"] for e in emails}:
            adjudicate(row)

    log_activity(
        "emails.generate",
        detail=f"Composed {len(emails)} segment emails",
        target_type="email",
        metadata={"count": len(emails)},
    )
    return {"emails": persistence.fetch_segment_emails()}


class UpdateEmailRequest(BaseModel):
    subject: str | None = None
    preheader: str | None = None
    blocks: list[dict] | None = None
    background: dict | None = None


@router.patch("/api/emails/{email_id}")
def update_email(email_id: str, body: UpdateEmailRequest):
    """Saves builder edits back to the segment email, then re-adjudicates —
    an edit can introduce manipulation language or PII, so the Approval
    Queue's verdict must not go stale."""
    _require_supabase()
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    patch["status"] = "edited"

    updated = persistence.update_segment_email(email_id, patch)
    if updated is None:
        raise HTTPException(status_code=404, detail="Email not found")

    # An edited email loses any prior approval — it is no longer the artifact
    # that was signed off.
    persistence.delete_approval_for(email_id)
    verdict = adjudicate(updated)

    log_activity(
        "email.edit",
        detail=f"Edited email in the builder ({', '.join(k for k in patch if k != 'status')})",
        target_type="email",
        target_id=email_id,
        metadata={"fields": [k for k in patch if k != "status"], "verdict": verdict["verdict"]},
    )
    return {"email": updated, "verdict": verdict}


@router.post("/api/emails/{email_id}/adjudicate")
def readjudicate_email(email_id: str):
    _require_supabase()
    email = persistence.fetch_segment_email(email_id)
    if email is None:
        raise HTTPException(status_code=404, detail="Email not found")
    verdict = adjudicate(email)
    log_activity(
        "email.adjudicate",
        detail=f"Re-ran Guardian checks — verdict {verdict['verdict']}",
        target_type="email",
        target_id=email_id,
        metadata={"verdict": verdict["verdict"]},
    )
    return verdict


# ── Stage 4: Approvals ────────────────────────────────────────────────────


class ApproveRequest(BaseModel):
    target_id: str
    decision: str = "approved"
    scope: str = "segment-email"


@router.post("/api/approvals")
def approve(body: ApproveRequest):
    _require_supabase()
    email = persistence.fetch_segment_email(body.target_id)
    if email is None:
        raise HTTPException(status_code=404, detail="Email not found")

    # A BLOCK verdict cannot be approved. This is enforced here, not just by
    # a disabled button, so the gate holds regardless of the caller.
    latest = [
        e
        for e in list_entries(WORKSPACE_ID)
        if e.get("stage") == "Compliance Adjudication" and e.get("output_artifact_id") == body.target_id
    ]
    if latest and latest[0].get("verdict") == "BLOCK":
        raise HTTPException(
            status_code=409,
            detail="This email is BLOCKed by the Guardian and cannot be approved. Fix the failing check first.",
        )

    row = {
        "id": f"approval-{uuid.uuid4().hex[:10]}",
        "campaign_id": WORKSPACE_ID,
        "scope": body.scope,
        "approver_name": "Operator",
        "decision": body.decision,
        "target_id": body.target_id,
    }
    persistence.delete_approval_for(body.target_id)
    persistence.insert_approval(row)
    persistence.update_segment_email(body.target_id, {"status": "approved"})

    log_activity(
        "email.approve",
        detail=f"Approved “{email.get('subject', '')}” for dispatch",
        target_type="email",
        target_id=body.target_id,
        metadata={"decision": body.decision},
    )
    return row


@router.delete("/api/approvals/{target_id}")
def revoke_approval(target_id: str):
    _require_supabase()
    persistence.delete_approval_for(target_id)
    persistence.update_segment_email(target_id, {"status": "edited"})
    log_activity(
        "email.approval.revoke",
        detail="Revoked a previous approval",
        target_type="email",
        target_id=target_id,
    )
    return {"revoked": target_id}


# ── Settings ──────────────────────────────────────────────────────────────


class OfferInput(BaseModel):
    id: str | None = None
    name: str
    terms: str = ""


class UpdateSettingsRequest(BaseModel):
    objective: str | None = None
    brand_palette: dict | None = None
    offers: list[OfferInput] | None = None


@router.get("/api/settings")
def get_settings_route():
    _require_supabase()
    return {
        "objective": persistence.get_objective(),
        "brand_palette": persistence.get_brand_palette(),
        "offers": persistence.fetch_offers(),
        "openrouter_configured": settings.openrouter_configured,
        "supabase_configured": settings.supabase_configured,
        "text_model": settings.openrouter_text_model,
        "embedding_model": settings.openrouter_embedding_model,
        "max_segments": settings.max_segments,
    }


@router.put("/api/settings")
def update_settings_route(body: UpdateSettingsRequest):
    _require_supabase()
    changed = []

    if body.objective is not None:
        persistence.set_objective(body.objective)
        changed.append("objective")

    if body.brand_palette is not None:
        persistence.set_brand_palette(body.brand_palette)
        changed.append("brand palette")

    if body.offers is not None:
        existing = {o["id"] for o in persistence.fetch_offers()}
        rows = []
        kept = set()
        for offer in body.offers:
            offer_id = offer.id or f"OFFER-{uuid.uuid4().hex[:8]}"
            kept.add(offer_id)
            rows.append(
                {"id": offer_id, "campaign_id": WORKSPACE_ID, "name": offer.name, "terms": offer.terms}
            )
        persistence.upsert_offers(rows)
        for removed in existing - kept:
            persistence.delete_offer(removed)
        changed.append("offer catalogue")

    if changed:
        log_activity(
            "settings.update",
            detail=f"Updated {', '.join(changed)}",
            target_type="setting",
            metadata={"changed": changed},
        )
    return get_settings_route()


# ── Logs ──────────────────────────────────────────────────────────────────


@router.get("/api/logs")
def get_logs(limit: int = 200):
    """The Logs tab merges two sources: what the user did (activity_log) and
    what the agents did (ledger_entry, one row per model call)."""
    activity = [
        {
            "id": a["id"],
            "kind": "user",
            "actor": a.get("actor", "Operator"),
            "action": a["action"],
            "detail": a.get("detail", ""),
            "target_type": a.get("target_type"),
            "target_id": a.get("target_id"),
            "verdict": (a.get("metadata") or {}).get("verdict"),
            "created_at": a["created_at"],
        }
        for a in list_activity(limit)
    ]
    agent = [
        {
            "id": e["id"],
            "kind": "agent",
            "actor": e.get("agent", ""),
            "action": e.get("stage", ""),
            "detail": f"prompt {e.get('prompt_version') or '—'} · model {e.get('model_version') or '—'}",
            "target_type": "artifact",
            "target_id": e.get("output_artifact_id"),
            "verdict": e.get("verdict"),
            "created_at": e["created_at"],
        }
        for e in list_entries(WORKSPACE_ID)
    ]
    merged = sorted(activity + agent, key=lambda r: r["created_at"], reverse=True)[:limit]
    return {"entries": merged, "spend_usd": cost_meter.total_for()}
