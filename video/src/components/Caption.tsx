import React from "react";
import { EASE, ramp } from "../lib/polish";
import { TextReveal } from "../lib/text";
import { C, MONO, TILE_LIST } from "../theme";
import { useShotFrame } from "./Shot";

/**
 * The narration plate: a frosted `.glass-card` slab carrying a mono kicker,
 * the headline, and an optional sub line. Sizes sit on aesthetic rule Q11's
 * floors (headline ≥ 56 px, auxiliary ≥ 32 px) so it reads in a phone-sized
 * embed. Frames are shot-local.
 */
export const Caption: React.FC<{
  kicker?: string;
  title: string;
  sub?: string;
  at: number;
  until: number;
  x?: number;
  y?: number;
  width?: number;
  size?: number;
  tile?: number;
}> = ({ kicker, title, sub, at, until, x = 96, y, width = 720, size = 68, tile = 0 }) => {
  const f = useShotFrame();
  if (f < at - 1 || f > until + 1) return null;
  const inT = ramp(f, at, 18, EASE.snappy);
  const outT = ramp(f, until - 10, 10, EASE.exit);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        bottom: y === undefined ? 96 : undefined,
        width,
        padding: "34px 40px 38px",
        borderRadius: 30,
        background: "rgba(255,255,255,0.80)",
        backdropFilter: "blur(22px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.95)",
        boxShadow: "0 30px 80px rgba(17,20,43,0.16), 0 4px 14px rgba(17,20,43,0.06), inset 0 1px 0 rgba(255,255,255,1)",
        opacity: inT * (1 - outT),
        transform: `translate(${((1 - inT) * -36).toFixed(2)}px, ${(outT * 14).toFixed(2)}px) scale(${(0.97 + 0.03 * inT).toFixed(4)})`,
        transformOrigin: "left center",
      }}
    >
      {kicker ? (
        <div
          style={{
            fontFamily: MONO,
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
            color: C.primary,
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 18,
            opacity: ramp(f, at + 2, 12, EASE.out),
          }}
        >
          <span style={{ width: 16, height: 16, borderRadius: 5, background: TILE_LIST[tile % TILE_LIST.length], flex: "none" }} />
          {kicker}
        </div>
      ) : null}
      <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.06, letterSpacing: "-0.03em", color: C.ink }}>
        <TextReveal text={title} by="word" variant="rise" start={at + 4} each={16} gap={3} frame={f} />
      </div>
      {sub ? (
        <div style={{ fontSize: 36, fontWeight: 400, lineHeight: 1.3, color: C.muted, marginTop: 18 }}>
          <TextReveal text={sub} by="word" variant="blur" start={at + 12} each={14} gap={1.5} frame={f} />
        </div>
      ) : null}
    </div>
  );
};
