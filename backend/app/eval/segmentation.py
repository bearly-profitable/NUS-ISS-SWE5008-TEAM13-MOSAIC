"""Clustering quality + LLM judge of segment names.

Silhouette is computed on the engineered (numeric + categorical) feature
matrix with labels taken from persisted membership — HDBSCAN is not
re-run, so the score grades the segments the console is actually showing.
Embeddings are omitted so a scoring pass does not re-bill the embedding
API; that is noted on the result.
"""
from __future__ import annotations

import numpy as np
from sklearn.metrics import silhouette_score

from app import csv_ingest, persistence
from app.eval.judge import judge
from app.eval.scoring import blend, likert_to_100, mean, round1, silhouette_to_100
from app.orchestrator.agents.segmentation import (
    _build_feature_matrix,
    _feature_schema,
    _flatten_customer,
)

_BRIEF_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "segment_id": {"type": "string"},
                    "faithfulness": {
                        "type": "integer",
                        "description": "1-5. Does the name and rationale match the z-score traits, not invent a different story?",
                    },
                    "specificity": {
                        "type": "integer",
                        "description": "1-5. Concrete and distinctive vs generic marketing labels.",
                    },
                    "rationale": {"type": "string", "description": "One sentence."},
                },
                "required": ["segment_id", "faithfulness", "specificity", "rationale"],
            },
        }
    },
    "required": ["items"],
}


def score_segmentation() -> dict:
    customers = persistence.fetch_customers()
    segments = persistence.fetch_segments()
    proxy = persistence.fetch_proxy_checks()
    company = persistence.get_company_profile()
    column_profile = company.get("columns") or []

    if not customers or not segments:
        return {
            "score": None,
            "available": False,
            "metrics": {},
            "notes": ["No segments to score — generate segments first."],
            "items": [],
        }

    flat_rows = [_flatten_customer(r) for r in customers]
    excluded = {
        c for c in (csv_ingest.consent_column([c["name"] for c in column_profile]),) if c
    } | {a for a in (company.get("dynamic_attribute"),) if a}
    numeric_keys, categorical_keys, _protected = _feature_schema(flat_rows, column_profile, excluded)
    matrix, _cols = _build_feature_matrix(flat_rows, numeric_keys, categorical_keys)
    id_to_label = {s["id"]: i for i, s in enumerate(segments)}
    labels = np.array(
        [id_to_label.get(c.get("segment_brief_id"), -1) for c in customers],
        dtype=int,
    )

    assigned = labels >= 0
    noise_ratio = float((~assigned).mean()) if len(labels) else 1.0
    n_clusters = len({int(x) for x in labels[assigned].tolist()}) if assigned.any() else 0

    silhouette = None
    sil_note = None
    if matrix.shape[1] == 0:
        sil_note = "Silhouette skipped — no engineered features on this audience."
    elif n_clusters >= 2 and int(assigned.sum()) > n_clusters:
        try:
            silhouette = float(silhouette_score(matrix[assigned], labels[assigned]))
        except ValueError as exc:
            sil_note = f"Silhouette skipped: {exc}"
    else:
        sil_note = "Silhouette needs at least two populated segments."

    confidences = [float(s.get("confidence") or 0) for s in segments]
    mean_confidence = mean(confidences) or 0.0
    flagged = sum(1 for p in proxy if p.get("flagged"))
    proxy_rate = flagged / max(len(segments), 1)

    brief_scores, brief_items, brief_note = _judge_briefs(segments)

    clustering_100 = blend(
        [
            (0.55, silhouette_to_100(silhouette)),
            (0.25, (1.0 - noise_ratio) * 100.0),
            (0.20, mean_confidence * 100.0),
        ]
    )
    overall = blend([(0.7, clustering_100), (0.3, brief_scores)])

    notes = [
        "Silhouette uses engineered features only (no re-embedding), with labels from saved membership.",
    ]
    if sil_note:
        notes.append(sil_note)
    if brief_note:
        notes.append(brief_note)
    if proxy_rate > 0:
        notes.append(f"{flagged} segment(s) flagged as protected-attribute proxies.")

    return {
        "score": round1(overall),
        "available": True,
        "metrics": {
            "silhouette": round(silhouette, 3) if silhouette is not None else None,
            "silhouette_0_100": round1(silhouette_to_100(silhouette)),
            "noise_ratio": round(noise_ratio, 3),
            "mean_confidence": round(mean_confidence, 3),
            "proxy_flag_rate": round(proxy_rate, 3),
            "n_segments": len(segments),
            "n_customers": len(customers),
            "brief_faithfulness_0_100": round1(brief_scores),
        },
        "notes": notes,
        "items": brief_items,
    }


def _judge_briefs(segments: list[dict]) -> tuple[float | None, list[dict], str | None]:
    payload = [
        {
            "segment_id": s["id"],
            "name": s.get("name") or s["id"],
            "rationale": s.get("rationale") or "",
            "motivation": s.get("motivation") or "",
            "traits": s.get("feature_contributions") or [],
        }
        for s in segments
    ]
    parsed = judge(
        "Grade each segment brief. Faithfulness: the name and rationale must be "
        "justified by the listed z-score traits, not a different story. "
        "Specificity: avoid generic labels like 'Valued Customers'.\n\n"
        f"Segments:\n{payload}",
        _BRIEF_SCHEMA,
        agent="Eval · Segmentation",
    )
    if not parsed:
        return None, [], "LLM judge skipped (OpenRouter unavailable or call failed)."

    by_id = {item.get("segment_id"): item for item in parsed.get("items") or [] if isinstance(item, dict)}
    items = []
    faithfulness = []
    for s in segments:
        row = by_id.get(s["id"]) or {}
        f = _clip_likert(row.get("faithfulness"))
        spec = _clip_likert(row.get("specificity"))
        faithfulness.append(mean([f, spec]))
        items.append(
            {
                "id": s["id"],
                "name": s.get("name") or s["id"],
                "faithfulness": f,
                "specificity": spec,
                "rationale": row.get("rationale") or "",
            }
        )
    scores_100 = [likert_to_100(v) for v in faithfulness]
    return mean(scores_100), items, None


def _clip_likert(value) -> float | None:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return max(1, min(5, n))
