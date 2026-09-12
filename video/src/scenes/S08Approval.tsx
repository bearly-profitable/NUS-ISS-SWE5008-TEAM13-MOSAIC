import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Check, Send, ShieldCheck, UserRound } from "lucide-react";
import { C, MONO, glass } from "../theme";
import { enter, ramp, rise, sceneFade } from "../anim";
import { Card, SceneHead } from "../components/Ui";

/** What the append-only ledger has to say about one campaign run. */
const LEDGER = [
  { t: "14:02:11", stage: "segmentation", who: "agent", ver: "gpt-5.6-luna", out: "4 segments" },
  { t: "14:03:40", stage: "creative_direction", who: "agent", ver: "gpt-5.6-luna", out: "4 directions" },
  { t: "14:05:02", stage: "email_composer", who: "agent", ver: "gpt-5.6-luna", out: "4 emails" },
  { t: "14:05:44", stage: "guardian", who: "agent", ver: "guardian-v3", out: "PASS" },
  { t: "14:06:10", stage: "approval", who: "human", ver: "ong qing quan", out: "APPROVED" },
  { t: "14:06:11", stage: "dispatch", who: "system", ver: "resend", out: "SENT" },
];

const PRESS_AT = 76;

export const S08Approval: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, length, 10, 14);

  // The button dips, then the card flips to its sent state.
  const press = interpolate(frame, [PRESS_AT, PRESS_AT + 5, PRESS_AT + 12], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sent = ramp(frame, PRESS_AT + 8, PRESS_AT + 26);

  return (
    <AbsoluteFill
      style={{
        opacity: fade,
        padding: "70px 96px",
        flexDirection: "row",
        gap: 52,
        alignItems: "center",
      }}
    >
      <div style={{ width: 780, display: "flex", flexDirection: "column" }}>
        <SceneHead
          eyebrow="Stage 05 · Human approval"
          title={
            <>
              Nothing sends itself.
            </>
          }
          sub="The gate is mandatory and there is no bypass flag. Who approved it, what they approved, and the verdict they approved it over are all written down before a single message leaves."
          delay={2}
        />

        <Card delay={16} style={{ marginTop: 40, padding: 32 }}>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            {/* the email under review */}
            <div
              style={{
                width: 132,
                height: 168,
                borderRadius: 16,
                background: "#fff",
                boxShadow: "0 12px 34px rgba(17,20,43,0.12)",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <div style={{ height: 44, background: "linear-gradient(120deg,#F04A3C,#F6A184)" }} />
              <div style={{ padding: 12, display: "grid", gap: 7 }}>
                <div style={{ height: 8, borderRadius: 4, background: "#DFE2EE", width: "80%" }} />
                <div style={{ height: 6, borderRadius: 3, background: "#ECEEF6" }} />
                <div style={{ height: 6, borderRadius: 3, background: "#ECEEF6" }} />
                <div style={{ height: 6, borderRadius: 3, background: "#ECEEF6", width: "60%" }} />
                <div
                  style={{
                    marginTop: 6,
                    height: 20,
                    borderRadius: 6,
                    background: C.primary,
                  }}
                />
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 27, fontWeight: 650, color: C.ink }}>
                  Price-led switchers
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "6px 13px",
                    borderRadius: 999,
                    background: C.pass + "1A",
                    color: C.pass,
                    fontFamily: MONO,
                    fontSize: 17,
                    fontWeight: 700,
                  }}
                >
                  <ShieldCheck size={17} /> PASS
                </span>
              </div>

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(17,20,43,0.07)",
                }}
              >
                <UserRound size={20} color={C.muted} />
                <span style={{ fontFamily: MONO, fontSize: 20, color: C.ink }}>
                  approver: ong qing quan
                </span>
              </div>

              <div
                style={{
                  marginTop: 18,
                  height: 62,
                  borderRadius: 16,
                  background: sent > 0.5 ? C.pass : C.primary,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  fontSize: 23,
                  fontWeight: 650,
                  transform: "scale(" + (1 - press * 0.035) + ")",
                  boxShadow:
                    "0 " +
                    (16 - press * 10) +
                    "px 40px " +
                    (sent > 0.5 ? C.pass : C.primary) +
                    "55",
                  transition: "none",
                }}
              >
                {sent > 0.5 ? (
                  <>
                    <Check size={24} strokeWidth={3} /> Sent via Resend
                  </>
                ) : (
                  <>
                    <Send size={22} /> Approve &amp; send
                  </>
                )}
              </div>
            </div>
          </div>

          {/* the ripple the press leaves behind */}
          <div
            style={{
              marginTop: 18,
              fontFamily: MONO,
              fontSize: 19,
              color: C.muted,
              opacity: sent,
            }}
          >
            4 emails · 4,550 recipients · dispatched {Math.round(sent * 100)}%
          </div>
        </Card>
      </div>

      <Card delay={26} style={{ flex: 1, padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 650, color: C.ink }}>Decision ledger</div>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 16,
              color: C.primary,
              background: C.primary + "14",
              padding: "6px 13px",
              borderRadius: 999,
            }}
          >
            append-only
          </span>
        </div>

        <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
          {LEDGER.map((row, i) => {
            const t = enter(frame, fps, 34 + i * 9);
            const human = row.who === "human";
            return (
              <div
                key={row.stage}
                style={{
                  ...glass(0.55),
                  borderRadius: 16,
                  padding: "14px 18px",
                  display: "grid",
                  gridTemplateColumns: "96px 1fr auto",
                  gap: 14,
                  alignItems: "center",
                  fontFamily: MONO,
                  fontSize: 18,
                  borderLeft: "3px solid " + (human ? C.revise : C.primary),
                  ...rise(t, 14),
                }}
              >
                <span style={{ color: C.muted }}>{row.t}</span>
                <span style={{ color: C.ink }}>
                  {row.stage}
                  <span style={{ color: C.muted, marginLeft: 10 }}>{row.ver}</span>
                </span>
                <span
                  style={{
                    color: human ? C.revise : C.pass,
                    fontWeight: 700,
                  }}
                >
                  {row.out}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 26,
            fontSize: 21,
            color: C.muted,
            lineHeight: 1.5,
            opacity: ramp(frame, 110, 130),
          }}
        >
          Every row carries the prompt and model version live at generation time — so a decision
          made last month can still be explained this month.
        </div>
      </Card>
    </AbsoluteFill>
  );
};
