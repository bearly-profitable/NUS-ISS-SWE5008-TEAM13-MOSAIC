"""
Thin wrapper around OpenRouter — the single chokepoint every agent goes
through, so cost metering and prompt/model version tagging (for the Decision
Ledger) happen in one place instead of being duplicated per-agent.

OpenRouter's chat/completions endpoint is OpenAI-compatible, so this talks to
it over plain REST (httpx) rather than pulling in a provider SDK.

Image generation was removed in the workspace revamp — this module is text
and embeddings only. Emails are assembled from typed EmailBlock[] with an
empty hero, and creative direction is expressed as colour/tone/style fields.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.cost_meter import cost_meter

settings = get_settings()

# OpenAI-style strict structured output accepts only a small subset of JSON
# Schema. Anything else is a hard 400 from the provider — which then falls
# through to json_object mode and produces unshaped output. Keep the
# expressive constraints in each field's `description` (the model still
# honours them) and strip them from the wire format here, so agent schemas
# stay readable at their definition site.
_UNSUPPORTED_SCHEMA_KEYS = {
    "pattern",
    "format",
    "minItems",
    "maxItems",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "default",
    "examples",
}


def _strictify(node):
    """Rewrites a JSON schema into the strict-mode subset: unsupported
    keywords removed, `additionalProperties: false` on every object, and
    every property listed in `required` (strict mode forbids optional
    fields)."""
    if isinstance(node, dict):
        out = {k: _strictify(v) for k, v in node.items() if k not in _UNSUPPORTED_SCHEMA_KEYS}
        if out.get("type") == "object":
            out["additionalProperties"] = False
            out["required"] = list((out.get("properties") or {}).keys())
        return out
    if isinstance(node, list):
        return [_strictify(v) for v in node]
    return node

# Rough per-call cost estimates in USD — placeholders until real per-model
# pricing is confirmed from OpenRouter's model pages / response usage data.
# Nothing gates on these; they only feed the Logs tab's spend readout.
_ESTIMATED_TEXT_CALL_USD = 0.002
_ESTIMATED_EMBED_CALL_USD = 0.0002

_TIMEOUT = httpx.Timeout(120.0, connect=10.0)


class OpenRouterNotConfiguredError(RuntimeError):
    def __init__(self):
        super().__init__(
            "OPENROUTER_API_KEY is not set. Add it to backend/.env — see .env.example."
        )


class OpenRouterCallError(RuntimeError):
    def __init__(self, status_code: int, body: str):
        self.status_code = status_code
        self.body = body
        super().__init__(f"OpenRouter call failed ({status_code}): {body}")


@dataclass
class GenerateTextResult:
    text: str
    model_version: str
    cost_usd: float


def _headers() -> dict:
    if not settings.openrouter_configured:
        raise OpenRouterNotConfiguredError()
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        # Optional but recommended by OpenRouter for attribution/rate-limit tiers.
        "HTTP-Referer": settings.frontend_origin,
        "X-Title": "MOSAIC Campaign Console",
    }


def generate_text(
    prompt: str,
    *,
    stage: str,
    agent: str,
    response_schema: dict | None = None,
    system_instruction: str | None = None,
) -> GenerateTextResult:
    """Text/reasoning call — used by every agent.

    Pass `response_schema` (a JSON schema dict) to request structured JSON
    output via OpenAI-style `response_format: json_schema`, so the
    Orchestrator never has to parse a model response — every artifact is
    typed at the boundary. Falls back to `json_object` mode if the model
    rejects `json_schema` (not every OpenRouter-routed model supports strict
    schema mode yet).
    """
    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    body: dict = {
        "model": settings.openrouter_text_model,
        "messages": messages,
        "stream": False,
    }
    if response_schema:
        body["response_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": "mosaic_artifact",
                "schema": _strictify(response_schema),
                "strict": True,
            },
        }

    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.post(
            f"{settings.openrouter_base_url}/chat/completions",
            headers=_headers(),
            json=body,
        )

    if resp.status_code >= 400 and response_schema:
        # Retry in plain json_object mode — not every provider OpenRouter
        # routes to supports strict schema mode.
        #
        # json_object mode has its own rule: the request is rejected unless
        # the *messages* literally contain the word "json". Restating the
        # schema in the prompt satisfies that and keeps the output shaped,
        # since json_object alone enforces valid JSON but not our fields.
        body["response_format"] = {"type": "json_object"}
        body["messages"] = messages + [
            {
                "role": "user",
                "content": (
                    "Reply with a single JSON object and nothing else — no prose, no code "
                    "fence. It must match this JSON schema exactly:\n"
                    + json.dumps(_strictify(response_schema))
                ),
            }
        ]
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers=_headers(),
                json=body,
            )

    if resp.status_code >= 400:
        raise OpenRouterCallError(resp.status_code, resp.text)

    data = resp.json()
    text = data["choices"][0]["message"]["content"] or ""

    cost = cost_meter.record(stage=stage, agent=agent, cost_usd=_ESTIMATED_TEXT_CALL_USD)
    return GenerateTextResult(text=text, model_version=settings.openrouter_text_model, cost_usd=cost)


def embed_text(
    texts: list[str],
    *,
    stage: str = "Segmentation & Insight",
    agent: str = "Segmentation Agent",
) -> list[list[float]]:
    """Embeds the sanitised free-text portion of a customer profile for
    clustering. Structured/behavioural attributes are engineered features
    concatenated alongside these vectors before HDBSCAN.

    NOTE: confirm OpenRouter actually serves `/embeddings` for the configured
    model before relying on this — it's less standardised across providers
    than chat. If it doesn't, swap in a direct embedding provider here
    without touching any caller.
    """
    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.post(
            f"{settings.openrouter_base_url}/embeddings",
            headers=_headers(),
            json={"model": settings.openrouter_embedding_model, "input": texts},
        )

    if resp.status_code >= 400:
        raise OpenRouterCallError(resp.status_code, resp.text)

    data = resp.json()
    cost_meter.record(stage=stage, agent=agent, cost_usd=_ESTIMATED_EMBED_CALL_USD * len(texts))
    return [item["embedding"] for item in data["data"]]
