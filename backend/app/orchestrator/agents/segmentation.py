"""
Stage 1 — Segmentation & Insight Agent. Real implementation:

  1. Fetch customer_profile rows for the workspace from Supabase.
  2. Embed the sanitised free-text field (openrouter_client.embed_text),
     concatenate with engineered numeric/categorical features from
     structured/behavioural/psychographic attributes.
  3. Cluster the combined vectors with HDBSCAN.
  4. For each cluster, compute real feature contributions (z-scored mean
     deviation vs. the whole population) and call generate_text with a
     JSON schema so the model synthesises a name/motivation/tone from the
     cluster's actual characteristics — not free-floating text.
  5. Run the protected-attribute proxy check against the held-out
     age_bracket field (never used in clustering) and persist any flagged
     segments to proxy_check_result.

`age_bracket` is present in the data but deliberately excluded from the
feature matrix — it never touches clustering.

Only the largest `max_segments` clusters (default 6) are kept, because the
Email Review tab renders one email per segment and is capped at 6.
"""
from __future__ import annotations

import json
import uuid

import numpy as np
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

try:
    import hdbscan
except ImportError:  # pragma: no cover
    hdbscan = None

from app import persistence
from app.config import WORKSPACE_ID
from app.ledger import LedgerEntry, write_entry
from app.openrouter_client import OpenRouterCallError, OpenRouterNotConfiguredError, embed_text, generate_text
from app.orchestrator.state import SegmentBrief, WorkspaceState

PROTECTED_ATTRIBUTE_KEYS = {"age_bracket"}

_NUMERIC_KEYS = [
    "contract_tenure_months",
    "monthly_spend_sgd",
    "num_lines",
    "roaming_days_90d",
    "device_installment_balance_sgd",
    "customer_service_contacts_90d",
    "app_logins_per_week",
    "upgrade_eligibility_days",
    "promo_email_open_rate",
    "avg_discount_at_purchase_pct",
    "churn_risk_score",
    "price_sensitivity",
    "tech_enthusiasm",
    "loyalty_score",
]
_CATEGORICAL_KEYS = ["plan_type", "data_tier"]
_BOOL_KEYS = ["has_5g", "broadband_bundle"]

_SEGMENT_BRIEF_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "Short human-readable segment name, e.g. 'Durability-First Renewers'",
        },
        "motivation": {"type": "string"},
        "tone_guidance": {"type": "string"},
        "rationale": {"type": "string", "description": "One paragraph explaining why this cluster is coherent"},
    },
    "required": ["name", "motivation", "tone_guidance", "rationale"],
}


def _flatten_customer(row: dict) -> dict:
    s = row.get("structured_attrs") or {}
    b = row.get("behavioural") or {}
    p = row.get("psychographic") or {}
    return {**s, **b, **p}


def _build_feature_matrix(flat_rows: list[dict]) -> tuple[np.ndarray, list[str]]:
    numeric_cols = list(_NUMERIC_KEYS)
    numeric = np.array(
        [[float(r.get(k, 0) or 0) for k in numeric_cols] for r in flat_rows],
        dtype=float,
    )
    numeric = StandardScaler().fit_transform(numeric)

    bool_matrix = np.array(
        [[1.0 if r.get(k) else 0.0 for k in _BOOL_KEYS] for r in flat_rows],
        dtype=float,
    )

    cat_blocks = []
    cat_cols: list[str] = []
    for key in _CATEGORICAL_KEYS:
        values = sorted({str(r.get(key, "")) for r in flat_rows})
        cat_cols.extend(f"{key}={v}" for v in values)
        block = np.array([[1.0 if str(r.get(key, "")) == v else 0.0 for v in values] for r in flat_rows])
        cat_blocks.append(block)
    categorical = np.hstack(cat_blocks) if cat_blocks else np.zeros((len(flat_rows), 0))

    feature_names = numeric_cols + _BOOL_KEYS + cat_cols
    return np.hstack([numeric, bool_matrix, categorical]), feature_names


def _feature_contributions(flat_rows: list[dict], labels: np.ndarray, cluster_id: int, top_n: int = 4) -> list[dict]:
    members = [r for r, l in zip(flat_rows, labels) if l == cluster_id]
    contributions = []
    for key in _NUMERIC_KEYS:
        pop = np.array([float(r.get(key, 0) or 0) for r in flat_rows])
        if pop.std() < 1e-9:
            continue
        cluster_vals = np.array([float(r.get(key, 0) or 0) for r in members])
        z = (cluster_vals.mean() - pop.mean()) / pop.std()
        contributions.append({"feature": key, "weight": round(float(z), 3)})
    contributions.sort(key=lambda c: abs(c["weight"]), reverse=True)
    return contributions[:top_n]


def _proxy_check(
    flat_rows: list[dict], labels: np.ndarray, cluster_id: int, attribute: str, threshold: float = 0.35
) -> dict:
    pop_values = [r.get(attribute) for r in flat_rows]
    pop_dist: dict[str, float] = {}
    for v in pop_values:
        pop_dist[v] = pop_dist.get(v, 0) + 1
    for k in pop_dist:
        pop_dist[k] /= len(pop_values)

    members = [r.get(attribute) for r, l in zip(flat_rows, labels) if l == cluster_id]
    cluster_dist: dict[str, float] = {}
    for v in members:
        cluster_dist[v] = cluster_dist.get(v, 0) + 1
    for k in cluster_dist:
        cluster_dist[k] /= max(len(members), 1)

    max_deviation = max(abs(cluster_dist.get(k, 0) - pop_dist.get(k, 0)) for k in pop_dist)
    return {"correlation": round(float(max_deviation), 3), "flagged": max_deviation > threshold}


def run_segmentation(state: WorkspaceState) -> dict:
    max_segments = state.get("max_segments", 6)
    customers = persistence.fetch_customers()
    if not customers:
        raise RuntimeError(
            "No customer_profile rows found — load the audience first via POST /api/audience/load."
        )

    flat_rows = [_flatten_customer(r) for r in customers]
    free_texts = [r.get("free_text", "") for r in customers]

    embeddings: list[list[float]] = []
    for i in range(0, len(free_texts), 200):
        embeddings.extend(embed_text(free_texts[i : i + 200]))
    embeddings_arr = np.array(embeddings)
    embed_dims = min(10, embeddings_arr.shape[1], max(embeddings_arr.shape[0] - 1, 1))
    embeddings_reduced = PCA(n_components=embed_dims).fit_transform(embeddings_arr)

    numeric_features, _ = _build_feature_matrix(flat_rows)
    combined = np.hstack([numeric_features, embeddings_reduced])

    if hdbscan is None:
        raise RuntimeError("hdbscan is not installed in the backend venv.")

    min_cluster_size = max(30, len(customers) // 40)
    clusterer = hdbscan.HDBSCAN(min_cluster_size=min_cluster_size, min_samples=10)
    labels = clusterer.fit_predict(combined)
    probabilities = clusterer.probabilities_

    # Keep only the largest clusters — Email Review renders one email per
    # segment and is capped at max_segments. -1 is HDBSCAN's noise label.
    all_ids = sorted(set(labels.tolist()) - {-1})
    cluster_ids = sorted(all_ids, key=lambda c: int((labels == c).sum()), reverse=True)[:max_segments]

    customer_ids = [c["id"] for c in customers]

    # A regenerate replaces the previous set outright, rather than appending a
    # second competing set of segments to the same workspace.
    persistence.clear_segments()

    segment_briefs: list[SegmentBrief] = []
    segment_rows_for_db = []
    proxy_rows_for_db = []

    for cid in cluster_ids:
        member_mask = labels == cid
        size = int(member_mask.sum())
        confidence = float(probabilities[member_mask].mean())
        contributions = _feature_contributions(flat_rows, labels, cid)
        sample_texts = [free_texts[i] for i in np.where(member_mask)[0][:5]]

        prompt = (
            "You are analysing a discovered customer micro-segment for M1 Limited, "
            "a Singapore telco (using entirely synthetic demo data). "
            f"This segment's dominant characteristics (z-scored deviation from the "
            f"whole customer base): {json.dumps(contributions)}. "
            f"Representative (synthetic) customer notes from this segment: {sample_texts}. "
            "Synthesise a short segment name, their likely motivation, tone guidance for "
            "marketing copy, and a one-paragraph rationale for why this cluster is coherent."
        )

        segment_id = f"seg-{uuid.uuid4().hex[:8]}"
        try:
            result = generate_text(
                prompt,
                stage="Segmentation & Insight",
                agent="Segmentation Agent",
                response_schema=_SEGMENT_BRIEF_SCHEMA,
            )
            parsed = json.loads(result.text)
            model_version = result.model_version
        except (OpenRouterNotConfiguredError, OpenRouterCallError, ValueError) as exc:
            parsed = {
                "name": f"Segment {cid}",
                "motivation": f"[LLM synthesis failed: {exc}]",
                "tone_guidance": "",
                "rationale": "",
            }
            model_version = None

        brief: SegmentBrief = {
            "id": segment_id,
            "name": parsed["name"],
            "motivation": parsed["motivation"],
            "tone_guidance": parsed["tone_guidance"],
            "size": size,
            "confidence": round(confidence, 3),
            "feature_contributions": contributions,
        }
        segment_briefs.append(brief)
        segment_rows_for_db.append(
            {
                "id": segment_id,
                "campaign_id": WORKSPACE_ID,
                "name": brief["name"],
                "motivation": brief["motivation"],
                "tone_guidance": brief["tone_guidance"],
                "exclusions": "",
                "size": size,
                "confidence": brief["confidence"],
                "rationale": parsed.get("rationale", ""),
                "feature_contributions": contributions,
            }
        )

        proxy = _proxy_check(flat_rows, labels, cid, "age_bracket")
        proxy_rows_for_db.append(
            {
                "segment_brief_id": segment_id,
                "protected_attribute": "age_bracket",
                "correlation": proxy["correlation"],
                "flagged": proxy["flagged"],
            }
        )

        write_entry(
            LedgerEntry(
                campaign_id=WORKSPACE_ID,
                stage="Segmentation & Insight",
                agent="Segmentation Agent",
                prompt_version="seg-v2",
                model_version=model_version or "n/a",
                output_artifact_id=segment_id,
            )
        )

    persistence.insert_segment_briefs(segment_rows_for_db)
    persistence.insert_proxy_check_results(proxy_rows_for_db)

    # Assign member customers to their segment now that the segment_brief
    # rows exist (FK requires insert order) — this is what lets the
    # Guardian's marketing-permission check query real members.
    for cid, brief in zip(cluster_ids, segment_briefs):
        member_ids = [customer_ids[i] for i in np.where(labels == cid)[0]]
        persistence.assign_customers_to_segment(member_ids, brief["id"])

    return {"segment_briefs": segment_briefs}
