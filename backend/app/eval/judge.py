"""LLM-as-judge wrapper. Temperature is whatever generate_text uses (the
shared OpenRouter client); structured JSON keeps the scores typed."""
from __future__ import annotations

import json
import logging

from app.openrouter_client import OpenRouterCallError, OpenRouterNotConfiguredError, generate_text

logger = logging.getLogger("mosaic.eval")

JUDGE_SYSTEM = (
    "You are a strict academic evaluator for a marketing-agent coursework project. "
    "Score conservatively. 1 = clearly fails the criterion, 3 = adequate, 5 = excellent. "
    "Do not inflate scores. Never invent facts that are not in the artifact. "
    "Reply only with JSON matching the schema."
)


def judge(prompt: str, schema: dict, *, agent: str) -> dict | None:
    """Returns parsed JSON, or None if the judge cannot run."""
    try:
        result = generate_text(
            prompt,
            stage="Evaluation",
            agent=agent,
            response_schema=schema,
            system_instruction=JUDGE_SYSTEM,
        )
        return json.loads(result.text)
    except (OpenRouterNotConfiguredError, OpenRouterCallError, ValueError, KeyError, json.JSONDecodeError) as exc:
        logger.warning("Judge skipped for %s: %s", agent, exc)
        return None
