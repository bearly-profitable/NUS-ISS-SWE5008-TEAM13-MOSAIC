import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, glass } from "../theme";
import { enter, ramp, rise, sceneFade } from "../anim";
import { Eyebrow, Sub, Title } from "../components/Ui";

/** The four graded agents. Scores are one illustrative run of `app.eval`. */
const AGENTS = [
  { name: "Segmentation", score: 82.4, color: C.primary },
  { name: "Creative", score: 89.1, color: C.secondary },
  { name: "Composer", score: 86.7, color: C.info },
  { name: "Guardian", score: 94.0, color: C.pass },
];

/** eval-v1's segmentation rubric, weights straight from app/eval/rubric.py. */
const RUBRIC = [
  { name: "Silhouette", kind: "Code", weight: 38.5, earned: 31.2 },
  { name: "Coverage", kind: "Code", weight: 17.5, earned: 15.9 },
  { name: "HDBSCAN confidence", kind: "Code", weight: 14.0, earned: 11.1 },
  { name: "Faithfulness", kind: "LLM Judge", weight: 15.0, earned: 12.0 },
  { name: "Specificity", kind: "LLM Judge", weight: 15.0, earned: 12.2 },
];

const Ring: React.FC<{ score: number; color: string; name: string; t: number }> = ({
  score,
  color,
  name,
  t,
}) => {
  const R = 76;
  const circ = 2 * Math.PI * R;
  const shown = score * t;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={188} height={188}>
        <circle cx={94} cy={94} r={R} fill="none" stroke="rgba(17,20,43,0.08)" strokeWidth={15} />
        <circle
          cx={94}
          cy={94}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={15}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - shown / 100)}
          transform="rotate(-90 94 94)"
        />
        <text
          x={94}
          y={104}
          textAnchor="middle"
          fontFamily={MONO}
          fontSize={40}
          fontWeight={700}
          fill={C.ink}
        >
          {shown.toFixed(1)}
        </text>
      </svg>
      <div style={{ fontSize: 24, fontWeight: 620, color: C.ink, marginTop: -6 }}>{name}</div>
    </div>
  );
};

export const S09Eval: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, length, 10, 14);

  return (
    <AbsoluteFill style={{ opacity: fade, padding: "76px 96px", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ ...rise(enter(frame, fps, 2), 18), display: "grid", gap: 12, maxWidth: 1000 }}>
          <Eyebrow color={C.secondary}>Sidecar evaluation</Eyebrow>
          <Title size={60}>The agents get graded too.</Title>
          <Sub size={26}>
            A weighted rubric per agent, half deterministic code metrics and half LLM-as-judge,
            scored against the artifacts already saved — never against a fresh, friendlier run.
          </Sub>
        </div>
        <div style={{ ...rise(enter(frame, fps, 8), 14), textAlign: "right" }}>
          <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: 2, color: C.muted }}>
            RUBRIC eval-v1
          </div>
          <div style={{ fontFamily: MONO, fontSize: 19, color: C.muted, marginTop: 6 }}>
            python -m app.eval
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 30, alignItems: "stretch", width: "100%" }}>
        <div
          style={{
            ...glass(0.64),
            padding: "28px 34px",
            display: "flex",
            gap: 22,
            alignItems: "center",
            ...rise(enter(frame, fps, 14), 20),
          }}
        >
          {AGENTS.map((a, i) => (
            <Ring
              key={a.name}
              {...a}
              t={interpolate(enter(frame, fps, 26 + i * 8), [0, 1], [0, 1])}
            />
          ))}
        </div>

        <div
          style={{
            ...glass(0.64),
            flex: 1,
            padding: "28px 32px",
            ...rise(enter(frame, fps, 40), 20),
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 25, fontWeight: 650, color: C.ink }}>
              Segmentation · criterion breakdown
            </div>
            <div style={{ fontFamily: MONO, fontSize: 19, color: C.muted }}>weight → earned</div>
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 11 }}>
            {RUBRIC.map((r, i) => {
              const t = enter(frame, fps, 52 + i * 7);
              const code = r.kind === "Code";
              return (
                <div
                  key={r.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "270px 118px 1fr 78px",
                    alignItems: "center",
                    gap: 14,
                    ...rise(t, 12),
                  }}
                >
                  <span style={{ fontSize: 21, color: C.ink, fontWeight: 560 }}>{r.name}</span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 15,
                      textAlign: "center",
                      padding: "5px 0",
                      borderRadius: 999,
                      color: code ? C.info : C.secondary,
                      background: (code ? C.info : C.secondary) + "16",
                    }}
                  >
                    {r.kind}
                  </span>
                  <div
                    style={{
                      height: 14,
                      borderRadius: 7,
                      background: "rgba(17,20,43,0.07)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: (r.weight / 40) * 100 + "%",
                        background: "rgba(17,20,43,0.08)",
                        borderRadius: 7,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        width: (r.earned / 40) * 100 * t + "%",
                        background: code ? C.info : C.secondary,
                        borderRadius: 7,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 19,
                      color: C.ink,
                      textAlign: "right",
                    }}
                  >
                    {(r.earned * t).toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid rgba(17,20,43,0.08)",
              display: "flex",
              justifyContent: "space-between",
              fontFamily: MONO,
              fontSize: 20,
              color: C.muted,
              opacity: ramp(frame, 96, 116),
            }}
          >
            <span>5 criteria · 100 points</span>
            <span style={{ color: C.primary, fontWeight: 700 }}>82.4 / 100</span>
          </div>
        </div>
      </div>

      </div>

      <div
        style={{
          display: "flex",
          gap: 54,
          fontFamily: MONO,
          fontSize: 22,
          color: C.muted,
          ...rise(enter(frame, fps, 108), 14),
        }}
      >
        {[
          "Scores saved per run, so regressions show up",
          "The judge is itself checked against a human-labelled set",
        ].map((t) => (
          <span key={t} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: C.secondary }} />
            {t}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
