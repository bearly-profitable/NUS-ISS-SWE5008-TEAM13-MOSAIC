"""
Stage 3 — Email Composer Agent (per segment).

Emits a real `EmailBlock[]` in exactly the shape
frontend/src/types/email-builder.ts defines, so the Email Review tab hands it
straight to the builder with no translation layer.

Split of responsibility:

  - The **model** writes only content, under hard word limits.
  - The **code** assembles the layout, applies the segment's creative
    direction (palette, shape language) and pins the logo and hero image to
    the centre. A bad model response can shorten the copy but can never
    produce an unrenderable or off-brand template.

The layout is deliberately layered rather than a flat stack of paragraphs:
centred logo → hero → headline → intro → three highlight columns → offer
coupon (only when an offer is genuinely cited) → centred CTA → closing →
social → footer.

Grounding is enforced, not trusted: any cited offer id that isn't a real
offer_catalogue row is dropped, and an empty citation list is a hard BLOCK
at stage 4 (guardian.py).
"""
from __future__ import annotations

import json
import uuid
from typing import Callable

from app import brand
from app.config import WORKSPACE_ID
from app.ledger import LedgerEntry, write_entry
from app.openrouter_client import OpenRouterCallError, OpenRouterNotConfiguredError, generate_text
from app.orchestrator.agents.creative_direction import company_assets
from app.orchestrator.state import CreativeDirection, SegmentEmail, WorkspaceState
from app.persistence import fetch_offers, replace_segment_emails

# Every field is length-capped. Marketing models default to florid filler;
# the caps are what keep the rendered email tight.
_COPY_SCHEMA = {
    "type": "object",
    "properties": {
        "subject": {"type": "string", "description": "Inbox subject line. Max 8 words. No emoji, no exclamation marks."},
        "preheader": {"type": "string", "description": "Inbox preview text. Max 12 words."},
        "headline": {"type": "string", "description": "In-email headline, distinct from the subject. Max 7 words."},
        "intro": {"type": "string", "description": "Opening paragraph. TWO sentences maximum, max 34 words total."},
        "highlights": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "description": "Exactly three benefit cards.",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Max 3 words."},
                    "text": {"type": "string", "description": "ONE sentence, max 12 words."},
                },
                "required": ["title", "text"],
            },
        },
        "cta_text": {"type": "string", "description": "Button label. 2-3 words."},
        "faqs": {
            "type": "array",
            "description": "Exactly two short questions a member of this segment would actually ask.",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string", "description": "Max 8 words, ends with '?'."},
                    "answer": {"type": "string", "description": "ONE sentence, max 20 words. Only facts from the offer terms."},
                },
                "required": ["question", "answer"],
            },
        },
        "closing": {"type": "string", "description": "Sign-off line. ONE sentence, max 14 words."},
        "cited_offers": {
            "type": "array",
            "description": "Ids of every offer the copy actually references. Must not be empty.",
            "items": {"type": "string"},
        },
    },
    "required": [
        "subject", "preheader", "headline", "intro", "highlights",
        "cta_text", "faqs", "closing", "cited_offers",
    ],
}

def _block(block_type: str, content: dict) -> dict:
    """EmailBlock content is Record<string, string> on the frontend, so every
    value is stringified — a stray number breaks the editors."""
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
    if any(w in s for w in ("pill", "very round", "soft", "friendly", "playful", "rounded")):
        return 24
    return 12


def _faq_items(copy: dict) -> list[dict]:
    items = []
    for n, faq in enumerate(copy.get("faqs") or [], start=1):
        if isinstance(faq, dict) and faq.get("question"):
            items.append({"id": f"a{n}", "question": str(faq["question"]), "answer": str(faq.get("answer", ""))})
    return items


def _highlight(copy: dict, index: int, key: str, fallback: str = "") -> str:
    items = copy.get("highlights") or []
    if index < len(items) and isinstance(items[index], dict):
        return str(items[index].get(key, fallback))
    return fallback


def _build_blocks(copy: dict, direction: CreativeDirection, offer_names: list[str]) -> list[dict]:
    palette = direction.get("palette") or {}
    accent = palette.get("accent", "#C2703D")
    background = palette.get("background", "#ffffff")
    text_color = palette.get("text", "#1f2937")
    radius = _rounded_for(direction.get("design_style", ""))

    default_logo, default_hero = company_assets()
    logo_url = direction.get("logo_url") or default_logo
    hero_url = direction.get("hero_image_url") or default_hero
    website = brand.website_url()

    # The greeting is assembled here rather than asked for, so the
    # personalisation attribute the operator chose in step 1 always lands as a
    # real merge tag — a model asked to "include {{first_name}}" drops it
    # often enough to matter.
    tag = brand.merge_tag()
    intro = f"Hi {tag},\n\n{copy['intro']}" if tag else copy["intro"]

    blocks = []

    # Both brand assets are optional: with nothing uploaded the block is left
    # out entirely rather than rendering a broken image or someone else's mark.
    if logo_url:
        # Non-floating header renders the logo centred.
        blocks.append(
            _block(
                "header",
                {"logoUrl": logo_url, "bgColor": background, "logoHeight": 76, "floating": "false"},
            )
        )
    if hero_url:
        # Hero: centred, full content width, corner radius from the direction.
        blocks.append(
            _block(
                "hero-image",
                {
                    "imageUrl": hero_url,
                    "alt": "",
                    "align": "center",
                    "width": "auto",
                    "borderRadius": radius,
                    "heroLayersMerged": "false",
                    "heroOverlay": _EMPTY_HERO_OVERLAY,
                    "heroLogoEnabled": "false",
                },
            )
        )

    blocks += [
        _block("heading", {"text": copy["headline"], "align": "center", "size": "28"}),
        _block("body-text", {"markdown": intro}),
        _block("spacer", {"height": "8"}),
        # Layer 1: three benefit columns.
        _block(
            "columns",
            {
                "columnCount": "3",
                "col1Heading": _highlight(copy, 0, "title"),
                "col1Text": _highlight(copy, 0, "text"),
                "col1ImageUrl": "",
                "col1ImageLink": "",
                "col2Heading": _highlight(copy, 1, "title"),
                "col2Text": _highlight(copy, 1, "text"),
                "col2ImageUrl": "",
                "col2ImageLink": "",
                "col3Heading": _highlight(copy, 2, "title"),
                "col3Text": _highlight(copy, 2, "text"),
                "col3ImageUrl": "",
                "col3ImageLink": "",
            },
        ),
        _block("divider", {"color": accent, "style": "solid", "thickness": "1"}),
    ]

    # Layer 2: the offer panel only appears when an offer was actually cited,
    # so the email can't imply a promotion that isn't grounded.
    if offer_names:
        blocks.append(
            _block(
                "coupon",
                {
                    "code": offer_names[0][:24].upper().replace(" ", ""),
                    "label": offer_names[0],
                    "bgColor": background,
                    "textColor": accent,
                },
            )
        )

    # Layer 3: a short FAQ, grounded in the cited offer's terms.
    faqs = _faq_items(copy)
    if faqs:
        blocks.append(
            _block(
                "accordion",
                {
                    "items": json.dumps(faqs),
                    "headerBgColor": accent,
                    "headerTextColor": "#ffffff",
                    "bodyBgColor": background,
                    "bodyTextColor": text_color,
                    "borderColor": "#e5e7eb",
                    "borderRadius": radius,
                    "iconStyle": "chevron",
                },
            )
        )

    blocks.extend(
        [
            _block(
                "button",
                {
                    "text": copy["cta_text"],
                    # The company's own site — the app never learns a deeper
                    # landing page, and a placeholder domain would ship a dead
                    # CTA.
                    "url": website,
                    "color": accent,
                    "textColor": "#ffffff",
                    "style": "rounded" if radius >= 24 else "filled",
                    "size": "medium",
                    "align": "center",
                },
            ),
            _block("spacer", {"height": "8"}),
            _block("body-text", {"markdown": copy["closing"]}),
            _block("divider", {"color": accent, "style": "solid", "thickness": "1"}),
        ]
    )

    # Social and footer links are built from the company's website, so both
    # blocks drop out when no website was given rather than pointing at a
    # brand the operator has nothing to do with.
    social = brand.social_links()
    if social:
        blocks.append(_block("social-links", social))
    footer = brand.footer_links()
    if footer:
        blocks.append(_block("footer", {**footer, "textColor": text_color}))

    return blocks


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


def _prompt_for(segment: dict, direction: CreativeDirection, offers: list[dict], company: str) -> str:
    offers_desc = (
        "\n".join(f"- id={o['id']}: {o['name']} — {o['terms']}" for o in offers)
        if offers
        else "(none available — leave cited_offers empty and do not imply any promotion)"
    )
    greeting_rule = (
        "The email is opened with a personalised greeting that is added for you — do not "
        "write your own salutation, and do not start the intro with a name or 'Hi'.\n"
        if brand.merge_tag()
        else ""
    )
    return (
        "Write a marketing email for the company below.\n\n"
        f"{company}\n\n"
        f"Segment: {segment.get('name') or segment['id']}\n"
        f"Motivation: {segment['motivation']}\n\n"
        "Creative direction you must follow:\n"
        f"- Tonality: {direction['tonality']}\n"
        f"- Language: {direction['language_style']}\n"
        f"- CTA: {direction['cta_style']}\n\n"
        f"Offers you may cite (use the exact id in cited_offers, only if the copy "
        f"actually references it):\n{offers_desc}\n\n"
        f"{greeting_rule}"
        "Rules: be brief and concrete — respect every word limit in the schema exactly. "
        "No filler openers ('We're excited to...'), no exclamation marks, no emoji. "
        "Never invent prices, discounts or offers outside that list. Avoid urgency, "
        "scarcity and loss-framing. Never mention age, gender or any protected attribute. "
        "Do not include any email address or phone number."
    )


# Step indices must match EMAIL_STEPS in routers/workspace.py.
def _noop(_index: int, _detail: str = "") -> None:
    pass


def run_email_composer(state: WorkspaceState, on_step: Callable[[int, str], None] = _noop) -> dict:
    company = brand.context_block()
    on_step(0, "Reading the offer catalogue")
    offers = fetch_offers()
    offers_by_id = {o["id"]: o for o in offers}
    directions = {d["segment_id"]: d for d in state.get("creative_directions", [])}

    emails: list[SegmentEmail] = []
    rows_for_db = []
    segments = state.get("segment_briefs", [])
    on_step(0, f"{len(offers)} offers available for citation")

    for n, segment in enumerate(segments, start=1):
        on_step(1, f"Segment {n} of {len(segments)} — {segment.get('name') or segment['id']}")
        direction = directions.get(segment["id"])
        if direction is None:
            # No direction for this segment — skip rather than composing an
            # off-brand email with nothing to follow.
            continue

        try:
            result = generate_text(
                _prompt_for(segment, direction, offers, company),
                stage="Email Composition",
                agent="Email Composer",
                response_schema=_COPY_SCHEMA,
            )
            parsed = json.loads(result.text)
            model_version = result.model_version
        except (OpenRouterNotConfiguredError, OpenRouterCallError, ValueError, KeyError) as exc:
            parsed = {
                "subject": "[generation failed]",
                "preheader": f"Email generation failed: {exc}",
                "headline": "Generation failed",
                "intro": f"The email composer call did not complete: {exc}",
                "highlights": [],
                "cta_text": "Learn more",
                "faqs": [],
                "closing": "",
                "cited_offers": [],
            }
            model_version = None

        cited = [oid for oid in parsed.get("cited_offers", []) if oid in offers_by_id]
        offer_names = [offers_by_id[oid]["name"] for oid in cited]

        email_id = f"email-{segment['id']}"
        blocks = _build_blocks(parsed, direction, offer_names)

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
                prompt_version="email-v2",
                model_version=model_version or "n/a",
                input_artifact_ids=[segment["id"]],
                output_artifact_id=email_id,
            )
        )

    on_step(2, f"Saving {len(rows_for_db)} emails")
    replace_segment_emails([e["segment_id"] for e in emails], rows_for_db)
    return {"segment_emails": emails}
