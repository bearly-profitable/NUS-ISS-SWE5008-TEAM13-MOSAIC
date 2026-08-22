"""
Image hosting for sent email, via Supabase Storage.

Mail clients will not render `data:` sources and cannot reach a relative path
once the message leaves the app, so every image inside an email has to be a
public https URL first. That is what the `email-images` bucket is for.

Uploads run *here*, on the backend, rather than from the browser: the bucket is
public to read but its RLS policies do not grant the anon key insert rights, so
a browser-side upload fails with "new row violates row-level security policy"
and — because the old client swallowed that — the email silently shipped with
its images still inline. The service-role key bypasses RLS, and keeping write
access on the server means the public anon key never carries it.
"""
from __future__ import annotations

import logging
import mimetypes
import uuid

import httpx

from app.config import get_settings

logger = logging.getLogger("mosaic.storage")

BUCKET = "email-images"

# A year. These objects are content-addressed by a random name and never
# rewritten, so mail-client image proxies may cache them indefinitely.
CACHE_CONTROL = "31536000"

MAX_IMAGE_BYTES = 10 * 1024 * 1024


class StorageError(RuntimeError):
    """An upload Supabase refused, or never reached."""


def _extension(filename: str, content_type: str) -> str:
    if "." in (filename or ""):
        ext = filename.rsplit(".", 1)[1].lower()
        if ext.isalnum() and len(ext) <= 5:
            return ext
    guessed = mimetypes.guess_extension(content_type or "") or ".png"
    return guessed.lstrip(".")


def public_url(path: str) -> str:
    base = get_settings().supabase_url.rstrip("/")
    return f"{base}/storage/v1/object/public/{BUCKET}/{path}"


def upload_image(data: bytes, *, filename: str = "", content_type: str = "", prefix: str = "email") -> str:
    """Stores one image and returns its public https URL."""
    settings = get_settings()
    if not settings.supabase_configured:
        raise StorageError("Supabase is not configured — cannot host email images.")
    if not data:
        raise StorageError("That image is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise StorageError(
            f"That image is {len(data) / 1024 / 1024:.1f} MB — the limit is "
            f"{MAX_IMAGE_BYTES // 1024 // 1024} MB."
        )

    ext = _extension(filename, content_type)
    path = f"{prefix}-{uuid.uuid4().hex[:12]}.{ext}"
    mime = content_type or mimetypes.guess_type(f"x.{ext}")[0] or "image/png"

    try:
        response = httpx.post(
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{BUCKET}/{path}",
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "apikey": settings.supabase_service_role_key,
                "Content-Type": mime,
                "Cache-Control": CACHE_CONTROL,
            },
            content=data,
            timeout=60.0,
        )
    except httpx.HTTPError as exc:
        raise StorageError(f"Could not reach Supabase Storage: {exc}") from exc

    if response.status_code >= 400:
        detail = _error_detail(response)
        if response.status_code == 404 and "bucket" in detail.lower():
            raise StorageError(
                f"The “{BUCKET}” storage bucket doesn't exist — create it as a public "
                "bucket in the Supabase dashboard."
            )
        raise StorageError(f"Supabase Storage returned {response.status_code}: {detail}")

    url = public_url(path)
    logger.info("Hosted %s (%d bytes) at %s", path, len(data), url)
    return url


def _error_detail(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return response.text[:300]
    return str(body.get("message") or body.get("error") or body)[:300]
