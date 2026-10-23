"""
Rebuilds the FatCatPillow demo run (the one in docs/media/console/) as the
JSON the Orchestrator would serve, so capture.mjs can drive the real Console
without a live Supabase project.

Everything structural comes from the backend's own code, not hand-written
copies of it: email blocks from email_composer._build_blocks, backgrounds from
_background_for, CSV column profiles from csv_ingest, every Guardian check from
guardian.run_checks, the eval rubric from eval.rubric. Only the run's *outputs*
(segment names/sizes/traits, the copy, scores) are restated — taken from the
screenshots of that run.

    cd backend && .venv/Scripts/python.exe ../video/capture/build_fixture.py
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app import brand, csv_ingest, persistence  # noqa: E402
from app.eval import rubric  # noqa: E402
from app.orchestrator.agents import creative_direction, email_composer, guardian  # noqa: E402

random.seed(13)
OUT = Path(__file__).resolve().parent / "fixture"
OUT.mkdir(exist_ok=True)

ASSET_HOST = "https://mvtpknmrwrhjowocutjv.supabase.co/storage/v1/object/public/email-images"
LOGO = f"{ASSET_HOST}/email-asset-b78febe59c86.png"
HERO = f"{ASSET_HOST}/email-asset-13648166940a.png"
HERO_PINK = f"{ASSET_HOST}/email-asset-5d21c0a7e913.png"

# ── Audience ──────────────────────────────────────────────────────────────
raw = (ROOT / "backend/data/mosaic_customers.csv").read_bytes()
columns, rows = csv_ingest.parse_csv(raw)
profile_cols = csv_ingest.profile_columns(columns, rows)

COMPANY = {
    "name": "FatCatPillow",
    "website": "FCP.com.sg",
    "description": "Sells fat cat pillows",
    "campaign_intent": "Sell fat cat pillows to users that like fat cats",
    "dynamic_attribute": "name",
    "logo_url": LOGO,
    "hero_image_url": HERO,
    "columns": profile_cols,
    "csv_filename": "mosaic_customers.csv",
    "csv_row_count": len(rows),
    "uploaded_at": "2026-09-12T02:14:07+00:00",
}
OFFERS = [
    {"id": "OFFER-02ad920e", "name": "Early Bird", "terms": "Pay 80% of the regular price on any fat cat pillow ordered before launch day."},
    {"id": "OFFER-7c41be09", "name": "Gift Wrap", "terms": "Free gift wrapping and a handwritten card on any order."},
]
PALETTE = {"primary": "#C2703D", "accent": "#C2703D", "background": "#FFF8F0", "text": "#1f2937"}

# ── Segments (names, sizes, traits as discovered in the run) ─────────────
SEGMENTS = [
    ("seg-lapsed", "Lapsed Complaint Customers", 141, 0.91,
     "They need their delivery issue resolved before considering another fat cat pillow.",
     "Acknowledge the complaint; offer a clear fix.",
     [("days_since_last_order", 2.10), ("email_open_rate", -1.76), ("discovery_appetite", -1.21), ("orders_p3m", -0.97)]),
    ("seg-loyal", "Loyal Full-Price Buyers", 134, 0.93,
     "They buy every new fat cat pillow release at full price and want first access.",
     "Lead with launches, restocks, and loyalty rewards.",
     [("p6m_spend_sgd", 2.25), ("p3m_spend_sgd", 2.23), ("brand_loyalty", 1.84), ("orders_p3m", 1.81)]),
    ("seg-app", "App-First Drop Explorers", 134, 0.93,
     "They want early access to new fat cat pillow drops and enjoy exploring the range.",
     "Lead with app launches and early access.",
     [("app_sessions_per_month", 1.93), ("discovery_appetite", 1.55), ("returns_rate", 1.41), ("orders_p6m", 0.71)]),
    ("seg-gift", "Seasonal Gift Buyers", 121, 0.93,
     "They buy fat cat pillows as occasional gifts during festive periods.",
     "Lead with gifting, wrapping, and delivery options.",
     [("discovery_appetite", -0.98), ("email_open_rate", -0.88), ("app_sessions_per_month", -0.87), ("returns_rate", -0.85)]),
    ("seg-conscious", "Conscious Cat Keepers", 114, 0.93,
     "They buy durable fat cat pillows from brands that offer take-back programs and lower-impact delivery.",
     "Lead with durability and circular delivery choices",
     [("sustainability_affinity", 1.89), ("brand_loyalty", 1.03), ("returns_rate", -0.71), ("avg_discount_pct", -0.57)]),
    ("seg-discount", "Discount-Driven Cat Shoppers", 100, 0.95,
     "They want fat cat pillows at the lowest possible price and watch for discounts before buying.",
     "Lead with savings and clear price comparisons.",
     [("avg_discount_pct", 1.66), ("price_sensitivity", 1.52), ("sustainability_affinity", -1.06), ("email_open_rate", 0.98)]),
]
segments = [
    {
        "id": sid, "name": name, "motivation": motivation, "tone_guidance": tone, "size": size,
        "confidence": conf,
        "rationale": f"HDBSCAN cluster of {size} contacts; named from its four most distinctive engineered features.",
        "feature_contributions": [{"feature": f, "weight": w} for f, w in traits],
    }
    for sid, name, size, conf, motivation, tone, traits in SEGMENTS
]
proxy_checks = [
    {"segment_brief_id": s["id"], "protected_attribute": "age",
     "correlation": 0.37 if s["id"] == "seg-loyal" else round(random.uniform(0.04, 0.18), 2),
     "flagged": s["id"] == "seg-loyal"}
    for s in segments
]

# ── Creative directions ───────────────────────────────────────────────────
DIRECTIONS = {
    "seg-lapsed": ("Calm, accountable, resolution-first", "Plain, short sentences; own the problem",
                   "Low-pressure: see the fix first", "Soft, rounded, generous whitespace", "#8A4B2A",
                   "Lead with acknowledgment, then present resolution before inviting a new pillow purchase."),
    "seg-loyal": ("Warm, insider, release-focused", "Confident, concise, first-person plural",
                  "Exclusive first look, one tap", "Rounded cards, product-forward hero", "#9A4E26",
                  "Dark terracotta improves button contrast while preserving the warm palette."),
    "seg-app": ("Curious, playful, discovery-led", "Snappy fragments, app-native phrasing",
                "Open the app to explore", "Playful, rounded, bold product imagery", "#C2703D",
                "Brand terracotta kept as-is; playful radius matches the app's own UI."),
    "seg-gift": ("Thoughtful, festive, reassuring", "Warm and descriptive, gift-giver's view",
                 "Pick a gift, we'll wrap it", "Soft rounded panels, cosy seasonal warmth", "#B5653A",
                 "Gifting cues lead; delivery reassurance sits beside the CTA."),
    "seg-conscious": ("Grounded, honest, quietly proud", "Factual, specific, no greenwashing",
                      "Built to last — see how", "Calm, rounded, natural light imagery", "#7E6A3A",
                      "Earthier accent signals durability without a green-washed palette."),
    "seg-discount": ("Direct, value-first, transparent", "Numbers up front, short declaratives",
                     "Claim the Early Bird price", "Clean rounded blocks, price clearly visible", "#C2703D",
                     "Offer terms visible without scrolling; no countdown or scarcity framing."),
}
directions = []
for sid, (tone, lang, cta, design, accent, why) in DIRECTIONS.items():
    directions.append({
        "segment_brief_id": sid, "tonality": tone, "language_style": lang, "cta_style": cta,
        "design_style": design, "palette": {**PALETTE, "accent": accent}, "logo_url": LOGO,
        "hero_image_url": HERO_PINK if sid == "seg-app" else HERO,
        "rationale": why, "model_version": "openai/gpt-5.6-luna",
    })

# ── Emails: copy from the run, layout from the composer ──────────────────
COPY = {
    "seg-discount": ("Save 20% On Fat Cat Pillows", "Pay 80% of regular price with Early Bird savings.",
                     "The same pillow, for less",
                     "Early Bird pricing takes 20% off every fat cat pillow. The offer terms are below, in full.",
                     [("Clear savings", "Pay 80% of the regular price at checkout."), ("Same quality", "Identical pillows, stitched and stuffed the same way."), ("No catches", "One price, shown upfront, before you pay.")],
                     "Claim Early Bird", "OFFER-02ad920e"),
    "seg-app": ("Explore New Fat Cat Drops", "Enter the app for early access and explore the range.",
                "New drops land in the app first",
                "The newest fat cat pillows appear in the app before anywhere else. Browse the full range and save favourites.",
                [("First access", "New drops open in the app before the site."), ("Full range", "Every shape, size and colourway in one place."), ("Early Bird", "Pay 80% of the regular price on launch orders.")],
                "Open the app", "OFFER-02ad920e"),
    "seg-loyal": ("First Look: Latest Fat Cat Pillow", "Your insider preview of the newest fat cat pillow release.",
                  "Meet the newest fat cat",
                  "You have been with us since the first pillow. Here is the next one, before it reaches the shop.",
                  [("Insider preview", "See the new release before anyone else."), ("Restock alerts", "Know first when favourites come back."), ("Early Bird", "Pay 80% of the regular price before launch.")],
                  "Get first look", "OFFER-02ad920e"),
    "seg-gift": ("A Thoughtful Fat Cat Gift", "Thoughtful gifting starts with a fat cat pillow.",
                 "A gift that gets hugged",
                 "A fat cat pillow is the gift people actually keep on the sofa. We wrap it and add a card.",
                 [("Free wrapping", "Every order can arrive gift-wrapped with a card."), ("Easy delivery", "Send it straight to the person it's for."), ("Early Bird", "Pay 80% of the regular price before launch.")],
                 "Choose a gift", "OFFER-02ad920e"),
    "seg-conscious": ("A Fat Cat Pillow Built to Last", "Durable stitching, take-back at end of life.",
                      "Made to be kept",
                      "Every fat cat pillow is double-stitched to last for years. When it's done, we take it back.",
                      [("Built to last", "Double-stitched seams and a washable cover."), ("Take-back", "Return worn pillows; we recycle the fill."), ("Early Bird", "Pay 80% of the regular price before launch.")],
                      "See how it's made", "OFFER-02ad920e"),
    "seg-lapsed": ("Let's Resolve Your Delivery Issue", "We're sorting your last order first.",
                   "Your last order, sorted",
                   "Your last delivery didn't go the way it should have. Here's what we've fixed, and how to reach us.",
                   [("What happened", "We traced the delay on your last order."), ("What we fixed", "Tracked delivery is now standard on every order."), ("Early Bird", "Pay 80% of the regular price if you order again.")],
                   "See the fix", "OFFER-02ad920e"),
}

# Point the composer and Guardian at this workspace instead of Supabase.
seg_size = {s["id"]: s["size"] for s in segments}
withdrawn = {"seg-lapsed": 9, "seg-loyal": 3, "seg-app": 4, "seg-gift": 6, "seg-conscious": 2, "seg-discount": 5}
for mod in (persistence, brand, creative_direction, guardian, email_composer):
    if hasattr(mod, "get_company_profile"):
        mod.get_company_profile = lambda: COMPANY
guardian.fetch_offers = lambda: OFFERS
guardian.fetch_proxy_check = lambda sid: next((p for p in proxy_checks if p["segment_brief_id"] == sid), None)
guardian.consent_stats_for_segment = lambda sid: {
    "total": seg_size[sid], "withdrawn": withdrawn[sid], "withdrawn_pct": withdrawn[sid] / seg_size[sid]}

emails, verdicts = [], {}
ORDER = ["seg-discount", "seg-app", "seg-loyal", "seg-gift", "seg-conscious", "seg-lapsed"]
for n, sid in enumerate(ORDER):
    subject, pre, headline, intro, highlights, cta, offer = COPY[sid]
    direction = next(d for d in directions if d["segment_brief_id"] == sid)
    copy = {
        "subject": subject, "preheader": pre, "headline": headline, "intro": intro,
        "highlights": [{"title": t, "text": x} for t, x in highlights], "cta_text": cta,
        "faqs": [{"question": "How does Early Bird pricing work?", "answer": "You pay 80% of the regular price on any pillow ordered before launch day."},
                 {"question": "Can I return a pillow?", "answer": "Yes — unused pillows can be returned within 30 days of delivery."}],
        "closing": "With love from the FatCatPillow team.", "cited_offers": [offer],
    }
    blocks = email_composer._build_blocks(copy, direction, ["Early Bird"])
    email = {
        "id": f"email-{sid[4:]}", "segment_brief_id": sid, "subject": subject, "preheader": pre,
        "blocks": blocks, "background": email_composer._background_for(direction),
        "cited_offer_ids": [offer], "status": "sent" if n < 2 else "draft",
        "model_version": "openai/gpt-5.6-luna",
    }
    emails.append(email)
    checks = guardian.run_checks(email)
    verdicts[email["id"]] = {"verdict": guardian.verdict_for(checks), "checks": checks,
                             "created_at": f"2026-10-14T01:08:{55 + n:02d}+08:00"}

approvals = [
    {"id": f"appr-{e['id']}", "scope": "email", "approver_name": "Ong Qing Quan", "decision": "approved",
     "target_id": e["id"], "created_at": "2026-09-12T11:26:40+08:00"}
    for e in emails[:2]
]
sends = [
    {"id": f"send-{e['id']}", "email_id": e["id"], "segment_brief_id": e["segment_brief_id"],
     "recipient": "demo@fcp.com.sg", "subject": e["subject"], "status": "sent", "provider": "resend",
     "provider_id": f"re_{n}a91f3c", "error": None, "created_at": f"2026-09-12T11:27:{10 + n * 14}+08:00"}
    for n, e in enumerate(emails[:2])
]

# ── Eval: the scores eval-v1 gave that run ────────────────────────────────
EARNED = {
    "segmentation": (70.8, [26.6, 13.0, 13.0, 6.9, 11.2]),
    "creative": (95.0, [8, 8, 8, 8, 8, 20, 15, 20]),
    "composer": (93.3, [10, 10, 10, 10, 20, 19.2, 14.2]),
    "guardian": (93.7, [68.7, 25]),
}
agents = {}
for name, (score, earned) in EARNED.items():
    rows_ = [{"name": spec["name"], "kind": spec["kind"], "weight": spec["weight"], "earned": e}
             for spec, e in zip(rubric.RUBRIC_BREAKDOWN[name], earned)]
    agents[name] = {"score": score, "available": True, "metrics": {}, "notes": [], "items": [], "breakdown": rows_}
eval_payload = {
    "id": "eval-4be1d07a2c", "created_at": "2026-09-12T02:41:00+00:00", "rubric_version": "eval-v1",
    "judge_model": "openai/gpt-5.6-luna", "overall": 88.2, "agents": agents,
    "delta": {"overall": 3.4, "segmentation": 1.2, "creative": 4.1, "composer": 2.6, "guardian": 5.7},
    "rubric": rubric.public_rubric(),
}

state = {
    "company": {**COMPANY, "configured": True},
    "audience_count": len(rows),
    "segments": segments,
    "creative_directions": directions,
    "emails": emails,
    "verdicts": verdicts,
    "proxy_checks": proxy_checks,
    "approvals": approvals,
    "sends": sends,
    "offers": OFFERS,
    "brand_palette": PALETTE,
    "max_segments": 6,
    "spend_usd": 0.4172,
    "eval": eval_payload,
    "dispatch": {"configured": True, "from_address": "FatCatPillow <hello@fcp.com.sg>", "default_recipient": "demo@fcp.com.sg"},
}

# ── Logs ──────────────────────────────────────────────────────────────────
log = []
def entry(kind, actor, action, detail, verdict, ts, target=None):
    log.append({"id": f"log-{len(log):03d}", "kind": kind, "actor": actor, "action": action, "detail": detail,
                "target_type": "artifact" if target else None, "target_id": target, "verdict": verdict, "created_at": ts})
for n, e in enumerate(reversed(emails)):
    ts = f"2026-10-14T01:09:{1 - n if n < 2 else 0:02d}+08:00"
    v = verdicts[e["id"]]["verdict"]
    entry("user", "Operator", "email.adjudicate", f"Re-ran Guardian checks — verdict {v}", v, f"2026-10-14T01:0{8 if n > 1 else 9}:{(59 - n * 2) % 60:02d}+08:00", e["id"])
    entry("agent", "Pre-flight Guardian", "Compliance Adjudication", "prompt guardian-v4 · model rule-engine", v, f"2026-10-14T01:0{8 if n > 1 else 9}:{(59 - n * 2) % 60:02d}+08:00", e["id"])
for n, e in enumerate(emails[:2]):
    entry("user", "Operator", "email.send", f"Sent “{e['subject']}” to demo@fcp.com.sg", None, f"2026-09-12T11:27:{24 - n * 14:02d}+08:00", e["id"])
entry("user", "Ong Qing Quan", "approval.grant", "Approved “Explore New Fat Cat Drops”", "PASS", "2026-09-12T11:26:40+08:00")
entry("agent", "Copywriter & Assembly", "Email Composition", "prompt composer-v6 · model openai/gpt-5.6-luna", None, "2026-09-12T11:04:12+08:00")
entry("agent", "Creative Director", "Creative Direction", "prompt creative-v5 · model openai/gpt-5.6-luna", None, "2026-09-12T10:58:31+08:00")
entry("agent", "Segmentation & Insight", "Segment Discovery", "prompt segmentation-v4 · model openai/gpt-5.6-luna", None, "2026-09-12T10:52:09+08:00")
logs = {"entries": log, "spend_usd": 0.4172}

settings_payload = {
    "brand_palette": PALETTE, "openrouter_configured": True, "supabase_configured": True, "resend_configured": True,
    "resend_from": "FatCatPillow <hello@fcp.com.sg>", "default_recipient": "demo@fcp.com.sg",
    "text_model": "openai/gpt-5.6-luna", "embedding_model": "openai/text-embedding-3-small", "max_segments": 6,
}

# Audience rows for the Company Info table (first page only is ever shown).
audience_rows = []
try:
    built = csv_ingest.build_customer_rows(rows[:200], profile_cols, "mosaic-demo")
    for i, r in enumerate(built):
        audience_rows.append({"id": r.get("id") or f"mosaic-cust-{i:05d}", "structured_attrs": r.get("structured_attrs", {}),
                              "behavioural": r.get("behavioural", {}), "psychographic": r.get("psychographic", {}),
                              "free_text": r.get("free_text", ""), "consent_state": r.get("consent_state", "active"),
                              "segment_brief_id": None})
except Exception as exc:  # noqa: BLE001
    print("audience rows skipped:", exc)

def dump(name, payload):
    (OUT / f"{name}.json").write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding="utf-8")

dump("state", state)
dump("company", {"company": state["company"], "offers": OFFERS})
dump("audience", {"rows": audience_rows, "total": len(rows), "offset": 0, "limit": 50, "columns": profile_cols})
dump("logs", logs)
dump("settings", settings_payload)
print({e["subject"]: verdicts[e["id"]]["verdict"] for e in emails})
print("checks per email:", len(next(iter(verdicts.values()))["checks"]), "| audience rows:", len(audience_rows))
