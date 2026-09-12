import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { Background, Vignette } from "./components/Background";
import { SANS } from "./theme";
import { S01Hook } from "./scenes/S01Hook";
import { S02Logo } from "./scenes/S02Logo";
import { S03Pipeline } from "./scenes/S03Pipeline";
import { S04Segments } from "./scenes/S04Segments";
import { S05Creative } from "./scenes/S05Creative";
import { S06Compose } from "./scenes/S06Compose";
import { S07Guardian } from "./scenes/S07Guardian";
import { S08Approval } from "./scenes/S08Approval";
import { S09Eval } from "./scenes/S09Eval";
import { S10Outro } from "./scenes/S10Outro";

/**
 * Scene table. Each scene fades its own contents in and out (see anim.ts's
 * sceneFade) over one continuous background, so cuts read as dissolves rather
 * than hard switches — and the durations stay editable in one place.
 */
export const SCENES = [
  { id: "hook", component: S01Hook, duration: 105 },
  { id: "logo", component: S02Logo, duration: 150 },
  { id: "pipeline", component: S03Pipeline, duration: 180 },
  { id: "segments", component: S04Segments, duration: 190 },
  { id: "creative", component: S05Creative, duration: 180 },
  { id: "compose", component: S06Compose, duration: 190 },
  { id: "guardian", component: S07Guardian, duration: 215 },
  { id: "approval", component: S08Approval, duration: 180 },
  { id: "eval", component: S09Eval, duration: 185 },
  { id: "outro", component: S10Outro, duration: 160 },
] as const;

export const TOTAL_FRAMES = SCENES.reduce((a, s) => a + s.duration, 0);

export const MosaicIntro: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: SANS, background: "#F3F4FA" }}>
    <Background />
    <Series>
      {SCENES.map((scene) => {
        const Scene = scene.component;
        return (
          <Series.Sequence key={scene.id} durationInFrames={scene.duration} name={scene.id}>
            <Scene length={scene.duration} />
          </Series.Sequence>
        );
      })}
    </Series>
    <Vignette />
  </AbsoluteFill>
);
