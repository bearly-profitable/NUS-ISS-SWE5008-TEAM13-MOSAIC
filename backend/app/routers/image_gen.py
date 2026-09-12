"""
Operator-driven image generation.

Every other model call in this app happens because a pipeline stage ran.
These two do not. Imagery is expensive, subjective, and frequently wrong on
the first attempt, so nothing here is wired into the orchestrator graph: an
image exists only because a person opened the Generate panel, read the
prompt, edited it, and pressed the button. Both endpoints are one-shot and
synchronous -- no job record, no background thread, no auto-retry -- because
the only caller is a button someone is currently looking at.

`/draft-prompt` is likewise not automatic: it writes a *suggestion* into the
textarea for the operator to review, and never produces the picture itself.
Drafting and generating are separate presses on purpose, so the expensive
call always sits behind a prompt a human has actually read.
"""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import brand, persistence, storage
from app.activity import log_activity
from app.config import WORKSPACE_ID, get_settings
from app.ledger import LedgerEntry, write_entry
from app.openrouter_client import (
    IMAGE_ASPECT_RATIOS,
    IMAGE_BACKGROUNDS,
    IMAGE_QUALITIES,
    MAX_IMAGE_PROMPT_CHARS,
    OpenRouterCallError,
    OpenRouterNotConfiguredError,
    generate_image,
    generate_text,
)

logger = logging.getLogger("mosaic.image_gen")

router = APIRouter()
settings = get_settings()

PROMPT_VERSION = "image-prompt-v2"

# What the image is for, phrased as the writer should think of it. The
# composition note matters more than the label: a banner with copy over it and
# a small inline illustration want genuinely different framing.
PURPOSES = {
    "hero": (
        "a wide banner across the top of a marketing email; leave one calm, plain area "
        "where headline copy can sit"
    ),
    "logo": (
        "a simple symbolic brand mark -- a shape or icon, never a wordmark -- centred "
        "on a plain uncluttered background"
    ),
    "block": "a small supporting image inside the body of a marketing email",
}

# Appended to every draft rather than left to the writer.
#
# Two things must always be true of these images: no malformed generated
# lettering (the real copy goes on top in the email), and no identifiable
# faces or real brands. Spending three of the writer's rules on that had two
# costs -- it ate the word budget meant for the scene, and long negative lists
# backfire, because a model that reads "no bicycles" often paints a bicycle.
# One short clause, added in code, is both terser and more reliable.
#
# A brand mark is the exception: it *is* a logo, so the general tail told the
# writer to draw a logo without logos, and drafts came back contradicting
# themselves. It still gets the no-lettering rule, for the same reason
# everything else does -- generated type renders malformed.
NEGATIVE_TAILS = {
    "hero": "No text, logos or recognisable faces.",
    "block": "No text, logos or recognisable faces.",
    "logo": "No lettering or recognisable faces.",
}

# The house style, held apart from the per-image brief so it stays identical
# across drafts.
#
# Tuned for current image models (gpt-image, Gemini, Imagen), which read prose
# and reward specificity over volume. The banned habits below are all holdovers
# from the keyword-soup era: they no longer help, and they crowd out the
# description that does.
_WRITER_SYSTEM = """You write prompts for text-to-image models. Reply with the prompt itself and nothing else — no preamble, no quotes, no label, no code fence.

House style:
- 20 to 35 words. One sentence if you can, two at most.
- Open with the subject. Then the setting, the light, and the shot.
- Concrete visual nouns only. Cut any word that cannot be seen — "premium", "engaging", "innovative", "dynamic", "modern" put nothing on the canvas.
- Exactly one lighting phrase and one camera angle. Not three of each.
- Never add quality boosters: "8k", "ultra detailed", "hyperrealistic", "masterpiece", "award-winning", "trending". They do nothing on current models.
- Write what is there, not what is absent: "an empty street", never "a street with no people".
- Write sentences, not comma-separated keyword lists. If you are over the limit, drop a detail — never chain clauses with commas to fit everything in."""


def _require_openrouter():
    if not settings.openrouter_configured:
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not set on the backend -- add it to backend/.env.",
        )


@router.get("/api/images/config")
def image_config():
    """Lets the Generate panel name the model it would call, and grey itself
    out before the operator writes a prompt that cannot be sent."""
    return {
        "configured": settings.openrouter_configured,
        "model": settings.openrouter_image_model,
        "aspect_ratios": list(IMAGE_ASPECT_RATIOS),
        "qualities": list(IMAGE_QUALITIES),
        "backgrounds": list(IMAGE_BACKGROUNDS),
        "max_prompt_chars": MAX_IMAGE_PROMPT_CHARS,
    }


class DraftPromptRequest(BaseModel):
    purpose: str = "hero"
    # Optional -- when set, that segment's creative direction steers the
    # draft so the suggestion matches the email it will sit in.
    segment_id: str | None = None
    # Whatever the operator typed before asking for help, e.g. "storefront at
    # dusk". Carried into the draft rather than paraphrased away.
    hint: str = ""


class DraftPromptResponse(BaseModel):
    prompt: str
    # False when the model call failed and this is the local template
    # instead, so the panel can say so rather than passing it off as a draft.
    ai_written: bool


def _direction_for(segment_id: str | None) -> dict:
    if not segment_id:
        return {}
    try:
        for row in persistence.fetch_creative_directions():
            if row.get("segment_brief_id") == segment_id:
                return row
    except Exception as exc:  # noqa: BLE001 -- a draft is not worth a 500
        logger.warning("Could not load creative direction for %s: %s", segment_id, exc)
    return {}


def _template_prompt(purpose: str, hint: str, direction: dict) -> str:
    """The deterministic fallback, used when the text model is unavailable.

    Written to the same terse house style as a drafted prompt, so the operator
    edits the same shape of thing either way — just plainer, because it is
    assembled from fields rather than composed.
    """
    subject = hint.strip().rstrip(".") or "a calm, uncluttered scene that suits the brand"
    parts = [f"{subject[0].upper()}{subject[1:]}."]
    if direction.get("tonality"):
        parts.append(f"{direction['tonality'].strip().rstrip('.')}.")
    parts.append(
        "Soft natural light, straight-on shot."
        if purpose == "logo"
        else "Soft natural light, straight-on shot, with open space for copy."
    )
    parts.append(NEGATIVE_TAILS.get(purpose, NEGATIVE_TAILS["hero"]))
    return " ".join(parts)


def _company_context() -> str:
    """The company preamble, or nothing if it can't be read.

    A draft is a convenience, not a pipeline stage -- losing the brand
    context makes the suggestion more generic, which the operator can fix by
    editing. Failing the whole request would leave them with an empty box.
    """
    try:
        block = brand.context_block()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Drafting without company context: %s", exc)
        return ""
    # Drop the website line. A domain is nothing a camera can see, and handed
    # one the writer works it into the scene as lettering -- drafts came back
    # asking for "an eye-level product shot for QQ.com.sg".
    return "\n".join(
        line for line in block.splitlines() if not line.lower().startswith("website:")
    )


def _draft_brief(purpose: str, hint: str, direction: dict) -> str:
    """The per-image half of the request: what to depict, and for whom.

    Kept to labelled one-liners. The house style lives in the system message,
    so everything here is the part that actually varies.
    """
    lines = [f"Write the image prompt. The image is {PURPOSES.get(purpose, PURPOSES['hero'])}."]

    company = _company_context()
    if company:
        lines += ["", company]

    # `design_style` is deliberately not passed on. It describes the *email
    # layout* ("clear cards, generous spacing") and a writer handed it dutifully
    # works it into the scene, producing photographs of nothing: "clear cards and
    # generous spacing against a warm room". Tonality survives the jump to an
    # image; layout language does not.
    brief = []
    if hint.strip():
        # The operator's own words are the brief, not a suggestion to improve
        # on -- they typed it because they want that thing in the picture.
        brief.append(f"Must depict: {hint.strip()}")
    if direction.get("tonality"):
        brief.append(f"Mood: {direction['tonality']}")
    palette = direction.get("palette") or {}
    if palette.get("accent"):
        # Named in words, because image models read "warm terracotta" and
        # ignore "#C2703D".
        brief.append(f"Echo this accent colour, named as a plain colour word: {palette['accent']}")
    if brief:
        lines += [""] + brief

    return "\n".join(lines)


# Preambles a model adds despite being told not to. Stripped rather than
# retried: the prompt underneath is usually fine, and a second call to fix
# punctuation is not worth the latency.
_PREFIX_RE = re.compile(r"^\s*(?:image\s+)?prompt\s*[:\-]\s*", re.IGNORECASE)
_FENCE_RE = re.compile(r"^\s*```[a-zA-Z]*\s*|\s*```\s*$")
_OPEN_QUOTES = "\"'“‘"
_CLOSE_QUOTES = "\"'”’"


def _clean_draft(text: str) -> str:
    """Reduces a model reply to the bare prompt: one paragraph, no wrapper.

    The system message asks for exactly this, but obedience varies by model
    and a stray "Prompt:" or code fence would be read as part of the scene by
    the image model downstream.

    The peels run in a loop because they nest in either order -- a model may
    emit `Prompt: "a street"` or `"Prompt: a street"`, and stripping quotes
    only after the label leaves the label behind on the second form.
    """
    cleaned = " ".join((text or "").split())
    for _ in range(4):
        before = cleaned
        cleaned = _FENCE_RE.sub("", cleaned).strip()
        cleaned = _PREFIX_RE.sub("", cleaned).strip()
        if len(cleaned) > 1 and cleaned[0] in _OPEN_QUOTES and cleaned[-1] in _CLOSE_QUOTES:
            cleaned = cleaned[1:-1].strip()
        if cleaned == before:
            break
    return cleaned


def _with_negative_tail(prompt: str, purpose: str) -> str:
    """Guarantees the standing no-lettering/no-faces clause is present.

    Appended here rather than requested in the system message, so the writer
    spends its whole word budget on the scene and the invariant holds even
    when the model ignores an instruction.
    """
    if not prompt:
        return prompt
    # Already said it in its own words? Don't say it twice.
    lowered = prompt.lower()
    if "no text" in lowered or "no lettering" in lowered or "without text" in lowered:
        return prompt
    tail = NEGATIVE_TAILS.get(purpose, NEGATIVE_TAILS["hero"])
    return f"{prompt.rstrip().rstrip('.')}. {tail}"


@router.post("/api/images/draft-prompt", response_model=DraftPromptResponse)
def draft_prompt(body: DraftPromptRequest) -> DraftPromptResponse:
    """Suggests a prompt. Produces no image and spends no image credits --
    the operator still has to read it and press Generate."""
    _require_openrouter()
    purpose = body.purpose if body.purpose in PURPOSES else "hero"
    direction = _direction_for(body.segment_id)

    try:
        result = generate_text(
            _draft_brief(purpose, body.hint, direction),
            stage="Imagery",
            agent="Image Prompt Writer",
            system_instruction=_WRITER_SYSTEM,
        )
        drafted = _clean_draft(result.text)
    except (OpenRouterNotConfiguredError, OpenRouterCallError, KeyError) as exc:
        logger.warning("Prompt draft fell back to the local template: %s", exc)
        return DraftPromptResponse(
            prompt=_template_prompt(purpose, body.hint, direction), ai_written=False
        )

    if not drafted:
        return DraftPromptResponse(
            prompt=_template_prompt(purpose, body.hint, direction), ai_written=False
        )
    return DraftPromptResponse(
        prompt=_with_negative_tail(drafted, purpose)[:MAX_IMAGE_PROMPT_CHARS], ai_written=True
    )


class GenerateImageRequest(BaseModel):
    # No default: the prompt is the whole point of the review step, so an
    # omitted one is a bug in the caller, not something to paper over.
    prompt: str = Field(min_length=1)
    aspect_ratio: str = "3:2"
    quality: str = "auto"
    background: str = "auto"
    purpose: str = "hero"
    segment_id: str | None = None


class GeneratedImageResponse(BaseModel):
    url: str
    prompt: str
    model: str
    aspect_ratio: str
    cost_usd: float


@router.post("/api/images/generate", response_model=GeneratedImageResponse)
def generate(body: GenerateImageRequest) -> GeneratedImageResponse:
    """Renders one image from the approved prompt and hosts it.

    The result is returned but *not* attached to anything -- the operator
    decides in the UI whether to keep it. That stops a rejected attempt from
    silently becoming the hero image of an email.
    """
    _require_openrouter()
    prompt = body.prompt.strip()

    try:
        image = generate_image(
            prompt,
            aspect_ratio=body.aspect_ratio,
            quality=body.quality,
            background=body.background,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OpenRouterNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OpenRouterCallError as exc:
        raise HTTPException(
            status_code=502, detail=f"The image model refused the request: {exc.body[:300]}"
        ) from exc

    try:
        url = storage.upload_image(
            image.data,
            filename=f"generated.{image.mime_type.split('/')[-1] or 'png'}",
            content_type=image.mime_type,
            prefix="generated",
        )
    except storage.StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    write_entry(
        LedgerEntry(
            campaign_id=WORKSPACE_ID,
            stage="Imagery",
            agent="Image Generator",
            prompt_version=PROMPT_VERSION,
            model_version=image.model_version,
            input_artifact_ids=[body.segment_id] if body.segment_id else [],
            output_artifact_id=url,
            actor="Operator",
        )
    )
    log_activity(
        "image.generate",
        detail=f"Generated a {body.aspect_ratio} image from a reviewed prompt",
        target_type="image",
        target_id=url,
        metadata={
            "prompt": prompt,
            "model": image.model_version,
            "purpose": body.purpose,
            "aspect_ratio": body.aspect_ratio,
            "quality": body.quality,
            "segment_id": body.segment_id,
        },
    )

    return GeneratedImageResponse(
        url=url,
        prompt=prompt,
        model=image.model_version,
        aspect_ratio=body.aspect_ratio,
        cost_usd=round(image.cost_usd, 4),
    )
