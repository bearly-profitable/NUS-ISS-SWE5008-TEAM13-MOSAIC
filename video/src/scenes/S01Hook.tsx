import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, TILE_LIST } from "../theme";
import { enter, ramp, rise, sceneFade } from "../anim";
import { Title, Sub } from "../components/Ui";

const COLS = 12;
const ROWS = 6;
const CELLS = COLS * ROWS;

/**
 * The problem, stated in one picture: every contact gets the identical
 * message. Then colour sweeps across the grid and the wall of grey becomes a
 * mosaic — the metaphor the rest of the film runs on.
 */
export const S01Hook: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, length, 10, 14);

  // The colour wave travels diagonally across the grid from the top-left.
  const wave = ramp(frame, 46, 82);
  const swapped = ramp(frame, 52, 62);

  return (
    <AbsoluteFill style={{ opacity: fade, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, 116px)`,
          gap: 18,
          transform: `scale(${interpolate(ramp(frame, 0, 90), [0, 1], [1.06, 1])})`,
        }}
      >
        {new Array(CELLS).fill(0).map((_, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const appear = enter(frame, fps, 2 + (col + row) * 1.1);
          // Diagonal position, 0 at top-left to 1 at bottom-right.
          const d = (col / (COLS - 1) + row / (ROWS - 1)) / 2;
          const lit = interpolate(wave, [d * 0.8, d * 0.8 + 0.22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const color = TILE_LIST[Math.floor(random(`hue-${i}`) * TILE_LIST.length)];

          return (
            <div
              key={i}
              style={{
                width: 116,
                height: 116,
                borderRadius: 20,
                background: `rgba(255,255,255,0.55)`,
                border: "1px solid rgba(255,255,255,0.7)",
                opacity: appear * 0.95,
                transform: `scale(${interpolate(appear, [0, 1], [0.7, 1]) * (1 + lit * (1 - lit) * 0.5)})`,
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 8px 26px rgba(17,20,43,0.06)",
              }}
            >
              {/* the identical grey "email" every contact would have received */}
              <div style={{ position: "absolute", inset: 20, display: "grid", gap: 9, opacity: 1 - lit }}>
                <div style={{ height: 9, borderRadius: 4, background: "#C9CCDC" }} />
                <div style={{ height: 9, borderRadius: 4, background: "#DDE0EB" }} />
                <div style={{ height: 9, borderRadius: 4, background: "#DDE0EB", width: "62%" }} />
              </div>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: color,
                  opacity: lit,
                  transform: `scale(${interpolate(lit, [0, 1], [0.4, 1])})`,
                  borderRadius: 20,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Caption sits on a scrim so it stays readable over both states. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            padding: "38px 62px",
            borderRadius: 34,
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(26px)",
            boxShadow: "0 24px 90px rgba(17,20,43,0.16)",
            textAlign: "center",
            ...rise(enter(frame, fps, 18), 18),
          }}
        >
          <div style={{ position: "relative", height: 96 }}>
            <Title size={80} style={{ position: "absolute", inset: 0, opacity: 1 - swapped }}>
              One email. Everyone.
            </Title>
            <Title
              size={80}
              style={{
                position: "absolute",
                inset: 0,
                opacity: swapped,
                transform: `translateY(${(1 - swapped) * 22}px)`,
              }}
            >
              One email. <span style={{ color: C.primary }}>Each.</span>
            </Title>
          </div>
          <Sub size={26} style={{ marginTop: 10, fontFamily: MONO, letterSpacing: 1 }}>
            5,000 contacts · one campaign · nobody has time to write 5,000 emails
          </Sub>
        </div>
      </div>
    </AbsoluteFill>
  );
};
