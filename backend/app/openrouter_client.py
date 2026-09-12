"""
Thin wrapper around OpenRouter — the single chokepoint every agent goes
through, so cost metering and prompt/model version tagging (for the Decision
Ledger) happen in one place instead of being duplicated per-agent.

OpenRouter's chat/completions endpoint is OpenAI-compatible, so this talks to
it over plain REST (httpx) rather than pulling in a provider SDK.

Image generation lives here too, but no agent calls it: `generate_image` is
reachable only from the manual endpoint the operator drives by hand after
reviewing a prompt. Pipeline runs still compose emails from typed
EmailBlock[] with whatever hero the operator chose, and creative direction
stays colour/tone/style fields — nothing here ever fires on its own.
"""
from __future__ import annotations

import base64
import binascii
import json
import re
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
# Image models cost orders of magnitude more per call than text, which is a
# large part of why generation is operator-triggered rather than automatic.
_ESTIMATED_IMAGE_CALL_USD = 0.04

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


# --------------------------------------------------------------------------
# Image generation — manual only.
#
# Nothing in the orchestrator graph reaches this. It is called from one
# operator-driven endpoint (routers/image_gen.py) after the user has read and
# edited the prompt, so an image is never produced as a side effect of
# generating segments, direction or copy.
# --------------------------------------------------------------------------

# What the Generate panel offers. Kept server-side as well as in the UI so a
# hand-rolled request can't smuggle an arbitrary string into the provider
# payload.
IMAGE_ASPECT_RATIOS = ("1:1", "3:2", "2:3", "16:9", "9:16", "4:3", "3:4")
IMAGE_QUALITIES = ("auto", "low", "medium", "high")
IMAGE_BACKGROUNDS = ("auto", "transparent", "opaque")

# The longest prompt worth sending. Past this the provider truncates anyway,
# and the operator has lost track of what they're approving.
MAX_IMAGE_PROMPT_CHARS = 4000

_DATA_URI_RE = re.compile(r"^data:(?P<mime>[\w.+-]+/[\w.+-]+)?;base64,(?P<payload>.+)$", re.DOTALL)


@dataclass
class GenerateImageResult:
    data: bytes
    mime_type: str
    model_version: str
    # This call's estimated cost, not the running workspace total that
    # GenerateTextResult carries -- the Generate panel shows it beside a
    # single render, where a cumulative figure would read as a lie.
    cost_usd: float


def _decode_data_uri(uri: str) -> tuple[bytes, str] | None:
    match = _DATA_URI_RE.match(uri.strip())
    if not match:
        return None
    try:
        return base64.b64decode(match.group("payload")), match.group("mime") or "image/png"
    except (binascii.Error, ValueError):
        return None


def _image_from_images_endpoint(payload: dict) -> tuple[bytes, str] | None:
    """Reads OpenAI-shaped `/images/generations` output: a `data` array whose
    entries carry either inline base64 or a URL to fetch."""
    items = payload.get("data")
    if not isinstance(items, list) or not items:
        return None
    first = items[0]
    if not isinstance(first, dict):
        return None

    b64 = first.get("b64_json")
    if isinstance(b64, str) and b64:
        decoded = _decode_data_uri(b64) if b64.startswith("data:") else None
        if decoded:
            return decoded
        try:
            return base64.b64decode(b64), "image/png"
        except (binascii.Error, ValueError):
            return None

    url = first.get("url")
    if isinstance(url, str) and url:
        if url.startswith("data:"):
            return _decode_data_uri(url)
        # Hosted result — pull the bytes now so the caller only ever deals in
        # bytes, and so the image lands in our own bucket before the
        # provider's short-lived URL expires.
        with httpx.Client(timeout=_TIMEOUT) as client:
            fetched = client.get(url)
        if fetched.status_code >= 400:
            return None
        return fetched.content, fetched.headers.get("content-type", "image/png").split(";")[0]
    return None


def _image_from_chat_completion(payload: dict) -> tuple[bytes, str] | None:
    """Reads the chat-completions image shape, where the picture comes back
    as a data URI on `message.images[].image_url.url`."""
    try:
        message = payload["choices"][0]["message"]
    except (KeyError, IndexError, TypeError):
        return None
    for image in message.get("images") or []:
        url = (image or {}).get("image_url", {}).get("url") if isinstance(image, dict) else None
        if isinstance(url, str):
            decoded = _decode_data_uri(url)
            if decoded:
                return decoded
    return None


def generate_image(
    prompt: str,
    *,
    aspect_ratio: str = "3:2",
    quality: str = "auto",
    background: str = "auto",
    stage: str = "Imagery",
    agent: str = "Image Generator",
) -> GenerateImageResult:
    """Renders one image from an operator-approved prompt and returns its raw
    bytes — hosting is the caller's job (see storage.upload_image).

    OpenRouter exposes image models two ways and which one a given model
    answers on varies, so this tries the OpenAI-compatible
    `/images/generations` endpoint first and falls back to `/chat/completions`
    with `modalities`. Streaming is deliberately off: the caller has to hold
    the complete bytes to upload them, so a stream would buy nothing but
    partial-failure states.
    """
    prompt = (prompt or "").strip()
    if not prompt:
        raise ValueError("An image prompt is required.")
    if len(prompt) > MAX_IMAGE_PROMPT_CHARS:
        raise ValueError(
            f"That prompt is {len(prompt)} characters — the limit is {MAX_IMAGE_PROMPT_CHARS}."
        )
    if aspect_ratio not in IMAGE_ASPECT_RATIOS:
        raise ValueError(f"Unsupported aspect ratio “{aspect_ratio}”.")
    if quality not in IMAGE_QUALITIES:
        raise ValueError(f"Unsupported quality “{quality}”.")
    if background not in IMAGE_BACKGROUNDS:
        raise ValueError(f"Unsupported background “{background}”.")

    model = settings.openrouter_image_model
    headers = _headers()

    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.post(
            f"{settings.openrouter_base_url}/images/generations",
            headers=headers,
            json={
                "model": model,
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "quality": quality,
                "background": background,
                "stream": False,
            },
        )

        image = None
        if resp.status_code < 400:
            try:
                image = _image_from_images_endpoint(resp.json())
            except ValueError:
                image = None

        if image is None:
            # Either the endpoint isn't served for this model, or it answered
            # in the chat shape. Retry the documented chat-modalities form
            # before giving up, so swapping the model id doesn't break this.
            fallback = client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "modalities": ["image", "text"],
                    "stream": False,
                },
            )
            if fallback.status_code >= 400:
                # Report whichever failure is more informative — the first
                # call's body, unless it succeeded and only parsing failed.
                failed = resp if resp.status_code >= 400 else fallback
                raise OpenRouterCallError(failed.status_code, failed.text)
            try:
                image = _image_from_chat_completion(fallback.json())
            except ValueError:
                image = None
            if image is None:
                raise OpenRouterCallError(
                    502, f"{model} returned no image data. Response: {fallback.text[:300]}"
                )

    data, mime = image
    cost_meter.record(stage=stage, agent=agent, cost_usd=_ESTIMATED_IMAGE_CALL_USD)
    return GenerateImageResult(
        data=data, mime_type=mime, model_version=model, cost_usd=_ESTIMATED_IMAGE_CALL_USD
    )
