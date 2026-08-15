/**
 * Browser-side compositor for video thumbnails: draws the source image with a
 * centered play button into a canvas, then uploads the resulting PNG to
 * Supabase. The returned public URL can be embedded directly in exported email
 * HTML — no backend canvas dependency.
 */
import { uploadEmailImageBlob } from "@/lib/email-image-storage";

/**
 * Load an image by fetching it as a blob first, then creating an object URL.
 * This avoids CORS canvas-tainting issues with external hosts like YouTube
 * that don't serve Access-Control-Allow-Origin headers.
 */
function loadImageViaFetch(url: string): Promise<HTMLImageElement | null> {
  return new Promise(async (resolve) => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) { resolve(null); return; }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    } catch {
      resolve(null);
    }
  });
}

function drawPlayButton(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const radius = Math.min(width, height) * 0.11;
  const cx = width / 2;
  const cy = height / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = Math.max(8, radius * 0.35);
  ctx.shadowOffsetY = Math.max(2, radius * 0.08);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const triW = radius * 0.72;
  const triH = radius * 0.92;
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.moveTo(cx - triW * 0.28, cy - triH / 2);
  ctx.lineTo(cx - triW * 0.28, cy + triH / 2);
  ctx.lineTo(cx + triW * 0.55, cy);
  ctx.closePath();
  ctx.fill();
}

export async function generatePlayThumbnailBlob(thumbUrl: string): Promise<Blob | null> {
  if (!thumbUrl) return null;

  const image = await loadImageViaFetch(thumbUrl);
  if (!image) return null;

  const w = image.naturalWidth || 1280;
  const h = image.naturalHeight || 720;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0, w, h);
  drawPlayButton(ctx, w, h);

  try {
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/png"),
    );
  } catch {
    return null;
  }
}

/**
 * Builds the play-button thumbnail composite and uploads it to Supabase.
 * Returns the public URL, or `null` if the source image could not be loaded
 * cross-origin or the upload fails.
 */
export async function generateAndUploadPlayThumbnail(thumbUrl: string): Promise<string | null> {
  const blob = await generatePlayThumbnailBlob(thumbUrl);
  if (!blob) return null;
  return await uploadEmailImageBlob(blob, {
    filenamePrefix: "video-thumb",
    ext: "png",
    contentType: "image/png",
  });
}
