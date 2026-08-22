"""
Sandboxed dispatch stub, kept for the ported email builder's sendTestEmail
(frontend/src/services/emailApi.ts) — it logs and discards.

Real dispatch does *not* go through here. The Approval Queue sends via
POST /api/emails/{id}/send in routers/workspace.py, which goes out through
mailer.py and Resend to an actual inbox.
"""
import logging

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger("mosaic.test_send")


class TestSendRequest(BaseModel):
    to: str
    subject: str
    html: str


@router.post("/api/test-send")
def test_send(body: TestSendRequest):
    logger.info("[sandboxed-dispatch] to=%s subject=%r (%d bytes of HTML)", body.to, body.subject, len(body.html))
    return {"ok": True, "sandboxed": True}
