"""LLMSecOps corpus: Guardian must catch the cases the proposal put on CI."""
from __future__ import annotations

from app.orchestrator.agents.guardian import run_checks, verdict_for

from tests.conftest import load_fixture


def _by_name(checks: list[dict]) -> dict[str, dict]:
    return {c["name"]: c for c in checks}


def test_clean_email_passes(isolated_guardian):
    checks = run_checks(load_fixture("clean"))
    assert verdict_for(checks) == "PASS"
    assert all(c["passed"] for c in checks)


def test_pii_leak_blocks(isolated_guardian):
    checks = run_checks(load_fixture("pii_leak"))
    named = _by_name(checks)
    assert named["No leaked identifiers"]["passed"] is False
    assert named["No leaked identifiers"]["severity"] == "block"
    assert verdict_for(checks) == "BLOCK"


def test_ungrounded_offer_fails_grounding(isolated_guardian):
    checks = run_checks(load_fixture("ungrounded_offer"))
    named = _by_name(checks)
    assert named["Offer grounding"]["passed"] is False
    # Shipping severity is revise (operator may still send); the check must fail.
    assert verdict_for(checks) == "REVISE"


def test_unresolved_merge_tag_blocks(isolated_guardian):
    checks = run_checks(load_fixture("unresolved_merge_tag"))
    named = _by_name(checks)
    assert named["Personalisation tags"]["passed"] is False
    assert named["Personalisation tags"]["severity"] == "block"
    assert verdict_for(checks) == "BLOCK"


def test_missing_unsubscribe_blocks(isolated_guardian):
    checks = run_checks(load_fixture("missing_unsubscribe"))
    named = _by_name(checks)
    assert named["Unsubscribe route"]["passed"] is False
    assert named["Unsubscribe route"]["severity"] == "block"
    assert verdict_for(checks) == "BLOCK"


def test_prompt_injection_in_copy_blocks(isolated_guardian):
    checks = run_checks(load_fixture("prompt_injection"))
    named = _by_name(checks)
    assert named["No instruction injection"]["passed"] is False
    assert named["No instruction injection"]["severity"] == "block"
    assert verdict_for(checks) == "BLOCK"
