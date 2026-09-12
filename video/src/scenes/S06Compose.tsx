import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Quote, Pencil } from "lucide-react";
import { C, MONO, TILES, glass } from "../theme";
import { enter, rise, sceneFade } from "../anim";
import { Card, Chip, SceneHead, Sub } from "../components/Ui";

/**
 * The email assembles out of the same block model the builder edits
 * (frontend/src/types/email-builder.ts) — the point being that what the agent
 * writes is not a screenshot, it is an editable document.
 */
const BLOCKS: { type: string; height: number; render: React.FC<{ t: number }> }[] = [
  {
    type: "header",
    height: 64,
    render: () => (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 22px",
          gap: 10,
          borderBottom: "1px solid #EDEEF5",
        }}
      >
        <div style={{ width: 26, height: 26, borderRadius: 8, background: C.primary }} />
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: 2, color: C.ink }}>
          NORTHBANK
        </span>
      </div>
    ),
  },
  {
    type: "hero-image",
    height: 168,
    render: ({ t }) => (
      <div
        style={{
          height: "100%",
          background: "linear-gradient(130deg," + TILES.red + "," + TILES.salmon + " 60%," + TILES.amber + ")",
          opacity: 0.35 + t * 0.65,
        }}
      />
    ),
  },
  {
    type: "heading",
    height: 62,
    render: () => (
      <div style={{ padding: "16px 22px 0", fontSize: 30, fontWeight: 700, color: C.ink }}>
        Your rate, recalculated.
      </div>
    ),
  },
  {
    type: "body-text",
    height: 92,
    render: () => (
      <div style={{ padding: "10px 22px", display: "grid", gap: 10 }}>
        <div style={{ height: 11, borderRadius: 5, background: "#E3E5EF" }} />
        <div style={{ height: 11, borderRadius: 5, background: "#E3E5EF" }} />
        <div style={{ height: 11, borderRadius: 5, background: "#E3E5EF", width: "72%" }} />
      </div>
    ),
  },
  {
    type: "coupon",
    height: 78,
    render: () => (
      <div
        style={{
          margin: "6px 22px",
          height: 62,
          borderRadius: 14,
          border: "2px dashed " + TILES.red + "77",
          background: TILES.red + "10",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontFamily: MONO,
          fontSize: 20,
          color: TILES.red,
          fontWeight: 700,
        }}
      >
        FIRSTMONTH · terms from OFF-102
      </div>
    ),
  },
  {
    type: "button",
    height: 82,
    render: () => (
      <div style={{ padding: "12px 22px" }}>
        <div
          style={{
            height: 54,
            borderRadius: 14,
            background: C.primary,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 21,
            fontWeight: 650,
          }}
        >
          See your rate
        </div>
      </div>
    ),
  },
  {
    type: "footer",
    height: 84,
    render: () => (
      <div
        style={{
          padding: "16px 22px",
          borderTop: "1px solid #EDEEF5",
          fontSize: 15,
          color: "#9AA0B8",
          lineHeight: 1.6,
        }}
      >
        Northbank Living · 21 Quayside, Singapore
        <br />
        <span style={{ textDecoration: "underline" }}>Unsubscribe</span> · Update preferences
      </div>
    ),
  },
];

export const S06Compose: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, length, 10, 14);

  return (
    <AbsoluteFill
      style={{
        opacity: fade,
        padding: "70px 100px",
        flexDirection: "row",
        gap: 60,
        alignItems: "center",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <SceneHead
          eyebrow="Stage 03 · Copywriter & Assembly"
          title={
            <>
              Copy that has to
              <br />
              cite its source.
            </>
          }
          sub="Subject, preheader, body and CTA are written into typed slots and assembled from the same 20 block types the builder edits. Nothing is a screenshot — every block stays editable."
          delay={2}
        />

        <div style={{ marginTop: 30, display: "flex", gap: 12, ...rise(enter(frame, fps, 24), 14) }}>
          <Chip>20 block types</Chip>
          <Chip color={C.secondary}>
            <Pencil size={16} /> editable after generation
          </Chip>
        </div>

        <Card delay={70} style={{ marginTop: 34, padding: 30 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <Quote size={26} color={C.primary} style={{ flexShrink: 0, marginTop: 4 }} />
            <div>
              <div style={{ fontSize: 26, fontWeight: 650, color: C.ink }}>
                Every factual claim cites a row in the offer catalogue.
              </div>
              <Sub size={21} style={{ marginTop: 8 }}>
                If a claim has no catalogue row behind it, the copywriter refuses to make it — and
                if one slips through, the Guardian treats it as a BLOCK, not a note.
              </Sub>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              padding: "18px 22px",
              borderRadius: 16,
              background: "rgba(17,20,43,0.045)",
              fontFamily: MONO,
              fontSize: 19,
              lineHeight: 1.7,
              color: C.ink,
            }}
          >
            <span style={{ color: C.muted }}>"cited_offer_ids"</span>:{" "}
            <span style={{ color: C.pass }}>["OFF-102"]</span>
            <br />
            <span style={{ color: C.muted }}>OFF-102</span> — First month free, 12-month term,
            new residents only
          </div>
        </Card>

        <div style={{ marginTop: 26, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {["subject", "preheader", "body_slots", "cta", "cited_offer_ids"].map((slot, i) => {
            const t = enter(frame, fps, 96 + i * 5);
            return (
              <span
                key={slot}
                style={{
                  fontFamily: MONO,
                  fontSize: 18,
                  padding: "9px 16px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.6)",
                  border: "1px solid rgba(17,20,43,0.07)",
                  color: C.muted,
                  ...rise(t, 10),
                }}
              >
                {slot}
              </span>
            );
          })}
        </div>
      </div>

      {/* The composed email, block by block. */}
      <div style={{ width: 620, position: "relative" }}>
        <div
          style={{
            ...glass(0.52),
            padding: 26,
            borderRadius: 34,
            ...rise(enter(frame, fps, 8), 20),
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0 6px 16px",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 17, color: C.muted, letterSpacing: 1.5 }}>
              SUBJECT
            </div>
            <div style={{ fontFamily: MONO, fontSize: 17, color: C.pass }}>46 chars</div>
          </div>
          <div style={{ padding: "0 6px 18px", fontSize: 24, fontWeight: 600, color: C.ink }}>
            Your first month is on us, {"{{first_name}}"}
          </div>

          {/* Block palette: each type lights as the composer lays it down. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 6px 18px" }}>
            {BLOCKS.map((b, i) => {
              const on = enter(frame, fps, 26 + i * 11);
              return (
                <span
                  key={b.type}
                  style={{
                    fontFamily: MONO,
                    fontSize: 15,
                    padding: "5px 11px",
                    borderRadius: 999,
                    background: "rgba(79,70,229," + (0.06 + on * 0.12) + ")",
                    color: C.primary,
                    opacity: 0.35 + on * 0.65,
                  }}
                >
                  {b.type}
                </span>
              );
            })}
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 22,
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(17,20,43,0.12)",
            }}
          >
            {BLOCKS.map((b, i) => {
              const t = enter(frame, fps, 26 + i * 11);
              const Render = b.render;
              return (
                <div
                  key={b.type}
                  style={{
                    height: interpolate(t, [0, 1], [0, b.height]),
                    overflow: "hidden",
                    opacity: interpolate(t, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
                    position: "relative",
                  }}
                >
                  <Render t={t} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
