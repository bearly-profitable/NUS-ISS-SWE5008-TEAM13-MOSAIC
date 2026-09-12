"""
In-memory spend tally for OpenRouter calls, tagged by stage/agent.

Budget ceilings were removed in the workspace revamp — nothing halts a run
on cost any more. This is now purely observability: the Logs tab shows what
each generation cost so the numbers stay visible without gating anything.

Process-local and non-persisted, so it resets on backend restart.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Lock


@dataclass
class Spend:
    total_usd: float = 0.0
    calls: list = field(default_factory=list)


class CostMeter:
    def __init__(self):
        self._lock = Lock()
        self._spend: dict[str, Spend] = defaultdict(Spend)

    def record(self, *, stage: str, agent: str, cost_usd: float, scope: str = "workspace") -> float:
        """Record a call's cost and return the running total for `scope`."""
        with self._lock:
            entry = self._spend[scope]
            entry.total_usd += cost_usd
            entry.calls.append({"stage": stage, "agent": agent, "cost_usd": cost_usd})
            return entry.total_usd

    def total_for(self, scope: str = "workspace") -> float:
        return round(self._spend[scope].total_usd, 4)

    def breakdown(self, scope: str = "workspace") -> list[dict]:
        return list(self._spend[scope].calls)

    def reset(self) -> None:
        """Zeroes the tally — only the workspace reset calls this, so the
        Logs tab's spend readout matches the emptied workspace instead of
        still showing what the discarded run cost."""
        with self._lock:
            self._spend.clear()


cost_meter = CostMeter()
