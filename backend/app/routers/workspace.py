"""
The console's whole API surface.

One implicit workspace, one stage per tab. Each generate endpoint runs a
single agent against the persisted output of the previous stage, so a user
can re-run just the step they're looking at instead of the whole pipeline.

Stage order is enforced here, not only by a greyed-out nav item: each
generate endpoint refuses to run until step 1 is complete and the stage
before it has produced something, so the gate holds regardless of the caller.
"""
from __future__ import annotations

import logging
import threading
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app import brand, csv_ingest, mailer, persistence, storage
from app.activity import list_activity, log_activity
from app.config import WORKSPACE_ID, get_settings
from app.cost_meter import cost_meter
from app.ledger import list_entries
from app.orchestrator.agents.creative_direction import company_assets, run_creative_direction
from app.orchestrator.agents.email_composer import run_email_composer
from app.orchestrator.agents.guardian import GUARDIAN_VERSION, adjudicate
from app.orchestrator.agents.segmentation import run_segmentation
from app.progress import jobs
from app.supabase_client import get_supabase

router = APIRouter()
settings = get_settings()

# 25 MB — comfortably past a 20,000-row contact export, and small enough that
# a mis-picked file fails fast instead of being buffered in full.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def _require_supabase():
    if get_supabase() is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured on the backend yet.")


def _require_company():
    """Every agent prompt is built from the company profile, so a run before
    step 1 is finished would describe a nameless company with no intent."""
    if not persistence.company_is_configured():
        raise HTTPException(
            status_code=400,
            detail="Fill in your company name and campaign intent in Company Info first.",
        )


def _start_job(kind: str, steps: list[str], work, on_success=None):
    """Runs `work(on_step)` on a worker thread behind a job record.

    Every long action goes through here so the console can show the same
    step-by-step panel instead of an indefinite spinner, and so a slow
    generate never sits on an open HTTP request.
    """
    job_id = jobs.create(kind, steps)

    def worker():
        try:
            result = work(lambda i, detail="": jobs.start_step(job_id, i, detail))
            summary = on_success(result) if on_success else None
            jobs.finish(job_id, summary)
        except Exception as exc:  # noqa: BLE001 — surfaced through the job record
            logging.getLogger("mosaic.jobs").exception("%s failed", kind)
            log_activity(f"{kind}.failed", detail=str(exc))
            jobs.fail(job_id, str(exc))

    threading.Thread(target=worker, daemon=True).start()
    return {"job_id": job_id, "steps": steps}


@router.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    return job


# ── Console state ─────────────────────────────────────────────────────────


def _latest_verdicts() -> dict[str, dict]:
    """Most recent pre-flight verdict per email. list_entries returns newest
    first, so the first hit for an artifact wins — an email edited after
    approval must not surface its stale pre-edit verdict.

    Verdicts from an older Guardian are ignored rather than shown: their checks
    predate the category/severity grouping the Approval Queue renders, and a
    verdict from a *different set of checks* is not evidence about this one.
    The queue shows those emails as unchecked, with a Re-run button.
    """
    verdicts: dict[str, dict] = {}
    for entry in list_entries(WORKSPACE_ID):
        if entry.get("stage") != "Compliance Adjudication":
            continue
        if entry.get("prompt_version") != GUARDIAN_VERSION:
            continue
        artifact_id = entry.get("output_artifact_id")
        if artifact_id and artifact_id not in verdicts:
            verdicts[artifact_id] = {
                "verdict": entry.get("verdict"),
                "checks": entry.get("checks") or [],
                "created_at": entry.get("created_at"),
            }
    return verdicts


def _company_payload() -> dict:
    """The company profile plus the one derived flag the console gates on."""
    profile = persistence.get_company_profile()
    return {**profile, "configured": persistence.company_is_configured(profile)}


@router.get("/api/state")
def get_state():
    """Everything the console renders, in one payload. Each tab slices what
    it needs client-side rather than issuing its own fetch."""
    _require_supabase()
    return {
        "company": _company_payload(),
        "audience_count": persistence.count_customers(),
        "segments": persistence.fetch_segments(),
        "creative_directions": persistence.fetch_creative_directions(),
        "emails": persistence.fetch_segment_emails(),
        "verdicts": _latest_verdicts(),
        "proxy_checks": persistence.fetch_proxy_checks(),
        "approvals": persistence.fetch_approvals(),
        "sends": persistence.fetch_sends(),
        "offers": persistence.fetch_offers(),
        "brand_palette": persistence.get_brand_palette(),
        "max_segments": settings.max_segments,
        "spend_usd": cost_meter.total_for(),
        "dispatch": {
            "configured": settings.resend_configured,
            "from_address": settings.resend_from,
            "default_recipient": settings.default_recipient,
        },
    }


# ── Step 1: Company info & audience upload ────────────────────────────────


@router.get("/api/company")
def get_company():
    _require_supabase()
    return {"company": _company_payload(), "offers": persistence.fetch_offers()}


class OfferInput(BaseModel):
    id: str | None = None
    name: str
    terms: str = ""


class UpdateCompanyRequest(BaseModel):
    """Everything step 1 collects. Every field is optional so a partial save
    (Creative Review writing only the brand assets, say) can't blank the rest."""

    name: str | None = None
    website: str | None = None
    description: str | None = None
    campaign_intent: str | None = None
    dynamic_attribute: str | None = None
    logo_url: str | None = None
    hero_image_url: str | None = None
    offers: list[OfferInput] | None = None


def _replace_offers(offers: list[OfferInput]) -> None:
    """Upserts the submitted catalogue and drops anything the user removed."""
    existing = {o["id"] for o in persistence.fetch_offers()}
    kept = set()
    rows = []
    for offer in offers:
        offer_id = offer.id or f"OFFER-{uuid.uuid4().hex[:8]}"
        kept.add(offer_id)
        rows.append({"id": offer_id, "campaign_id": WORKSPACE_ID, "name": offer.name, "terms": offer.terms})
    persistence.upsert_offers(rows)
    for removed in existing - kept:
        persistence.delete_offer(removed)


@router.put("/api/company")
def update_company(body: UpdateCompanyRequest):
    _require_supabase()
    patch = body.model_dump(exclude={"offers"}, exclude_none=True)

    if patch.get("dynamic_attribute"):
        known = {c["name"] for c in persistence.get_company_profile().get("columns") or []}
        if known and patch["dynamic_attribute"] not in known:
            raise HTTPException(
                status_code=400,
                detail=f"“{patch['dynamic_attribute']}” is not a column in the uploaded CSV.",
            )

    if patch:
        persistence.set_company_profile(patch)
    if body.offers is not None:
        _replace_offers(body.offers)

    changed = list(patch) + (["offers"] if body.offers is not None else [])
    if changed:
        log_activity(
            "company.update",
            detail=f"Updated company info ({', '.join(changed)})",
            target_type="setting",
            metadata={"changed": changed},
        )
    return get_company()


@router.get("/api/audience")
def get_audience(offset: int = 0, limit: int = 50):
    """One page of the uploaded audience, plus the column profile so the
    console can render the operator's own column names rather than a fixed
    set it no longer knows anything about."""
    _require_supabase()
    rows, total = persistence.page_customers(offset, min(limit, 200))
    profile = persistence.get_company_profile()
    return {
        "rows": rows,
        "total": total,
        "offset": offset,
        "limit": limit,
        "columns": profile.get("columns") or [],
    }


UPLOAD_STEPS = [
    "Reading the CSV",
    "Profiling columns",
    "Clearing the previous audience",
    "Writing contacts",
]


@router.post("/api/audience/upload")
async def upload_audience(file: UploadFile = File(...)):
    """Replaces the workspace audience with an uploaded CSV.

    The file is read here, on the request, and only the parsed bytes are
    handed to the worker — an UploadFile is closed once the response returns,
    so a background thread reading from it would race the client.
    """
    _require_supabase()
    if not (file.filename or "").lower().endswith((".csv", ".txt")):
        raise HTTPException(status_code=400, detail="Upload a .csv file.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="That file is empty.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"That file is {len(raw) / 1024 / 1024:.1f} MB — the limit is {MAX_UPLOAD_BYTES // 1024 // 1024} MB.",
        )
    filename = file.filename or "customers.csv"

    def work(on_step):
        on_step(0, f"Reading {filename}")
        try:
            columns, rows = csv_ingest.parse_csv(raw)
        except ValueError as exc:
            raise RuntimeError(str(exc)) from exc
        on_step(0, f"{len(rows):,} rows · {len(columns)} columns")

        on_step(1, "Classifying columns")
        profile = csv_ingest.profile_columns(columns, rows)
        kinds: dict[str, int] = {}
        for column in profile:
            kinds[column["kind"]] = kinds.get(column["kind"], 0) + 1
        on_step(1, " · ".join(f"{n} {kind}" for kind, n in sorted(kinds.items())))

        on_step(2, "Removing segments and existing contacts")
        persistence.clear_segments()
        persistence.clear_customers()

        customer_rows = csv_ingest.build_customer_rows(rows, profile, WORKSPACE_ID)
        on_step(3, f"0 / {len(customer_rows):,} written")
        persistence.bulk_insert_customers(
            customer_rows,
            on_progress=lambda done: on_step(3, f"{done:,} / {len(customer_rows):,} written"),
        )

        # A new file invalidates the previously chosen personalisation column.
        previous = persistence.get_company_profile().get("dynamic_attribute") or ""
        persistence.set_company_profile(
            {
                "columns": profile,
                "csv_filename": filename,
                "csv_row_count": len(customer_rows),
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                "dynamic_attribute": previous if previous in columns else "",
            }
        )
        return len(customer_rows)

    def done(count):
        log_activity(
            "audience.upload",
            detail=f"Uploaded {count} contacts from {filename}",
            target_type="audience",
            metadata={"count": count, "filename": filename},
        )
        return {"count": count}

    return _start_job("audience.upload", UPLOAD_STEPS, work, done)


# ── Stage 1: Segments ─────────────────────────────────────────────────────


class GenerateSegmentsRequest(BaseModel):
    max_segments: int | None = None


# Order and wording must match the on_step() indices in segmentation.py.
SEGMENTATION_STEPS = [
    "Reading the audience",
    "Embedding customer notes",
    "Building the feature matrix",
    "Clustering with HDBSCAN",
    "Writing segment briefs",
    "Saving segments",
]


@router.post("/api/segments/generate")
def generate_segments(body: GenerateSegmentsRequest):
    """Segmentation is the one genuinely slow stage, so it runs on a worker
    thread and reports named steps. The console polls GET /api/jobs/{id}
    rather than sitting on an open request for minutes."""
    _require_supabase()
    _require_company()
    if persistence.count_customers() == 0:
        raise HTTPException(status_code=400, detail="No contacts yet — upload your customer CSV first.")
    max_segments = body.max_segments or settings.max_segments
    job_id = jobs.create("segmentation", SEGMENTATION_STEPS)

    def worker():
        try:
            result = run_segmentation(
                {"max_segments": max_segments},
                on_step=lambda i, detail="": jobs.start_step(job_id, i, detail),
            )
            count = len(result["segment_briefs"])
            log_activity(
                "segments.generate",
                detail=f"Discovered {count} micro-segments via HDBSCAN",
                target_type="segment",
                metadata={"count": count},
            )
            jobs.finish(job_id, {"count": count})
        except Exception as exc:  # noqa: BLE001 — surfaced through the job record
            logging.getLogger("mosaic.segmentation").exception("Segmentation failed")
            log_activity("segments.generate.failed", detail=str(exc), target_type="segment")
            jobs.fail(job_id, str(exc))

    threading.Thread(target=worker, daemon=True).start()
    return {"job_id": job_id, "steps": SEGMENTATION_STEPS}


@router.get("/api/segments")
def get_segments():
    _require_supabase()
    return {"segments": persistence.fetch_segments()}


# ── Stage 2: Creative direction ───────────────────────────────────────────


CREATIVE_STEPS = [
    "Loading the brand palette",
    "Writing creative direction",
    "Saving direction",
]


@router.post("/api/creative/generate")
def generate_creative():
    _require_supabase()
    _require_company()
    segments = persistence.fetch_segments()
    if not segments:
        raise HTTPException(status_code=400, detail="No segments yet — generate segments first.")

    existing_assets = {
        d["segment_brief_id"]: {
            "logo_url": d.get("logo_url"),
            "hero_image_url": d.get("hero_image_url"),
        }
        for d in persistence.fetch_creative_directions()
    }

    def work(on_step):
        return run_creative_direction(
            {"segment_briefs": segments, "existing_assets": existing_assets},
            on_step=on_step,
        )

    def done(result):
        count = len(result["creative_directions"])
        log_activity(
            "creative.generate",
            detail=f"Generated creative direction for {count} segments",
            target_type="segment",
            metadata={"count": count},
        )
        return {"count": count}

    return _start_job("creative.generate", CREATIVE_STEPS, work, done)


class UpdateCreativeRequest(BaseModel):
    tonality: str | None = None
    language_style: str | None = None
    cta_style: str | None = None
    design_style: str | None = None
    palette: dict | None = None
    logo_url: str | None = None
    hero_image_url: str | None = None


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


EMAIL_STEPS = [
    "Reading the offer catalogue",
    "Composing emails",
    "Saving emails",
    "Running Guardian checks",
]


@router.post("/api/emails/generate")
def generate_emails(body: GenerateEmailsRequest):
    _require_supabase()
    _require_company()
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

    default_logo, default_hero = company_assets()
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
                "logo_url": d.get("logo_url") or default_logo,
                "hero_image_url": d.get("hero_image_url") or default_hero,
                "rationale": d.get("rationale", ""),
            }
            for d in directions
        ],
    }

    def work(on_step):
        result = run_email_composer(state, on_step=on_step)
        emails = result["segment_emails"]

        # Adjudicate immediately so the Approval Queue has a verdict to show
        # without the user having to trigger a separate pass.
        composed_ids = {e["segment_id"] for e in emails}
        rows = [r for r in persistence.fetch_segment_emails() if r["segment_brief_id"] in composed_ids]
        for n, row in enumerate(rows, start=1):
            on_step(3, f"Email {n} of {len(rows)}")
            adjudicate(row)
        return emails

    def done(emails):
        log_activity(
            "emails.generate",
            detail=f"Composed {len(emails)} segment emails",
            target_type="email",
            metadata={"count": len(emails)},
        )
        return {"count": len(emails)}

    return _start_job("emails.generate", EMAIL_STEPS, work, done)


class UpdateEmailRequest(BaseModel):
    subject: str | None = None
    preheader: str | None = None
    blocks: list[dict] | None = None
    background: dict | None = None


@router.patch("/api/emails/{email_id}")
def update_email(email_id: str, body: UpdateEmailRequest):
    """Saves builder edits back to the segment email, then re-runs pre-flight —
    an edit can break a link, strip the unsubscribe footer or paste in a real
    customer's address, so the Approval Queue's verdict must not go stale."""
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


# ── Stage 4: Approvals & dispatch ─────────────────────────────────────────


def _latest_verdict_for(email_id: str) -> str | None:
    """The most recent Guardian verdict for one email, straight from the
    ledger. list_entries returns newest first."""
    for entry in list_entries(WORKSPACE_ID):
        if entry.get("stage") == "Compliance Adjudication" and entry.get("output_artifact_id") == email_id:
            return entry.get("verdict")
    return None


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
    if _latest_verdict_for(body.target_id) == "BLOCK":
        raise HTTPException(
            status_code=409,
            detail="This email failed a blocking pre-flight check and cannot be approved. Fix it first.",
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


@router.post("/api/email-assets/upload")
async def upload_email_asset(file: UploadFile = File(...)):
    """Hosts one image in the public email-images bucket and returns its URL.

    The browser cannot do this itself — the bucket's RLS policies don't grant
    the anon key insert rights — so every image that needs a public URL comes
    through here. See storage.py.
    """
    _require_supabase()
    raw = await file.read()
    try:
        url = storage.upload_image(
            raw,
            filename=file.filename or "",
            content_type=file.content_type or "",
            prefix="email-asset",
        )
    except storage.StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"url": url}


class SendRequest(BaseModel):
    """The Approval Queue posts the same HTML the builder previews.

    Rendering happens in the browser because that is where the block renderer
    lives (components/email-builder/export-html.ts) — re-implementing it in
    Python would give two renderers that drift, and the operator would be
    approving a preview that isn't what ships.
    """

    to: str
    html: str
    subject: str | None = None


@router.post("/api/emails/{email_id}/send")
def send_email(email_id: str, body: SendRequest):
    """Dispatches an email for real, through Resend.

    Pressing Send *is* the sign-off — there is no separate approval step — so
    the blocking pre-flight verdict is the only gate, and it is enforced here
    rather than only by a disabled button. Both outcomes, accepted and refused,
    are written to email_send, so the queue shows a failed attempt instead of
    silently looking unsent.
    """
    _require_supabase()
    email = persistence.fetch_segment_email(email_id)
    if email is None:
        raise HTTPException(status_code=404, detail="Email not found")

    if not persistence.sends_table_ready():
        raise HTTPException(status_code=503, detail=persistence.SEND_TABLE_MISSING)

    if _latest_verdict_for(email_id) == "BLOCK":
        raise HTTPException(
            status_code=409,
            detail="This email failed a blocking pre-flight check and cannot be sent.",
        )

    recipient = (body.to or "").strip()
    if not mailer.is_valid_address(recipient):
        raise HTTPException(status_code=400, detail=f"“{recipient}” is not a valid email address.")

    # Fill personalisation from a real contact in this segment, so the tags the
    # Guardian verified as resolvable actually resolve on the way out.
    contact = persistence.sample_contact_for_segment(email["segment_brief_id"])
    subject = brand.fill_merge_tags(body.subject or email.get("subject", ""), contact)
    html = brand.fill_merge_tags(body.html, contact)

    row = {
        "id": f"send-{uuid.uuid4().hex[:10]}",
        "campaign_id": WORKSPACE_ID,
        "email_id": email_id,
        "segment_brief_id": email["segment_brief_id"],
        "recipient": recipient,
        "subject": subject,
    }

    try:
        result = mailer.send_email(to=recipient, subject=subject, html=html)
    except mailer.SendError as exc:
        persistence.insert_send({**row, "status": "failed", "error": str(exc)})
        log_activity(
            "email.send.failed",
            detail=f"Send to {recipient} failed — {exc}",
            target_type="email",
            target_id=email_id,
            metadata={"recipient": recipient},
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    row = {**row, "status": "sent", "provider_id": result.get("id")}
    persistence.insert_send(row)
    persistence.update_segment_email(email_id, {"status": "sent"})
    log_activity(
        "email.send",
        detail=f"Sent “{subject}” to {recipient}",
        target_type="email",
        target_id=email_id,
        metadata={"recipient": recipient, "provider_id": result.get("id")},
    )
    return row


# ── Settings ──────────────────────────────────────────────────────────────
#
# Campaign intent and the offer catalogue moved to step 1 (see PUT
# /api/company) — Settings is connections, generation limits and the brand
# palette only.


class UpdateSettingsRequest(BaseModel):
    brand_palette: dict | None = None


@router.get("/api/settings")
def get_settings_route():
    _require_supabase()
    return {
        "brand_palette": persistence.get_brand_palette(),
        "openrouter_configured": settings.openrouter_configured,
        "supabase_configured": settings.supabase_configured,
        "resend_configured": settings.resend_configured,
        "resend_from": settings.resend_from,
        "default_recipient": settings.default_recipient,
        "text_model": settings.openrouter_text_model,
        "embedding_model": settings.openrouter_embedding_model,
        "max_segments": settings.max_segments,
    }


@router.put("/api/settings")
def update_settings_route(body: UpdateSettingsRequest):
    _require_supabase()
    if body.brand_palette is not None:
        persistence.set_brand_palette(body.brand_palette)
        log_activity(
            "settings.update",
            detail="Updated brand palette",
            target_type="setting",
            metadata={"changed": ["brand palette"]},
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
