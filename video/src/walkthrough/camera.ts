/**
 * The screen camera: which point of the recording sits at the centre of the
 * frame, and how far in we are. Keys come from script.ts in source seconds;
 * each one starts a move from wherever the camera is at that moment, so keys
 * can interrupt each other and nothing ever jumps unless a key asks to
 * (`d: 0`, a cut-on-the-cut punch).
 *
 * Zoom is interpolated in log space (equal ratios feel equally fast), and
 * every hold creeps in by a few percent so a held shot never reads as a
 * paused screenshot.
 */
import { bezier, EASE } from "../lib/polish";
import { CAMERA, type CamEase } from "./script";
import { SRC_H, SRC_W, srcToCut } from "./timeline";

export type View = { x: number; y: number; z: number };

export const FULL: View = { x: SRC_W / 2, y: SRC_H / 2, z: 1 };

const EASES: Record<CamEase, (t: number) => number> = {
  glide: bezier(0.45, 0, 0.15, 1),
  snap: EASE.snappy,
  smooth: EASE.smooth,
};

const DRIFT = 0.028; // zoom gained over a long hold
const DRIFT_LEN = 420; // frames to reach it

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const KEYS = CAMERA.map((k) => ({ f: srcToCut(k.t), to: { x: k.x, y: k.y, z: k.z }, d: k.d ?? 28, ease: EASES[k.ease ?? "glide"] }))
  .map((k, i) => ({ ...k, i }))
  .sort((a, b) => a.f - b.f || a.i - b.i);

const under = (i: number, from: View, c: number): View => {
  const k = KEYS[i];
  const p = k.d <= 0 ? 1 : k.ease(clamp01((c - k.f) / k.d));
  const hold = clamp01((c - k.f - k.d) / DRIFT_LEN);
  const z = Math.exp(mix(Math.log(from.z), Math.log(k.to.z), p)) * (1 + DRIFT * EASE.out(hold));
  return { x: mix(from.x, k.to.x, p), y: mix(from.y, k.to.y, p), z };
};

/** The state each key starts its move from. */
const FROMS: View[] = [];
KEYS.forEach((k, i) => {
  FROMS.push(i === 0 ? FULL : under(i - 1, FROMS[i - 1], k.f));
});

/** The camera at a (fractional) cut frame. */
export const viewAt = (c: number): View => {
  let i = -1;
  for (let j = 0; j < KEYS.length && KEYS[j].f <= c; j++) i = j;
  return i < 0 ? FULL : under(i, FROMS[i], c);
};

/** Blend toward another view, zoom in log space. */
export const blendView = (a: View, b: View, t: number): View => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
  z: Math.exp(mix(Math.log(a.z), Math.log(b.z), t)),
});

/** Base fit: the whole recording, with a margin, at zoom 1. */
export const FRAME_W = 1920;
export const FRAME_H = 1080;
export const FIT = (FRAME_W - 2 * 64) / SRC_W;

/**
 * Screen-space placement of the recording for a view: scale, and the top-left
 * corner. Once the recording is wider (taller) than the frame it is clamped so
 * its edge never comes inside the frame — zoomed shots are always full-bleed.
 */
export const place = (v: View) => {
  const s = FIT * v.z;
  const w = SRC_W * s;
  const h = SRC_H * s;
  const axis = (frame: number, size: number, focus: number) => {
    const want = frame / 2 - focus * s;
    if (size <= frame) return (frame - size) / 2;
    return Math.min(0, Math.max(frame - size, want));
  };
  return { s, left: axis(FRAME_W, w, v.x), top: axis(FRAME_H, h, v.y) };
};
