"""
Real dispatch, via Resend.

This replaces the sandboxed stub in routers/test_send.py for the Approval
Queue's send path: an approved email is handed to Resend and lands in a real
inbox. Nothing else in the app calls this — dispatch is only reachable behind
an explicit approval plus a non-BLOCK Guardian verdict (see routers/workspace.py).

The from-address must sit on a domain verified in the Resend dashboard.
An unverified sender is the single most common failure here, so that case is
translated into a message that says what to fix rather than echoing Resend's
raw 403 body.
"""
from __future__ import annotations

import logging
import re

import httpx

from app.config import get_settings

logger = logging.getLogger("mosaic.mailer")

RESEND_ENDPOINT = "https://api.resend.com/emails"

# Deliberately permissive — this only catches a typo'd address before it costs
# an API round trip; Resend does the authoritative validation.
_ADDRESS_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SendError(RuntimeError):
    """A dispatch that Resend refused, or never reached."""


_STRIP_TAGS_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>|<[^>]+>", re.IGNORECASE | re.DOTALL)
_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_ENTITIES = {"&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'"}


def is_valid_address(address: str) -> bool:
    return bool(_ADDRESS_RE.match((address or "").strip()))


def html_to_text(html: str) -> str:
    """A plain-text alternative for the multipart body.

    HTML-only mail scores worse at every major provider and renders as nothing
    in text-only clients, so every send carries both. This is deliberately a
    tag-strip rather than a real renderer — it is a fallback, not a second
    design of the email.
    """
    text = _COMMENT_RE.sub(" ", html or "")
    text = _STRIP_TAGS_RE.sub(" ", text)
    for entity, char in _ENTITIES.items():
        text = text.replace(entity, char)
    # Collapse the whitespace the stripped table layout leaves behind, but keep
    # paragraph breaks so the fallback is still readable.
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s*\n\s*", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def send_email(*, to: str, subject: str, html: str) -> dict:
    """Sends one email and returns Resend's record ({'id': ...}).

    Raises SendError with an operator-readable message on any failure — the
    caller surfaces it straight into the Approval Queue.
    """
    settings = get_settings()
    if not settings.resend_configured:
        raise SendError(
            "Resend is not configured — set RESEND_API_KEY (and RESEND_FROM) in backend/.env, "
            "then restart the backend."
        )
    if not is_valid_address(to):
        raise SendError(f"“{to}” is not a valid email address.")

    payload: dict = {
        "from": settings.resend_from,
        "to": [to.strip()],
        "subject": subject or "(no subject)",
        "html": html,
        "text": html_to_text(html),
    }
    if settings.resend_reply_to:
        payload["reply_to"] = settings.resend_reply_to

    try:
        response = httpx.post(
            RESEND_ENDPOINT,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json=payload,
            timeout=30.0,
        )
    except httpx.HTTPError as exc:
        raise SendError(f"Could not reach Resend: {exc}") from exc

    if response.status_code >= 400:
        detail = _error_detail(response)
        if response.status_code in (401, 403):
            raise SendError(
                f"Resend rejected the send ({detail}). Check RESEND_API_KEY, and that "
                f"“{settings.resend_from}” is on a domain verified in the Resend dashboard."
            )
        raise SendError(f"Resend returned {response.status_code}: {detail}")

    body = response.json()
    logger.info("Sent %s to %s (resend id %s)", subject, to, body.get("id"))
    return body


def _error_detail(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return response.text[:300]
    return str(body.get("message") or body.get("error") or body)[:300]
