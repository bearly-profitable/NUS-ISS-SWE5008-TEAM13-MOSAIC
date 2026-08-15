"""
Sandboxed dispatch stub — per the proposal's assumptions, dispatch always
goes to a sandboxed stub; no message ever reaches a real recipient. Backs
frontend/src/services/emailApi.ts's sendTestEmail.
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
