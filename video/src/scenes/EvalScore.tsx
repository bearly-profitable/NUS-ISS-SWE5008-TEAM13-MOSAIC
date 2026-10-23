/**
 * S11 — sidecar eval. The real "Model scores" card (expanded rubric) tilts
 * in on the right; its four agent columns lift into place one after another
 * while the overall score rolls in on the left like an odometer.
 */
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Caption } from "../components/Caption";
import { useShotFrame } from "../components/Shot";
import { bezier, EASE, ramp } from "../lib/polish";
import { C, MONO } from "../theme";

const CARD = { w: 1088, h: 552, x: 728, y: 300 };
const COLS = [22, 287, 551, 816].map((x) => ({ x, y: 73, w: 251, h: 430 }));
const BG = "#F4F4FB";
const SETTLE = bezier(0.34, 1.45, 0.64, 1);

/** One odometer digit: a 0–9 strip that spins down onto `to`. */
const Digit: React.FC<{ to: number; f: number; start: number; size: number }> = ({ to, f, start, size }) => {
  const t = SETTLE(Math.min(1, Math.max(0, (f - start) / 26)));
  const pos = (to + 20) * t; // two full turns, then land
  const y = -(pos % 10) * size * 1.1;
  return (
    <span style={{ display: "inline-block", height: size * 1.1, overflow: "hidden", verticalAlign: "top" }}>
      <span style={{ display: "block", transform: `translateY(${y.toFixed(2)}px)` }}>
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} style={{ display: "block", height: size * 1.1, lineHeight: `${size * 1.1}px` }}>
            {i % 10}
          </span>
        ))}
      </span>
    </span>
  );
};

export const EvalScore: React.FC = () => {
  const f = useShotFrame();
  const enter = ramp(f, 0, 22, EASE.snappy);
  const exit = ramp(f, 98, 10, EASE.exit);
  const tilt = -14 * (1 - enter) - 6;
  const bg = `url(${staticFile("ui/eval@card.png")})`;
  const size = 220;
  return (
    <AbsoluteFill style={{ opacity: 1 - exit, filter: exit > 0 ? `blur(${(exit * 8).toFixed(2)}px)` : undefined }}>
      <div style={{ position: "absolute", inset: 0, perspective: 2200, perspectiveOrigin: "1300px 560px" }}>
        <div
          style={{
            position: "absolute", left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: 18, overflow: "hidden",
            transform: `translateX(${((1 - enter) * 260).toFixed(1)}px) rotateY(${tilt.toFixed(2)}deg) scale(${(1.04 + 0.03 * ramp(f, 20, 90, EASE.smooth)).toFixed(4)})`,
            boxShadow: "0 50px 120px rgba(17,20,43,0.18), 0 6px 20px rgba(17,20,43,0.08)",
            opacity: enter,
          }}
        >
          <Img src={staticFile("ui/eval@card.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
          {COLS.map((c, i) => {
            const t = ramp(f, 12 + i * 6, 16, EASE.snappy);
            return (
              <React.Fragment key={i}>
                <div style={{ position: "absolute", left: c.x - 2, top: c.y - 2, width: c.w + 4, height: c.h + 4, background: BG, borderRadius: 18 }} />
                <div
                  style={{
                    position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, borderRadius: 18,
                    background: `${bg} ${-c.x}px ${-c.y}px / ${CARD.w}px ${CARD.h}px no-repeat`,
                    opacity: Math.min(1, t * 1.5), transform: `translateY(${((1 - t) * 40).toFixed(1)}px)`,
                    boxShadow: `0 ${(18 * (1 - t)).toFixed(1)}px ${(36 * (1 - t)).toFixed(1)}px rgba(17,20,43,0.12)`,
                  }}
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div style={{ position: "absolute", left: 110, top: 520 }}>
        <div style={{ fontSize: size, fontWeight: 700, letterSpacing: "-0.05em", color: C.primary, lineHeight: 1, display: "flex" }}>
          <Digit to={8} f={f} start={8} size={size} />
          <Digit to={8} f={f} start={11} size={size} />
          <span style={{ lineHeight: `${size * 1.1}px` }}>.</span>
          <Digit to={2} f={f} start={14} size={size} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 32, letterSpacing: "0.12em", color: C.muted, marginTop: 6, opacity: ramp(f, 30, 12, EASE.out) }}>
          OVERALL · RUBRIC EVAL-V1
        </div>
      </div>
      <Caption
        kicker="SIDECAR EVAL"
        title="The agents get graded, too."
        sub="Code checks plus an LLM judge."
        at={4}
        until={104}
        y={96}
        width={620}
        size={70}
        tile={0}
      />
    </AbsoluteFill>
  );
};
