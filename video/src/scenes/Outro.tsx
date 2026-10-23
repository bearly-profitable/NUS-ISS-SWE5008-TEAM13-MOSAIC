/**
 * S12 — outro-group-photo-launch (video-shotcraft demos/outro): one real
 * element from every feature shown flies in from its own side and settles
 * around the mark; slam #3 is the wordmark stamp on beat 92; crane-in
 * camera, stage light, rule with extension lines, drifting dust in the tile
 * colours. Outro carries no caption (copy rule C1's exception) — only the
 * lockup lines.
 *
 * Kept from the demo: fly 12 f on bezier(0.34,1.4,0.44,1) (a true
 * overshoot), cues 3 f apart, rot×2 → settled rot, ×1.12 → 1 scale, speed
 * blur 0.3×px/f capped at 22, landing squash 1.5% with contact shadow
 * tightening, recede (−12% opacity, −8% saturation) when the mark lands,
 * crane rotateX 4°→0 + scale 1.06→1 over 40 f then a slow push.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile } from "remotion";
import { MosaicMark } from "../components/MosaicMark";
import { useShotFrame } from "../components/Shot";
import { camPath, PageCam } from "../lib/cam";
import { EASE, ramp, SpeedBlur, velocity } from "../lib/polish";
import { C, MONO, TILE_LIST } from "../theme";
import { local } from "../timeline";
import layout from "../ui-layout.json";

const STAMP = local("outro", 92); // slam #3
const FLY = Easing.bezier(0.34, 1.4, 0.44, 1);

type El = { src: string; w: number; h: number; cx: number; cy: number; s: number; rot: number; dx: number; dy: number; r: number };
const ELS: El[] = [
  { src: "ui/segments@card2.png", w: 352, h: 393, cx: 300, cy: 300, s: 0.66, rot: -5, dx: -520, dy: -40, r: 16 },
  { src: "ui/creative@card2.png", w: 1088, h: 147, cx: 960, cy: 140, s: 0.56, rot: 1.5, dx: 0, dy: -280, r: 16 },
  { src: "ui/emails@card1.png", w: 536, h: 408, cx: 1630, cy: 300, s: 0.6, rot: 4, dx: 540, dy: -30, r: 16 },
  { src: "ui/approvals-gift@card2.png", w: 828, h: 690, cx: 240, cy: 880, s: 0.42, rot: 3, dx: -460, dy: 300, r: 16 },
  { src: "ui/eval@card.png", w: 1088, h: 552, cx: 1660, cy: 870, s: 0.46, rot: -3, dx: 480, dy: 300, r: 18 },
];

const DUST = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 439 + 137) % 1920,
  y0: (i * 613 + 271) % 1080,
  rise: 0.3 + (i % 5) * 0.11,
  sway: 9 + (i % 4) * 5,
  freq: 0.022 + (i % 3) * 0.008,
  ph: (i * 0.83) % (Math.PI * 2),
  size: 3 + (i % 3) * 1.2,
  op: 0.35 + ((i * 7) % 5) * 0.09,
  color: TILE_LIST[i % TILE_LIST.length],
}));

const bgCam = camPath([{ f: 0, cx: 960, cy: 700, zoom: 0.78 }]);

const Chip: React.FC<{ f: number }> = ({ f }) => {
  // The send toast, back for the group photo.
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px 16px 16px", borderRadius: 20, background: "#fff", border: "1px solid rgba(17,20,43,0.06)" }}>
      <div style={{ width: 40, height: 40, borderRadius: 20, background: "#E3F5EC", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={C.pass} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.ink, whiteSpace: "nowrap" }}>Sent · approved by a person</div>
    </div>
  );
};

export const Outro: React.FC = () => {
  const f = useShotFrame();
  const crane = interpolate(f, [0, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0, 0.2, 1) });
  const push = ramp(f, 36, 144, EASE.smooth);
  const punch = f >= STAMP ? Math.sin(Math.min(1, (f - STAMP) / 8) * Math.PI) * (1 - ramp(f, STAMP, 14, EASE.out)) : 0;
  const camScale = 1.06 - 0.06 * crane + 0.03 * push + 0.015 * punch;
  const recede = ramp(f, STAMP - 4, 8, EASE.out);
  const blur = interpolate(f, [0, 24], [4, 14], { extrapolateRight: "clamp" });
  const stage = interpolate(f, [STAMP - 4, STAMP + 6, STAMP + 18], [0, 0.6, 0.36], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rule = ramp(f, STAMP + 20, 12, EASE.snappy);
  const ext = ramp(f, STAMP + 20, 8, EASE.snappy) * (1 - ramp(f, STAMP + 28, 6, EASE.out));
  const tag = ramp(f, STAMP + 30, 14, EASE.out);
  const team = ramp(f, STAMP + 42, 14, EASE.out);
  const sweepX = interpolate(f, [2, 16], [-700, 2020], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sweepOp = interpolate(f, [2, 5, 13, 16], [0, 0.5, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const markT = interpolate(f, [STAMP - 4, STAMP + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.2, 0.75, 0.3, 1) });

  const fly = (i: number, w: number, h: number, cx: number, cy: number, s: number, rot: number, dx: number, dy: number, child: React.ReactNode, r: number) => {
    const cue = 4 + i * 3;
    if (f < cue) return null;
    const tAt = (fr: number) => interpolate(fr, [cue, cue + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: FLY });
    const t = tAt(f);
    const land = interpolate(f, [cue + 9, cue + 12, cue + 16], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const air = Math.max(0, 1 - t);
    const vx = velocity((fr) => dx * (1 - tAt(fr)), f);
    const vy = velocity((fr) => dy * (1 - tAt(fr)), f);
    return (
      <SpeedBlur key={i} vx={vx} vy={vy} amount={0.3} max={22}>
        <div
          style={{
            position: "absolute", left: cx - w / 2, top: cy - h / 2, width: w, height: h, borderRadius: r, overflow: "hidden",
            transform: `translate(${(dx * (1 - t)).toFixed(1)}px, ${(dy * (1 - t)).toFixed(1)}px) rotate(${(rot * (2 - t)).toFixed(2)}deg) scale(${(s * (1.12 - 0.12 * t) * (1 - 0.015 * land)).toFixed(4)})`,
            boxShadow: `0 ${(14 + 26 * air - 6 * land).toFixed(1)}px ${(34 + 46 * air - 12 * land).toFixed(1)}px rgba(17,20,43,${(0.16 + 0.08 * air).toFixed(3)}), 0 2px 6px rgba(17,20,43,.06)`,
            opacity: interpolate(f, [cue, cue + 3], [0, 1], { extrapolateRight: "clamp" }) * (1 - 0.12 * recede),
            filter: `saturate(${(1 - 0.08 * recede).toFixed(3)})`,
          }}
        >
          {child}
        </div>
      </SpeedBlur>
    );
  };

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `perspective(1400px) rotateX(${(4 * (1 - crane)).toFixed(3)}deg) scale(${camScale.toFixed(4)})`, transformOrigin: "50% 45%" }}>
        <PageCam src="ui/emails.jpg" pageH={layout.emails.pageH} cam={bgCam(f)} filter={`blur(${blur.toFixed(1)}px)`} />
        <AbsoluteFill style={{ background: "radial-gradient(1200px 800px at 50% 48%, rgba(246,247,252,0.9), rgba(246,247,252,0.62) 60%, rgba(243,244,250,0.45))" }} />
        {ELS.map((e, i) => fly(i, e.w, e.h, e.cx, e.cy, e.s, e.rot, e.dx, e.dy, <Img src={staticFile(e.src)} style={{ width: "100%", height: "100%" }} />, e.r))}
        {fly(ELS.length, 430, 72, 960, 970, 1, -1.5, 0, 320, <Chip f={f} />, 20)}
      </AbsoluteFill>

      {/* dust in the tile colours */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {DUST.map((d, i) => {
          const y = (((d.y0 - f * d.rise) % 1080) + 1080) % 1080;
          const x = d.x + Math.sin(f * d.freq + d.ph) * d.sway;
          const tw = 0.7 + 0.3 * Math.sin(f * 0.21 + d.ph * 3);
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, width: d.size, height: d.size, borderRadius: "50%", background: d.color, opacity: d.op * tw * ramp(f, 6, 20, EASE.out), boxShadow: `0 0 ${d.size * 2.5}px ${d.size * 0.6}px ${d.color}88` }} />
          );
        })}
      </AbsoluteFill>

      {sweepOp > 0 ? (
        <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "soft-light" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: sweepX - 300, width: 600, background: "linear-gradient(90deg, rgba(255,255,255,0), #fff 50%, rgba(255,255,255,0))", opacity: sweepOp }} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: stage, background: "radial-gradient(720px 420px at 960px 470px, rgba(255,255,255,1), rgba(255,255,255,0.4) 55%, rgba(255,255,255,0) 76%)" }} />

      {/* lockup */}
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ position: "absolute", top: 250, opacity: markT, transform: `translateY(${((1 - markT) * 28).toFixed(1)}px) scale(${(1.35 - 0.35 * markT).toFixed(4)})`, filter: markT < 0.995 ? `blur(${((1 - markT) * 8).toFixed(2)}px)` : undefined }}>
          <MosaicMark width={210} still />
        </div>
        <div style={{ position: "absolute", top: 452, display: "flex", paddingLeft: 120 * 0.26 }}>
          {"MOSAIC".split("").map((ch, i) => {
            const d = STAMP + i * 1.8;
            const t = interpolate(f, [d, d + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.2, 0.75, 0.3, 1) });
            return (
              <span
                key={i}
                style={{
                  fontSize: 128, fontWeight: 300, letterSpacing: 128 * 0.26, color: C.ink, display: "inline-block", opacity: t,
                  transform: `translateY(${((1 - t) * 28).toFixed(1)}px) scale(${(1.35 - 0.35 * t).toFixed(4)})`,
                  filter: t < 0.995 ? `blur(${((1 - t) * 8).toFixed(2)}px)` : undefined,
                  textShadow: "0 1px 0 rgba(255,255,255,0.8), 0 16px 40px rgba(17,20,43,0.12)",
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
        <div style={{ position: "absolute", top: 640, width: 260, height: 6 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 3, background: `linear-gradient(90deg, ${TILE_LIST.join(", ")})`, transform: `scaleX(${rule.toFixed(4)})` }} />
          {ext > 0 ? (
            <>
              <div style={{ position: "absolute", top: 2.5, height: 1, right: "100%", width: 190 * ext, background: C.primary, opacity: ext }} />
              <div style={{ position: "absolute", top: 2.5, height: 1, left: "100%", width: 190 * ext, background: C.primary, opacity: ext }} />
            </>
          ) : null}
        </div>
        <div style={{ position: "absolute", top: 676, fontSize: 46, fontWeight: 500, letterSpacing: "-0.02em", color: C.ink, opacity: tag, transform: `translateY(${((1 - tag) * 8).toFixed(1)}px)` }}>
          Hyper-personalised email, with a human at the gate.
        </div>
        <div style={{ position: "absolute", top: 760, fontFamily: MONO, fontSize: 32, letterSpacing: "0.14em", color: C.muted, opacity: team, transform: `translateY(${((1 - team) * 6).toFixed(1)}px)` }}>
          TEAM 13 · NUS-ISS
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
