"""Score the four decision agents against the current workspace artifacts.

Used by `python -m app.eval` and by POST /api/eval. Does not re-run the
pipeline — it grades what is already saved.
"""
from __future__ import annotations

import argparse
import uuid
from typing import Callable

from app.config import WORKSPACE_ID, get_settings
from app.eval.composer import score_composer
from app.eval.creative import score_creative
from app.eval.guardian import score_guardian
from app.eval.rubric import breakdown_with_earned, public_rubric
from app.eval.scoring import mean, round1
from app.eval.segmentation import score_segmentation
from app.persistence import fetch_eval_runs, insert_eval_run

RUBRIC_VERSION = "eval-v1"

EVAL_STEPS = [
    "Scoring segmentation",
    "Judging creative direction",
    "Judging email copy",
    "Scoring guardian",
    "Saving scores",
]

AGENTS = ("segmentation", "creative", "composer", "guardian")


def _noop(_index: int, _detail: str = "") -> None:
    pass


def run_evaluation(on_step: Callable[[int, str], None] = _noop) -> dict:
    settings = get_settings()
    on_step(0, "Clustering metrics + name judge")
    segmentation = score_segmentation()

    on_step(1, "Word limits, hex, brand/segment fit")
    creative = score_creative()

    on_step(2, "Grounding plus copy judge")
    composer = score_composer()

    on_step(3, "Latest pre-flight pass rates")
    guardian = score_guardian()

    agents = {
        "segmentation": segmentation,
        "creative": creative,
        "composer": composer,
        "guardian": guardian,
    }
    for name in AGENTS:
        agents[name]["breakdown"] = breakdown_with_earned(name, agents[name])
    overall = round1(mean(agents[name]["score"] for name in AGENTS))

    scores = {
        "overall": overall,
        "agents": agents,
    }

    on_step(4, f"Overall {overall if overall is not None else '—'}")
    row = {
        "id": f"eval-{uuid.uuid4().hex[:10]}",
        "campaign_id": WORKSPACE_ID,
        "rubric_version": RUBRIC_VERSION,
        "judge_model": settings.openrouter_text_model if settings.openrouter_configured else None,
        "scores": scores,
    }
    insert_eval_run(row)
    return {**row, "delta": _delta_against_previous(row["id"], scores)}


def payload_for_state(latest: dict | None, previous: dict | None = None) -> dict | None:
    if not latest:
        return None
    scores = latest.get("scores") or {}
    return {
        "id": latest.get("id"),
        "created_at": latest.get("created_at"),
        "rubric_version": latest.get("rubric_version"),
        "judge_model": latest.get("judge_model"),
        "overall": (scores.get("overall")),
        "agents": _with_rubric(scores.get("agents") or {}),
        "delta": _delta(scores, (previous or {}).get("scores") if previous else None),
        "rubric": public_rubric(),
    }


def _with_rubric(agents: dict) -> dict:
    out = dict(agents)
    for name in AGENTS:
        slot = dict(out.get(name) or {})
        slot.setdefault("score", None)
        slot.setdefault("available", False)
        slot["breakdown"] = breakdown_with_earned(name, slot)
        out[name] = slot
    return out


def empty_eval_payload() -> dict:
    return {
        "id": None,
        "created_at": None,
        "rubric_version": RUBRIC_VERSION,
        "judge_model": None,
        "overall": None,
        "agents": _with_rubric({}),
        "delta": None,
        "rubric": public_rubric(),
    }


def latest_eval_payload() -> dict | None:
    runs = fetch_eval_runs(limit=2)
    if not runs:
        return empty_eval_payload()
    previous = runs[1] if len(runs) > 1 else None
    return payload_for_state(runs[0], previous)


def _delta_against_previous(current_id: str, current_scores: dict) -> dict | None:
    previous = next((r for r in fetch_eval_runs(limit=2) if r.get("id") != current_id), None)
    return _delta(current_scores, (previous or {}).get("scores") if previous else None)


def _delta(current: dict, previous: dict | None) -> dict | None:
    if not previous:
        return None
    out: dict[str, float | None] = {"overall": _sub(current.get("overall"), previous.get("overall"))}
    cur_agents = current.get("agents") or {}
    prev_agents = previous.get("agents") or {}
    for name in AGENTS:
        out[name] = _sub(
            (cur_agents.get(name) or {}).get("score"),
            (prev_agents.get(name) or {}).get("score"),
        )
    return out


def _sub(a, b) -> float | None:
    if a is None or b is None:
        return None
    return round(float(a) - float(b), 1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Score MOSAIC's four decision agents.")
    parser.parse_args()
    result = run_evaluation()
    _print_summary(result)


def _print_summary(result: dict) -> None:
    scores = result.get("scores") or {}
    delta = result.get("delta") or {}
    agents = scores.get("agents") or {}
    print(f"MOSAIC eval  {result.get('rubric_version')}  {result.get('id')}")
    if result.get("judge_model"):
        print(f"Judge model  {result['judge_model']}")
    print()
    print(f"{'Agent':<16} {'Score':>7}  {'vs last':>8}")
    print("-" * 36)
    for name in AGENTS:
        score = (agents.get(name) or {}).get("score")
        d = delta.get(name)
        print(f"{name:<16} {_fmt(score):>7}  {_fmt_delta(d):>8}")
        for note in (agents.get(name) or {}).get("notes") or []:
            print(f"  · {note}")
    print("-" * 36)
    print(f"{'overall':<16} {_fmt(scores.get('overall')):>7}  {_fmt_delta(delta.get('overall')):>8}")


def _fmt(value) -> str:
    return "—" if value is None else f"{value:.1f}"


def _fmt_delta(value) -> str:
    if value is None:
        return "—"
    return f"{value:+.1f}"


if __name__ == "__main__":
    main()
