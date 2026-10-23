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

    # -- OpenRouter (text, embeddings, and manually-triggered image gen) --
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_text_model: str = "openai/gpt-5.6-luna"
    # Imagery is never produced as part of a pipeline run — no agent calls
    # this model. It fires only when the operator reviews a prompt in the
    # image field and presses Generate. See routers/image_gen.py.
    openrouter_image_model: str = "openai/gpt-image-2.5-flare"
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

    # -- Resend (real dispatch) --
    # Approved emails are sent for real. `resend_from` must sit on a domain
    # verified in the Resend dashboard, otherwise Resend rejects the send with
    # a 403 and only the account owner's own address can receive anything.
    resend_api_key: str = ""
    resend_from: str = "MOSAIC <mosaic@ongqq.site>"
    resend_reply_to: str = ""
    # Pre-filled in the Approval Queue's recipient field. Every send is still
    # explicit — the operator confirms the address before dispatch.
    default_recipient: str = ""

    # -- CORS --
    # Comma-separated: the Console is served from a different origin in every
    # environment (localhost in dev, the static service's domain on Railway),
    # and a preview deploy adds another. "*" allows any origin.
    frontend_origin: str = "http://localhost:5173"

    @property
    def openrouter_configured(self) -> bool:
        return bool(self.openrouter_api_key)

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def resend_configured(self) -> bool:
        return bool(self.resend_api_key and self.resend_from)

    @property
    def cors_origins(self) -> list[str]:
        """FRONTEND_ORIGIN parsed into the list CORSMiddleware wants.

        Trailing slashes are stripped because a browser's Origin header never
        carries one — "https://app.up.railway.app/" in the env var would
        otherwise silently match nothing and every call would fail CORS.
        """
        origins = [o.strip().rstrip("/") for o in self.frontend_origin.split(",")]
        return [o for o in origins if o] or ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
