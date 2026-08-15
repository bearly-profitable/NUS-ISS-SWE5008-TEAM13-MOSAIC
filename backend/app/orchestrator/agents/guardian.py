"""
Stage 4 — Compliance & Brand Guardian.

Every check here is real and runs against actual data from this workspace —
nothing is a hardcoded pass:

  - Marketing permission: queries the real customer_profile rows assigned to
    this segment (see segmentation.py's assign_customers_to_segment) and
    flags if a majority have withdrawn marketing consent.
  - Protected-attribute proxy: reads the proxy_check_result row
    segmentation.py already computed and persisted for this segment.
  - Claim grounding: cited_offer_ids must be non-empty (email_composer.py
    already filters to real offer_catalogue ids, so a non-empty list is a
    genuine citation).
  - PII contamination: regex scan of the actual rendered email text for
    email/phone patterns that shouldn't appear in generic marketing copy.
  - Manipulation index: lexicon scorer over the real subject/preheader/body/
    CTA text for urgency, scarcity, loss-framing and false social proof.

An ungrounded claim or a majority-withdrawn-permission segment is a BLOCK,
not a REVISE. Everything else that fails is a REVISE.

Re-runnable: the Approval Queue re-adjudicates after a user edits an email in
the builder, so this reads the email's *current* blocks, not the originally
generated ones.
"""
import re

from app.config import WORKSPACE_ID
from app.ledger import LedgerEntry, write_entry
from app.orchestrator.state import GuardianVerdict, WorkspaceState
from app.persistence import consent_stats_for_segment, fetch_proxy_check, insert_manipulation_scores

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"\b(?:\+?65[\s-]?)?[689]\d{3}[\s-]?\d{4}\b")

_URGENCY_WORDS = ["hurry", "act now", "don't wait", "don't miss", "last chance", "final hours", "ends soon", "expires"]
_SCARCITY_WORDS = ["limited", "only a few", "while supplies last", "almost gone", "selling fast", "exclusive"]
_LOSS_FRAMING_WORDS = ["miss out", "lose your", "before it's too late", "risk losing"]
_SOCIAL_PROOF_WORDS = ["everyone is", "join thousands", "bestseller", "most popular", "sold out fast"]

# Block content fields that hold user-visible prose. Anything else (colours,
# URLs, sizes) is styling and shouldn't be scanned for PII or manipulation.
_TEXT_FIELDS = ("text", "markdown", "heading", "label", "answer", "question")


def _email_text(email: dict) -> str:
    """Flattens an email's visible copy — subject, preheader and every prose
    field across its blocks — into one string for the text-based checks."""
    parts = [email.get("subject", ""), email.get("preheader", "")]
    for block in email.get("blocks") or []:
        content = block.get("content") or {}
        for field in _TEXT_FIELDS:
            if content.get(field):
                parts.append(str(content[field]))
    return " ".join(parts)


def _grounding_check(email: dict) -> dict:
    cited = email.get("cited_offer_ids") or []
    passed = len(cited) > 0
    return {
        "name": "Claim grounding",
        "passed": passed,
        "detail": f"{len(cited)} cited offer(s)" if passed else "No offer cited — ungrounded claim",
    }


def _permission_check(segment_id: str) -> dict:
    stats = consent_stats_for_segment(segment_id)
    passed = stats["withdrawn_pct"] <= 0.5
    return {
        "name": "Marketing permission",
        "passed": passed,
        "detail": f"{stats['withdrawn']}/{stats['total']} contacts have withdrawn marketing consent "
        f"({stats['withdrawn_pct']:.0%})"
        if stats["total"]
        else "No contacts assigned to this segment yet",
    }


def _proxy_check(segment_id: str) -> dict:
    proxy = fetch_proxy_check(segment_id)
    if proxy is None:
        return {"name": "Protected attribute proxy", "passed": True, "detail": "No proxy check on record"}
    passed = not proxy["flagged"]
    return {
        "name": "Protected attribute proxy",
        "passed": passed,
        "detail": f"age_bracket deviation {proxy['correlation']:.0%}" + (" — flagged" if not passed else ""),
    }


def _pii_check(text: str) -> dict:
    hits = _EMAIL_RE.findall(text) + _PHONE_RE.findall(text)
    return {
        "name": "PII contamination",
        "passed": len(hits) == 0,
        "detail": "No identifiers detected" if not hits else f"Found {len(hits)} identifier-like string(s)",
    }


def _manipulation_score(text: str) -> dict:
    lowered = text.lower()

    def count(words: list[str]) -> int:
        return sum(1 for w in words if w in lowered)

    urgency = count(_URGENCY_WORDS) * 25
    scarcity = count(_SCARCITY_WORDS) * 25
    loss_framing = count(_LOSS_FRAMING_WORDS) * 25
    social_proof = count(_SOCIAL_PROOF_WORDS) * 25
    total = min(100, urgency + scarcity + loss_framing + social_proof)
    return {
        "urgency": urgency,
        "scarcity": scarcity,
        "loss_framing": loss_framing,
        "social_proof": social_proof,
        "total": total,
        "threshold_breached": total > 50,
    }


def adjudicate(email: dict) -> GuardianVerdict:
    """Adjudicates a single email dict (as stored in segment_email) and
    writes its ledger entry. Exposed separately so the Approval Queue can
    re-adjudicate one edited email without re-running the whole graph."""
    segment_id = email["segment_brief_id"]
    text = _email_text(email)

    grounding = _grounding_check(email)
    permission = _permission_check(segment_id)
    proxy = _proxy_check(segment_id)
    pii = _pii_check(text)
    manip = _manipulation_score(text)

    checks = [
        permission,
        proxy,
        grounding,
        pii,
        {
            "name": "Manipulation index",
            "passed": not manip["threshold_breached"],
            "detail": f"Score {manip['total']}/100"
            + (" — over threshold" if manip["threshold_breached"] else " — under threshold"),
        },
    ]

    if not grounding["passed"] or not permission["passed"]:
        verdict = "BLOCK"
    elif not proxy["passed"] or not pii["passed"] or manip["threshold_breached"]:
        verdict = "REVISE"
    else:
        verdict = "PASS"

    insert_manipulation_scores([{"message_id": email["id"], **manip}])
    write_entry(
        LedgerEntry(
            campaign_id=WORKSPACE_ID,
            stage="Compliance Adjudication",
            agent="Compliance & Brand Guardian",
            prompt_version="guardian-v2",
            model_version="rule-engine",
            input_artifact_ids=[segment_id],
            output_artifact_id=email["id"],
            verdict=verdict,
            checks=checks,
        )
    )
    return {"message_id": email["id"], "verdict": verdict, "checks": checks}


def run_guardian(state: WorkspaceState) -> dict:
    verdicts: list[GuardianVerdict] = []
    for email in state.get("segment_emails", []):
        verdicts.append(
            adjudicate(
                {
                    "id": email["id"],
                    "segment_brief_id": email["segment_id"],
                    "subject": email["subject"],
                    "preheader": email["preheader"],
                    "blocks": email["blocks"],
                    "cited_offer_ids": email["cited_offers"],
                }
            )
        )
    return {"guardian_verdicts": verdicts}
