import React from "react";
import { Composition } from "remotion";
import { MosaicIntro, type MosaicIntroProps } from "./MosaicIntro";
import { FPS, TOTAL } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MosaicIntro"
    component={MosaicIntro}
    durationInFrames={TOTAL}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{ bgm: true } satisfies MosaicIntroProps}
  />
);
