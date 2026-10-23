import React from "react";
import { AbsoluteFill } from "remotion";
import { Background, Vignette } from "./components/Background";
import { FlashLayer, Shot } from "./components/Shot";
import { Soundtrack } from "./audio/Soundtrack";
import { Grain } from "./lib/polish";
import { SANS } from "./theme";
import { Opening } from "./scenes/Opening";
import { Company } from "./scenes/Company";
import { Segments } from "./scenes/Segments";
import { Breath } from "./scenes/Breath";
import { Creative } from "./scenes/Creative";
import { Compose } from "./scenes/Compose";
import { Guardian } from "./scenes/Guardian";
import { Ledger } from "./scenes/Ledger";
import { EvalScore } from "./scenes/EvalScore";
import { Outro } from "./scenes/Outro";

export type MosaicIntroProps = { bgm: boolean };

/**
 * Shot order and lengths live in timeline.ts; each <Shot> handles its own
 * seams (whip / flash) so the scenes only draw their content.
 */
export const MosaicIntro: React.FC<MosaicIntroProps> = ({ bgm }) => (
  <AbsoluteFill style={{ fontFamily: SANS, background: "#F3F4FA" }}>
    <Background />
    <Shot id="opening">
      <Opening />
    </Shot>
    <Shot id="company" lead={18}>
      <Company />
    </Shot>
    <Shot id="segments">
      <Segments />
    </Shot>
    <Shot id="breath">
      <Breath />
    </Shot>
    <Shot id="creative">
      <Creative />
    </Shot>
    <Shot id="compose">
      <Compose />
    </Shot>
    <Shot id="guardian">
      <Guardian />
    </Shot>
    <Shot id="ledger">
      <Ledger />
    </Shot>
    <Shot id="evalScore">
      <EvalScore />
    </Shot>
    <Shot id="outro" lead={0}>
      <Outro />
    </Shot>
    <FlashLayer />
    <Vignette />
    <Grain opacity={0.018} />
    <Soundtrack bgm={bgm} />
  </AbsoluteFill>
);
