import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Building2, Layers, Palette, Mail, ShieldCheck, Lock } from "lucide-react";
import { C, MONO, glass } from "../theme";
import { enter, ramp, rise, sceneFade } from "../anim";
import { Eyebrow, Sub, Title } from "../components/Ui";

/** The console's five tabs, in the order lib/pipeline.ts unlocks them. */
const STEPS = [
  { icon: Building2, label: "Company Info", desc: "Brand, offers, contacts", color: C.primary },
  { icon: Layers, label: "Segments", desc: "Clustered, explained", color: "#7C5BE8" },
  { icon: Palette, label: "Creative Review", desc: "Direction per segment", color: "#B05BC9" },
  { icon: Mail, label: "Email Review", desc: "Composed and editable", color: "#0EA5E9" },
  { icon: ShieldCheck, label: "Approval Queue", desc: "Adjudicated, then sent", color: C.pass },
];

const CARD_W = 296;
const GAP = 42;

export const S03Pipeline: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, length, 10, 14);

  // The unlock wave: a step opens only once the one before it is done, which
  // is exactly the rule the route guard enforces.
  const flow = ramp(frame, 42, 138);

  return (
    <AbsoluteFill style={{ opacity: fade, padding: "96px 110px", flexDirection: "column" }}>
      <div style={{ ...rise(enter(frame, fps, 2), 18), display: "grid", gap: 14 }}>
        <Eyebrow>The pipeline</Eyebrow>
        <Title size={62}>Five steps. Four agents. One human gate.</Title>
        <Sub size={28} style={{ maxWidth: 1100 }}>
          Each stage consumes the reviewed output of the one before it — and stays locked until
          that output exists.
        </Sub>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          gap: GAP,
          position: "relative",
        }}
      >
        {/* the rail the unlock wave travels along */}
        <div
          style={{
            position: "absolute",
            top: 74,
            left: CARD_W / 2,
            width: (CARD_W + GAP) * (STEPS.length - 1),
            height: 4,
            borderRadius: 2,
            background: "rgba(17,20,43,0.09)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 74,
            left: CARD_W / 2,
            width: (CARD_W + GAP) * (STEPS.length - 1) * flow,
            height: 4,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
            boxShadow: `0 0 18px ${C.primary}66`,
          }}
        />

        {STEPS.map((step, i) => {
          const appear = enter(frame, fps, 18 + i * 5);
          const unlocked = interpolate(flow, [i / STEPS.length - 0.04, i / STEPS.length + 0.1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const Icon = step.icon;

          return (
            <div
              key={step.label}
              style={{
                ...glass(0.6 + unlocked * 0.12),
                width: CARD_W,
                padding: "34px 26px 30px",
                textAlign: "center",
                position: "relative",
                ...rise(appear, 24),
                transform: `translateY(${(1 - appear) * 24 - unlocked * 8}px)`,
                borderColor: unlocked > 0.5 ? `${step.color}55` : "rgba(255,255,255,0.7)",
              }}
            >
              <div
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: 26,
                  margin: "0 auto",
                  display: "grid",
                  placeItems: "center",
                  background: `linear-gradient(140deg, ${step.color}, ${step.color}BB)`,
                  boxShadow: `0 14px 34px ${step.color}44`,
                  filter: `saturate(${interpolate(unlocked, [0, 1], [0.15, 1])})`,
                  opacity: interpolate(unlocked, [0, 1], [0.45, 1]),
                }}
              >
                {unlocked > 0.45 ? (
                  <Icon size={40} color="#fff" strokeWidth={1.9} />
                ) : (
                  <Lock size={34} color="#fff" strokeWidth={2} />
                )}
              </div>
              <div
                style={{
                  marginTop: 20,
                  fontFamily: MONO,
                  fontSize: 17,
                  letterSpacing: 3,
                  color: step.color,
                  opacity: 0.4 + unlocked * 0.6,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ marginTop: 6, fontSize: 29, fontWeight: 650, color: C.ink }}>
                {step.label}
              </div>
              <div style={{ marginTop: 8, fontSize: 21, color: C.muted }}>{step.desc}</div>
            </div>
          );
        })}
      </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 54,
          justifyContent: "center",
          fontFamily: MONO,
          fontSize: 22,
          color: C.muted,
          letterSpacing: 0.4,
          ...rise(enter(frame, fps, 92), 14),
        }}
      >
        {[
          "Agents never call each other",
          "Every artifact is schema-validated",
          "Every decision lands in an append-only ledger",
        ].map((t) => (
          <span key={t} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: C.primary }} />
            {t}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
