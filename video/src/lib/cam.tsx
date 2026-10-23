// 2.5D page camera. The transform math is video-shotcraft's PageCam
// (assets/lib/PageCam.tsx): magnification goes through CSS `zoom`, not
// scale(), so Chromium rasterises the page at the enlarged size and text stays
// sharp under perspective (aesthetic rule Q2). Keyframes are joined with the
// monotone cubic Hermite spline from the deck-deal-flyin demo, so the camera's
// velocity is continuous through every key — no hitch at keyframes.
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

export type Cam = {
  cx: number; // page-space point held at the screen centre
  cy: number;
  zoom: number;
  rotX: number; // + = top edge leans away
  rotY: number; // + = right edge recedes
  rotZ: number;
  persp: number;
  sx: number; // screen-space shift after projection (frees room for captions)
  sy: number;
};
export type CamKey = { f: number } & Partial<Cam> & Pick<Cam, "cx" | "cy" | "zoom">;

const DEFAULTS: Omit<Cam, "cx" | "cy" | "zoom"> = { rotX: 0, rotY: 0, rotZ: 0, persp: 1600, sx: 0, sy: 0 };
const PARAMS: (keyof Cam)[] = ["cx", "cy", "zoom", "rotX", "rotY", "rotZ", "persp", "sx", "sy"];

const hermite = (xs: number[], ys: number[]) => {
  const n = xs.length;
  if (n === 1) return () => ys[0];
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
  const m = xs.map((_, i) => (i === 0 ? 0 : i === n - 1 ? 0 : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
};

/** Builds a camera path; call the result with a frame. Keys must be sorted by f. */
export const camPath = (keys: CamKey[]) => {
  const full = keys.map((k) => ({ ...DEFAULTS, ...k }));
  const curves = PARAMS.map((p) => hermite(full.map((k) => k.f), full.map((k) => k[p] as number)));
  return (f: number): Cam => Object.fromEntries(PARAMS.map((p, i) => [p, curves[i](f)])) as Cam;
};

/** Screen position of a page-space point under a flat (unrotated) camera. */
export const toScreen = (cam: Cam, x: number, y: number) => ({
  x: 960 + (x - cam.cx) * cam.zoom + cam.sx,
  y: 540 + (y - cam.cy) * cam.zoom + cam.sy,
});

/**
 * A page texture (2x screenshot, laid out at CSS size `w`×`pageH`) under the
 * camera. Children are page-space overlays in CSS px — the same coordinate
 * system as src/ui-layout.json — and ride the camera with the page.
 */
export const PageCam: React.FC<{
  src: string;
  pageH: number;
  cam: Cam;
  w?: number;
  children?: React.ReactNode;
  /** Painted behind the page out to infinity, so tilts never show the void. */
  floor?: string;
  filter?: string;
}> = ({ src, pageH, cam, w = 1920, children, floor, filter }) => {
  const { cx, cy, zoom, rotX, rotY, rotZ, persp, sx, sy } = cam;
  return (
    // The shift goes on the perspective box, not the clipping box: shifting the
    // clip would expose a bare strip at the screen edge.
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: `${(persp * zoom).toFixed(2)}px`,
          perspectiveOrigin: "960px 540px",
          transform: sx || sy ? `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px)` : undefined,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: w,
            height: pageH,
            zoom,
            transform: `translate(${(960 / zoom - cx).toFixed(3)}px, ${(540 / zoom - cy).toFixed(3)}px) rotateY(${rotY.toFixed(3)}deg) rotateX(${rotX.toFixed(3)}deg) rotateZ(${rotZ.toFixed(3)}deg)`,
            transformOrigin: `${cx.toFixed(2)}px ${cy.toFixed(2)}px`,
            transformStyle: "preserve-3d",
            filter,
          }}
        >
          {floor ? <div style={{ position: "absolute", left: -3000, top: -3000, width: w + 6000, height: pageH + 6000, background: floor }} /> : null}
          {src ? <Img src={staticFile(src)} style={{ position: "absolute", left: 0, top: 0, width: w, height: pageH }} /> : null}
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** A cut-out (element screenshot) placed at its page-space bbox. */
export const Cutout: React.FC<{
  src: string;
  box: { x: number; y: number; w: number; h: number };
  radius?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ src, box, radius = 20, style, children }) => (
  <div
    style={{
      position: "absolute",
      left: box.x,
      top: box.y,
      width: box.w,
      height: box.h,
      borderRadius: radius,
      overflow: "hidden",
      ...style,
    }}
  >
    <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    {children}
  </div>
);
