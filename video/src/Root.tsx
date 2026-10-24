import React from "react";
import { Composition, Still } from "remotion";
import { MosaicIntro, type MosaicIntroProps } from "./MosaicIntro";
import { FPS, TOTAL } from "./timeline";
import { Poster, type PosterProps } from "./walkthrough/Poster";
import { Walkthrough, type WalkthroughProps } from "./walkthrough/Walkthrough";
import { TOTAL as WALKTHROUGH_TOTAL } from "./walkthrough/timeline";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="MosaicIntro"
      component={MosaicIntro}
      durationInFrames={TOTAL}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ bgm: true } satisfies MosaicIntroProps}
    />
    <Composition
      id="MosaicWalkthrough"
      component={Walkthrough}
      durationInFrames={WALKTHROUGH_TOTAL}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ bgm: true, subtitles: true } satisfies WalkthroughProps}
    />
    <Still
      id="WalkthroughPoster"
      component={Poster}
      width={1920}
      height={1080}
      defaultProps={{ play: true } satisfies PosterProps}
    />
  </>
);
