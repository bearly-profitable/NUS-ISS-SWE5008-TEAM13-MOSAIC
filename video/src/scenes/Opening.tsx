/**
 * S1 hook + S2 brand — the icon-field-colorize card (video-shotcraft
 * demos/opening/icon-field-colorize), re-skinned for the Console's light
 * glass look.
 *
 * Every keycap is a customer, and every one carries the same grey envelope:
 * one email for everyone. On the drop (slam #1) bands of the eight MOSAIC
 * tile colours sweep down the field — each customer's email turns their own
 * colour — then the lit keycaps stream into the mark.
 *
 * Kept from the demo (its tuned numbers): 17×10 field on a 108×106 pitch,
 * half-cell row offset, 10 centre-out batches 4.4 f apart with a 0.6→1.06→1
 * pop, an inhale dim before the hit, row lag 1.4 f + column tilt 0.25 f +
 * ≤1.5 f jitter, 4 f clip-fill flip (never a cross-fade), 1.22× pop and a
 * 5 f flash once the new colour has filled.
 */
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { MosaicMark, TILE_SHAPES, Wordmark } from "../components/MosaicMark";
import { useShotFrame } from "../components/Shot";
import { EASE, mix, ramp, SpeedBlur, velocity } from "../lib/polish";
import { TextReveal } from "../lib/text";
import { C, TILE_LIST } from "../theme";
import { beatF } from "../timeline";

const mulberry32 = (a: number) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const COLS = 17;
const ROWS = 10;
const CELL_X = 108;
const CELL_Y = 106;
const TILE = 66;
const X0 = (1920 - ((COLS - 1) * CELL_X + CELL_X / 2 + TILE)) / 2;
const Y0 = (1080 - ((ROWS - 1) * CELL_Y + TILE)) / 2;
const FLIP = 4;

// Beat-anchored cues (film frames; this shot starts at 0).
const DROP = beatF(8); // slam #1 — first colour wave
const INHALE = DROP - 22;
const CONVERGE = beatF(11) - 2; // lit field holds ~1 beat, then streams into the mark
const MARK = beatF(11) + 8;
const WORD = beatF(13) - 4;
const TAG = beatF(13) + 10;
const EXIT = beatF(16) - 4; // hand-off to Company Info's tilt-reveal

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const css = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const shade = (c: RGB, k: number): RGB => c.map((v) => Math.round(Math.max(0, Math.min(255, v + k * 255)))) as RGB;

// Eight waves, one per mark tile, each owning a lower band of rows.
const WAVES = TILE_LIST.map((h, k) => ({ color: hex(h), fromRow: Math.floor((k * ROWS) / TILE_LIST.length), start: DROP + k * 2.2, k }));
const GRAYS = ["#A7ABC4", "#B4B8CE", "#9A9FBB"];

// Where each mark tile sits on screen (MosaicMark at MARK_W, centred at MARK_CY).
const MARK_W = 300;
const MARK_CY = 380;
const markScale = MARK_W / 772;
const markCentroids = TILE_SHAPES.map((t) => {
  const cx = t.pts.reduce((a, p) => a + p[0], 0) / t.pts.length;
  const cy = t.pts.reduce((a, p) => a + p[1], 0) / t.pts.length;
  return { x: 960 + (cx - 34 - 772 / 2) * markScale, y: MARK_CY + (cy - 14 - 656 / 2) * markScale };
});

const rnd = mulberry32(20261023);
const ICONS = Array.from({ length: ROWS * COLS }, (_, idx) => {
  const r = Math.floor(idx / COLS);
  const c = idx % COLS;
  const r1 = rnd();
  const r2 = rnd();
  const r3 = rnd();
  const x = X0 + c * CELL_X + (r % 2) * (CELL_X / 2);
  const y = Y0 + r * CELL_Y;
  const d = Math.hypot(x + TILE / 2 - 960, y + TILE / 2 - 540) / Math.hypot(960, 540);
  const batch = Math.min(9, Math.floor((d * 0.75 + r1 * 0.35) * 10));
  const arrive = WAVES.filter((w) => r >= w.fromRow).map((w) => ({ w, at: w.start + (r - w.fromRow) * 1.4 + c * 0.25 + r3 * 1.5 }));
  const last = arrive[arrive.length - 1].w.k;
  const target = markCentroids[last];
  return {
    r, c, x, y, d,
    t0: 2 + batch * 4.4 + r2 * 3,
    gray: GRAYS[Math.floor(r2 * GRAYS.length)],
    jit: (r1 - 0.5) * 0.06,
    arrive,
    target,
    // Converge cue: nearest the mark go first, the far edges last but fastest.
    cue: CONVERGE + d * 14 + r2 * 4,
  };
});

const Envelope: React.FC<{ color: string; flap: string }> = ({ color, flap }) => (
  <svg viewBox="0 0 24 24" width={34} height={34} style={{ display: "block" }}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.6" fill={color} />
    <path d="M3.6 6.6 12 12.6l8.4-6" fill="none" stroke={flap} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Key: React.FC<{ gray: string; tint: RGB | null; glowK?: number }> = ({ gray, tint, glowK = 1 }) => {
  const lit = tint !== null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 18,
        background: lit
          ? `linear-gradient(180deg, ${css(shade(tint, 0.1))} 0%, ${css(tint)} 55%, ${css(shade(tint, -0.08))} 100%)`
          : "linear-gradient(180deg, #FFFFFF 0%, #EEF0F8 100%)",
        boxShadow: lit
          ? `inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 0 ${css(shade(tint, -0.2), 0.45)}, 0 0 ${(24 * glowK).toFixed(1)}px ${css(tint, 0.38 * glowK)}, 0 12px 22px -10px ${css(shade(tint, -0.3), 0.55)}`
          : "inset 0 1px 0 #fff, inset 0 0 0 1px rgba(17,20,43,0.05), 0 8px 16px -8px rgba(17,20,43,0.22)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Envelope color={lit ? "rgba(255,255,255,0.94)" : gray} flap={lit ? css(tint) : "#F4F5FA"} />
    </div>
  );
};

export const Opening: React.FC = () => {
  const f = useShotFrame();

  // Inhale before the drop (12% dim + tiny pull back), released by the first wave.
  const inhale = ramp(f, INHALE, 16, EASE.smooth) * (1 - ramp(f, DROP, 6, EASE.out));
  // Slam #1 — the one camera-level hit in this shot: field punches out 3% and settles.
  const slam = f >= DROP ? Math.sin(Math.min(1, (f - DROP) / 10) * Math.PI) * (1 - ramp(f, DROP, 16, EASE.out)) : 0;
  const push = 1 + 0.035 * ramp(f, 0, DROP, EASE.smooth) - 0.012 * inhale + 0.03 * slam;

  const rowLit = new Array(ROWS).fill(0);
  const rowColor: (RGB | null)[] = new Array(ROWS).fill(null);

  const icons = ICONS.map((ic, i) => {
    const op = ramp(f, ic.t0, 7, EASE.out);
    if (op <= 0) return null;
    const appear = mix(0.6, 1, ramp(f, ic.t0, 13, EASE.overshoot));
    const lift = (1 - ramp(f, ic.t0, 13, EASE.snappy)) * 10;
    let prev: RGB | null = null;
    let cur: RGB | null = null;
    let p = 0;
    let since = -1;
    for (const a of ic.arrive) {
      const q = Math.min(1, Math.max(0, (f - a.at) / FLIP));
      if (q > 0) {
        prev = cur;
        cur = shade(a.w.color, ic.jit);
        p = q;
        since = f - a.at;
      }
    }
    if (cur) {
      rowLit[ic.r] += 1 / COLS;
      rowColor[ic.r] = cur;
    }
    const flipping = p > 0 && p < 1;
    const pop = flipping ? 1 + Math.sin(p * Math.PI) * 0.22 : 1;
    const flash = since >= FLIP ? Math.max(0, 1 - (since - FLIP) / 5) : 0;
    const glowK = since >= 0 ? 1 + 1.2 * Math.max(0, 1 - since / 12) : 1;

    // Converge: accelerate (ease-in) toward this colour's tile in the mark.
    const flyAt = (fr: number) => EASE.exit(Math.min(1, Math.max(0, (fr - ic.cue) / 16)));
    const fly = flyAt(f);
    if (fly >= 1) return null;
    const ox = (ic.target.x - (ic.x + TILE / 2)) * fly;
    const oy = (ic.target.y - (ic.y + TILE / 2)) * fly;
    const vx = velocity((fr) => (ic.target.x - (ic.x + TILE / 2)) * flyAt(fr), f);
    const vy = velocity((fr) => (ic.target.y - (ic.y + TILE / 2)) * flyAt(fr), f);
    const shrink = 1 - 0.78 * fly;

    const body = (
      <div
        key={i}
        style={{
          position: "absolute",
          left: ic.x,
          top: ic.y + lift,
          width: TILE,
          height: TILE,
          opacity: op * (1 - ramp(fly, 0.7, 0.3, EASE.linear)),
          transform: `translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px) scale(${(appear * pop * shrink).toFixed(4)})`,
        }}
      >
        <Key gray={ic.gray} tint={flipping ? prev : cur} glowK={glowK} />
        {flipping && (
          <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 ${((1 - EASE.out(p)) * 100).toFixed(2)}% 0 round 18px)` }}>
            <Key gray={ic.gray} tint={cur} glowK={glowK} />
          </div>
        )}
        {flash > 0 && (
          <div style={{ position: "absolute", inset: 0, borderRadius: 18, background: `rgba(255,255,255,${(0.6 * flash).toFixed(3)})` }} />
        )}
      </div>
    );
    return fly > 0.02 ? (
      <SpeedBlur key={i} vx={vx} vy={vy} amount={0.3} max={20}>
        {body}
      </SpeedBlur>
    ) : (
      body
    );
  });

  // Hook copy over a soft centre scrim.
  const hookIn = ramp(f, 10, 20, EASE.out);
  const hookOut = ramp(f, INHALE + 2, 12, EASE.exit);
  const fieldFade = 1 - ramp(f, CONVERGE + 10, 20, EASE.out);
  const exit = ramp(f, EXIT, 18, EASE.exit);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* light spill: a lit row tints the stage behind it */}
      <AbsoluteFill style={{ transform: `scale(${push})`, opacity: fieldFade }}>
        {rowColor.map((c, r) =>
          c ? (
            <div
              key={r}
              style={{
                position: "absolute",
                left: -100,
                right: -100,
                top: Y0 + r * CELL_Y + TILE / 2 - CELL_Y * 1.1,
                height: CELL_Y * 2.2,
                background: `linear-gradient(180deg, ${css(c, 0)} 0%, ${css(c, 0.13 * rowLit[r])} 50%, ${css(c, 0)} 100%)`,
              }}
            />
          ) : null,
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${push})`, opacity: 1 - 0.12 * inhale }}>{icons}</AbsoluteFill>

      {/* hook */}
      <AbsoluteFill
        style={{
          opacity: hookIn * (1 - hookOut),
          background: "radial-gradient(ellipse 38% 30% at 50% 50%, rgba(246,247,252,0.96) 0%, rgba(246,247,252,0.88) 50%, rgba(246,247,252,0) 100%)",
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center" }}>
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: "-0.045em", color: C.ink, lineHeight: 1.04 }}>
          <TextReveal text="1,000 customers." by="word" variant="rise" start={14} each={20} gap={6} frame={f} out={{ start: INHALE + 2, dur: 12 }} />
        </div>
        <div style={{ fontSize: 60, fontWeight: 500, letterSpacing: "-0.025em", color: C.muted, marginTop: 18 }}>
          <TextReveal text="One email for all of them." by="word" variant="blur" start={52} each={16} gap={4} frame={f} out={{ start: INHALE, dur: 12 }} />
        </div>
      </AbsoluteFill>

      {/* brand lockup */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          opacity: 1 - exit,
          transform: `translateY(${(-60 * exit).toFixed(1)}px) scale(${(1 - 0.25 * exit).toFixed(4)})`,
          filter: exit > 0 ? `blur(${(exit * 10).toFixed(2)}px)` : undefined,
        }}
      >
        <div style={{ position: "absolute", top: MARK_CY - (MARK_W * 656) / 772 / 2, left: 960 - MARK_W / 2 }}>
          {f >= MARK ? <MosaicMark width={MARK_W} delay={MARK} stagger={2.2} frame={f} /> : null}
        </div>
        <div style={{ position: "absolute", top: 560 }}>
          <Wordmark size={110} progress={interpolate(f, [WORD, WORD + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
        </div>
        <div style={{ position: "absolute", top: 740, fontSize: 52, fontWeight: 500, letterSpacing: "-0.02em", color: C.muted }}>
          <TextReveal text="Every segment gets its own email." by="word" variant="blur" start={TAG} each={16} gap={3} frame={f} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
