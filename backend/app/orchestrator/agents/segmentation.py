"""
Stage 1 — Segmentation & Insight Agent.

  1. Fetch customer_profile rows for the workspace from Supabase.
  2. Embed the sanitised free-text field, concatenate with engineered
     numeric/categorical features from structured/behavioural/psychographic
     attributes.
  3. Cluster the combined vectors with HDBSCAN.
  4. For each cluster, compute real feature contributions (z-scored mean
     deviation vs. the whole population) and call generate_text with a tight
     JSON schema so the model names the segment from its actual
     characteristics — not free-floating text.
  5. Run protected-attribute proxy checks and persist any flagged segments.

The audience is whatever CSV the operator uploaded, so there is no fixed
column list to cluster on. The feature schema is inferred per run from the
rows themselves (see `_feature_schema`), using the column profile that
csv_ingest wrote at upload time for the protected-attribute flags.

Protected attributes never enter the feature matrix. Age, gender and the
rest are held out entirely and only read back afterwards, to test whether a
discovered segment ended up correlating with them anyway.

Progress is reported through an optional callback so the Segments tab can
show what is actually running (see app/progress.py).
"""
from __future__ import annotations

import json
import uuid
from typing import Callable

import numpy as np
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

try:
    import hdbscan
except ImportError:  # pragma: no cover
    hdbscan = None

from app import csv_ingest, persistence
from app.brand import context_block
from app.config import WORKSPACE_ID
from app.csv_ingest import is_protected
from app.ledger import LedgerEntry, write_entry
from app.openrouter_client import OpenRouterCallError, OpenRouterNotConfiguredError, embed_text, generate_text
from app.orchestrator.state import SegmentBrief, WorkspaceState

# A one-hot column pair is unit-distance apart while numerics are
# standardised, so at full weight a wide categorical block dominates the
# Euclidean distance and collapses everything into one blob (measured on the
# original base: 2 clusters, 82% of contacts in one). Down-weighting keeps
# categorical columns as real signal without letting them drown behaviour.
_CATEGORICAL_WEIGHT = 0.3

# Embedding dimensions are scaled to sit alongside the engineered features
# rather than swamp them — PCA output variance is unbounded otherwise.
_EMBEDDING_WEIGHT = 0.5

# Categorical columns wider than this are dropped rather than one-hot
# encoded: a 200-value column adds 200 near-orthogonal dimensions and buys
# almost no separation.
_MAX_CATEGORY_CARDINALITY = 25

# Deliberately tight: short, concrete fields. The console renders these on
# compact cards, so long paragraphs get truncated and read as noise.
_SEGMENT_BRIEF_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "Segment name, 2-4 words, title case. No quotes, no trailing punctuation.",
        },
        "motivation": {
            "type": "string",
            "description": "What drives them to buy. ONE sentence, max 18 words.",
        },
        "tone_guidance": {
            "type": "string",
            "description": "How to speak to them. ONE short phrase, max 10 words.",
        },
        "rationale": {
            "type": "string",
            "description": "Why this cluster holds together. ONE sentence, max 22 words.",
        },
    },
    "required": ["name", "motivation", "tone_guidance", "rationale"],
}


def _flatten_customer(row: dict) -> dict:
    s = row.get("structured_attrs") or {}
    b = row.get("behavioural") or {}
    p = row.get("psychographic") or {}
    return {**s, **b, **p}


def _label_for(key: str) -> str:
    """Turns a raw CSV column name into something readable on the Segments
    tab's contribution bars — `p3m_spend_sgd` → `P3m spend sgd`."""
    words = key.replace("_", " ").replace("-", " ").strip()
    return words[:1].upper() + words[1:] if words else key


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _feature_schema(
    flat_rows: list[dict], column_profile: list[dict], excluded: set[str] | None = None
) -> tuple[list[str], list[str], list[str]]:
    """Decides, from the audience itself, which columns are clusterable.

    Returns (numeric keys, categorical keys, protected keys). Nothing here is
    hardcoded to a particular CSV: numeric columns with real spread become
    standardised features, low-cardinality columns become one-hot blocks, and
    anything protected, constant or effectively a row key is excluded.
    """
    protected_flagged = {c["name"] for c in column_profile if c.get("protected")}
    # Row keys and prose are already represented elsewhere (as the id and as
    # the embedded free text respectively); one-hot encoding them again would
    # add hundreds of near-orthogonal dimensions for no separation.
    not_features = {c["name"] for c in column_profile if c.get("kind") in ("identifier", "text", "constant")}
    excluded = (excluded or set()) | not_features
    total = len(flat_rows)

    keys: list[str] = []
    for row in flat_rows:
        for key in row:
            if key not in keys:
                keys.append(key)

    numeric: list[str] = []
    categorical: list[str] = []
    protected: list[str] = []

    for key in keys:
        values = [r.get(key) for r in flat_rows]
        present = [v for v in values if v is not None and v != ""]
        if not present:
            continue

        if key in protected_flagged or is_protected(key):
            protected.append(key)
            continue
        if key in excluded:
            continue

        distinct = len({str(v) for v in present})
        if distinct <= 1:
            continue  # constant column — no signal

        if all(_is_number(v) for v in present) and distinct > 2:
            numeric.append(key)
        elif 2 <= distinct <= min(_MAX_CATEGORY_CARDINALITY, max(20, int(total * 0.05))) and distinct / len(present) <= 0.5:
            categorical.append(key)

    return numeric, categorical, protected


def _build_feature_matrix(
    flat_rows: list[dict], numeric_keys: list[str], categorical_keys: list[str]
) -> tuple[np.ndarray, list[str]]:
    numeric = np.array(
        [[float(r.get(k) or 0) if _is_number(r.get(k)) else 0.0 for k in numeric_keys] for r in flat_rows],
        dtype=float,
    ).reshape(len(flat_rows), len(numeric_keys))
    if numeric_keys:
        numeric = StandardScaler().fit_transform(numeric)

    cat_blocks = []
    cat_cols: list[str] = []
    for key in categorical_keys:
        values = sorted({str(r.get(key, "")) for r in flat_rows})
        cat_cols.extend(f"{key}={v}" for v in values)
        cat_blocks.append(
            np.array([[1.0 if str(r.get(key, "")) == v else 0.0 for v in values] for r in flat_rows])
        )
    categorical = np.hstack(cat_blocks) if cat_blocks else np.zeros((len(flat_rows), 0))

    return (
        np.hstack([numeric, categorical * _CATEGORICAL_WEIGHT]),
        numeric_keys + cat_cols,
    )


def _feature_contributions(
    flat_rows: list[dict], labels: np.ndarray, cluster_id: int, numeric_keys: list[str], top_n: int = 4
) -> list[dict]:
    members = [r for r, l in zip(flat_rows, labels) if l == cluster_id]
    contributions = []
    for key in numeric_keys:
        pop = np.array([float(r.get(key) or 0) if _is_number(r.get(key)) else 0.0 for r in flat_rows])
        if pop.std() < 1e-9:
            continue
        cluster_vals = np.array([float(r.get(key) or 0) if _is_number(r.get(key)) else 0.0 for r in members])
        z = (cluster_vals.mean() - pop.mean()) / pop.std()
        contributions.append({"feature": _label_for(key), "weight": round(float(z), 3)})
    contributions.sort(key=lambda c: abs(c["weight"]), reverse=True)
    return contributions[:top_n]


def _protected_values(flat_rows: list[dict], attribute: str) -> list[str]:
    """Protected attribute per row, as a comparable category.

    A raw continuous column (`age`: 19, 20, 21…) has a distinct value for
    almost every contact, which makes a distribution comparison meaningless —
    every bucket sits near zero and nothing ever flags. Continuous columns are
    therefore quartile-bucketed against the population first.
    """
    raw = [r.get(attribute) for r in flat_rows]
    numeric = [float(v) for v in raw if _is_number(v)]

    if len(numeric) >= len(raw) * 0.9 and len({str(v) for v in raw}) > 12:
        edges = np.quantile(np.array(numeric), [0.25, 0.5, 0.75])
        labels = ["Q1", "Q2", "Q3", "Q4"]
        return [
            labels[int(np.searchsorted(edges, float(v), side="right"))] if _is_number(v) else "unknown"
            for v in raw
        ]

    return [str(v) if v not in (None, "") else "unknown" for v in raw]


def _proxy_check(
    values: list[str], labels: np.ndarray, cluster_id: int, threshold: float = 0.35
) -> dict:
    """Largest deviation between this cluster's distribution of a protected
    attribute and the population's. A big gap means the clustering has found
    a proxy for something it was never given."""
    pop_dist: dict[str, float] = {}
    for v in values:
        pop_dist[v] = pop_dist.get(v, 0) + 1
    for k in pop_dist:
        pop_dist[k] /= len(values)

    members = [v for v, l in zip(values, labels) if l == cluster_id]
    cluster_dist: dict[str, float] = {}
    for v in members:
        cluster_dist[v] = cluster_dist.get(v, 0) + 1
    for k in cluster_dist:
        cluster_dist[k] /= max(len(members), 1)

    max_deviation = max(abs(cluster_dist.get(k, 0) - pop_dist.get(k, 0)) for k in pop_dist)
    return {"correlation": round(float(max_deviation), 3), "flagged": max_deviation > threshold}


# Step indices must match SEGMENTATION_STEPS in routers/workspace.py.
def _noop(_index: int, _detail: str = "") -> None:
    pass


def run_segmentation(state: WorkspaceState, on_step: Callable[[int, str], None] = _noop) -> dict:
    max_segments = state.get("max_segments", 6)

    on_step(0, "Reading the audience")
    customers = persistence.fetch_customers()
    if not customers:
        raise RuntimeError("No contacts loaded — upload your customer CSV in Company Info first.")

    flat_rows = [_flatten_customer(r) for r in customers]
    free_texts = [r.get("free_text", "") or "" for r in customers]
    company = persistence.get_company_profile()
    column_profile = company.get("columns") or []
    on_step(0, f"{len(customers):,} contacts")

    # Marketing consent decides who may be sent to; clustering on it would
    # let the run produce a segment that is entirely opted out. The
    # personalisation column is a per-person label, not a trait.
    excluded = {
        c for c in (csv_ingest.consent_column([c["name"] for c in column_profile]),) if c
    } | {a for a in (company.get("dynamic_attribute"),) if a}

    numeric_keys, categorical_keys, protected_keys = _feature_schema(flat_rows, column_profile, excluded)
    if not numeric_keys and not categorical_keys:
        raise RuntimeError(
            "No clusterable columns in this audience — the CSV needs at least one numeric "
            "or repeated-category column beyond identifiers and protected attributes."
        )

    # Free text is optional: plenty of customer exports are pure numbers and
    # categories. Skip the embedding call entirely rather than paying for a
    # batch of empty strings that adds no separation.
    has_text = any(t.strip() for t in free_texts)
    if has_text:
        on_step(1, f"0 / {len(free_texts):,} notes embedded")
        embeddings: list[list[float]] = []
        for i in range(0, len(free_texts), 200):
            embeddings.extend(embed_text(free_texts[i : i + 200]))
            on_step(1, f"{min(i + 200, len(free_texts)):,} / {len(free_texts):,} notes embedded")

        embeddings_arr = np.array(embeddings)
        embed_dims = min(10, embeddings_arr.shape[1], max(embeddings_arr.shape[0] - 1, 1))
        embeddings_reduced = PCA(n_components=embed_dims).fit_transform(embeddings_arr)
        embeddings_reduced = StandardScaler().fit_transform(embeddings_reduced) * _EMBEDDING_WEIGHT
    else:
        on_step(1, "No free-text column in this audience — skipping embeddings")
        embeddings_reduced = np.zeros((len(customers), 0))

    on_step(2, f"{len(numeric_keys)} numeric + {len(categorical_keys)} categorical columns")
    numeric_features, _ = _build_feature_matrix(flat_rows, numeric_keys, categorical_keys)
    combined = np.hstack([numeric_features, embeddings_reduced])
    on_step(
        2,
        f"{combined.shape[1]} dimensions per contact"
        + (f" · {len(protected_keys)} protected column(s) held out" if protected_keys else ""),
    )

    if hdbscan is None:
        raise RuntimeError("hdbscan is not installed in the backend venv.")

    on_step(3, "Running HDBSCAN")
    # Scales with the uploaded list rather than assuming a 1,000-row base: a
    # fixed floor of 25 finds nothing at all in a 150-contact CSV.
    min_cluster_size = max(5, len(customers) // 40)
    # 'leaf' selection over the default 'eom': eom merges the behavioural
    # archetypes back into one dominant cluster on this base, leaf keeps them
    # separate. Verified at 100% cluster purity against the generator's
    # archetypes on the 1,000-row base.
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=max(2, min(5, min_cluster_size // 2)),
        cluster_selection_method="leaf",
    )
    labels = clusterer.fit_predict(combined)
    probabilities = clusterer.probabilities_

    all_ids = sorted(set(labels.tolist()) - {-1})
    cluster_ids = sorted(all_ids, key=lambda c: int((labels == c).sum()), reverse=True)[:max_segments]
    noise = int((labels == -1).sum())
    on_step(3, f"{len(all_ids)} clusters found, keeping top {len(cluster_ids)} · {noise:,} unclustered")

    if not cluster_ids:
        raise RuntimeError(
            "HDBSCAN found no clusters dense enough to keep. Try uploading a larger "
            "customer list, or one with more varied numeric columns."
        )

    customer_ids = [c["id"] for c in customers]
    persistence.clear_segments()

    # Bucketed once for the whole population — the per-cluster check compares
    # against these same categories.
    protected_values = {key: _protected_values(flat_rows, key) for key in protected_keys}
    company_context = context_block()

    segment_briefs: list[SegmentBrief] = []
    segment_rows_for_db = []
    proxy_rows_for_db = []

    for n, cid in enumerate(cluster_ids, start=1):
        on_step(4, f"Segment {n} of {len(cluster_ids)}")
        member_mask = labels == cid
        size = int(member_mask.sum())
        confidence = float(probabilities[member_mask].mean())
        contributions = _feature_contributions(flat_rows, labels, cid, numeric_keys)
        sample_texts = [free_texts[i] for i in np.where(member_mask)[0][:5] if free_texts[i].strip()]

        prompt = (
            f"{company_context}\n\n"
            "A clustering run over this company's own customer list has surfaced the "
            "micro-segment below.\n\n"
            f"Distinguishing traits, as z-scores vs. the whole list: {json.dumps(contributions)}\n"
            + (f"Sample customer notes: {sample_texts}\n" if sample_texts else "")
            + "\nName the segment and describe it, in this company's terms. Be terse and "
            "concrete — respect the word limits in the schema exactly. No preamble, no "
            "hedging, no marketing adjectives."
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
                "name": f"Segment {n}",
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

        # Worst-case across every protected attribute the CSV happened to
        # carry — one flagged attribute is enough to route the segment to
        # human review. A list with none of them still records a row, so the
        # Guardian can say the check ran and found nothing to test.
        worst = None
        for attribute, values in protected_values.items():
            check = _proxy_check(values, labels, cid)
            if worst is None or check["correlation"] > worst[1]["correlation"]:
                worst = (attribute, check)
        proxy_rows_for_db.append(
            {
                "segment_brief_id": segment_id,
                "protected_attribute": worst[0] if worst else "",
                "correlation": worst[1]["correlation"] if worst else 0.0,
                "flagged": worst[1]["flagged"] if worst else False,
            }
        )

        write_entry(
            LedgerEntry(
                campaign_id=WORKSPACE_ID,
                stage="Segmentation & Insight",
                agent="Segmentation Agent",
                prompt_version="seg-v3",
                model_version=model_version or "n/a",
                output_artifact_id=segment_id,
            )
        )

    on_step(5, f"Saving {len(segment_briefs)} segments")
    persistence.insert_segment_briefs(segment_rows_for_db)
    persistence.insert_proxy_check_results(proxy_rows_for_db)

    for cid, brief in zip(cluster_ids, segment_briefs):
        member_ids = [customer_ids[i] for i in np.where(labels == cid)[0]]
        persistence.assign_customers_to_segment(member_ids, brief["id"])

    flagged = sum(1 for r in proxy_rows_for_db if r["flagged"])
    on_step(5, f"{len(segment_briefs)} segments saved" + (f" · {flagged} flagged for review" if flagged else ""))

    return {"segment_briefs": segment_briefs}
