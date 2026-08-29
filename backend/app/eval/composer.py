"""Grounding / structure checks + LLM judge of copy vs direction."""
from __future__ import annotations

from app import persistence
from app.eval.judge import judge
from app.eval.scoring import blend, likert_to_100, mean, round1, word_count

_TEXT_KEYS = ("text", "markdown", "heading", "label", "answer", "question")

_JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "email_id": {"type": "string"},
                    "follows_direction": {
                        "type": "integer",
                        "description": "1-5. Copy follows the segment's creative direction.",
                    },
                    "segment_fit": {
                        "type": "integer",
                        "description": "1-5. Sounds written for this segment, not a blast.",
                    },
                    "grounded": {
                        "type": "integer",
                        "description": "1-5. Claims stay inside the cited offers. Invented prices or discounts = 1.",
                    },
                    "rationale": {"type": "string", "description": "One sentence."},
                },
                "required": ["email_id", "follows_direction", "segment_fit", "grounded", "rationale"],
            },
        }
    },
    "required": ["items"],
}


def score_composer() -> dict:
    emails = persistence.fetch_segment_emails()
    segments = {s["id"]: s for s in persistence.fetch_segments()}
    directions = {d["segment_brief_id"]: d for d in persistence.fetch_creative_directions()}
    offers = {o["id"]: o for o in persistence.fetch_offers()}
    if not emails:
        return {
            "score": None,
            "available": False,
            "metrics": {},
            "notes": ["No emails to score — compose them first."],
            "items": [],
        }

    code_fracs = []
    items = []
    for email in emails:
        cited = list(email.get("cited_offer_ids") or [])
        known = [oid for oid in cited if oid in offers]
        unknown = [oid for oid in cited if oid not in offers]
        has_cite = bool(cited)
        all_real = has_cite and not unknown
        subject_ok = word_count(email.get("subject")) <= 8
        preheader_ok = word_count(email.get("preheader")) <= 12
        checks = [
            {"name": "has_citation", "passed": has_cite, "detail": f"{len(cited)} cited"},
            {"name": "citations_in_catalogue", "passed": all_real, "detail": ", ".join(unknown) or "all real"},
            {"name": "subject_length", "passed": subject_ok, "detail": f"{word_count(email.get('subject'))} words"},
            {"name": "preheader_length", "passed": preheader_ok, "detail": f"{word_count(email.get('preheader'))} words"},
        ]
        frac = sum(1 for c in checks if c["passed"]) / len(checks) * 100.0
        code_fracs.append(frac)
        seg = segments.get(email["segment_brief_id"]) or {}
        items.append(
            {
                "id": email["id"],
                "name": seg.get("name") or email["segment_brief_id"],
                "subject": email.get("subject") or "",
                "code_pass": sum(1 for c in checks if c["passed"]),
                "code_total": len(checks),
                "checks": checks,
                "copy": _copy_blob(email),
            }
        )

    judge_100, judged, judge_note = _judge_emails(emails, segments, directions, offers)
    overall = blend([(0.4, mean(code_fracs)), (0.6, judge_100)])
    notes = ["Citation and inbox-length checks are counted in code; the judge scores fit and grounding."]
    if judge_note:
        notes.append(judge_note)

    merged = []
    for item in items:
        extra = judged.get(item["id"]) or {}
        merged.append({**{k: v for k, v in item.items() if k != "copy"}, **extra})

    return {
        "score": round1(overall),
        "available": True,
        "metrics": {
            "schema_pass_rate": round1(mean(code_fracs)),
            "judge_0_100": round1(judge_100),
            "n_emails": len(emails),
        },
        "notes": notes,
        "items": merged,
    }


def _copy_blob(email: dict) -> str:
    parts = [str(email.get("subject") or ""), str(email.get("preheader") or "")]
    for block in email.get("blocks") or []:
        content = block.get("content") or {}
        for key in _TEXT_KEYS:
            if content.get(key):
                parts.append(str(content[key]))
    return "\n".join(p for p in parts if p.strip())


def _judge_emails(emails, segments, directions, offers) -> tuple[float | None, dict, str | None]:
    payload = []
    for email in emails:
        seg = segments.get(email["segment_brief_id"]) or {}
        direction = directions.get(email["segment_brief_id"]) or {}
        cited = [offers[oid] for oid in (email.get("cited_offer_ids") or []) if oid in offers]
        payload.append(
            {
                "email_id": email["id"],
                "segment": seg.get("name") or email["segment_brief_id"],
                "motivation": seg.get("motivation") or "",
                "direction": {
                    "tonality": direction.get("tonality"),
                    "language_style": direction.get("language_style"),
                    "cta_style": direction.get("cta_style"),
                },
                "cited_offers": [{"id": o["id"], "name": o["name"], "terms": o.get("terms")} for o in cited],
                "copy": _copy_blob(email)[:2500],
            }
        )
    parsed = judge(
        "Grade each email. follows_direction: matches the creative direction. "
        "segment_fit: written for that audience. grounded: no invented prices, "
        "discounts or offers beyond the cited catalogue rows.\n\n"
        f"Emails:\n{payload}",
        _JUDGE_SCHEMA,
        agent="Eval · Composer",
    )
    if not parsed:
        return None, {}, "LLM judge skipped (OpenRouter unavailable or call failed)."

    by_id = {}
    scores = []
    for row in parsed.get("items") or []:
        if not isinstance(row, dict):
            continue
        dims = [_clip(row.get(k)) for k in ("follows_direction", "segment_fit", "grounded")]
        by_id[row.get("email_id")] = {
            "follows_direction": dims[0],
            "segment_fit": dims[1],
            "grounded": dims[2],
            "rationale": row.get("rationale") or "",
        }
        scores.append(likert_to_100(mean(dims)))
    return mean(scores), by_id, None


def _clip(value) -> float | None:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return max(1, min(5, n))
