/**
 * S6 — Creative Director. An oblique glide (steep-tilt-glide's "right near,
 * left far" stance, softened for readability) down the real Creative Review
 * page: brand assets → palette → the direction fields of two segments, so
 * the cut ends on two different voices side by side.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { Caption } from "../components/Caption";
import { useShotFrame } from "../components/Shot";
import { camPath, PageCam } from "../lib/cam";
import layout from "../ui-layout.json";

const cam = camPath([
  { f: 0, cx: 1000, cy: 335, zoom: 1.18, rotY: -20, rotX: 6, persp: 1500, sx: 250 },
  { f: 46, cx: 980, cy: 600, zoom: 1.26, rotY: -15, rotX: 5, persp: 1500, sx: 250 },
  { f: 100, cx: 760, cy: 920, zoom: 1.6, rotY: -9, rotX: 3, persp: 1600, sx: 270 },
  { f: 162, cx: 1150, cy: 960, zoom: 1.62, rotY: -6, rotX: 2, persp: 1600, sx: 270 },
]);

export const Creative: React.FC = () => {
  const f = useShotFrame();
  return (
    <AbsoluteFill>
      <PageCam src="ui/creative.jpg" pageH={layout.creative.pageH} cam={cam(f)} floor="#ECEDF6" />
      <Caption
        kicker="AGENT 02 · CREATIVE DIRECTOR"
        title="Its own voice, in your brand."
        sub="Tonality, language, CTA and design, written per segment."
        at={8}
        until={138}
        tile={4}
      />
    </AbsoluteFill>
  );
};
