"""MLOps pins: rubric, agent JSON contracts, prompt versions, no committed secrets."""
from __future__ import annotations

import re
from pathlib import Path

from app.csv_ingest import is_protected
from app.eval.rubric import RUBRIC_BREAKDOWN
from app.eval.run import RUBRIC_VERSION
from app.orchestrator.agents.creative_direction import _DIRECTION_SCHEMA
from app.orchestrator.agents.email_composer import _COPY_SCHEMA
from app.orchestrator.agents.guardian import GUARDIAN_VERSION
from app.orchestrator.agents.segmentation import _SEGMENT_BRIEF_SCHEMA

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"


def test_eval_rubric_weights_sum_to_100():
    assert RUBRIC_VERSION == "eval-v1"
    for agent, rows in RUBRIC_BREAKDOWN.items():
        total = sum(r["weight"] for r in rows)
        assert abs(total - 100.0) < 1e-6, f"{agent} weights sum to {total}, not 100"


def test_eval_rubric_kinds_are_code_or_judge():
    for rows in RUBRIC_BREAKDOWN.values():
        for row in rows:
            assert row["kind"] in ("Code", "LLM Judge")


def test_segment_brief_schema_required_fields():
    assert set(_SEGMENT_BRIEF_SCHEMA["required"]) == {
        "name",
        "motivation",
        "tone_guidance",
        "rationale",
    }


def test_creative_direction_schema_required_fields():
    assert set(_DIRECTION_SCHEMA["required"]) == {
        "tonality",
        "language_style",
        "cta_style",
        "design_style",
        "accent_color",
        "rationale",
    }


def test_composer_schema_requires_citations():
    required = set(_COPY_SCHEMA["required"])
    assert "cited_offers" in required
    assert "subject" in required
    assert "preheader" in required


def test_prompt_versions_are_pinned():
    """Silent version drift would make the ledger and eval look at different check sets."""
    seg = (BACKEND / "app/orchestrator/agents/segmentation.py").read_text(encoding="utf-8")
    creative = (BACKEND / "app/orchestrator/agents/creative_direction.py").read_text(encoding="utf-8")
    composer = (BACKEND / "app/orchestrator/agents/email_composer.py").read_text(encoding="utf-8")
    assert 'prompt_version="seg-v3"' in seg
    assert 'prompt_version="direction-v2"' in creative
    assert 'prompt_version="email-v2"' in composer
    assert GUARDIAN_VERSION == "guardian-v4"


def test_protected_columns_are_recognised():
    assert is_protected("gender") is True
    assert is_protected("date_of_birth") is True
    assert is_protected("p3m_spend_sgd") is False
    assert is_protected("plan_tier") is False


_SECRET_ASSIGNMENT = re.compile(
    r"(OPENROUTER_API_KEY|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY)\s*=\s*['\"]?(?:sk-|re_|eyJ)[^\s'\"]+",
)
_TRACKED_ENV_NAMES = {".env", ".env.local"}
_CODEISH = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".yml", ".yaml", ".env", ".local", ".ps1", ".sh"}


def test_no_dotenv_or_live_keys_in_repo():
    import subprocess

    tracked = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).splitlines()
    for rel in tracked:
        name = Path(rel).name
        if name in _TRACKED_ENV_NAMES:
            raise AssertionError(f"secret file is tracked: {rel}")
        path = ROOT / rel
        if path.suffix.lower() not in _CODEISH and name not in {".env", ".env.local"}:
            continue
        if name.endswith(".example"):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if _SECRET_ASSIGNMENT.search(text):
            raise AssertionError(f"live API key assignment in {rel}")
