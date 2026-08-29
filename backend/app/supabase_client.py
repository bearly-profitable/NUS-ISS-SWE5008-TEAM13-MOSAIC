"""
Server-side Supabase client — uses the service role key so the Orchestrator
can write past RLS (Ledger inserts, template rows, storage uploads). Never
expose this key to the frontend; the frontend only ever holds the anon key
(see frontend/.env.example).
"""
from __future__ import annotations

import threading

import httpx
from supabase import Client, ClientOptions, create_client

from app.config import get_settings

settings = get_settings()

# One client per thread. The upload job runs on a worker while the console
# polls /api/jobs and /api/state on the request thread; a shared httpx
# connection pool on Windows raises WinError 10035 (WSAEWOULDBLOCK),
# especially on HTTP/2.
_local = threading.local()


def _make_client() -> Client:
    http = httpx.Client(
        http2=False,
        timeout=httpx.Timeout(120.0, connect=15.0),
    )
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
        options=ClientOptions(httpx_client=http),
    )


def get_supabase() -> Client | None:
    """Returns None (instead of raising) when Supabase isn't configured yet,
    so routes can degrade to in-memory/log-only behaviour during setup."""
    if not settings.supabase_configured:
        return None
    client = getattr(_local, "client", None)
    if client is None:
        _local.client = _make_client()
    return _local.client
