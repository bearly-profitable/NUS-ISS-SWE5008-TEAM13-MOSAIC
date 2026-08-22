"""
Generates a synthetic Mosaic customer base.

Mosaic is a (fictional) Singapore lifestyle retail membership brand. Every
row here is fabricated — no real customer records are used or referenced
anywhere in this codebase, which is also what keeps real PII from ever being
sent to a third-party LLM via OpenRouter.

Design note: customers are sampled from a mixture of behavioural archetypes
below, each with its own distribution — a real customer base has natural
density structure (that's *why* clustering finds anything), it isn't
uniformly random. The archetypes exist only to make the generator produce
data with genuine structure; the Segmentation agent's HDBSCAN clustering
still has to discover that structure from the raw features itself — no
archetype label is ever passed to it.

Protected attributes: `age`/`age_bracket` and `gender` are generated but
deliberately held out of every clustering feature (see segmentation.py's
PROTECTED_ATTRIBUTE_KEYS). They exist only so the Guardian's
protected-attribute proxy check has something real to test segment
membership against.
"""
from __future__ import annotations

import random
from dataclasses import dataclass

GENDERS = ["Female", "Male", "Non-binary", "Undisclosed"]  # held out, never clustered on
LOCATIONS = ["Central", "East", "West", "North", "North-East"]
LANGUAGES = ["English", "Mandarin", "Malay", "Tamil"]


def age_bracket_for(age: int) -> str:
    """Buckets a raw age for the proxy-correlation check, which compares
    categorical distributions rather than raw numbers."""
    if age < 25:
        return "18-24"
    if age < 35:
        return "25-34"
    if age < 45:
        return "35-44"
    if age < 55:
        return "45-54"
    if age < 65:
        return "55-64"
    return "65+"


@dataclass
class Archetype:
    name: str
    weight: float
    age_range: tuple[int, int]
    gender_weights: dict[str, float]
    location_weights: dict[str, float]
    language_weights: dict[str, float]
    tier_weights: dict[str, float]
    channel_weights: dict[str, float]
    p3m_spend_range: tuple[float, float]
    # p6m spend is derived as p3m * this factor, so the two stay coherent
    # (a customer can never have spent less over 6 months than over 3).
    p6m_multiplier_range: tuple[float, float]
    orders_p3m_range: tuple[int, int]
    days_since_last_order_range: tuple[int, int]
    tenure_months_range: tuple[int, int]
    email_open_rate_range: tuple[float, float]
    app_sessions_range: tuple[int, int]
    avg_discount_range: tuple[float, float]
    returns_rate_range: tuple[float, float]
    price_sensitivity_range: tuple[float, float]
    brand_loyalty_range: tuple[float, float]
    discovery_appetite_range: tuple[float, float]
    sustainability_affinity_range: tuple[float, float]
    newsletter_prob: float
    app_installed_prob: float
    free_text_pool: list[str]
    consent_withdrawn_prob: float = 0.03


ARCHETYPES = [
    Archetype(
        name="signature_regulars",
        weight=0.15,
        age_range=(34, 62),
        gender_weights={"Female": 0.55, "Male": 0.38, "Non-binary": 0.03, "Undisclosed": 0.04},
        location_weights={"Central": 0.45, "East": 0.2, "West": 0.15, "North": 0.1, "North-East": 0.1},
        language_weights={"English": 0.7, "Mandarin": 0.24, "Malay": 0.04, "Tamil": 0.02},
        tier_weights={"Signature": 0.8, "Insider": 0.2},
        channel_weights={"In-store": 0.4, "Web": 0.35, "App": 0.15, "Referral": 0.1},
        p3m_spend_range=(680, 2400),
        p6m_multiplier_range=(1.8, 2.3),
        orders_p3m_range=(5, 14),
        days_since_last_order_range=(2, 21),
        tenure_months_range=(24, 84),
        email_open_rate_range=(0.45, 0.8),
        app_sessions_range=(8, 26),
        avg_discount_range=(0, 6),
        returns_rate_range=(0.0, 0.08),
        price_sensitivity_range=(0.05, 0.3),
        brand_loyalty_range=(0.75, 1.0),
        discovery_appetite_range=(0.4, 0.75),
        sustainability_affinity_range=(0.4, 0.8),
        newsletter_prob=0.9,
        app_installed_prob=0.85,
        free_text_pool=[
            "Buys the seasonal collection every launch without waiting for a promotion.",
            "Asked to be notified first when the atelier line restocks.",
            "Long-standing member, prefers in-store styling appointments.",
            "Regularly buys full price and rarely returns anything.",
        ],
        consent_withdrawn_prob=0.01,
    ),
    Archetype(
        name="value_seekers",
        weight=0.18,
        age_range=(24, 55),
        gender_weights={"Female": 0.52, "Male": 0.4, "Non-binary": 0.03, "Undisclosed": 0.05},
        location_weights={"Central": 0.1, "East": 0.22, "West": 0.28, "North": 0.22, "North-East": 0.18},
        language_weights={"English": 0.5, "Mandarin": 0.3, "Malay": 0.14, "Tamil": 0.06},
        tier_weights={"Explorer": 0.7, "Insider": 0.3},
        channel_weights={"Web": 0.45, "App": 0.3, "Referral": 0.2, "In-store": 0.05},
        p3m_spend_range=(45, 260),
        p6m_multiplier_range=(1.9, 2.6),
        orders_p3m_range=(1, 5),
        days_since_last_order_range=(5, 60),
        tenure_months_range=(3, 40),
        email_open_rate_range=(0.5, 0.9),
        app_sessions_range=(3, 14),
        avg_discount_range=(18, 45),
        returns_rate_range=(0.05, 0.25),
        price_sensitivity_range=(0.7, 1.0),
        brand_loyalty_range=(0.05, 0.35),
        discovery_appetite_range=(0.2, 0.5),
        sustainability_affinity_range=(0.1, 0.4),
        newsletter_prob=0.85,
        app_installed_prob=0.6,
        free_text_pool=[
            "Only purchases during the mid-season sale window.",
            "Compares prices against other brands before every checkout.",
            "Asked whether the member discount stacks with promotional codes.",
            "Waits for markdowns rather than buying at full price.",
        ],
    ),
    Archetype(
        name="lapsing_members",
        weight=0.16,
        age_range=(28, 60),
        gender_weights={"Female": 0.5, "Male": 0.42, "Non-binary": 0.03, "Undisclosed": 0.05},
        location_weights={"Central": 0.18, "East": 0.22, "West": 0.2, "North": 0.2, "North-East": 0.2},
        language_weights={"English": 0.58, "Mandarin": 0.28, "Malay": 0.09, "Tamil": 0.05},
        tier_weights={"Explorer": 0.5, "Insider": 0.45, "Signature": 0.05},
        channel_weights={"Web": 0.4, "In-store": 0.25, "App": 0.2, "Referral": 0.15},
        p3m_spend_range=(0, 70),
        p6m_multiplier_range=(3.0, 7.0),
        orders_p3m_range=(0, 1),
        days_since_last_order_range=(95, 300),
        tenure_months_range=(14, 70),
        email_open_rate_range=(0.02, 0.2),
        app_sessions_range=(0, 3),
        avg_discount_range=(5, 22),
        returns_rate_range=(0.05, 0.3),
        price_sensitivity_range=(0.4, 0.8),
        brand_loyalty_range=(0.05, 0.3),
        discovery_appetite_range=(0.05, 0.3),
        sustainability_affinity_range=(0.15, 0.5),
        newsletter_prob=0.45,
        app_installed_prob=0.3,
        free_text_pool=[
            "Has not opened a campaign email in over four months.",
            "Was a frequent buyer last year, no orders this quarter.",
            "Raised a delivery complaint and has not returned since.",
            "Unsubscribed from push notifications but kept the account open.",
        ],
        consent_withdrawn_prob=0.11,
    ),
    Archetype(
        name="new_joiners",
        weight=0.15,
        age_range=(19, 34),
        gender_weights={"Female": 0.54, "Male": 0.36, "Non-binary": 0.05, "Undisclosed": 0.05},
        location_weights={"Central": 0.3, "East": 0.2, "West": 0.16, "North": 0.14, "North-East": 0.2},
        language_weights={"English": 0.72, "Mandarin": 0.2, "Malay": 0.05, "Tamil": 0.03},
        tier_weights={"Explorer": 0.95, "Insider": 0.05},
        channel_weights={"App": 0.4, "Referral": 0.3, "Web": 0.25, "In-store": 0.05},
        p3m_spend_range=(40, 300),
        p6m_multiplier_range=(1.0, 1.35),
        orders_p3m_range=(1, 3),
        days_since_last_order_range=(3, 45),
        tenure_months_range=(0, 5),
        email_open_rate_range=(0.35, 0.7),
        app_sessions_range=(4, 18),
        avg_discount_range=(5, 20),
        returns_rate_range=(0.05, 0.3),
        price_sensitivity_range=(0.35, 0.7),
        brand_loyalty_range=(0.1, 0.4),
        discovery_appetite_range=(0.55, 0.95),
        sustainability_affinity_range=(0.3, 0.75),
        newsletter_prob=0.8,
        app_installed_prob=0.8,
        free_text_pool=[
            "Joined through a friend's referral link last month.",
            "First order placed recently, still browsing other categories.",
            "Asked how membership tiers work and what unlocks the next one.",
            "Signed up in-app during the welcome offer.",
        ],
    ),
    Archetype(
        name="trend_discoverers",
        weight=0.13,
        age_range=(20, 38),
        gender_weights={"Female": 0.6, "Male": 0.31, "Non-binary": 0.05, "Undisclosed": 0.04},
        location_weights={"Central": 0.35, "East": 0.22, "West": 0.13, "North": 0.1, "North-East": 0.2},
        language_weights={"English": 0.75, "Mandarin": 0.18, "Malay": 0.05, "Tamil": 0.02},
        tier_weights={"Insider": 0.65, "Explorer": 0.3, "Signature": 0.05},
        channel_weights={"App": 0.55, "Web": 0.3, "Referral": 0.1, "In-store": 0.05},
        p3m_spend_range=(220, 780),
        p6m_multiplier_range=(1.6, 2.1),
        orders_p3m_range=(3, 9),
        days_since_last_order_range=(1, 18),
        tenure_months_range=(6, 36),
        email_open_rate_range=(0.4, 0.75),
        app_sessions_range=(18, 45),
        avg_discount_range=(5, 18),
        returns_rate_range=(0.15, 0.4),
        price_sensitivity_range=(0.25, 0.6),
        brand_loyalty_range=(0.3, 0.6),
        discovery_appetite_range=(0.8, 1.0),
        sustainability_affinity_range=(0.35, 0.8),
        newsletter_prob=0.75,
        app_installed_prob=0.95,
        free_text_pool=[
            "Browses new arrivals in the app several times a week.",
            "Buys across many categories, often returns part of the order.",
            "Asked about early access to the next collaboration drop.",
            "Follows the brand socially and reacts quickly to launches.",
        ],
    ),
    Archetype(
        name="gifting_occasionals",
        weight=0.12,
        age_range=(30, 65),
        gender_weights={"Female": 0.46, "Male": 0.46, "Non-binary": 0.03, "Undisclosed": 0.05},
        location_weights={"Central": 0.24, "East": 0.2, "West": 0.2, "North": 0.18, "North-East": 0.18},
        language_weights={"English": 0.6, "Mandarin": 0.27, "Malay": 0.08, "Tamil": 0.05},
        tier_weights={"Explorer": 0.55, "Insider": 0.4, "Signature": 0.05},
        channel_weights={"Web": 0.5, "In-store": 0.25, "App": 0.15, "Referral": 0.1},
        p3m_spend_range=(0, 120),
        p6m_multiplier_range=(2.5, 6.0),
        orders_p3m_range=(0, 2),
        days_since_last_order_range=(30, 150),
        tenure_months_range=(10, 60),
        email_open_rate_range=(0.15, 0.45),
        app_sessions_range=(0, 5),
        avg_discount_range=(0, 12),
        returns_rate_range=(0.0, 0.12),
        price_sensitivity_range=(0.2, 0.55),
        brand_loyalty_range=(0.25, 0.6),
        discovery_appetite_range=(0.1, 0.4),
        sustainability_affinity_range=(0.2, 0.6),
        newsletter_prob=0.6,
        app_installed_prob=0.35,
        free_text_pool=[
            "Orders mainly around festive periods, usually as gifts.",
            "Asked about gift wrapping and delivery to a second address.",
            "Buys a few high-value items a year rather than browsing regularly.",
            "Requested a gift receipt with the last order.",
        ],
    ),
    Archetype(
        name="eco_conscious",
        weight=0.11,
        age_range=(25, 50),
        gender_weights={"Female": 0.58, "Male": 0.33, "Non-binary": 0.05, "Undisclosed": 0.04},
        location_weights={"Central": 0.28, "East": 0.24, "West": 0.16, "North": 0.12, "North-East": 0.2},
        language_weights={"English": 0.78, "Mandarin": 0.15, "Malay": 0.05, "Tamil": 0.02},
        tier_weights={"Insider": 0.55, "Explorer": 0.35, "Signature": 0.1},
        channel_weights={"Web": 0.45, "App": 0.3, "Referral": 0.2, "In-store": 0.05},
        p3m_spend_range=(180, 620),
        p6m_multiplier_range=(1.7, 2.2),
        orders_p3m_range=(2, 6),
        days_since_last_order_range=(4, 40),
        tenure_months_range=(8, 48),
        email_open_rate_range=(0.4, 0.75),
        app_sessions_range=(4, 16),
        avg_discount_range=(2, 14),
        returns_rate_range=(0.02, 0.12),
        price_sensitivity_range=(0.2, 0.55),
        brand_loyalty_range=(0.5, 0.85),
        discovery_appetite_range=(0.35, 0.7),
        sustainability_affinity_range=(0.8, 1.0),
        newsletter_prob=0.88,
        app_installed_prob=0.65,
        free_text_pool=[
            "Asks about material sourcing and repair options before buying.",
            "Chose the slower carbon-neutral delivery option on every order.",
            "Interested in the take-back and resale programme.",
            "Prefers durable staples over seasonal pieces.",
        ],
    ),
]


def _weighted_choice(rng: random.Random, weights: dict) -> object:
    keys = list(weights.keys())
    probs = list(weights.values())
    return rng.choices(keys, weights=probs, k=1)[0]


def _rand_round(rng: random.Random, lo: float, hi: float, ndigits: int = 2) -> float:
    return round(rng.uniform(lo, hi), ndigits)


@dataclass
class SyntheticCustomer:
    id: str
    campaign_id: str
    structured_attrs: dict
    behavioural: dict
    psychographic: dict
    free_text: str
    consent_state: str


def generate_customer(base_id: str, campaign_id: str, rng: random.Random, archetype: Archetype) -> SyntheticCustomer:
    age = rng.randint(*archetype.age_range)
    gender = _weighted_choice(rng, archetype.gender_weights)
    location = _weighted_choice(rng, archetype.location_weights)
    language = _weighted_choice(rng, archetype.language_weights)
    tier = _weighted_choice(rng, archetype.tier_weights)
    channel = _weighted_choice(rng, archetype.channel_weights)

    p3m_spend = _rand_round(rng, *archetype.p3m_spend_range)
    p6m_spend = round(p3m_spend * rng.uniform(*archetype.p6m_multiplier_range), 2)
    orders_p3m = rng.randint(*archetype.orders_p3m_range)
    # Orders over 6 months scale roughly with spend, with a little noise.
    orders_p6m = max(orders_p3m, int(round(orders_p3m * rng.uniform(1.6, 2.4))))
    avg_basket = round(p6m_spend / orders_p6m, 2) if orders_p6m else 0.0

    return SyntheticCustomer(
        id=f"{campaign_id}:{base_id}" if campaign_id else base_id,
        campaign_id=campaign_id,
        structured_attrs={
            # Held out — never included in clustering features (see
            # segmentation.py's PROTECTED_ATTRIBUTE_KEYS). Read back only by
            # the Guardian's proxy-correlation check.
            "age": age,
            "age_bracket": age_bracket_for(age),
            "gender": gender,
            # Clustered on:
            "location": location,
            "language": language,
            "membership_tier": tier,
            "signup_channel": channel,
            "tenure_months": rng.randint(*archetype.tenure_months_range),
            "newsletter_opt_in": rng.random() < archetype.newsletter_prob,
            "app_installed": rng.random() < archetype.app_installed_prob,
        },
        behavioural={
            "p3m_spend_sgd": p3m_spend,
            "p6m_spend_sgd": p6m_spend,
            "orders_p3m": orders_p3m,
            "orders_p6m": orders_p6m,
            "avg_basket_sgd": avg_basket,
            "days_since_last_order": rng.randint(*archetype.days_since_last_order_range),
            "email_open_rate": _rand_round(rng, *archetype.email_open_rate_range),
            "app_sessions_per_month": rng.randint(*archetype.app_sessions_range),
            "avg_discount_pct": _rand_round(rng, *archetype.avg_discount_range, ndigits=1),
            "returns_rate": _rand_round(rng, *archetype.returns_rate_range),
        },
        psychographic={
            "price_sensitivity": _rand_round(rng, *archetype.price_sensitivity_range),
            "brand_loyalty": _rand_round(rng, *archetype.brand_loyalty_range),
            "discovery_appetite": _rand_round(rng, *archetype.discovery_appetite_range),
            "sustainability_affinity": _rand_round(rng, *archetype.sustainability_affinity_range),
        },
        free_text=(
            rng.choice(archetype.free_text_pool)
            + (" " + rng.choice(archetype.free_text_pool) if rng.random() < 0.25 else "")
        ),
        consent_state="withdrawn" if rng.random() < archetype.consent_withdrawn_prob else "active",
    )


def generate_customers(campaign_id: str, count: int = 1000, seed: int = 42) -> list[SyntheticCustomer]:
    """Deterministic — same seed + count always produces the same base.
    Kept for scripts/tests; the app seeds from the fixed CSV export of this
    (see load_base_csv / backend/data/mosaic_customers.csv) rather than
    calling this live, so the base stays stable between runs."""
    rng = random.Random(seed)
    archetype_names = [a.name for a in ARCHETYPES]
    archetype_weights = [a.weight for a in ARCHETYPES]
    by_name = {a.name: a for a in ARCHETYPES}

    assignments = rng.choices(archetype_names, weights=archetype_weights, k=count)
    return [
        generate_customer(f"mosaic-cust-{i:05d}", campaign_id, rng, by_name[name])
        for i, name in enumerate(assignments)
    ]


# ─────────────────────────────────────────────────────────────
# CSV export/import — the stable, inspectable base file
# ─────────────────────────────────────────────────────────────

_STRUCTURED_INT = ["age", "tenure_months"]
_STRUCTURED_STR = ["age_bracket", "gender", "location", "language", "membership_tier", "signup_channel"]
_STRUCTURED_BOOL = ["newsletter_opt_in", "app_installed"]

_BEHAVIOURAL_FLOAT = ["p3m_spend_sgd", "p6m_spend_sgd", "avg_basket_sgd", "email_open_rate", "avg_discount_pct", "returns_rate"]
_BEHAVIOURAL_INT = ["orders_p3m", "orders_p6m", "days_since_last_order", "app_sessions_per_month"]

_PSYCHOGRAPHIC_FLOAT = ["price_sensitivity", "brand_loyalty", "discovery_appetite", "sustainability_affinity"]

_CSV_FIELDS = (
    ["base_id"]
    + _STRUCTURED_INT
    + _STRUCTURED_STR
    + _STRUCTURED_BOOL
    + _BEHAVIOURAL_FLOAT
    + _BEHAVIOURAL_INT
    + _PSYCHOGRAPHIC_FLOAT
    + ["free_text", "consent_state"]
)


def export_base_csv(path: str, count: int = 1000, seed: int = 42) -> int:
    """Generates the base once and writes it to a flat CSV — the single
    source of truth for what "the Mosaic customer base" is. Run this again
    only if you deliberately want to regenerate the base."""
    import csv

    customers = generate_customers(campaign_id="", count=count, seed=seed)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=_CSV_FIELDS)
        writer.writeheader()
        for c in customers:
            writer.writerow(
                {
                    "base_id": c.id,
                    **c.structured_attrs,
                    **c.behavioural,
                    **c.psychographic,
                    "free_text": c.free_text,
                    "consent_state": c.consent_state,
                }
            )
    return len(customers)


def load_base_csv(path: str, campaign_id: str, limit: int | None = None) -> list[SyntheticCustomer]:
    """Loads the fixed base CSV and attaches it to a workspace id — this is
    what POST /api/audience/load calls. No random generation happens here."""
    import csv

    def _bool(v: str) -> bool:
        return v.strip().lower() in ("true", "1", "yes")

    customers = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if limit is not None and i >= limit:
                break
            customers.append(
                SyntheticCustomer(
                    id=f"{campaign_id}:{row['base_id']}",
                    campaign_id=campaign_id,
                    structured_attrs={
                        **{k: int(row[k]) for k in _STRUCTURED_INT},
                        **{k: row[k] for k in _STRUCTURED_STR},
                        **{k: _bool(row[k]) for k in _STRUCTURED_BOOL},
                    },
                    behavioural={
                        **{k: float(row[k]) for k in _BEHAVIOURAL_FLOAT},
                        **{k: int(row[k]) for k in _BEHAVIOURAL_INT},
                    },
                    psychographic={k: float(row[k]) for k in _PSYCHOGRAPHIC_FLOAT},
                    free_text=row["free_text"],
                    consent_state=row["consent_state"],
                )
            )
    return customers
