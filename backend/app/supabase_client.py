"""
Server-side Supabase client — uses the service role key so the Orchestrator
can write past RLS (Ledger inserts, template rows, storage uploads on behalf
of Nano Banana generations). Never expose this key to the frontend; the
frontend only ever holds the anon key (see frontend/.env.example).
"""
from supabase import Client, create_client

from app.config import get_settings

settings = get_settings()

_client: Client | None = None


def get_supabase() -> Client | None:
    """Returns None (instead of raising) when Supabase isn't configured yet,
    so routes can degrade to in-memory/log-only behaviour during setup."""
    global _client
    if not settings.supabase_configured:
        return None
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client
