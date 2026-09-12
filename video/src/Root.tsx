import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import { MosaicIntro, TOTAL_FRAMES } from "./MosaicIntro";
import { Background } from "./components/Background";
import { S02Logo } from "./scenes/S02Logo";
import { SANS } from "./theme";

/** The logo sting on its own — useful as a title card or a social bumper. */
const LogoSting: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: SANS, background: "#F3F4FA" }}>
    <Background />
    <S02Logo length={150} />
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="MosaicIntro"
      component={MosaicIntro}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="LogoSting"
      component={LogoSting}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
