/**
 * The recording on stage: a rounded window over the gradient-mesh ground,
 * framed by the camera (camera.ts), swung back in 3D for the intro, every
 * chapter card and the outro. Overlays that point at the UI (callouts,
 * clicks, the send burst) live inside the window in source pixels, so they
 * stay glued to the thing they mark through every zoom.
 */
import React from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { EASE, ramp } from "../../lib/polish";
import { blendView, FULL, place, viewAt } from "../camera";
import { CARD, CHAPTERS, CUT_TOTAL, INTRO, OUTRO, OUTRO_FROM, phaseAt, SRC_H, SRC_W } from "../timeline";
import { Overlays } from "./Overlays";

const CUT = staticFile("walkthrough/cut.mp4");
const VIDEO: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: SRC_W, height: SRC_H };

/** One frame of the cut, held. Seeks with trimBefore and freezes at 0 — the same path playback takes. */
const Still: React.FC<{ at: number; opacity?: number }> = ({ at, opacity = 1 }) => (
  <div style={{ ...VIDEO, opacity }}>
    <Freeze frame={0}>
      <OffthreadVideo src={CUT} muted trimBefore={at || undefined} style={VIDEO} />
    </Freeze>
  </div>
);

/** During a card the screen holds the outgoing chapter's last frame, then dissolves to the incoming one's first. */
const CardStill: React.FC<{ a: number; b: number }> = ({ a, b }) => {
  const t = ramp(useCurrentFrame(), CARD / 2 - 6, 12, EASE.smooth);
  return (
    <>
      {t < 1 ? <Still at={a} /> : null}
      {t > 0 ? <Still at={b} opacity={t} /> : null}
    </>
  );
};

const Footage: React.FC = () => (
  <>
    <Sequence from={0} durationInFrames={INTRO} layout="none" name="intro still">
      <Still at={0} />
    </Sequence>
    {CHAPTERS.map((ch) => (
      <React.Fragment key={ch.id}>
        {ch.index > 0 ? (
          <Sequence from={ch.cardFrom} durationInFrames={CARD} layout="none" name={`card still ${ch.id}`}>
            <CardStill a={CHAPTERS[ch.index - 1].cutTo - 1} b={ch.cutFrom} />
          </Sequence>
        ) : null}
        <Sequence from={ch.from} durationInFrames={ch.len} layout="none" name={`footage ${ch.id}`}>
          <OffthreadVideo src={CUT} muted trimBefore={ch.cutFrom} style={VIDEO} />
        </Sequence>
      </React.Fragment>
    ))}
    <Sequence from={OUTRO_FROM} durationInFrames={OUTRO} layout="none" name="outro still">
      <Still at={CUT_TOTAL - 1} />
    </Sequence>
  </>
);

/** Stage pose for the current phase: how far the window is swung away (k), and its transform. */
const stagePose = (f: number) => {
  const ph = phaseAt(f);
  if (ph.kind === "intro") {
    const p = ramp(f, INTRO - 46, 46, EASE.snappy);
    return {
      ph,
      k: 0,
      opacity: Math.min(1, p * 3),
      transform: `translateY(${((1 - p) * 760).toFixed(1)}px) rotateX(${((1 - p) * 28).toFixed(2)}deg) scale(${(0.84 + 0.16 * p).toFixed(4)})`,
    };
  }
  if (ph.kind === "card") {
    const out = ramp(ph.t, 0, 22, EASE.smooth);
    const back = ramp(ph.t, CARD - 24, 24, EASE.snappy);
    const k = out * (1 - back);
    return {
      ph,
      k,
      opacity: 1,
      transform: `translateX(${(k * 400).toFixed(1)}px) translateY(${(k * 24).toFixed(1)}px) rotateY(${(-17 * k).toFixed(2)}deg) scale(${(1 - 0.45 * k).toFixed(4)})`,
    };
  }
  if (ph.kind === "outro") {
    const k = ramp(ph.t, 0, 34, EASE.smooth);
    const gone = ramp(ph.t, 16, 22, EASE.exit);
    return {
      ph,
      k,
      opacity: 1 - gone,
      transform: `translateY(${(k * -40 - gone * 160).toFixed(1)}px) rotateX(${(k * 22).toFixed(2)}deg) scale(${(1 - 0.42 * k).toFixed(4)})`,
    };
  }
  return { ph, k: 0, opacity: 1, transform: "none" };
};

export const Screen: React.FC = () => {
  const f = useCurrentFrame();
  const { ph, k, opacity, transform } = stagePose(f);
  const view = blendView(viewAt(ph.cut), FULL, k);
  const { s, left, top } = place(view);
  const radius = 26 / s;
  return (
    <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: "50% 45%" }}>
      <AbsoluteFill style={{ transform, transformOrigin: "50% 50%", opacity, transformStyle: "preserve-3d" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: SRC_W,
            height: SRC_H,
            transformOrigin: "0 0",
            transform: `translate(${left.toFixed(2)}px, ${top.toFixed(2)}px) scale(${s.toFixed(5)})`,
            borderRadius: radius,
            overflow: "hidden",
            background: "#F3F4FA",
            boxShadow: `0 ${40 / s}px ${110 / s}px rgba(17,20,43,0.22), 0 ${6 / s}px ${18 / s}px rgba(17,20,43,0.08), 0 0 0 ${1.5 / s}px rgba(255,255,255,0.9)`,
          }}
        >
          <Footage />
          <Overlays scale={s} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
