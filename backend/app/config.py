from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# The app is a single implicit workspace now — no campaign selector, no
# Brief Intake. Every pipeline table still carries campaign_id, so this one
# constant keeps those foreign keys satisfied without any campaign UI.
# Seeded by supabase/migrations/0003_workspace_revamp.sql.
WORKSPACE_ID = "mosaic-workspace"


class Settings(BaseSettings):
    """
    Central config for the MOSAIC Orchestrator. Every value here is read
    from environment variables / .env — see .env.example for the full list.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # -- OpenRouter (text + embeddings only; image generation was removed) --
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_text_model: str = "openai/gpt-5.6-luna"
    # Embeddings support on OpenRouter is less standardised than chat —
    # confirm this model id is actually servable via /embeddings before the
    # Segmentation agent goes live; see openrouter_client.py's embed_text().
    openrouter_embedding_model: str = "openai/text-embedding-3-small"

    # -- Supabase (database; service role so the backend can write past RLS) --
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # -- Generation limits --
    # The Email Review tab shows one email per segment, capped at 6.
    max_segments: int = 6

    # -- CORS --
    frontend_origin: str = "http://localhost:5173"

    @property
    def openrouter_configured(self) -> bool:
        return bool(self.openrouter_api_key)

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
