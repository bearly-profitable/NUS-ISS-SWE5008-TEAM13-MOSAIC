/**
 * Image generation API client.
 *
 * Two calls, both deliberately manual. `draftImagePrompt` only fills the
 * textarea with a suggestion; `generateImage` is the one that actually costs
 * money, and nothing in the app calls it except a button press. Neither is
 * ever invoked on mount, on tab switch, or as part of a pipeline run.
 */
import { ORCHESTRATOR_BASE } from "@/services/emailApi";

const base = ORCHESTRATOR_BASE.replace(/\/+$/, "");

const jsonHeaders: Record<string, string> = { "Content-Type": "application/json" };

/** What the image is for. Steers the drafted prompt, not the render. */
export type ImagePurpose = "hero" | "logo" | "block";

export interface ImageGenConfig {
  configured: boolean;
  model: string;
  aspect_ratios: string[];
  qualities: string[];
  backgrounds: string[];
  max_prompt_chars: number;
}

export interface DraftedPrompt {
  prompt: string;
  /** False when the backend fell back to its local template. */
  ai_written: boolean;
}

export interface GeneratedImage {
  url: string;
  prompt: string;
  model: string;
  aspect_ratio: string;
  cost_usd: number;
}

/** Pulls a FastAPI `detail` out of an error body, falling back to raw text. */
async function errorFrom(res: Response): Promise<Error> {
  const text = await res.text();
  try {
    return new Error(JSON.parse(text)?.detail ?? text);
  } catch {
    return new Error(text || `Request failed (${res.status})`);
  }
}

export async function getImageGenConfig(): Promise<ImageGenConfig> {
  const res = await fetch(`${base}/api/images/config`);
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

export async function draftImagePrompt(body: {
  purpose: ImagePurpose;
  hint?: string;
  segmentId?: string | null;
}): Promise<DraftedPrompt> {
  const res = await fetch(`${base}/api/images/draft-prompt`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      purpose: body.purpose,
      hint: body.hint ?? "",
      segment_id: body.segmentId ?? null,
    }),
  });
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

export async function generateImage(body: {
  prompt: string;
  aspectRatio: string;
  quality?: string;
  background?: string;
  purpose?: ImagePurpose;
  segmentId?: string | null;
}): Promise<GeneratedImage> {
  const res = await fetch(`${base}/api/images/generate`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      prompt: body.prompt,
      aspect_ratio: body.aspectRatio,
      quality: body.quality ?? "auto",
      background: body.background ?? "auto",
      purpose: body.purpose ?? "hero",
      segment_id: body.segmentId ?? null,
    }),
  });
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}
