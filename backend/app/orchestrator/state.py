from typing import Literal, TypedDict


class SegmentBrief(TypedDict):
    id: str
    name: str
    motivation: str
    tone_guidance: str
    size: int
    confidence: float
    feature_contributions: list[dict]


class CreativeDirection(TypedDict):
    """Stage 2 output. Replaces the old generated-image asset set — creative
    is now expressed as a *direction* the email composer follows, not a
    picture. No image is generated anywhere in the pipeline."""

    segment_id: str
    tonality: str
    language_style: str
    cta_style: str
    design_style: str
    palette: dict  # {primary, accent, background, text}
    logo_url: str
    hero_image_url: str
    rationale: str


class EmailBlock(TypedDict):
    id: str
    type: str
    content: dict


class SegmentEmail(TypedDict):
    id: str
    segment_id: str
    subject: str
    preheader: str
    blocks: list[EmailBlock]
    cited_offers: list[str]


class GuardianVerdict(TypedDict):
    message_id: str
    verdict: Literal["PASS", "REVISE", "BLOCK"]
    checks: list[dict]


class WorkspaceState(TypedDict, total=False):
    """Shared blackboard the Orchestrator threads through the graph.

    Agents never call each other directly — every stage reads/writes this
    typed state, and the Orchestrator persists each transition to the
    Decision Ledger (see app/ledger.py).

    Company context (name, description, campaign intent, brand assets) is
    deliberately *not* threaded through here: it is one stored profile that
    every agent reads directly via app/brand.py, so a re-run of a single
    stage can never work from a stale copy of it."""

    max_segments: int

    # {segment_id: {logo_url, hero_image_url}} — preserves a per-segment
    # asset override across a creative-direction regenerate.
    existing_assets: dict

    segment_briefs: list[SegmentBrief]
    creative_directions: list[CreativeDirection]
    segment_emails: list[SegmentEmail]
    guardian_verdicts: list[GuardianVerdict]

    error: str | None
