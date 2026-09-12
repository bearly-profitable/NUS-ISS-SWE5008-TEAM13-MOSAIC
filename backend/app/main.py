import logging

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError

from app.config import get_settings
from app.routers import image_gen, misc, test_send, workspace

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


@app.exception_handler(httpx.ConnectError)
def connect_error_handler(_request: Request, exc: httpx.ConnectError):
    """The Supabase host not resolving is the single most common cause here,
    and a paused free-tier project is the usual reason — its subdomain is
    withdrawn from DNS, so every call fails with getaddrinfo. Say that
    outright instead of dumping an httpcore traceback into the console."""
    message = str(exc)
    host = settings.supabase_url.replace("https://", "").replace("http://", "").rstrip("/")
    if "getaddrinfo" in message or "Name or service not known" in message:
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    f"Cannot resolve {host}. The Supabase project is most likely paused "
                    "or deleted — open the Supabase dashboard and restore it, or update "
                    "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in backend/.env."
                )
            },
        )
    return JSONResponse(
        status_code=503,
        content={"detail": f"Cannot reach Supabase at {host}: {message}"},
    )

@app.exception_handler(httpx.ReadError)
@app.exception_handler(httpx.TransportError)
def httpx_transport_error_handler(_request: Request, exc: httpx.TransportError):
    """Windows + a shared HTTP/2 pool used to surface as WinError 10035
    (WSAEWOULDBLOCK) on every overlapping request. The client now uses
    HTTP/1.1 per thread; this handler still turns a leftover transport
    failure into something the Console can show."""
    message = str(exc)
    if "10035" in message:
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    "Lost the connection to Supabase mid-request (Windows socket 10035). "
                    "Retry the action — a one-off is common during a large CSV upload."
                )
            },
        )
    return JSONResponse(status_code=503, content={"detail": f"Cannot reach Supabase: {message}"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workspace.router)
app.include_router(image_gen.router)
app.include_router(test_send.router)
app.include_router(misc.router)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "openrouter_configured": settings.openrouter_configured,
        "supabase_configured": settings.supabase_configured,
    }
