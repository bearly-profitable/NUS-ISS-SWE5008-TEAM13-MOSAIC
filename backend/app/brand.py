"""
The company's own identity, as every agent sees it.

Step 1 (Company Info) collects who the company is, what it does and what this
campaign is for. Nothing downstream hardcodes a brand any more, so this module
is the single place that turns the stored profile into the strings the agents
and the composed email actually use.
"""
from __future__ import annotations

import re

from app.persistence import get_company_profile

FALLBACK_NAME = "the company"


def brand_name() -> str:
    return (get_company_profile().get("name") or "").strip() or FALLBACK_NAME


def normalise_website(website: str) -> str:
    """Accepts what people actually type — `acme.com`, `www.acme.com`,
    `https://acme.com/` — and returns a usable absolute URL, or "" if there
    is nothing to work with."""
    value = (website or "").strip()
    if not value:
        return ""
    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"
    return value.rstrip("/")


def website_label(website: str) -> str:
    """The bare domain, for link text in the email footer."""
    url = normalise_website(website)
    if not url:
        return ""
    return url.split("://", 1)[1].split("/", 1)[0]


def website_url() -> str:
    """The company's own site as an absolute URL, or "" if none was given."""
    return normalise_website(get_company_profile().get("website", ""))


def context_block(include_intent: bool = True) -> str:
    """The shared preamble every agent prompt opens with, so segment names,
    creative direction and copy all describe the same company."""
    profile = get_company_profile()
    name = (profile.get("name") or "").strip() or FALLBACK_NAME
    lines = [f"Company: {name}"]

    description = (profile.get("description") or "").strip()
    if description:
        lines.append(f"What they do: {description}")

    site = website_label(profile.get("website", ""))
    if site:
        lines.append(f"Website: {site}")

    if include_intent:
        intent = (profile.get("campaign_intent") or "").strip()
        if intent:
            lines.append(f"Campaign intent: {intent}")

    return "\n".join(lines)


def social_links() -> dict:
    """Social icons all point at the company's own site.

    The app never learns a company's real social handles, and inventing
    plausible-looking ones would put dead — or worse, someone else's — links
    into a sent email. When no website is set the block is dropped entirely
    (see email_composer.py).
    """
    url = normalise_website(get_company_profile().get("website", ""))
    if not url:
        return {}
    return {key: url for key in ("facebook", "twitter", "instagram", "linkedin", "youtube")}


def footer_links() -> dict:
    """Footer link set built from the company's own website."""
    profile = get_company_profile()
    url = normalise_website(profile.get("website", ""))
    if not url:
        return {}
    return {
        "link1Label": website_label(profile.get("website", "")),
        "link1Url": url,
        "link2Label": "Contact us",
        "link2Url": f"{url}/contact",
        "link3Label": "Unsubscribe",
        "link3Url": f"{url}/preferences",
    }


def merge_tag() -> str:
    """The personalisation placeholder, e.g. `{{first_name}}`, or "" when the
    operator has not nominated a dynamic attribute."""
    attribute = (get_company_profile().get("dynamic_attribute") or "").strip()
    return f"{{{{{attribute}}}}}" if attribute else ""


# Both dialects the app can emit: `{{first_name}}` from the composer above and
# `%%first_name%%` from the email builder's HTML export.
_MERGE_TAG_RE = re.compile(r"\{\{\s*([\w.-]+)\s*\}\}|%%\s*([\w.-]+)\s*%%")

# What an unfillable tag becomes. A greeting reading "Hi ," is worse than one
# reading "Hi there," so the fallback is a word, not an empty string.
FALLBACK_VALUE = "there"


def fill_merge_tags(text: str, contact: dict | None) -> str:
    """Substitutes personalisation tags from a real customer_profile row.

    The uploaded CSV's columns are split across `structured_attrs` (categorical
    and identifier columns) and `behavioural` (numeric ones), so both are
    consulted. Anything the contact has no value for falls back rather than
    reaching the recipient as literal braces — the Guardian's merge-tag check
    is what stops an unfillable tag from getting this far in the first place.
    """
    if not text:
        return text
    attrs = {**(contact or {}).get("behavioural", {}), **(contact or {}).get("structured_attrs", {})}

    def replace(match: re.Match) -> str:
        key = match.group(1) or match.group(2)
        value = attrs.get(key)
        if value is None or str(value).strip() == "":
            return FALLBACK_VALUE
        # Numerics arrive as floats; a whole number should read "3", not "3.0".
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)

    return _MERGE_TAG_RE.sub(replace, text)
