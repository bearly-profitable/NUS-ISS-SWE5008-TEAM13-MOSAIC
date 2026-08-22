"""
In-memory job progress registry.

Segmentation is the one genuinely long stage (embedding a thousand notes,
clustering, then one model call per segment), so the Segments tab needs to
show what is actually happening rather than an indefinite spinner.

The job runs on a worker thread and pushes named steps in here; the console
polls GET /api/jobs/{id}. Process-local and non-persisted — a backend restart
mid-run loses the job, which is fine for a single-process demonstrator.
"""
from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone


class JobRegistry:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, dict] = {}

    def create(self, kind: str, steps: list[str]) -> str:
        job_id = f"job-{uuid.uuid4().hex[:12]}"
        with self._lock:
            self._jobs[job_id] = {
                "id": job_id,
                "kind": kind,
                "status": "running",
                "steps": [{"label": s, "state": "pending", "detail": ""} for s in steps],
                "error": None,
                "result": None,
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
        return job_id

    def start_step(self, job_id: str, index: int, detail: str = "") -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or index >= len(job["steps"]):
                return
            # Anything before this is implicitly finished — protects the UI
            # from a stuck "in progress" row if a step forgets to close.
            for i in range(index):
                if job["steps"][i]["state"] != "done":
                    job["steps"][i]["state"] = "done"
            job["steps"][index]["state"] = "running"
            if detail:
                job["steps"][index]["detail"] = detail

    def update_detail(self, job_id: str, index: int, detail: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job and index < len(job["steps"]):
                job["steps"][index]["detail"] = detail

    def finish(self, job_id: str, result: dict | None = None) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            for step in job["steps"]:
                if step["state"] != "done":
                    step["state"] = "done"
            job["status"] = "done"
            job["result"] = result

    def fail(self, job_id: str, error: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            for step in job["steps"]:
                if step["state"] == "running":
                    step["state"] = "failed"
            job["status"] = "failed"
            job["error"] = error

    def get(self, job_id: str) -> dict | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None


jobs = JobRegistry()
