"""
Stage 4 — Pre-flight checks for a real send.

These emails are dispatched for real (see mailer.py), so every check here is
one that would actually stop an operator from pressing send. Each runs against
this workspace's own data — the uploaded contacts, the offer catalogue, the
company profile, the email's current blocks — and nothing is a hardcoded pass.

Three groups, in the order they matter:

  compliance    — may we legally send this at all?
                  consent, unsubscribe, PII leakage, protected-attribute proxy
  content       — does the copy hold up?
                  offer grounding, merge-tag resolution
  deliverability— will it land, and render, in an inbox?
                  subject line, link integrity, image hosting

Severity drives the verdict. A `block` failure means the message must never
reach an inbox — sending without consent or without an unsubscribe route is
unlawful, leaking another customer's identifiers is a data incident, and an
unresolved `{{first_name}}` renders literally to a real person. A `revise`
failure is a quality problem the operator may knowingly ship over.

Re-runnable: the Approval Queue re-adjudicates after an edit in the builder,
so this reads the email's *current* blocks, not the originally generated ones.
"""
from __future__ import annotations

import json
import re

from app.config import WORKSPACE_ID
from app.ledger import LedgerEntry, write_entry
from app.orchestrator.state import GuardianVerdict, WorkspaceState
from app.persistence import (
    consent_stats_for_segment,
    fetch_offers,
    fetch_proxy_check,
    get_company_profile,
)

# Bumped whenever the check set changes. The console ignores verdicts written
# by an older version rather than rendering checks it no longer understands —
# see routers/workspace.py's _latest_verdicts.
GUARDIAN_VERSION = "guardian-v3"

BLOCK = "block"
REVISE = "revise"

COMPLIANCE = "compliance"
CONTENT = "content"
DELIVERABILITY = "deliverability"

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"\b(?:\+?65[\s-]?)?[689]\d{3}[\s-]?\d{4}\b")
# Both placeholder dialects the app can produce: `{{first_name}}` from the
# composer (brand.merge_tag) and `%%first_name%%` from the builder's export.
_MERGE_TAG_RE = re.compile(r"\{\{\s*([\w.-]+)\s*\}\}|%%\s*([\w.-]+)\s*%%")
_MARKDOWN_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")

# Anything an unsubscribe link plausibly says. Matched against the footer's
# link labels and URLs.
_UNSUBSCRIBE_WORDS = ("unsubscribe", "opt out", "opt-out", "preferences", "manage subscription")

# Words that materially raise a spam score in the subject line. Deliberately
# short: this is a deliverability signal, not a tone police.
_SPAM_SUBJECT_WORDS = ("free!!", "act now", "risk free", "100% free", "click here", "winner", "cash bonus")

# Placeholder hosts the builder and the sample content leave behind. A link to
# one of these in a real send is a dead link.
_PLACEHOLDER_HOSTS = ("example.com", "example.org", "yourdomain", "lorem", "placeholder")

# Block content fields that hold user-visible prose. Anything else (colours,
# URLs, sizes) is styling and shouldn't be scanned for PII or merge tags.
_TEXT_FIELDS = ("text", "markdown", "heading", "label", "answer", "question", "code")

# Gmail and Outlook both strip `data:` image sources, so a hero saved as a data
# URI silently renders as a broken image for the recipient.
_UNHOSTED_PREFIXES = ("data:", "blob:")


# ── Content walking ───────────────────────────────────────────────────────


def _blocks(email: dict) -> list[dict]:
    return [b for b in (email.get("blocks") or []) if isinstance(b, dict)]


def _content_pairs(email: dict):
    """Yields (block_type, key, value) for every string field in every block,
    flattening the JSON-encoded item lists that icon-grid and accordion use so
    their URLs and copy are scanned like any other field."""
    for block in _blocks(email):
        block_type = block.get("type", "")
        content = block.get("content") or {}
        if not isinstance(content, dict):
            continue
        for key, value in content.items():
            if key == "items" and isinstance(value, str):
                try:
                    items = json.loads(value)
                except (ValueError, TypeError):
                    items = []
                for item in items if isinstance(items, list) else []:
                    if isinstance(item, dict):
                        for item_key, item_value in item.items():
                            if isinstance(item_value, str):
                                yield block_type, item_key, item_value
                continue
            if isinstance(value, str):
                yield block_type, key, value


def _visible_text(email: dict) -> str:
    """The email's visible copy — subject, preheader and every prose field —
    flattened into one string for the text-based checks."""
    parts = [email.get("subject", ""), email.get("preheader", "")]
    for _, key, value in _content_pairs(email):
        if key in _TEXT_FIELDS:
            parts.append(value)
    return " ".join(parts)


def _is_url_key(key: str) -> bool:
    """Only fields that actually hold a URL. The suffix test matters: `logoUrl`
    is an address, `logoHeight` is a number, and both contain "logo"."""
    lowered = key.lower()
    return lowered.endswith(("url", "src", "link")) or bool(re.fullmatch(r"link\d+url", lowered))


def _is_image_key(key: str) -> bool:
    lowered = key.lower()
    return _is_url_key(key) and any(
        word in lowered for word in ("image", "logo", "thumbnail", "icon", "photo")
    )


def _is_link_key(block_type: str, key: str) -> bool:
    if block_type == "social-links":
        # Social blocks key their URLs by platform name, not by a *Url suffix.
        return True
    return _is_url_key(key) and not _is_image_key(key)


def _image_urls(email: dict) -> list[str]:
    return [v.strip() for _, k, v in _content_pairs(email) if _is_image_key(k) and v.strip()]


def _link_urls(email: dict) -> list[str]:
    urls = [v.strip() for t, k, v in _content_pairs(email) if _is_link_key(t, k) and v.strip()]
    for _, key, value in _content_pairs(email):
        if key in _TEXT_FIELDS:
            urls.extend(m.strip() for m in _MARKDOWN_LINK_RE.findall(value))
    return urls


def merge_tags(email: dict) -> list[str]:
    """Every distinct personalisation token in the email's visible copy."""
    found: list[str] = []
    for curly, percent in _MERGE_TAG_RE.findall(_visible_text(email)):
        tag = curly or percent
        if tag and tag not in found:
            found.append(tag)
    return found


def _check(name: str, category: str, passed: bool, detail: str, severity: str = REVISE) -> dict:
    return {"name": name, "category": category, "passed": passed, "detail": detail, "severity": severity}


# ── Compliance ────────────────────────────────────────────────────────────


def _consent_check(segment_id: str) -> dict:
    """Real query against the customer_profile rows assigned to this segment
    (see segmentation.assign_customers_to_segment)."""
    stats = consent_stats_for_segment(segment_id)
    if not stats["total"]:
        return _check(
            "Marketing consent",
            COMPLIANCE,
            True,
            "No contacts assigned to this segment yet",
            BLOCK,
        )
    passed = stats["withdrawn_pct"] <= 0.5
    reachable = stats["total"] - stats["withdrawn"]
    return _check(
        "Marketing consent",
        COMPLIANCE,
        passed,
        f"{reachable:,} of {stats['total']:,} contacts still opted in "
        f"({stats['withdrawn_pct']:.0%} withdrawn)",
        BLOCK,
    )


def _unsubscribe_check(email: dict) -> dict:
    """An unsubscribe route is not optional — CAN-SPAM and GDPR both require
    one, and every mailbox provider scores its absence."""
    for block_type, key, value in _content_pairs(email):
        if block_type != "footer":
            continue
        lowered = value.lower()
        if any(word in lowered for word in _UNSUBSCRIBE_WORDS):
            return _check("Unsubscribe route", COMPLIANCE, True, "Footer carries an opt-out link", BLOCK)
    has_footer = any(b.get("type") == "footer" for b in _blocks(email))
    return _check(
        "Unsubscribe route",
        COMPLIANCE,
        False,
        "Footer has no opt-out link — add one in the builder"
        if has_footer
        else "No footer block — the email has no unsubscribe route",
        BLOCK,
    )


def _pii_check(email: dict) -> dict:
    """Another customer's address or phone number appearing in shared marketing
    copy is a data incident, not a typo."""
    text = _visible_text(email)
    hits = _EMAIL_RE.findall(text) + _PHONE_RE.findall(text)
    return _check(
        "No leaked identifiers",
        COMPLIANCE,
        not hits,
        "No customer emails or phone numbers in the copy"
        if not hits
        else f"{len(hits)} identifier-like string(s) in the body: {', '.join(hits[:3])}",
        BLOCK,
    )


def _proxy_check(segment_id: str) -> dict:
    """Reads the proxy_check_result row segmentation.py already computed —
    does this segment correlate with a protected attribute?"""
    proxy = fetch_proxy_check(segment_id)
    if proxy is None:
        return _check("Protected-attribute proxy", COMPLIANCE, True, "No proxy check on record")
    attribute = proxy.get("protected_attribute") or ""
    if not attribute:
        return _check(
            "Protected-attribute proxy",
            COMPLIANCE,
            True,
            "No protected attribute in the uploaded list — nothing to test against",
        )
    passed = not proxy["flagged"]
    return _check(
        "Protected-attribute proxy",
        COMPLIANCE,
        passed,
        f"{attribute} deviates {proxy['correlation']:.0%} from the base rate"
        + (" — this segment is a proxy for it" if not passed else " — within tolerance"),
    )


# ── Content ───────────────────────────────────────────────────────────────


def _grounding_check(email: dict) -> dict:
    """Every claimed offer must be a row in the operator's own catalogue —
    a cited id that no longer exists is an offer the recipient can't redeem."""
    cited = [c for c in (email.get("cited_offer_ids") or []) if c]
    if not cited:
        return _check("Offer grounding", CONTENT, False, "No offer cited — the claim is ungrounded")
    known = {o["id"]: o for o in fetch_offers()}
    unknown = [c for c in cited if c not in known]
    if unknown:
        return _check(
            "Offer grounding",
            CONTENT,
            False,
            f"Cites {len(unknown)} offer(s) no longer in the catalogue: {', '.join(unknown[:3])}",
        )
    names = ", ".join(known[c]["name"] for c in cited[:3])
    return _check("Offer grounding", CONTENT, True, f"Cites {len(cited)} catalogue offer(s): {names}")


def _merge_tag_check(email: dict) -> dict:
    """A tag that names no uploaded column can never be filled, so it would
    reach the recipient as literal `{{first_name}}`."""
    tags = merge_tags(email)
    if not tags:
        return _check("Personalisation tags", CONTENT, True, "No merge tags to resolve", BLOCK)
    columns = {c["name"] for c in (get_company_profile().get("columns") or [])}
    unresolved = [t for t in tags if t not in columns]
    if unresolved:
        return _check(
            "Personalisation tags",
            CONTENT,
            False,
            f"{', '.join('{{' + t + '}}' for t in unresolved[:3])} matches no uploaded column — "
            "it would send as literal text",
            BLOCK,
        )
    return _check(
        "Personalisation tags",
        CONTENT,
        True,
        f"{', '.join(tags)} resolves from the uploaded CSV",
        BLOCK,
    )


# ── Deliverability ────────────────────────────────────────────────────────


def _subject_check(email: dict) -> dict:
    """Subject-line hygiene, on the three signals mailbox providers actually
    weight: length, shouting, and spam-trigger phrasing."""
    subject = (email.get("subject") or "").strip()
    if not subject:
        return _check("Subject line", DELIVERABILITY, False, "Empty subject line")

    problems = []
    if len(subject) > 70:
        problems.append(f"{len(subject)} chars — Gmail truncates past ~70")
    letters = [c for c in subject if c.isalpha()]
    if len(letters) >= 6 and all(c.isupper() for c in letters):
        problems.append("all caps")
    if subject.count("!") > 1 or "$$$" in subject:
        problems.append("excessive punctuation")
    lowered = subject.lower()
    hits = [w for w in _SPAM_SUBJECT_WORDS if w in lowered]
    if hits:
        problems.append(f"spam-trigger phrasing ({hits[0]})")

    if problems:
        return _check("Subject line", DELIVERABILITY, False, "; ".join(problems))
    return _check("Subject line", DELIVERABILITY, True, f"{len(subject)} chars, no spam triggers")


def _link_check(email: dict) -> dict:
    """Every link must be somewhere a recipient can actually go."""
    urls = _link_urls(email)
    if not urls:
        return _check("Link integrity", DELIVERABILITY, True, "No links in this email")

    broken: list[str] = []
    for url in urls:
        lowered = url.lower()
        if url in ("#", "") or lowered.startswith("javascript:"):
            broken.append(url or "(empty)")
        elif any(host in lowered for host in _PLACEHOLDER_HOSTS):
            broken.append(url)
        elif not lowered.startswith(("http://", "https://", "mailto:", "tel:")):
            broken.append(url)

    if broken:
        unique = list(dict.fromkeys(broken))
        return _check(
            "Link integrity",
            DELIVERABILITY,
            False,
            f"{len(unique)} of {len(urls)} links go nowhere: {', '.join(unique[:3])}",
        )
    return _check("Link integrity", DELIVERABILITY, True, f"All {len(urls)} links resolve to a real destination")


def _image_check(email: dict) -> dict:
    """Every image must end up on a public https URL, or the recipient sees a
    broken box.

    A `data:` source is fine here: dispatch pipes the blocks through the
    builder's image chokepoint (frontend/src/lib/email-image-urls.ts), which
    uploads inline images to Supabase Storage and rewrites them before the HTML
    is generated. What that cannot rescue is a *relative* path — resolving one
    needs a publicly reachable origin, which a workspace running on localhost
    does not have — or a plain-http URL, which many clients block outright.
    """
    urls = _image_urls(email)
    if not urls:
        return _check("Image sources", DELIVERABILITY, True, "No images in this email")

    inline = [u for u in urls if u.lower().startswith(_UNHOSTED_PREFIXES)]
    relative = [
        u for u in urls if not u.lower().startswith(_UNHOSTED_PREFIXES + ("http://", "https://"))
    ]
    insecure = [u for u in urls if u.lower().startswith("http://")]

    if relative:
        return _check(
            "Image sources",
            DELIVERABILITY,
            False,
            f"{len(relative)} of {len(urls)} images use a relative path "
            f"({relative[0][:40]}) — a recipient's mail client can't reach it",
        )
    if insecure:
        return _check(
            "Image sources",
            DELIVERABILITY,
            False,
            f"{len(insecure)} of {len(urls)} images are served over plain http — "
            "many clients block mixed content",
        )
    if inline:
        return _check(
            "Image sources",
            DELIVERABILITY,
            True,
            f"{len(inline)} of {len(urls)} images are inline — they're uploaded to storage on send",
        )
    return _check("Image sources", DELIVERABILITY, True, f"All {len(urls)} images on public https URLs")


# ── Adjudication ──────────────────────────────────────────────────────────


def run_checks(email: dict) -> list[dict]:
    """The full pre-flight, in display order. Pure — no writes — so callers
    can preview a verdict without recording one."""
    segment_id = email["segment_brief_id"]
    return [
        _consent_check(segment_id),
        _unsubscribe_check(email),
        _pii_check(email),
        _proxy_check(segment_id),
        _grounding_check(email),
        _merge_tag_check(email),
        _subject_check(email),
        _link_check(email),
        _image_check(email),
    ]


def verdict_for(checks: list[dict]) -> str:
    failed = [c for c in checks if not c["passed"]]
    if any(c["severity"] == BLOCK for c in failed):
        return "BLOCK"
    return "REVISE" if failed else "PASS"


def adjudicate(email: dict) -> GuardianVerdict:
    """Adjudicates a single email dict (as stored in segment_email) and writes
    its ledger entry. Exposed separately so the Approval Queue can re-check one
    edited email without re-running the whole graph."""
    checks = run_checks(email)
    verdict = verdict_for(checks)

    write_entry(
        LedgerEntry(
            campaign_id=WORKSPACE_ID,
            stage="Compliance Adjudication",
            agent="Pre-flight Guardian",
            prompt_version=GUARDIAN_VERSION,
            model_version="rule-engine",
            input_artifact_ids=[email["segment_brief_id"]],
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
