"""Shared stubs so Guardian tests never touch Supabase or OpenRouter."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures" / "llmsecops"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


@pytest.fixture
def isolated_guardian(monkeypatch):
    """Consent opted-in, no proxy flag, one real catalogue offer, first_name column."""
    monkeypatch.setattr(
        "app.orchestrator.agents.guardian.consent_stats_for_segment",
        lambda _sid: {"total": 10, "withdrawn": 0, "withdrawn_pct": 0.0},
    )
    monkeypatch.setattr(
        "app.orchestrator.agents.guardian.fetch_proxy_check",
        lambda _sid: None,
    )
    monkeypatch.setattr(
        "app.orchestrator.agents.guardian.fetch_offers",
        lambda: [{"id": "offer-demo", "name": "Welcome rebate"}],
    )
    monkeypatch.setattr(
        "app.orchestrator.agents.guardian.get_company_profile",
        lambda: {"columns": [{"name": "first_name"}]},
    )
