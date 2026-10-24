/**
 * MOSAIC product walkthrough: the presenter's screen recording, jump-cut to
 * the narration (walkthrough/build_edl.py, cut.py), on the console's own
 * gradient-mesh ground, with a camera that follows what is being said,
 * chapter cards, word-timed subtitles and the MOSAIC title and end cards.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { Grain } from "../lib/polish";
import { SANS } from "../theme";
import { Intro, Outro } from "./parts/Bookends";
import { ChapterPill, ChapterRail, ChapterTitle, FastForward, Subtitles } from "./parts/Hud";
import { Screen } from "./parts/Screen";
import { Sound } from "./parts/Sound";

export type WalkthroughProps = { bgm: boolean; subtitles: boolean };

export const Walkthrough: React.FC<WalkthroughProps> = ({ bgm, subtitles }) => (
  <AbsoluteFill style={{ fontFamily: SANS, background: "#F3F4FA" }}>
    <Background drift={1.4} />
    <Intro />
    <ChapterTitle />
    <Screen />
    <Outro />
    <ChapterPill />
    <FastForward />
    {subtitles ? <Subtitles /> : null}
    <ChapterRail />
    <Grain opacity={0.035} step={2} />
    <Sound bgm={bgm} />
  </AbsoluteFill>
);
