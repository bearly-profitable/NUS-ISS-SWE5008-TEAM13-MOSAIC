"""
The Orchestrator's pipeline graph.

Post-revamp the flow is strictly sequential, because each console tab now
owns one stage and the next stage consumes the previous one's *persisted,
user-reviewable* output:

    Segmentation -> Creative Direction -> Email Composition -> Guardian

The old parallel Creative ∥ Copy fan-out is gone: creative direction is no
longer an independent image branch, it's the input the email composer has to
follow, so it must complete first.

The human approval gate (Approval Queue) lives outside this graph entirely —
nothing here dispatches.

Agents never call each other directly; they only read/write WorkspaceState,
matching the "shared blackboard" design in the proposal. Each stage is also
exported individually so a tab can run just its own step (see
routers/workspace.py) without re-running everything upstream.
"""
from langgraph.graph import END, StateGraph

from app.orchestrator.agents.creative_direction import run_creative_direction
from app.orchestrator.agents.email_composer import run_email_composer
from app.orchestrator.agents.guardian import run_guardian
from app.orchestrator.agents.segmentation import run_segmentation
from app.orchestrator.state import WorkspaceState


def build_graph():
    graph = StateGraph(WorkspaceState)

    graph.add_node("segmentation", run_segmentation)
    graph.add_node("creative_direction", run_creative_direction)
    graph.add_node("email_composer", run_email_composer)
    graph.add_node("guardian", run_guardian)

    graph.set_entry_point("segmentation")
    graph.add_edge("segmentation", "creative_direction")
    graph.add_edge("creative_direction", "email_composer")
    graph.add_edge("email_composer", "guardian")
    graph.add_edge("guardian", END)

    return graph.compile()


pipeline_graph = build_graph()

__all__ = [
    "pipeline_graph",
    "run_segmentation",
    "run_creative_direction",
    "run_email_composer",
    "run_guardian",
]
