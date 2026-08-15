"""
Stage 3 — Email Composer Agent (per segment).

Replaces the old Copywriter. Instead of returning loose copy fields, this
emits a real `EmailBlock[]` in exactly the shape
frontend/src/types/email-builder.ts defines, so the Email Review tab can hand
it straight to the ported builder with no translation layer — the user edits
the generated email in place.

Two deliberate splits of responsibility:

  - The **model** writes only content (headline, body, CTA label, subject,
    preheader) and picks which offers it cited.
  - The **code** assembles the block structure and applies the segment's
    creative direction (palette, design style). The model never emits raw
    block JSON, so a bad response can't produce an unrenderable template.

The hero image is intentionally left empty — no imagery is generated
anywhere in the pipeline. The user fills it in from the builder's upload or
gallery if they want one.

Grounding is enforced, not trusted: any cited offer id that isn't a real
offer_catalogue row for this workspace is dropped before persistence, and an
empty citation list is a hard BLOCK at stage 4 (guardian.py).
"""
from __future__ import annotations

import json
import uuid

from app.config import WORKSPACE_ID
from app.ledger import LedgerEntry, write_entry
from app.openrouter_client import OpenRouterCallError, OpenRouterNotConfiguredError, generate_text
from app.orchestrator.state import CreativeDirection, SegmentEmail, WorkspaceState
from app.persistence import fetch_offers, replace_segment_emails

_COPY_SCHEMA = {
    "type": "object",
    "properties": {
        "subject": {"type": "string"},
        "preheader": {"type": "string"},
        "headline": {"type": "string", "description": "The in-email headline, distinct from the subject"},
        "body_markdown": {
            "type": "string",
            "description": "Two short paragraphs of body copy. Markdown allowed. No invented prices or offers.",
        },
        "cta_text": {"type": "string", "description": "Button label, 2-4 words"},
        "cited_offers": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["subject", "preheader", "headline", "body_markdown", "cta_text", "cited_offers"],
}


def _block(block_type: str, content: dict) -> dict:
    """EmailBlock content is Record<string, string> on the frontend, so every
    value is stringified here — a stray number would break the editors."""
    return {
        "id": uuid.uuid4().hex[:8],
        "type": block_type,
        "content": {k: str(v) for k, v in content.items()},
    }


_EMPTY_HERO_OVERLAY = json.dumps(
    {"layout": "simple", "topTextOverlays": [], "textOverlays": [], "shapeOverlays": []}
)


def _rounded_for(design_style: str) -> int:
    """Maps the direction's shape language onto the builder's radius knob."""
    s = (design_style or "").lower()
    if any(w in s for w in ("sharp", "angular", "square", "geometric", "editorial")):
        return 0
    if any(w in s for w in ("pill", "very round", "soft", "friendly", "playful")):
        return 24
    return 12


def _build_blocks(copy: dict, direction: CreativeDirection) -> list[dict]:
    palette = direction.get("palette") or {}
    accent = palette.get("accent", "#C2703D")
    background = palette.get("background", "#ffffff")
    radius = _rounded_for(direction.get("design_style", ""))

    return [
        _block("header", {"logoUrl": "/m1logo.png", "bgColor": background}),
        # Hero deliberately empty — no image generation in this pipeline.
        _block(
            "hero-image",
            {
                "imageUrl": "",
                "alt": "",
                "heroLayersMerged": "false",
                "heroOverlay": _EMPTY_HERO_OVERLAY,
                "heroLogoEnabled": "false",
            },
        ),
        _block("heading", {"text": copy["headline"], "align": "left", "size": "26"}),
        _block("body-text", {"markdown": copy["body_markdown"]}),
        _block(
            "button",
            {
                "text": copy["cta_text"],
                "url": "https://www.m1.com.sg",
                "color": accent,
                "style": "filled",
                "size": "medium",
                "borderRadius": radius,
            },
        ),
        _block("spacer", {"height": "16"}),
        _block("divider", {"color": accent, "style": "solid", "thickness": "1"}),
        _block("social-links", {}),
        _block("footer", {}),
    ]


def _background_for(direction: CreativeDirection) -> dict:
    palette = direction.get("palette") or {}
    return {
        "type": "solid",
        "primaryColor": palette.get("background", "#f3f4f6"),
        "secondaryColor": palette.get("accent", "#e5e7eb"),
        "pattern": "none",
        "patternOpacity": 15,
        "patternScale": 1,
        "gradientDirection": "to-bottom",
        "contentBgColor": "#ffffff",
        "contentBorderRadius": _rounded_for(direction.get("design_style", "")),
        "contentShadow": True,
        "paddingX": 24,
        "paddingY": 32,
    }


def _prompt_for(segment: dict, direction: CreativeDirection, offers: list[dict], objective: str) -> str:
    offers_desc = (
        "\n".join(f"- id={o['id']}: {o['name']} — {o['terms']}" for o in offers)
        if offers
        else "(none available — do not cite any offer id, leave cited_offers empty)"
    )
    return (
        "Write a marketing email for M1 Limited (Singapore telco, demo campaign using "
        "synthetic data).\n\n"
        f"Campaign objective: {objective}\n"
        f"Segment: {segment.get('name') or segment['id']}\n"
        f"Their motivation: {segment['motivation']}\n\n"
        "Creative direction you must follow:\n"
        f"- Tonality: {direction['tonality']}\n"
        f"- Language style: {direction['language_style']}\n"
        f"- CTA style: {direction['cta_style']}\n\n"
        f"Eligible offers you may cite (use their exact id in cited_offers, only if you "
        f"actually reference them in the copy):\n{offers_desc}\n\n"
        "Do not invent prices, discounts, or offers not in that list. Avoid urgency, "
        "scarcity and loss-framing language. Do not include anyone's email address or "
        "phone number in the copy."
    )


def run_email_composer(state: WorkspaceState) -> dict:
    objective = state.get("objective", "")
    offers = fetch_offers()
    real_offer_ids = {o["id"] for o in offers}
    directions = {d["segment_id"]: d for d in state.get("creative_directions", [])}

    emails: list[SegmentEmail] = []
    rows_for_db = []

    for segment in state.get("segment_briefs", []):
        direction = directions.get(segment["id"])
        if direction is None:
            # Creative Review hasn't run for this segment — skip rather than
            # composing an off-brand email with no direction to follow.
            continue

        try:
            result = generate_text(
                _prompt_for(segment, direction, offers, objective),
                stage="Email Composition",
                agent="Email Composer",
                response_schema=_COPY_SCHEMA,
            )
            parsed = json.loads(result.text)
            model_version = result.model_version
        except (OpenRouterNotConfiguredError, OpenRouterCallError, ValueError, KeyError) as exc:
            parsed = {
                "subject": f"[generation failed] {segment['motivation'][:40]}",
                "preheader": f"Email generation failed: {exc}",
                "headline": "Generation failed",
                "body_markdown": f"The email composer call did not complete: {exc}",
                "cta_text": "Learn more",
                "cited_offers": [],
            }
            model_version = None

        cited = [oid for oid in parsed.get("cited_offers", []) if oid in real_offer_ids]
        email_id = f"email-{segment['id']}"
        blocks = _build_blocks(parsed, direction)

        email: SegmentEmail = {
            "id": email_id,
            "segment_id": segment["id"],
            "subject": parsed["subject"],
            "preheader": parsed["preheader"],
            "blocks": blocks,
            "cited_offers": cited,
        }
        emails.append(email)
        rows_for_db.append(
            {
                "id": email_id,
                "segment_brief_id": segment["id"],
                "subject": email["subject"],
                "preheader": email["preheader"],
                "blocks": blocks,
                "background": _background_for(direction),
                "cited_offer_ids": cited,
                "status": "draft",
                "model_version": model_version,
            }
        )

        write_entry(
            LedgerEntry(
                campaign_id=WORKSPACE_ID,
                stage="Email Composition",
                agent="Email Composer",
                prompt_version="email-v1",
                model_version=model_version or "n/a",
                input_artifact_ids=[segment["id"]],
                output_artifact_id=email_id,
            )
        )

    replace_segment_emails([e["segment_id"] for e in emails], rows_for_db)
    return {"segment_emails": emails}
