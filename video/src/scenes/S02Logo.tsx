import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO } from "../theme";
import { enter, ramp, rise, sceneFade } from "../anim";
import { MosaicMark, Wordmark } from "../components/MosaicMark";
import { Sub } from "../components/Ui";

const STEPS = ["Segment", "Create", "Compose", "Adjudicate", "Approve"];

/** Tiles converge into the mark; the name and the promise follow. */
export const S02Logo: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, length, 8, 16);

  const word = ramp(frame, 44, 92);
  const tagline = enter(frame, fps, 68);
  const lift = interpolate(ramp(frame, 40, 80), [0, 1], [0, -34]);

  return (
    <AbsoluteFill
      style={{
        opacity: fade,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 30,
        paddingTop: 90,
      }}
    >
      <div style={{ transform: `translateY(${lift}px)` }}>
        <MosaicMark width={430} delay={2} stagger={3.4} />
      </div>

      <div style={{ transform: `translateY(${lift}px)` }}>
        <Wordmark size={84} progress={word} />
      </div>

      <div style={{ ...rise(tagline, 16), textAlign: "center", marginTop: 8 }}>
        <Sub size={32} style={{ color: C.ink, fontWeight: 500 }}>
          The AI campaign console that writes to segments, not spreadsheets.
        </Sub>
        <div
          style={{
            marginTop: 22,
            display: "flex",
            gap: 16,
            justifyContent: "center",
            fontFamily: MONO,
            fontSize: 21,
            letterSpacing: 2,
            color: C.muted,
            textTransform: "uppercase",
          }}
        >
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <span style={{ opacity: enter(frame, fps, 78 + i * 4) }}>{s}</span>
              {i < STEPS.length - 1 ? (
                <span style={{ opacity: enter(frame, fps, 80 + i * 4) * 0.5, color: C.primary }}>
                  →
                </span>
              ) : null}
            </React.Fragment>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
