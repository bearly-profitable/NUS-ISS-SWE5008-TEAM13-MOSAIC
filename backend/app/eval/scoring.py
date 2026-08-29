"""Shared scoring helpers for the eval sidecar."""
from __future__ import annotations

import math
from typing import Iterable


def words(text: str | None) -> list[str]:
    return [w for w in (text or "").split() if w]


def word_count(text: str | None) -> int:
    return len(words(text))


def clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def round1(value: float | None) -> float | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return round(float(value), 1)


def mean(values: Iterable[float | None]) -> float | None:
    present = [float(v) for v in values if v is not None]
    if not present:
        return None
    return sum(present) / len(present)


def silhouette_to_100(score: float | None) -> float | None:
    """sklearn silhouette is [-1, 1]. Map onto the same 0–100 scale as the rest."""
    if score is None:
        return None
    return clamp((float(score) + 1.0) / 2.0 * 100.0)


def likert_to_100(score: float | None) -> float | None:
    """1–5 rubric → 0–100."""
    if score is None:
        return None
    return clamp((float(score) - 1.0) / 4.0 * 100.0)


def blend(parts: list[tuple[float, float | None]]) -> float | None:
    """Weighted mean, dropping missing components and renormalising weights."""
    usable = [(w, v) for w, v in parts if v is not None and w > 0]
    if not usable:
        return None
    total_w = sum(w for w, _ in usable)
    return sum(w * v for w, v in usable) / total_w


def within_limit(text: str | None, max_words: int) -> bool:
    return word_count(text) <= max_words
