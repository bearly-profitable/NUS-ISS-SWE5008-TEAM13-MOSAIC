/**
 * S5 — breath card on the bar-11 dip (paper-title-card): one sentence pressed
 * on word by word, one word in the accent colour and italic, a short rule to
 * close. Lead-in for the Creative Director (copy rule C2).
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { useShotFrame } from "../components/Shot";
import { EASE, ramp } from "../lib/polish";
import { C, TILE_LIST } from "../theme";

const LINES: { w: string; accent?: boolean }[][] = [
  [{ w: "A" }, { w: "creative" }, { w: "brief" }],
  [{ w: "for" }, { w: "every", accent: true }, { w: "segment." }],
];

export const Breath: React.FC = () => {
  const f = useShotFrame();
  let k = 0;
  const sheet = ramp(f, 0, 16, EASE.snappy);
  const rule = ramp(f, 34, 14, EASE.snappy);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 1480,
          height: 560,
          borderRadius: 40,
          background: "rgba(255,255,255,0.62)",
          border: "1px solid rgba(255,255,255,0.9)",
          boxShadow: "0 40px 120px rgba(17,20,43,0.10), inset 0 1px 0 #fff",
          backdropFilter: "blur(20px)",
          transform: `scale(${(0.96 + 0.04 * sheet).toFixed(4)})`,
          opacity: sheet,
        }}
      />
      <div style={{ position: "relative", textAlign: "center" }}>
        {LINES.map((line, li) => (
          <div key={li} style={{ fontSize: 124, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.08, color: C.ink }}>
            {line.map((word, wi) => {
              const t = ramp(f, 4 + k++ * 4, 11, EASE.snappy);
              return (
                <span
                  key={wi}
                  style={{
                    display: "inline-block",
                    marginRight: wi < line.length - 1 ? "0.24em" : 0,
                    opacity: Math.min(1, t * 1.6),
                    transform: `scale(${(1.22 - 0.22 * t).toFixed(4)})`,
                    filter: t < 1 ? `blur(${((1 - t) * 10).toFixed(2)}px)` : undefined,
                    color: word.accent ? C.primary : undefined,
                    fontStyle: word.accent ? "italic" : undefined,
                  }}
                >
                  {word.w}
                </span>
              );
            })}
          </div>
        ))}
        <div
          style={{
            margin: "40px auto 0",
            width: 220,
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${TILE_LIST.join(", ")})`,
            transform: `scaleX(${rule.toFixed(4)})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
