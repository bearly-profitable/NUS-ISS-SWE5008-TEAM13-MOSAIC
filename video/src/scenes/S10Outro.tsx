import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO } from "../theme";
import { enter, ramp, rise, sceneFade } from "../anim";
import { MosaicMark, Wordmark } from "../components/MosaicMark";
import { Sub } from "../components/Ui";

const FACTS = [
  "4 agents",
  "9 pre-flight checks",
  "1 mandatory human gate",
  "0 decisions off the record",
];

export const S10Outro: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, length, 12, 24);
  const word = ramp(frame, 16, 58);

  return (
    <AbsoluteFill
      style={{
        opacity: fade,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 26,
      }}
    >
      <MosaicMark width={300} delay={0} stagger={2.2} />
      <Wordmark size={70} progress={word} />

      <Sub
        size={34}
        style={{
          color: C.ink,
          fontWeight: 500,
          marginTop: 8,
          ...rise(enter(frame, fps, 40), 16),
        }}
      >
        Personal at scale — with the receipts to prove it.
      </Sub>

      <div
        style={{
          marginTop: 26,
          display: "flex",
          gap: 26,
          alignItems: "center",
          fontFamily: MONO,
          fontSize: 22,
          color: C.muted,
          letterSpacing: 0.6,
        }}
      >
        {FACTS.map((f, i) => (
          <React.Fragment key={f}>
            <span
              style={{
                opacity: enter(frame, fps, 52 + i * 5),
                transform:
                  "translateY(" + (1 - enter(frame, fps, 52 + i * 5)) * 10 + "px)",
              }}
            >
              {f}
            </span>
            {i < FACTS.length - 1 ? (
              <span style={{ color: C.line, opacity: enter(frame, fps, 54 + i * 5) }}>·</span>
            ) : null}
          </React.Fragment>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 68,
          fontFamily: MONO,
          fontSize: 20,
          letterSpacing: 3,
          color: C.muted,
          opacity: interpolate(enter(frame, fps, 76), [0, 1], [0, 0.8]),
          textTransform: "uppercase",
        }}
      >
        MOSAIC Campaign Console
      </div>
    </AbsoluteFill>
  );
};
