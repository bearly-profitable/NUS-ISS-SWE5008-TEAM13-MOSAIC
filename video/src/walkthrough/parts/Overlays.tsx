/**
 * Marks drawn on the recording, in its own pixel space (the parent is the
 * camera-scaled window). Line widths and type are divided by `scale` so they
 * read the same size on screen at any zoom.
 */
import React from "react";
import { random, useCurrentFrame } from "remotion";
import { EASE, ramp } from "../../lib/polish";
import { C, MONO, SANS, TILE_LIST } from "../../theme";
import { BURSTS, CALLOUTS, CLICKS, NOTES, type Callout } from "../script";
import { srcToFilm } from "../timeline";

const CalloutRing: React.FC<{ c: Callout; f: number; s: number }> = ({ c, f, s }) => {
  const a = srcToFilm(c.t);
  const b = Math.max(a + 30, srcToFilm(c.until));
  if (f < a - 1 || f > b + 1) return null;
  const inT = ramp(f, a, 16, EASE.snappy);
  const outT = ramp(f, b - 10, 10, EASE.exit);
  const vis = inT * (1 - outT);
  const [x, y, w, h] = c.box;
  const pad = 14 / s;
  const grow = (1 - inT) * 26 / s;
  const r = 16 / s;
  const labelUp = (c.side ?? "top") === "top";
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - pad - grow,
          top: y - pad - grow,
          width: w + 2 * (pad + grow),
          height: h + 2 * (pad + grow),
          borderRadius: r,
          border: `${3.5 / s}px solid ${C.primary}`,
          opacity: vis,
          boxShadow: [
            `0 0 0 ${7 / s}px rgba(79,70,229,0.16)`,
            `0 ${10 / s}px ${40 / s}px rgba(79,70,229,0.28)`,
            c.dim === false ? null : `0 0 0 ${4000 / s}px rgba(17,20,43,${(0.2 * vis).toFixed(3)})`,
          ]
            .filter(Boolean)
            .join(", "),
        }}
      />
      {c.label ? (
        <div
          style={{
            position: "absolute",
            left: x - pad,
            top: labelUp ? y - pad - 22 / s : y + h + pad + 22 / s,
            transform: `translateY(${labelUp ? "-100%" : "0"}) translateY(${((1 - inT) * (labelUp ? 14 : -14)) / s}px)`,
            opacity: vis,
            display: "flex",
            alignItems: "center",
            gap: 12 / s,
            padding: `${12 / s}px ${22 / s}px`,
            borderRadius: 999,
            background: C.primary,
            color: "#fff",
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: 30 / s,
            whiteSpace: "nowrap",
            boxShadow: `0 ${12 / s}px ${30 / s}px rgba(79,70,229,0.35)`,
          }}
        >
          <span style={{ width: 10 / s, height: 10 / s, borderRadius: 3 / s, background: "#fff", opacity: 0.9 }} />
          {c.label}
        </div>
      ) : null}
    </>
  );
};

const Ripple: React.FC<{ t: number; x: number; y: number; f: number; s: number }> = ({ t, x, y, f, s }) => {
  const a = srcToFilm(t);
  const d = f - a;
  if (d < 0 || d > 24) return null;
  const rings = [0, 6].map((delay, i) => {
    const p = ramp(d, delay, 18, EASE.out);
    if (p <= 0 || p >= 1) return null;
    const R = (18 + 70 * p) / s;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: x - R,
          top: y - R,
          width: 2 * R,
          height: 2 * R,
          borderRadius: "50%",
          border: `${(4 - 2 * p) / s}px solid ${C.primary}`,
          opacity: 0.85 * (1 - p),
        }}
      />
    );
  });
  const dot = 1 - ramp(d, 2, 12, EASE.out);
  return (
    <>
      {rings}
      <div
        style={{
          position: "absolute",
          left: x - 16 / s,
          top: y - 16 / s,
          width: 32 / s,
          height: 32 / s,
          borderRadius: "50%",
          background: "rgba(79,70,229,0.35)",
          opacity: dot,
          transform: `scale(${0.6 + 0.4 * ramp(d, 0, 4, EASE.snappy)})`,
        }}
      />
    </>
  );
};

/** MOSAIC tiles thrown out of a point — the send. */
const TileBurst: React.FC<{ t: number; x: number; y: number; f: number; s: number }> = ({ t, x, y, f, s }) => {
  const a = srcToFilm(t);
  const d = f - a;
  if (d < 0 || d > 46) return null;
  return (
    <>
      {Array.from({ length: 22 }, (_, i) => {
        const ang = (i / 22) * Math.PI * 2 + random(`ang${i}`) * 0.5;
        const speed = 160 + random(`sp${i}`) * 260;
        const p = EASE.out(Math.min(1, d / 40));
        const dist = (speed * p) / s;
        const fall = ((d / 46) ** 2 * 120) / s;
        const size = (14 + random(`sz${i}`) * 16) / s;
        const op = 1 - ramp(d, 22, 24, EASE.out);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.cos(ang) * dist - size / 2,
              top: y + Math.sin(ang) * dist + fall - size / 2,
              width: size,
              height: size,
              borderRadius: size * 0.22,
              background: TILE_LIST[i % TILE_LIST.length],
              opacity: op,
              transform: `rotate(${(random(`r${i}`) - 0.5) * 540 * p}deg) scale(${0.4 + 0.6 * ramp(d, 0, 6, EASE.overshoot)})`,
            }}
          />
        );
      })}
    </>
  );
};

/** A chip over a blurred stretch, explaining what is hidden. */
const NoteChip: React.FC<{ t: number; until: number; text: string; f: number; s: number }> = ({ t, until, text, f, s }) => {
  const a = srcToFilm(t);
  const b = srcToFilm(until);
  if (f < a || f > b) return null;
  const vis = ramp(f, a, 12, EASE.snappy) * (1 - ramp(f, b - 8, 8, EASE.exit));
  return (
    <div
      style={{
        position: "absolute",
        left: 1419,
        top: 714,
        transform: `translate(-50%, -50%) scale(${(0.94 + 0.06 * vis) / s})`,
        opacity: vis,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "20px 34px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.86)",
        border: "1px solid rgba(255,255,255,1)",
        boxShadow: "0 20px 60px rgba(17,20,43,0.25)",
        fontFamily: SANS,
        fontSize: 34,
        fontWeight: 600,
        color: C.ink,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 24, color: C.primary, letterSpacing: "0.08em" }}>PRIVATE</span>
      {text}
    </div>
  );
};

export const Overlays: React.FC<{ scale: number }> = ({ scale: s }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {CALLOUTS.map((c, i) => (
        <CalloutRing key={`c${i}`} c={c} f={f} s={s} />
      ))}
      {CLICKS.map((c, i) => (
        <Ripple key={`k${i}`} {...c} f={f} s={s} />
      ))}
      {BURSTS.map((b, i) => (
        <TileBurst key={`b${i}`} {...b} f={f} s={s} />
      ))}
      {NOTES.map((n, i) => (
        <NoteChip key={`n${i}`} {...n} f={f} s={s} />
      ))}
    </div>
  );
};
