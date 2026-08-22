"""
Arbitrary customer-CSV ingestion.

The audience is no longer a fixed synthetic base — the operator uploads
whatever CSV their own customer list happens to be, so nothing downstream may
assume a column name. This module is the single place that turns a raw CSV
into customer_profile rows, and it does that by *profiling* the columns
rather than mapping known ones:

  numeric      → clusterable feature            (behavioural jsonb)
  categorical  → clusterable feature, one-hot   (structured jsonb)
  text         → embedded free text             (free_text column)
  identifier   → kept for display, never clustered on
  constant     → carries no signal, ignored by the feature matrix

Two kinds are special-cased by column *name*, because getting them wrong has
consequences beyond a weaker clustering:

  protected    → age / gender / race / religion / … Held out of every feature
                 matrix and only read back by the Guardian's proxy-correlation
                 check (see segmentation.py).
  consent      → marketing permission. Drives consent_state, which the
                 Guardian treats as a hard BLOCK when a segment is mostly
                 withdrawn.

The resulting column profile is persisted on the company profile so the
Company Info tab can render the real column names and the operator can pick
which one is the personalisation attribute.
"""
from __future__ import annotations

import csv
import io
import re
from typing import Iterable

# Ceiling on a single upload. Well past any demo-sized list, and low enough
# that a mis-picked file can't sit there inserting for ten minutes.
MAX_ROWS = 20_000

# Column kinds. Only `numeric` and `categorical` ever enter a feature matrix.
NUMERIC = "numeric"
CATEGORICAL = "categorical"
TEXT = "text"
IDENTIFIER = "identifier"
CONSTANT = "constant"

# Matched as whole underscore/space-separated tokens. "age" cannot be a
# substring test — it fires on "average_basket" and "package_tier".
_PROTECTED_TOKENS = {
    "age", "sex", "dob", "gender", "race", "ethnicity", "religion",
    "nationality", "disability", "pregnancy", "married", "widowed",
}
_PROTECTED_SUBSTRINGS = (
    "gender", "ethnic", "religio", "national", "marital", "disabilit",
    "pregnan", "orientation", "date_of_birth", "birthdate", "birth_date",
    "age_bracket", "age_group", "age_range", "age_band",
)

# Ordered by how unambiguously the column means "may we market to them".
# The first match wins when a CSV carries several permission-ish columns
# (a `consent_state` and a `newsletter_opt_in`, say).
_CONSENT_PATTERNS = (
    "consent", "do_not_contact", "unsubscrib", "suppress", "opt_out",
    "optout", "opted_out", "marketing_permission", "email_permission",
    "opt_in", "optin", "subscribed",
)

# Truthy strings that mean "yes, this flag is set".
_TRUE_VALUES = {"true", "1", "yes", "y", "t", "active", "subscribed", "opted_in", "opted in"}
_WITHDRAWN_VALUES = {"withdrawn", "unsubscribed", "opted_out", "opted out", "revoked", "suppressed"}

_IDENTIFIER_TOKENS = {"id", "uuid", "guid", "key", "ref", "email", "phone", "mobile", "msisdn"}
_IDENTIFIER_SUBSTRINGS = ("email", "phone", "mobile", "customer_no", "account_no", "_id", "id_")

# Currency symbols, thousands separators and trailing units all show up in
# real exports; none of them mean "not a number".
_NUMBER_CLEAN_RE = re.compile(r"[,\s$£€¥%]|sgd|usd|myr", re.IGNORECASE)


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (name or "").strip().lower()).strip("_")


def _tokens(name: str) -> set[str]:
    return {t for t in _norm(name).split("_") if t}


def _matches(name: str, tokens: set[str], substrings: Iterable[str]) -> bool:
    normalised = _norm(name)
    return bool(_tokens(name) & tokens) or any(s in normalised for s in substrings)


def is_protected(name: str) -> bool:
    return _matches(name, _PROTECTED_TOKENS, _PROTECTED_SUBSTRINGS)


def _is_identifier_name(name: str) -> bool:
    return _matches(name, _IDENTIFIER_TOKENS, _IDENTIFIER_SUBSTRINGS)


def _consent_rank(name: str) -> int | None:
    normalised = _norm(name)
    for rank, pattern in enumerate(_CONSENT_PATTERNS):
        if pattern in normalised:
            return rank
    return None


def to_float(value: str) -> float | None:
    """Parses a CSV cell as a number, tolerating the formatting real exports
    carry (currency prefixes, thousands separators, a trailing %)."""
    if value is None:
        return None
    cleaned = _NUMBER_CLEAN_RE.sub("", str(value)).strip()
    if not cleaned or cleaned in ("-", "."):
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _to_bool(value: str) -> bool:
    return str(value).strip().lower() in _TRUE_VALUES


# ── Parsing ───────────────────────────────────────────────────────────────


def parse_csv(raw: bytes) -> tuple[list[str], list[dict[str, str]]]:
    """Decodes and parses an uploaded CSV into (columns, rows).

    Exports from Excel are routinely cp1252 or UTF-8-with-BOM rather than
    clean UTF-8, so decoding falls back rather than 500-ing on one stray byte.
    """
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:  # pragma: no cover — latin-1 decodes any byte string
        raise ValueError("Could not decode the file as text. Save it as UTF-8 CSV and retry.")

    # Sniff the delimiter: semicolon-separated exports are common outside the
    # US/UK and would otherwise parse as a single giant column.
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    except csv.Error:
        reader = csv.DictReader(io.StringIO(text))

    columns = [c.strip() for c in (reader.fieldnames or []) if c and c.strip()]
    if not columns:
        raise ValueError("That CSV has no header row — the first line must name the columns.")

    rows: list[dict[str, str]] = []
    for row in reader:
        if len(rows) >= MAX_ROWS:
            break
        # DictReader keys are the *unstripped* header names; normalise both
        # keys and values so a ' Name ' header doesn't become its own column.
        cleaned = {c: str(row.get(c) if row.get(c) is not None else "").strip() for c in columns}
        if any(cleaned.values()):
            rows.append(cleaned)

    if not rows:
        raise ValueError("That CSV has a header but no data rows.")
    return columns, rows


# ── Profiling ─────────────────────────────────────────────────────────────


def _category_limit(total: int) -> int:
    """How many distinct values a column may hold and still be a category.

    Scales with the file but stays bounded at both ends: a 40-row sample
    still gets a usable floor, and a 50,000-row file doesn't turn a
    2,000-value column into 2,000 one-hot dimensions.
    """
    return min(25, max(12, int(total * 0.05)))


def profile_columns(columns: list[str], rows: list[dict[str, str]]) -> list[dict]:
    """Classifies every column. Returns one dict per column:
    {name, kind, protected, distinct, sample}."""
    total = len(rows)
    profile: list[dict] = []

    for column in columns:
        values = [r.get(column, "") for r in rows]
        non_empty = [v for v in values if v != ""]
        distinct = len({v for v in non_empty})
        numeric_hits = sum(1 for v in non_empty if to_float(v) is not None)
        numeric_ratio = numeric_hits / len(non_empty) if non_empty else 0.0
        avg_len = sum(len(v) for v in non_empty) / len(non_empty) if non_empty else 0.0

        if not non_empty or distinct <= 1:
            kind = CONSTANT
        elif numeric_ratio >= 0.9:
            # An all-distinct integer column called something id-ish is a row
            # key, not a measurement — clustering on it is pure noise.
            kind = IDENTIFIER if (distinct == len(non_empty) and _is_identifier_name(column)) else NUMERIC
        elif _is_identifier_name(column) and distinct / len(non_empty) > 0.8:
            # Checked ahead of the prose test: a row key like `mosaic-cust-00042`
            # is long and all-distinct, which otherwise reads as free text and
            # would be embedded as if it meant something.
            kind = IDENTIFIER
        elif avg_len > 40 or (avg_len > 15 and distinct / len(non_empty) > 0.8):
            kind = TEXT
        elif distinct <= _category_limit(total) and distinct < len(non_empty):
            # A repeated small vocabulary — plan, city, tier. `distinct <
            # len` is what separates it from a per-row label: a 4-row sample
            # where every value differs is a name column, not a category.
            kind = CATEGORICAL
        else:
            # High-cardinality short strings — names, postcodes, SKUs. Not a
            # useful one-hot, not really prose either.
            kind = IDENTIFIER

        profile.append(
            {
                "name": column,
                "kind": kind,
                "protected": is_protected(column),
                "distinct": distinct,
                "sample": non_empty[0] if non_empty else "",
            }
        )

    return profile


def consent_column(columns: list[str]) -> str | None:
    """The one column that decides marketing permission, or None."""
    ranked = [(rank, c) for c in columns if (rank := _consent_rank(c)) is not None]
    if not ranked:
        return None
    return min(ranked)[1]


def _consent_state(column: str, value: str) -> str:
    """Maps a permission cell onto active | withdrawn.

    The polarity is carried by the column *name*: `opt_out` true means
    withdrawn, `opt_in` true means active. Getting this backwards would
    silently invert the Guardian's consent gate, so it is explicit.
    """
    lowered = str(value).strip().lower()
    if lowered in _WITHDRAWN_VALUES:
        return "withdrawn"
    if lowered in ("active", "granted"):
        return "active"

    normalised = _norm(column)
    negative = any(p in normalised for p in ("opt_out", "optout", "opted_out", "unsubscrib", "do_not_contact", "suppress"))
    flag = _to_bool(value)
    if negative:
        return "withdrawn" if flag else "active"
    # Positive-polarity column (consent / opt_in / subscribed): an explicitly
    # false value is a withdrawal; anything unrecognised stays active rather
    # than silently suppressing a contact.
    if lowered in ("false", "0", "no", "n", "f"):
        return "withdrawn"
    return "active" if flag or lowered not in ("", "none", "null") else "active"


# ── Row building ──────────────────────────────────────────────────────────


def build_customer_rows(
    rows: list[dict[str, str]],
    profile: list[dict],
    campaign_id: str,
) -> list[dict]:
    """Turns profiled CSV rows into customer_profile inserts.

    Every original cell survives somewhere — numerics in `behavioural`,
    everything else in `structured_attrs`, prose concatenated into
    `free_text` — so the Company Info preview can show the file the operator
    actually uploaded rather than a lossy projection of it.
    """
    by_kind = {k: [c["name"] for c in profile if c["kind"] == k] for k in (NUMERIC, CATEGORICAL, TEXT, IDENTIFIER, CONSTANT)}
    consent = consent_column([c["name"] for c in profile])

    # Prefer a unique identifier column for the row id so re-uploading the
    # same file keeps stable ids; otherwise fall back to the row ordinal.
    key_column = next(
        (
            c["name"]
            for c in profile
            if c["kind"] == IDENTIFIER and c["distinct"] == len(rows) and _is_identifier_name(c["name"])
        ),
        None,
    )

    built: list[dict] = []
    for index, row in enumerate(rows):
        raw_key = row.get(key_column, "") if key_column else ""
        base_id = _norm(raw_key) or f"row-{index:06d}"

        structured = {}
        for column in by_kind[CATEGORICAL] + by_kind[IDENTIFIER] + by_kind[CONSTANT]:
            value = row.get(column, "")
            if value != "":
                structured[column] = value

        behavioural = {}
        for column in by_kind[NUMERIC]:
            value = to_float(row.get(column, ""))
            if value is not None:
                behavioural[column] = value

        free_text = " ".join(row.get(c, "") for c in by_kind[TEXT] if row.get(c)).strip()

        built.append(
            {
                "id": f"{campaign_id}:{base_id}-{index:06d}",
                "campaign_id": campaign_id,
                "structured_attrs": structured,
                "behavioural": behavioural,
                "psychographic": {},
                "free_text": free_text,
                "consent_state": _consent_state(consent, row.get(consent, "")) if consent else "active",
            }
        )

    return built
