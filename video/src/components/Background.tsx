import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";

/**
 * The console's `.gradient-mesh` ground, with the blobs drifting slowly so a
 * static shot never looks like a screenshot. Same five radial stops, same
 * hues — only the positions are animated.
 */
export const Background: React.FC<{ drift?: number }> = ({ drift = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame * 0.0045 * drift;

  const p = (x: number, y: number, ax: number, ay: number, ph: number) =>
    `${x + Math.sin(t + ph) * ax}% ${y + Math.cos(t * 0.8 + ph) * ay}%`;

  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(ellipse 65% 60% at ${p(88, 5, 4, 3, 0)}, hsla(243,80%,72%,0.45) 0%, transparent 62%)`,
          `radial-gradient(ellipse 55% 55% at ${p(8, 15, 3, 4, 1.7)}, hsla(262,75%,75%,0.38) 0%, transparent 58%)`,
          `radial-gradient(ellipse 55% 50% at ${p(85, 88, 4, 3, 3.1)}, hsla(199,60%,85%,0.42) 0%, transparent 58%)`,
          `radial-gradient(ellipse 58% 42% at ${p(5, 90, 3, 3, 4.4)}, hsla(234,30%,88%,0.40) 0%, transparent 60%)`,
          `radial-gradient(ellipse 45% 45% at ${p(52, 45, 5, 4, 2.2)}, hsla(250,55%,90%,0.45) 0%, transparent 65%)`,
          C.bg,
        ].join(", "),
      }}
    />
  );
};

/** A faint film grain + vignette so flat gradients don't band on export. */
export const Vignette: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background:
          "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 55%, rgba(17,20,43,0.07) 100%)",
        opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
      }}
    />
  );
};
