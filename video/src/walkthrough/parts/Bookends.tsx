/**
 * Title and end card. The mark's tiles fly in exactly as in the 60 s intro
 * film; the screen itself rises in under the title (Screen.tsx), and on the
 * way out it falls back while the lockup lands.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { MosaicMark, Wordmark } from "../../components/MosaicMark";
import { EASE, ramp } from "../../lib/polish";
import { TextReveal } from "../../lib/text";
import { C, MONO, SANS } from "../../theme";
import { INTRO, OUTRO, OUTRO_FROM } from "../timeline";

const Lockup: React.FC<{ f: number; delay: number; kicker: string; title: string; sub: string; markW?: number }> = ({
  f,
  delay,
  kicker,
  title,
  sub,
  markW = 230,
}) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: SANS }}>
    <MosaicMark width={markW} delay={delay} stagger={3.5} frame={f} />
    <div style={{ marginTop: 26 }}>
      <Wordmark size={70} progress={ramp(f, delay + 22, 40, EASE.linear)} />
    </div>
    <div
      style={{
        marginTop: 34,
        fontFamily: MONO,
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: "0.22em",
        color: C.primary,
        opacity: ramp(f, delay + 40, 14, EASE.out),
      }}
    >
      {kicker}
    </div>
    <div style={{ marginTop: 18, fontSize: 56, fontWeight: 700, letterSpacing: "-0.03em", color: C.ink }}>
      <TextReveal text={title} by="word" variant="rise" start={delay + 46} each={18} gap={3} frame={f} />
    </div>
    <div style={{ marginTop: 18, fontSize: 28, color: C.muted, opacity: ramp(f, delay + 62, 16, EASE.out) }}>{sub}</div>
  </div>
);

export const Intro: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= INTRO) return null;
  const exit = ramp(f, INTRO - 48, 30, EASE.exit);
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: 1 - exit,
        transform: `translateY(${(-260 * exit).toFixed(1)}px) scale(${(1 - 0.06 * exit).toFixed(4)})`,
        filter: exit > 0 ? `blur(${(exit * 10).toFixed(2)}px)` : undefined,
      }}
    >
      <Lockup
        f={f}
        delay={6}
        kicker="PRODUCT WALKTHROUGH"
        title="From one CSV to an email for every segment"
        sub="NUS-ISS · SWE5008 Practice Module · Team 13"
      />
    </AbsoluteFill>
  );
};

export const Outro: React.FC = () => {
  const f = useCurrentFrame() - OUTRO_FROM;
  if (f < 0) return null;
  const fade = ramp(f, OUTRO - 16, 16, EASE.smooth);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 1 - fade }}>
      <Lockup
        f={f}
        delay={38}
        kicker="THANKS FOR WATCHING"
        title="Every segment gets its own email."
        sub="Four agents, one human at the gate · Team 13 · NUS-ISS"
        markW={250}
      />
    </AbsoluteFill>
  );
};
