/**
 * S4 — Segmentation. deck-deal-flyin (video-shotcraft demos/ui-entrance):
 * the six real segment cards (element captures) sit as a physical pile
 * beside the empty Segments page; the camera circles the pile, takes a
 * visible anticipation beat, then the cards are dealt into their real grid
 * slots on a hard-accelerating cadence while the camera pulls back to face
 * the full board. After a 0.5 s rest it pushes into "Loyal Full-Price
 * Buyers" and an amber bracket locks onto the age-proxy flag.
 *
 * Kept from the demo: 8 f dive with a z-arc (+110) and 1.06× peak, 4 f
 * overshoot settle (y1>1), 2 f press, blurred ghost trail, shadow lagging
 * the card by ~3 f, anticipation of 48 px / 30 px (the amplitudes the card
 * says must clear the eye's threshold).
 */
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Caption } from "../components/Caption";
import { useShotFrame } from "../components/Shot";
import { camPath, PageCam } from "../lib/cam";
import { bezier, EASE, ramp } from "../lib/polish";
import { C, MONO } from "../theme";
import { local } from "../timeline";
import layout from "../ui-layout.json";

const BOXES = layout.segments.boxes.cards;
const PILE = { x: 1540, y: 318 };
const STACK = 3;
const DEAL = local("segments", 26); // first card leaves on beat 26
const GAPS = [0, 7, 13, 18, 22, 25]; // hard-accelerating deal intervals: 7, 6, 5, 4, 3
const ANT = { from: DEAL - 10, down: 48, pull: 30 };
const DIVE = bezier(0.3, 0, 0.2, 1);
const SETTLE = bezier(0.3, 0, 0.25, 1.15);

const CARDS = BOXES.map((b, k) => ({
  ...b,
  src: `ui/segments@card${k + 1}.png`,
  cue: DEAL + GAPS[k],
  px: PILE.x + (((k * 7) % 9) - 4) * 2,
  py: PILE.y + (((k * 5) % 7) - 3) * 2,
  rz: ((k * 11) % 7) - 3,
  pz: (BOXES.length - k) * STACK,
}));

// The age-skew flag inside the Loyal Full-Price Buyers card (page px).
const FLAG = { x: 805, y: 465, w: 311, h: 29 };
const LOCK = local("segments", 31) + 4;

const cam = camPath([
  { f: -8, cx: 1700, cy: 560, zoom: 1.55, rotX: 40, rotY: -24, rotZ: 7, persp: 1200 },
  { f: 26, cx: 1700, cy: 540, zoom: 1.5, rotX: 36, rotY: 16, rotZ: -4, persp: 1200 },
  { f: 70, cx: 960, cy: 505, zoom: 0.86, rotX: 6, rotY: 0, rotZ: 0, persp: 1900, sx: 330 },
  { f: 96, cx: 960, cy: 500, zoom: 0.88, rotX: 0, persp: 1900, sx: 330 },
  { f: 132, cx: 952, cy: 330, zoom: 2.05, rotX: 0, rotY: -7, persp: 1900, sx: 330 },
  { f: 216, cx: 952, cy: 340, zoom: 2.12, rotY: -4, persp: 1900, sx: 330 },
]);

const Card: React.FC<{ c: (typeof CARDS)[number]; i: number; f: number }> = ({ c, i, f }) => {
  const antT = EASE.out(Math.min(1, Math.max(0, (f - ANT.from) / 10)));
  const dive = DIVE(Math.min(1, Math.max(0, (f - c.cue) / 8)));
  const settle = SETTLE(Math.min(1, Math.max(0, (f - c.cue - 8) / 4)));
  const inPile = f < c.cue;
  const landed = f >= c.cue + 12;
  const dx = (c.px - c.x) * (1 - dive);
  const dy = (c.py - c.y) * (1 - dive);
  const arc = Math.sin(dive * Math.PI) * 110;
  const z = inPile ? c.pz : (c.pz + (40 - c.pz) * dive + arc) * (1 - settle);
  const scale = (1 + Math.sin(dive * Math.PI) * 0.06) * (f >= c.cue + 10 && f <= c.cue + 12 ? (f === c.cue + 11 ? 0.996 : 1) : 1);
  const antDy = inPile ? ANT.down * antT * (f < DEAL + 2 ? 1 : 0) : 0;
  const antPull = i === 0 && inPile ? ANT.pull * antT : 0;
  const transform = landed
    ? "translate3d(0px,0px,0px)"
    : inPile
      ? `translate3d(${c.px - c.x - antPull}px, ${c.py - c.y + antDy}px, ${c.pz}px) rotateZ(${c.rz}deg)`
      : `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, ${z.toFixed(1)}px) rotateZ(${(c.rz * (1 - dive)).toFixed(2)}deg) scale(${scale.toFixed(4)})`;
  const lag = ramp(f, c.cue + 8, 7, EASE.out);
  const shadow = landed
    ? `0 ${(2 + 14 * (1 - lag)).toFixed(1)}px ${(8 + 28 * (1 - lag)).toFixed(1)}px rgba(17,20,43,${(0.07 + 0.1 * (1 - lag)).toFixed(3)})`
    : inPile
      ? i === CARDS.length - 1
        ? "0 1px 3px rgba(17,20,43,.18), 0 30px 60px rgba(17,20,43,0.28)"
        : "0 1px 2px rgba(17,20,43,.14)"
      : `0 ${36 - 24 * settle}px ${70 - 50 * settle}px rgba(17,20,43,${(0.26 - 0.14 * settle).toFixed(3)})`;
  const ghost = dive > 0.02 && dive < 0.98;
  return (
    <div style={{ transformStyle: "preserve-3d" }}>
      {ghost ? (
        <div
          style={{
            position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, borderRadius: 16, overflow: "hidden",
            transform: `translate3d(${(dx + (c.px - c.x) * 0.06).toFixed(1)}px, ${(dy + (c.py - c.y) * 0.06).toFixed(1)}px, ${z.toFixed(1)}px)`,
            opacity: 0.28 * (1 - dive), filter: "blur(7px)",
          }}
        >
          <Img src={staticFile(c.src)} style={{ width: "100%", height: "100%" }} />
        </div>
      ) : null}
      <div style={{ position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, borderRadius: 16, overflow: "hidden", transform, boxShadow: shadow }}>
        <Img src={staticFile(c.src)} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
};

/** Four L-shaped corners spring from wide to tight with one overshoot (scanline-annotate-focus). */
const Bracket: React.FC<{ f: number }> = ({ f }) => {
  if (f < LOCK) return null;
  const t = EASE.overshoot(Math.min(1, (f - LOCK) / 12));
  const pad = 10 + 34 * (1 - t);
  const op = ramp(f, LOCK, 5, EASE.out);
  const L = 16;
  const corner = (k: number): React.CSSProperties => ({
    position: "absolute",
    width: L,
    height: L,
    borderColor: C.revise,
    borderStyle: "solid",
    borderWidth: 0,
    ...(k < 2 ? { top: -pad } : { bottom: -pad }),
    ...(k % 2 === 0 ? { left: -pad } : { right: -pad }),
    ...(k < 2 ? { borderTopWidth: 3 } : { borderBottomWidth: 3 }),
    ...(k % 2 === 0 ? { borderLeftWidth: 3 } : { borderRightWidth: 3 }),
    borderRadius: 3,
  });
  const tag = ramp(f, LOCK + 8, 10, EASE.snappy);
  const text = "PROXY CHECK · AGE +37%";
  const shown = text.slice(0, Math.round(text.length * ramp(f, LOCK + 10, 14, EASE.linear)));
  return (
    <div style={{ position: "absolute", left: FLAG.x, top: FLAG.y, width: FLAG.w, height: FLAG.h, opacity: op }}>
      {[0, 1, 2, 3].map((k) => (
        <div key={k} style={corner(k)} />
      ))}
      <div
        style={{
          position: "absolute",
          left: -10,
          top: -58,
          padding: "5px 10px",
          borderRadius: 7,
          background: C.revise,
          color: "#fff",
          fontFamily: MONO,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
          opacity: tag,
          transform: `translateY(${((1 - tag) * 8).toFixed(1)}px)`,
          boxShadow: "0 6px 16px rgba(245,158,11,0.35)",
        }}
      >
        {shown}
      </div>
    </div>
  );
};

export const Segments: React.FC = () => {
  const f = useShotFrame();
  const c = cam(f);
  const landed = CARDS.filter((k) => f >= k.cue + 8).length;
  return (
    <AbsoluteFill>
      <PageCam src="ui/segments-empty.jpg" pageH={1080} cam={c} floor="#ECEDF6">
        {CARDS.map((k, i) => (
          <Card key={i} c={k} i={i} f={f} />
        ))}
        <Bracket f={f} />
      </PageCam>
      <Caption
        kicker={`AGENT 01 · ${String(landed).padStart(2, "0")}/06 SEGMENTS`}
        title="Six segments. Found, not guessed."
        sub="HDBSCAN over 1,000 contacts. Every trait explained."
        at={40}
        until={118}
        tile={3}
      />
      <Caption
        kicker="AGENT 01 · SEGMENTATION"
        title="Skewed on age? Flagged for a human."
        sub="Protected attributes never drive a segment."
        at={124}
        until={214}
        tile={3}
      />
    </AbsoluteFill>
  );
};
