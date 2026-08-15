"""
Stage 2 — Creative Direction Agent (per segment).

This replaces the old Creative Director, which generated and critiqued
images. There is no image generation anywhere in the pipeline now. Instead
each segment gets a written *direction* the Email Composer (stage 3) has to
follow:

  - tonality      — how the message should feel
  - language_style— register, sentence length, vocabulary
  - cta_style     — how the call to action should be phrased
  - design_style  — layout/shape language (rounded vs. sharp, dense vs. airy)
  - palette       — {primary, accent, background, text}

The palette starts from the workspace brand palette (Settings) so everything
is on-brand by default; the model may shift the accent within that family,
and the user can override any swatch in the Creative Review tab.
"""
from __future__ import annotations

import json

from app.config import WORKSPACE_ID
from app.ledger import LedgerEntry, write_entry
from app.openrouter_client import OpenRouterCallError, OpenRouterNotConfiguredError, generate_text
from app.orchestrator.state import CreativeDirection, WorkspaceState
from app.persistence import get_brand_palette, upsert_creative_directions

_HEX = r"^#[0-9a-fA-F]{6}$"

_DIRECTION_SCHEMA = {
    "type": "object",
    "properties": {
        "tonality": {
            "type": "string",
            "description": "How the email should feel, e.g. 'Reassuring and matter-of-fact, never urgent'",
        },
        "language_style": {
            "type": "string",
            "description": "Register, sentence length and vocabulary guidance",
        },
        "cta_style": {
            "type": "string",
            "description": "How the call to action should be phrased for this segment",
        },
        "design_style": {
            "type": "string",
            "description": "Layout and shape language, e.g. 'Airy, generous whitespace, softly rounded cards'",
        },
        "accent_color": {"type": "string", "pattern": _HEX, "description": "Accent hex, on-brand"},
        "rationale": {"type": "string", "description": "Why this direction suits this segment"},
    },
    "required": ["tonality", "language_style", "cta_style", "design_style", "accent_color", "rationale"],
}

# Used when the model is unreachable, so the tab still renders something
# honest rather than a blank card.
_FALLBACK = {
    "tonality": "",
    "language_style": "",
    "cta_style": "",
    "design_style": "",
    "rationale": "",
}


def _prompt_for(segment: dict, palette: dict, objective: str) -> str:
    return (
        "You are the creative director for an M1 Limited (Singapore telco) email campaign "
        "using entirely synthetic demo data. No imagery is being produced — your output is "
        "a written direction the copy/layout agent must follow.\n\n"
        f"Campaign objective: {objective}\n"
        f"Segment: {segment.get('name') or segment['id']}\n"
        f"Their motivation: {segment['motivation']}\n"
        f"Existing tone guidance: {segment['tone_guidance']}\n\n"
        f"Brand palette to stay within — primary {palette.get('primary')}, "
        f"background {palette.get('background')}, text {palette.get('text')}. "
        "Choose an accent colour that sits in the same family as the primary and has "
        "sufficient contrast against the background for button labels.\n\n"
        "Give tonality, language style, CTA style, design/shape style, the accent hex, "
        "and a one-sentence rationale. Do not suggest urgency, scarcity or "
        "loss-framing tactics, and do not reference any protected attribute."
    )


def run_creative_direction(state: WorkspaceState) -> dict:
    objective = state.get("objective", "")
    palette = get_brand_palette()
    directions: list[CreativeDirection] = []
    rows_for_db = []

    for segment in state.get("segment_briefs", []):
        try:
            result = generate_text(
                _prompt_for(segment, palette, objective),
                stage="Creative Direction",
                agent="Creative Director",
                response_schema=_DIRECTION_SCHEMA,
            )
            parsed = json.loads(result.text)
            model_version = result.model_version
        except (OpenRouterNotConfiguredError, OpenRouterCallError, ValueError, KeyError) as exc:
            parsed = {**_FALLBACK, "rationale": f"[direction generation failed: {exc}]"}
            model_version = None

        accent = parsed.get("accent_color") or palette.get("accent", "#C2703D")
        segment_palette = {**palette, "accent": accent}

        direction: CreativeDirection = {
            "segment_id": segment["id"],
            "tonality": parsed["tonality"],
            "language_style": parsed["language_style"],
            "cta_style": parsed["cta_style"],
            "design_style": parsed["design_style"],
            "palette": segment_palette,
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
                "rationale": direction["rationale"],
                "model_version": model_version,
            }
        )

        write_entry(
            LedgerEntry(
                campaign_id=WORKSPACE_ID,
                stage="Creative Direction",
                agent="Creative Director",
                prompt_version="direction-v1",
                model_version=model_version or "n/a",
                input_artifact_ids=[segment["id"]],
                output_artifact_id=segment["id"],
            )
        )

    upsert_creative_directions(rows_for_db)
    return {"creative_directions": directions}
