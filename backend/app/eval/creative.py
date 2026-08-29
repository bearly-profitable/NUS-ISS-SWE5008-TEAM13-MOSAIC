"""Code checks (word caps, hex) + LLM judge of brand/segment fit."""
from __future__ import annotations

import re

from app import persistence
from app.eval.judge import judge
from app.eval.scoring import blend, likert_to_100, mean, round1, word_count

_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

_LIMITS = {
    "tonality": 8,
    "language_style": 8,
    "cta_style": 8,
    "design_style": 8,
    "rationale": 18,
}

_JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "segment_id": {"type": "string"},
                    "segment_fit": {
                        "type": "integer",
                        "description": "1-5. Direction matches this segment's motivation and tone.",
                    },
                    "brand_fit": {
                        "type": "integer",
                        "description": "1-5. Sounds like this company, not a generic brand.",
                    },
                    "no_dark_patterns": {
                        "type": "integer",
                        "description": "1-5. 5 = no urgency, scarcity or loss-framing. 1 = heavy dark patterns.",
                    },
                    "rationale": {"type": "string", "description": "One sentence."},
                },
                "required": ["segment_id", "segment_fit", "brand_fit", "no_dark_patterns", "rationale"],
            },
        }
    },
    "required": ["items"],
}


def score_creative() -> dict:
    segments = persistence.fetch_segments()
    directions = persistence.fetch_creative_directions()
    company = persistence.get_company_profile()
    if not directions:
        return {
            "score": None,
            "available": False,
            "metrics": {},
            "notes": ["No creative direction to score — generate it first."],
            "items": [],
        }

    by_seg = {s["id"]: s for s in segments}
    code_items = []
    code_fracs = []
    for d in directions:
        checks = _code_checks(d)
        passed = sum(1 for c in checks if c["passed"])
        frac = passed / max(len(checks), 1)
        code_fracs.append(frac * 100.0)
        code_items.append(
            {
                "id": d["segment_brief_id"],
                "name": (by_seg.get(d["segment_brief_id"]) or {}).get("name") or d["segment_brief_id"],
                "code_pass": passed,
                "code_total": len(checks),
                "checks": checks,
            }
        )

    judge_100, judged, judge_note = _judge_directions(directions, by_seg, company)
    overall = blend([(0.4, mean(code_fracs)), (0.6, judge_100)])
    notes = ["Word-limit and hex checks are counted in code; the judge scores fit only."]
    if judge_note:
        notes.append(judge_note)

    return {
        "score": round1(overall),
        "available": True,
        "metrics": {
            "schema_pass_rate": round1(mean(code_fracs)),
            "judge_0_100": round1(judge_100),
            "n_directions": len(directions),
        },
        "notes": notes,
        "items": _merge_items(code_items, judged),
    }


def _code_checks(direction: dict) -> list[dict]:
    palette = direction.get("palette") or {}
    accent = str(palette.get("accent") or "")
    checks = []
    for field, limit in _LIMITS.items():
        n = word_count(direction.get(field))
        checks.append(
            {
                "name": field,
                "passed": n <= limit,
                "detail": f"{n} words (max {limit})",
            }
        )
    checks.append(
        {
            "name": "accent_hex",
            "passed": bool(_HEX_RE.match(accent)),
            "detail": accent or "missing",
        }
    )
    return checks


def _judge_directions(directions: list[dict], by_seg: dict, company: dict) -> tuple[float | None, dict, str | None]:
    payload = []
    for d in directions:
        seg = by_seg.get(d["segment_brief_id"]) or {}
        payload.append(
            {
                "segment_id": d["segment_brief_id"],
                "segment_name": seg.get("name") or d["segment_brief_id"],
                "motivation": seg.get("motivation") or "",
                "tone_guidance": seg.get("tone_guidance") or "",
                "tonality": d.get("tonality"),
                "language_style": d.get("language_style"),
                "cta_style": d.get("cta_style"),
                "design_style": d.get("design_style"),
                "rationale": d.get("rationale"),
            }
        )
    parsed = judge(
        "Grade each creative direction for this company.\n"
        f"Company: {company.get('name')} — {company.get('campaign_intent')}\n\n"
        f"Directions:\n{payload}",
        _JUDGE_SCHEMA,
        agent="Eval · Creative",
    )
    if not parsed:
        return None, {}, "LLM judge skipped (OpenRouter unavailable or call failed)."

    by_id = {}
    scores = []
    for row in parsed.get("items") or []:
        if not isinstance(row, dict):
            continue
        sid = row.get("segment_id")
        dims = [_clip(row.get(k)) for k in ("segment_fit", "brand_fit", "no_dark_patterns")]
        by_id[sid] = {
            "segment_fit": dims[0],
            "brand_fit": dims[1],
            "no_dark_patterns": dims[2],
            "rationale": row.get("rationale") or "",
        }
        scores.append(likert_to_100(mean(dims)))
    return mean(scores), by_id, None


def _merge_items(code_items: list[dict], judged: dict) -> list[dict]:
    out = []
    for item in code_items:
        extra = judged.get(item["id"]) or {}
        out.append({**item, **extra})
    return out


def _clip(value) -> float | None:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return max(1, min(5, n))
