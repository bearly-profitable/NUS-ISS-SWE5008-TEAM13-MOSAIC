import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Check, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { C, MONO, glass } from "../theme";
import { enter, ramp, rise, sceneFade } from "../anim";
import { Eyebrow, Sub, Title } from "../components/Ui";

/** The nine pre-flight checks, exactly as guardian.py groups and orders them. */
const GROUPS = [
  {
    name: "compliance",
    question: "May we legally send this at all?",
    color: C.primary,
    checks: [
      { label: "Consent", detail: "1,540 of 1,540 contacts opted in", sev: "block" },
      { label: "Unsubscribe route", detail: "Footer carries an opt-out link", sev: "block" },
      { label: "PII leakage", detail: "No foreign identifiers in the body", sev: "block" },
      { label: "Protected-attribute proxy", detail: "No correlation above threshold", sev: "revise" },
    ],
  },
  {
    name: "content",
    question: "Does the copy hold up?",
    color: C.secondary,
    checks: [
      { label: "Offer grounding", detail: "Cites 1 catalogue offer: OFF-102", sev: "block" },
      { label: "Personalisation tags", detail: "3 tags, all resolvable", sev: "block" },
    ],
  },
  {
    name: "deliverability",
    question: "Will it land, and render?",
    color: C.info,
    checks: [
      { label: "Subject line", detail: "46 chars, no spam triggers", sev: "revise" },
      { label: "Link integrity", detail: "All 4 links resolve", sev: "revise" },
      { label: "Image sources", detail: "All 2 images on public https", sev: "revise" },
    ],
  },
];

const VERDICTS = [
  { id: "PASS", icon: ShieldCheck, color: C.pass, note: "clear to send" },
  { id: "REVISE", icon: ShieldAlert, color: C.revise, note: "ship it knowingly, or fix it" },
  { id: "BLOCK", icon: ShieldX, color: C.block, note: "never reaches an inbox" },
];

export const S07Guardian: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, length, 10, 14);

  let order = 0;

  return (
    <AbsoluteFill style={{ opacity: fade, padding: "74px 96px", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ ...rise(enter(frame, fps, 2), 18), display: "grid", gap: 12, maxWidth: 1080 }}>
          <Eyebrow>Stage 04 · Compliance & Brand Guardian</Eyebrow>
          <Title size={60}>Nine checks stand between a draft and an inbox.</Title>
          <Sub size={26}>
            Every one runs against this workspace's own data — the uploaded contacts, the offer
            catalogue, the email's current blocks. Nothing is a hardcoded pass.
          </Sub>
        </div>

        <div style={{ ...rise(enter(frame, fps, 10), 16), textAlign: "right" }}>
          <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 2, color: C.muted }}>
            GUARDIAN-V3
          </div>
          <div style={{ fontFamily: MONO, fontSize: 18, color: C.muted, marginTop: 6 }}>
            re-run on every edit
          </div>
        </div>
      </div>

      <div style={{ marginTop: 52, display: "flex", gap: 26, alignItems: "stretch" }}>
        {GROUPS.map((group, gi) => (
          <div
            key={group.name}
            style={{
              ...glass(0.64),
              flex: group.checks.length === 4 ? 1.18 : 1,
              padding: "26px 28px",
              ...rise(enter(frame, fps, 16 + gi * 6), 20),
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 18,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: group.color,
                fontWeight: 600,
              }}
            >
              {group.name}
            </div>
            <div style={{ fontSize: 21, color: C.muted, marginTop: 6 }}>{group.question}</div>

            <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
              {group.checks.map((check) => {
                const at = 34 + order * 8;
                order += 1;
                const t = enter(frame, fps, at);
                const tick = ramp(frame, at + 4, at + 12);
                return (
                  <div
                    key={check.label}
                    style={{
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                      padding: "13px 15px",
                      borderRadius: 16,
                      background: "rgba(255,255,255," + (0.4 + tick * 0.3) + ")",
                      border: "1px solid rgba(41,160,107," + tick * 0.35 + ")",
                      ...rise(t, 12),
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 99,
                        flexShrink: 0,
                        display: "grid",
                        placeItems: "center",
                        background: tick > 0.5 ? C.pass : "rgba(17,20,43,0.08)",
                        transform: "scale(" + interpolate(tick, [0, 0.6, 1], [0.8, 1.18, 1]) + ")",
                      }}
                    >
                      <Check
                        size={18}
                        color="#fff"
                        strokeWidth={3.4}
                        style={{ opacity: tick > 0.45 ? 1 : 0 }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 620,
                          color: C.ink,
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                        }}
                      >
                        {check.label}
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 13,
                            letterSpacing: 1,
                            padding: "3px 8px",
                            borderRadius: 6,
                            color: check.sev === "block" ? C.block : C.revise,
                            background:
                              (check.sev === "block" ? C.block : C.revise) + "16",
                          }}
                        >
                          {check.sev}
                        </span>
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 16, color: C.muted, marginTop: 4 }}>
                        {check.detail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Severity decides the verdict — spelled out, because it is the whole design. */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 40,
        }}
      >
        <Sub size={25} style={{ ...rise(enter(frame, fps, 122), 14), maxWidth: 620 }}>
          Severity decides the verdict. A <b style={{ color: C.block }}>block</b> failure is
          unlawful, a data incident, or a merge tag that would render literally to a real person.
        </Sub>

        <div style={{ display: "flex", gap: 18 }}>
          {VERDICTS.map((v, i) => {
            const t = enter(frame, fps, 128 + i * 8);
            const Icon = v.icon;
            const active = v.id === "PASS";
            return (
              <div
                key={v.id}
                style={{
                  ...glass(active ? 0.8 : 0.5),
                  padding: "18px 26px",
                  borderRadius: 22,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  border: "1px solid " + v.color + (active ? "88" : "33"),
                  boxShadow: active
                    ? "0 18px 50px " + v.color + "3A"
                    : "0 8px 24px rgba(17,20,43,0.06)",
                  transform: "translateY(" + (1 - t) * 16 + "px)",
                  opacity:
                    (active ? 1 : 0.62) *
                    interpolate(t, [0, 0.6], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                <Icon size={34} color={v.color} strokeWidth={2} />
                <div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 26,
                      fontWeight: 700,
                      letterSpacing: 2,
                      color: v.color,
                    }}
                  >
                    {v.id}
                  </div>
                  <div style={{ fontSize: 17, color: C.muted }}>{v.note}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
