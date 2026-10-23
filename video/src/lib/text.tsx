// Per-unit text reveal, from video-shotcraft demos/_fixtures/Look.tsx
// (TextReveal), unchanged apart from the font plumbing.
import React from "react";
import { useCurrentFrame } from "remotion";
import { EASE } from "./polish";

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export type RevealVariant = "rise" | "blur" | "drop" | "scale" | "fade";

export const TextReveal: React.FC<{
  text: string;
  start?: number;
  by?: "char" | "word" | "line";
  variant?: RevealVariant;
  each?: number;
  gap?: number;
  ease?: (t: number) => number;
  style?: React.CSSProperties;
  unitStyle?: (i: number) => React.CSSProperties;
  out?: { start: number; dur?: number };
  /** Frame override for callers whose clock is not useCurrentFrame(). */
  frame?: number;
}> = ({ text, start = 0, by = "char", variant = "rise", each = 18, gap, ease = EASE.snappy, style, unitStyle, out, frame: frameProp }) => {
  const own = useCurrentFrame();
  const frame = frameProp ?? own;
  const units = by === "line" ? text.split("\n") : by === "word" ? text.split(/(\s+)/) : Array.from(text);
  const g = gap ?? (by === "char" ? 1.6 : by === "word" ? 4 : 7);
  let k = 0;
  const outT = out ? clamp01((frame - out.start) / (out.dur ?? 12)) : 0;
  const outE = EASE.exit(outT);
  return (
    <span style={{ display: by === "line" ? "block" : "inline", whiteSpace: by === "word" ? "pre-wrap" : "pre", ...style }}>
      {units.map((u, i) => {
        if (by !== "line" && /^\s+$/.test(u)) return <span key={i}>{u}</span>;
        const idx = k++;
        const p = ease(clamp01((frame - start - idx * g) / each));
        const inner: React.CSSProperties = { display: "inline-block", willChange: "transform" };
        if (variant === "rise") {
          // 105% of the glyph box + 0.3em clears the mask's padding, so an
          // un-risen word never peeks out of the bottom of its clip.
          inner.transform = `translateY(calc(${((1 - p) * 105 - outE * 105).toFixed(2)}% + ${((1 - p) * 0.3 - outE * 0.3).toFixed(3)}em))`;
        } else if (variant === "blur") {
          inner.opacity = p * (1 - outE);
          inner.filter = `blur(${((1 - p) * 14 + outE * 10).toFixed(2)}px)`;
          inner.transform = `translateY(${((1 - p) * 0.25 - outE * 0.15).toFixed(3)}em)`;
        } else if (variant === "drop") {
          const s = clamp01((frame - start - idx * g) / each);
          inner.opacity = clamp01(s * 3) * (1 - outE);
          inner.transform = `translateY(${((1 - EASE.overshoot(s)) * -0.6).toFixed(3)}em)`;
        } else if (variant === "scale") {
          inner.opacity = clamp01(p * 2) * (1 - outE);
          inner.transform = `scale(${(1 + (1 - p) * 0.6 + outE * 0.2).toFixed(3)})`;
          inner.filter = p < 1 ? `blur(${((1 - p) * 8).toFixed(2)}px)` : undefined;
        } else {
          inner.opacity = p * (1 - outE);
        }
        const body = <span style={{ ...inner, ...(unitStyle ? unitStyle(idx) : null) }}>{u}</span>;
        return variant === "rise" ? (
          <span
            key={i}
            style={{
              display: by === "line" ? "block" : "inline-block",
              overflow: "hidden",
              verticalAlign: "top",
              padding: "0.06em 0.02em 0.22em",
              margin: "-0.06em -0.02em -0.22em",
            }}
          >
            {body}
          </span>
        ) : (
          <React.Fragment key={i}>{body}</React.Fragment>
        );
      })}
    </span>
  );
};
