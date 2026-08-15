import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError

from app.config import get_settings
from app.routers import misc, test_send, workspace

logging.basicConfig(level=logging.INFO)

settings = get_settings()

app = FastAPI(title="MOSAIC Orchestrator", version="0.2.0")


@app.exception_handler(APIError)
def postgrest_error_handler(_request: Request, exc: APIError):
    """A missing table almost always means a migration hasn't been applied.
    Surface that as an actionable message instead of a bare 500 — otherwise
    the Console just shows "Internal Server Error" on every tab."""
    message = str(exc.message or exc)
    if exc.code == "PGRST205" or "schema cache" in message:
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    f"Database schema is out of date ({message}). "
                    "Run supabase/migrations/0003_workspace_revamp.sql in the "
                    "Supabase SQL Editor, then reload."
                )
            },
        )
    return JSONResponse(status_code=500, content={"detail": f"Database error: {message}"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workspace.router)
app.include_router(test_send.router)
app.include_router(misc.router)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "openrouter_configured": settings.openrouter_configured,
        "supabase_configured": settings.supabase_configured,
    }
