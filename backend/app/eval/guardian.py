"""Deterministic Guardian score — pass rates from the latest ledger verdicts.

Guardian is a rule engine (`model_version=rule-engine`), so there is no
LLM-judge here. Inflating it with a second model would not test the checker.
"""
from __future__ import annotations

from app.config import WORKSPACE_ID
from app.eval.scoring import blend, round1
from app.ledger import list_entries
from app.orchestrator.agents.guardian import GUARDIAN_VERSION
from app.persistence import fetch_segment_emails


def score_guardian() -> dict:
    emails = persistence_emails()
    verdicts = _latest_verdicts()
    if not emails:
        return {
            "score": None,
            "available": False,
            "metrics": {},
            "notes": ["No emails — Guardian has nothing to adjudicate."],
            "items": [],
        }

    checked = [verdicts[e["id"]] for e in emails if e["id"] in verdicts]
    if not checked:
        return {
            "score": None,
            "available": False,
            "metrics": {},
            "notes": ["No Guardian verdicts on record — open Approval Queue and press Re-run."],
            "items": [],
        }

    pass_emails = sum(1 for v in checked if v.get("verdict") == "PASS")
    revise_emails = sum(1 for v in checked if v.get("verdict") == "REVISE")
    block_emails = sum(1 for v in checked if v.get("verdict") == "BLOCK")
    checks = [c for v in checked for c in (v.get("checks") or [])]
    passed_checks = sum(1 for c in checks if c.get("passed"))
    check_rate = passed_checks / max(len(checks), 1) * 100.0
    email_pass_rate = pass_emails / max(len(checked), 1) * 100.0
    coverage = len(checked) / max(len(emails), 1) * 100.0

    overall = blend([(0.7, check_rate), (0.3, email_pass_rate)])

    by_check: dict[str, list[bool]] = {}
    for c in checks:
        by_check.setdefault(c.get("name") or "unnamed", []).append(bool(c.get("passed")))
    per_check = {
        name: round(sum(vals) / len(vals) * 100.0, 1)
        for name, vals in by_check.items()
    }

    return {
        "score": round1(overall),
        "available": True,
        "metrics": {
            "check_pass_rate": round1(check_rate),
            "email_pass_rate": round1(email_pass_rate),
            "coverage": round1(coverage),
            "n_pass": pass_emails,
            "n_revise": revise_emails,
            "n_block": block_emails,
            "n_checked": len(checked),
            "n_emails": len(emails),
            "per_check": per_check,
        },
        "notes": [
            "Rule-engine rates from the latest ledger verdict per email. No LLM judge.",
            f"Guardian version {GUARDIAN_VERSION}.",
        ],
        "items": [
            {
                "id": e["id"],
                "verdict": (verdicts.get(e["id"]) or {}).get("verdict"),
                "passed_checks": sum(1 for c in (verdicts.get(e["id"]) or {}).get("checks") or [] if c.get("passed")),
                "total_checks": len((verdicts.get(e["id"]) or {}).get("checks") or []),
            }
            for e in emails
        ],
    }


def persistence_emails() -> list[dict]:
    return fetch_segment_emails()


def _latest_verdicts() -> dict[str, dict]:
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
            }
    return verdicts
