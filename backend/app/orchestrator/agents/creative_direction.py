"""
Stage 2 — Creative Direction Agent (per segment).

No imagery is generated anywhere. Each segment gets a short written
direction the Email Composer must follow — tonality, language, CTA style,
design/shape language — plus a palette and the two brand assets (logo and
hero image), which the operator uploads on the Creative Review tab and which
are stored once for the whole company rather than per segment.

Output is deliberately terse: these render on compact cards, so the schema
caps every field to a phrase or a single sentence.
"""
from __future__ import annotations

import json
import re
from typing import Callable

from app.brand import context_block
from app.config import WORKSPACE_ID
from app.ledger import LedgerEntry, write_entry
from app.openrouter_client import OpenRouterCallError, OpenRouterNotConfiguredError, generate_text
from app.orchestrator.state import CreativeDirection, WorkspaceState
from app.persistence import get_brand_palette, get_company_profile, upsert_creative_directions


def company_assets() -> tuple[str, str]:
    """(logo, hero) as uploaded in Creative Review. Empty strings when the
    operator has not uploaded them yet — the composer omits the block rather
    than rendering another company's mark."""
    profile = get_company_profile()
    return (profile.get("logo_url") or "", profile.get("hero_image_url") or "")

_HEX = r"^#[0-9a-fA-F]{6}$"
_HEX_RE = re.compile(_HEX)

_DIRECTION_SCHEMA = {
    "type": "object",
    "properties": {
        "tonality": {"type": "string", "description": "How it should feel. Max 8 words. No full sentence."},
        "language_style": {"type": "string", "description": "Register and sentence length. Max 8 words."},
        "cta_style": {"type": "string", "description": "How the CTA should read. Max 8 words."},
        "design_style": {"type": "string", "description": "Layout and shape language. Max 8 words."},
        "accent_color": {"type": "string", "pattern": _HEX, "description": "On-brand accent hex"},
        "rationale": {"type": "string", "description": "Why it fits this segment. ONE sentence, max 18 words."},
    },
    "required": ["tonality", "language_style", "cta_style", "design_style", "accent_color", "rationale"],
}

_FALLBACK = {
    "tonality": "",
    "language_style": "",
    "cta_style": "",
    "design_style": "",
    "rationale": "",
}


def _prompt_for(segment: dict, palette: dict, company: str) -> str:
    return (
        "You are the creative director for this company's email campaign. No imagery is "
        "being produced — your output is a short written direction the email composer "
        "must follow.\n\n"
        f"{company}\n\n"
        f"Segment: {segment.get('name') or segment['id']}\n"
        f"Motivation: {segment['motivation']}\n"
        f"Tone guidance so far: {segment['tone_guidance']}\n\n"
        f"Brand palette — primary {palette.get('primary')}, background "
        f"{palette.get('background')}, text {palette.get('text')}. Pick an accent in the "
        "same family with enough contrast for button labels.\n\n"
        "Be terse. Each style field is a short phrase, not a sentence — respect the word "
        "limits exactly. No preamble, no marketing adjectives. Never suggest urgency, "
        "scarcity or loss-framing, and never reference age, gender or any protected attribute."
    )


# Step indices must match CREATIVE_STEPS in routers/workspace.py.
def _noop(_index: int, _detail: str = "") -> None:
    pass


def run_creative_direction(state: WorkspaceState, on_step: Callable[[int, str], None] = _noop) -> dict:
    on_step(0, "Loading the brand palette")
    palette = get_brand_palette()
    company = context_block()
    default_logo, default_hero = company_assets()
    # A per-segment override set in Creative Review wins; everything else
    # falls back to the company's uploaded brand assets.
    existing_assets: dict[str, dict] = state.get("existing_assets") or {}

    directions: list[CreativeDirection] = []
    rows_for_db = []
    segments = state.get("segment_briefs", [])

    for n, segment in enumerate(segments, start=1):
        on_step(1, f"Segment {n} of {len(segments)} — {segment.get('name') or segment['id']}")
        try:
            result = generate_text(
                _prompt_for(segment, palette, company),
                stage="Creative Direction",
                agent="Creative Director",
                response_schema=_DIRECTION_SCHEMA,
            )
            parsed = json.loads(result.text)
            model_version = result.model_version
        except (OpenRouterNotConfiguredError, OpenRouterCallError, ValueError, KeyError) as exc:
            parsed = {**_FALLBACK, "rationale": f"[direction generation failed: {exc}]"}
            model_version = None

        # `pattern` isn't part of the strict-schema subset (openrouter_client
        # strips it), so the hex shape is validated here rather than trusted.
        accent = str(parsed.get("accent_color") or "").strip()
        if not _HEX_RE.match(accent):
            accent = palette.get("accent", "#C2703D")
        segment_palette = {**palette, "accent": accent}
        assets = existing_assets.get(segment["id"], {})

        direction: CreativeDirection = {
            "segment_id": segment["id"],
            "tonality": parsed["tonality"],
            "language_style": parsed["language_style"],
            "cta_style": parsed["cta_style"],
            "design_style": parsed["design_style"],
            "palette": segment_palette,
            "logo_url": assets.get("logo_url") or default_logo,
            "hero_image_url": assets.get("hero_image_url") or default_hero,
            "rationale": parsed["rationale"],
        }
        directions.append(direction)
        rows_for_db.append(
            {
                "segment_brief_id": segment["id"],
                "tonality": direction["tonality"],
                "language_style": direction["language_style"],
                "cta_style": direction["cta_style"],
                "design_style": direction["design_style"],
                "palette": segment_palette,
                "logo_url": direction["logo_url"],
                "hero_image_url": direction["hero_image_url"],
                "rationale": direction["rationale"],
                "model_version": model_version,
            }
        )

        write_entry(
            LedgerEntry(
                campaign_id=WORKSPACE_ID,
                stage="Creative Direction",
                agent="Creative Director",
                prompt_version="direction-v2",
                model_version=model_version or "n/a",
                input_artifact_ids=[segment["id"]],
                output_artifact_id=segment["id"],
            )
        )

    on_step(2, f"Saving direction for {len(rows_for_db)} segments")
    upsert_creative_directions(rows_for_db)
    return {"creative_directions": directions}
