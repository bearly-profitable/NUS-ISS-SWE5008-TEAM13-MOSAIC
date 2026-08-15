"""
Small routes that keep ported email-builder features from hard-404ing before
their real backends are wired up: GIF optimize (Tier 3, optional) and the
image-folders gallery API that ImageUpload.tsx's HeroGallery/FolderDestPicker
call. Both degrade to a no-op / empty response rather than erroring.
"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class GifOptimizeRequest(BaseModel):
    imageUrl: str


@router.post("/api/gif-optimize")
def gif_optimize(_body: GifOptimizeRequest):
    # Not implemented yet — frontend falls back to the original GIF on failure.
    return {"detail": "gif-optimize not implemented yet"}, 501


@router.get("/api/image-folders")
def list_image_folders():
    return {"folders": []}


@router.get("/api/image-assets")
def list_image_assets():
    return {"assets": []}


@router.post("/api/image-assets/register")
def register_image_asset(_body: dict):
    return {"ok": True}
