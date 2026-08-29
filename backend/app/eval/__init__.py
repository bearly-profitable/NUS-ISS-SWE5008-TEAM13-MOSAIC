"""Sidecar evaluation of the four decision agents.

Does not live inside the agent modules. Grade the artifacts already saved
in the workspace, then store an append-only eval_run row.
"""
from app.eval.run import RUBRIC_VERSION, EVAL_STEPS, latest_eval_payload, run_evaluation

__all__ = ["RUBRIC_VERSION", "EVAL_STEPS", "latest_eval_payload", "run_evaluation"]
