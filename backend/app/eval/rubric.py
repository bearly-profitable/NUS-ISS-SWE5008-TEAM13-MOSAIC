"""eval-v1 criterion weights per agent. Each list sums to 100.

`metric` / `check` / `likert` tell the scorecard how to turn a saved eval
run into earned points (weight × 0–100 score / 100) without re-running
the judge. Those keys stay internal; the API sends name, kind, weight, earned.
"""
from app.eval.scoring import likert_to_100, mean, round1

RUBRIC_BREAKDOWN = {
    "segmentation": [
        {"name": "Silhouette", "kind": "Code", "weight": 38.5, "metric": "silhouette_0_100"},
        {"name": "Coverage", "kind": "Code", "weight": 17.5, "metric": "coverage_0_100"},
        {"name": "HDBSCAN confidence", "kind": "Code", "weight": 14.0, "metric": "confidence_0_100"},
        {"name": "Faithfulness", "kind": "LLM Judge", "weight": 15.0, "likert": "faithfulness"},
        {"name": "Specificity", "kind": "LLM Judge", "weight": 15.0, "likert": "specificity"},
    ],
    "creative": [
        {"name": "Tonality length", "kind": "Code", "weight": 8.0, "check": "tonality"},
        {"name": "Language length", "kind": "Code", "weight": 8.0, "check": "language_style"},
        {"name": "CTA length", "kind": "Code", "weight": 8.0, "check": "cta_style"},
        {"name": "Design length", "kind": "Code", "weight": 8.0, "check": "design_style"},
        {"name": "Accent hex", "kind": "Code", "weight": 8.0, "check": "accent_hex"},
        {"name": "Segment fit", "kind": "LLM Judge", "weight": 20.0, "likert": "segment_fit"},
        {"name": "Brand fit", "kind": "LLM Judge", "weight": 20.0, "likert": "brand_fit"},
        {"name": "No dark patterns", "kind": "LLM Judge", "weight": 20.0, "likert": "no_dark_patterns"},
    ],
    "composer": [
        {"name": "Has citation", "kind": "Code", "weight": 10.0, "check": "has_citation"},
        {"name": "Citations in catalogue", "kind": "Code", "weight": 10.0, "check": "citations_in_catalogue"},
        {"name": "Subject length", "kind": "Code", "weight": 10.0, "check": "subject_length"},
        {"name": "Preheader length", "kind": "Code", "weight": 10.0, "check": "preheader_length"},
        {"name": "Follows direction", "kind": "LLM Judge", "weight": 20.0, "likert": "follows_direction"},
        {"name": "Segment fit", "kind": "LLM Judge", "weight": 20.0, "likert": "segment_fit"},
        {"name": "Grounded", "kind": "LLM Judge", "weight": 20.0, "likert": "grounded"},
    ],
    "guardian": [
        {"name": "Check pass rate", "kind": "Code", "weight": 70.0, "metric": "check_pass_rate"},
        {"name": "Email PASS rate", "kind": "Code", "weight": 30.0, "metric": "email_pass_rate"},
    ],
}


def public_rubric() -> dict:
    return {name: [_public_row(row, earned=None) for row in rows] for name, rows in RUBRIC_BREAKDOWN.items()}


def breakdown_with_earned(agent_name: str, agent: dict | None) -> list[dict]:
    agent = agent or {}
    available = bool(agent.get("available"))
    return [_public_row(spec, _earned(agent, spec) if available else None) for spec in RUBRIC_BREAKDOWN[agent_name]]


def _public_row(spec: dict, earned: float | None) -> dict:
    return {
        "name": spec["name"],
        "kind": spec["kind"],
        "weight": spec["weight"],
        "earned": earned,
    }


def _earned(agent: dict, spec: dict) -> float | None:
    frac = _criterion_0_100(agent, spec)
    if frac is None:
        return None
    return round1(float(frac) / 100.0 * spec["weight"])


def _criterion_0_100(agent: dict, spec: dict) -> float | None:
    if spec.get("check"):
        return _check_rate(agent.get("items") or [], spec["check"])
    if spec.get("likert"):
        return mean(likert_to_100(item.get(spec["likert"])) for item in (agent.get("items") or []))
    metric = spec.get("metric")
    if not metric:
        return None
    metrics = agent.get("metrics") or {}
    if metric == "coverage_0_100":
        noise = metrics.get("noise_ratio")
        return None if noise is None else (1.0 - float(noise)) * 100.0
    if metric == "confidence_0_100":
        conf = metrics.get("mean_confidence")
        return None if conf is None else float(conf) * 100.0
    value = metrics.get(metric)
    return None if value is None else float(value)


def _check_rate(items: list, name: str) -> float | None:
    vals = []
    for item in items:
        for check in item.get("checks") or []:
            if check.get("name") == name:
                vals.append(100.0 if check.get("passed") else 0.0)
    return mean(vals)
