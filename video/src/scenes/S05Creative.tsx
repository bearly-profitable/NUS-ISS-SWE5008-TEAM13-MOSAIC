import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { Sparkles, Wand2 } from "lucide-react";
import { C, MONO, TILES, glass } from "../theme";
import { enter, ramp, rise, sceneFade } from "../anim";
import { Card, Chip, SceneHead } from "../components/Ui";

/** The four direction fields the Creative Director actually emits, plus the
 *  palette it has to fill — see orchestrator/state.py. */
const FIELDS = [
  {
    key: "tonality",
    value: "Direct and value-first. Respect their time; lead with the number, not the adjective.",
  },
  {
    key: "language_style",
    value: "Short declaratives. No hype words, no exclamation marks, no invented urgency.",
  },
  { key: "cta_style", value: "One button. Verb plus outcome — 'See your rate'." },
  {
    key: "design_style",
    value: "Generous whitespace, one hero image, offer terms visible without scrolling.",
  },
];

const PALETTE = [
  { name: "primary", hex: "#4F46E5" },
  { name: "accent", hex: "#F04A3C" },
  { name: "background", hex: "#F7F7FB" },
  { name: "text", hex: "#11142B" },
];

/**
 * A stand-in for the generated hero image: brand-coloured tiles resolving in
 * a shuffled order, the way a progressive image lands.
 */
const TILE_COLS = 7;
const TILE_ROWS = 4;

const ImageTile: React.FC<{ progress: number }> = ({ progress }) => (
  <div
    style={{
      position: "relative",
      height: 224,
      borderRadius: 20,
      overflow: "hidden",
      background: "linear-gradient(135deg,#EEF0FA,#E4E8F6)",
      display: "grid",
      gridTemplateColumns: "repeat(" + TILE_COLS + ", 1fr)",
      gridTemplateRows: "repeat(" + TILE_ROWS + ", 1fr)",
    }}
  >
    {new Array(TILE_COLS * TILE_ROWS).fill(0).map((_, i) => {
      const col = i % TILE_COLS;
      const row = Math.floor(i / TILE_COLS);
      // A warm hero: red through amber across the frame, cooler at the edges.
      const hues = [TILES.red, TILES.salmon, TILES.amber, TILES.salmon, TILES.red];
      const base = hues[Math.round((col / (TILE_COLS - 1)) * (hues.length - 1))];
      const shade = 0.55 + (row / (TILE_ROWS - 1)) * 0.45;
      const order = random("ord-" + i);
      const t = interpolate(progress, [order * 0.7, order * 0.7 + 0.3], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return (
        <div
          key={i}
          style={{
            background: base,
            opacity: t * shade,
            transform: "scale(" + (0.72 + t * 0.28) + ")",
          }}
        />
      );
    })}
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse 70% 80% at 30% 20%, rgba(255,255,255,0.55), transparent 60%)",
      }}
    />
  </div>
);

export const S05Creative: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, length, 10, 14);
  const typing = ramp(frame, 26, 120);

  return (
    <AbsoluteFill style={{ opacity: fade, padding: "80px 96px", flexDirection: "row", gap: 52 }}>
      <div style={{ width: 660 }}>
        <SceneHead
          eyebrow="Stage 02 · Creative Director"
          title={
            <>
              A brief per segment,
              <br />
              not a vibe per campaign.
            </>
          }
          sub="Tone, language, call-to-action and design are written per segment and constrained to the brand pack — so the copywriter downstream has something to follow instead of something to guess."
          delay={2}
        />

        <div style={{ marginTop: 32, display: "flex", gap: 12, ...rise(enter(frame, fps, 24), 14) }}>
          <Chip color={C.secondary}>
            <Sparkles size={17} /> brand pack grounded
          </Chip>
          <Chip color={C.info}>word-count bounded</Chip>
        </div>

        <Card delay={74} style={{ marginTop: 36, padding: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Wand2 size={22} color={C.primary} />
            <span style={{ fontSize: 23, fontWeight: 650, color: C.ink }}>
              Imagery is never generated behind your back
            </span>
          </div>
          <div style={{ fontSize: 21, color: C.muted, lineHeight: 1.45 }}>
            No agent calls the image model on its own. You read the prompt, you press Generate.
          </div>
          <div style={{ marginTop: 16 }}>
            <ImageTile progress={ramp(frame, 84, 140)} />
          </div>
        </Card>
      </div>

      <Card delay={12} style={{ flex: 1, padding: 38, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 650, color: C.ink }}>
            Direction · Price-led switchers
          </div>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 17,
              color: C.pass,
              background: C.pass + "1A",
              padding: "6px 14px",
              borderRadius: 999,
            }}
          >
            json_schema
          </span>
        </div>

        <div style={{ marginTop: 26, display: "grid", gap: 18 }}>
          {FIELDS.map((f, i) => {
            const start = i * 0.2;
            const local = interpolate(typing, [start, start + 0.22], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const shown = f.value.slice(0, Math.round(local * f.value.length));
            const caretOn = local > 0 && local < 1 && Math.floor(frame / 6) % 2 === 0;
            return (
              <div
                key={f.key}
                style={{
                  padding: "16px 20px",
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.62)",
                  border: "1px solid rgba(17,20,43,0.06)",
                  opacity: local > 0 ? 1 : 0.3,
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: 1.6, color: C.primary }}>
                  {f.key}
                </div>
                <div style={{ marginTop: 6, fontSize: 23, color: C.ink, lineHeight: 1.4, minHeight: 64 }}>
                  {shown}
                  {caretOn ? (
                    <span style={{ color: C.primary, marginLeft: 1 }}>|</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", paddingTop: 26, display: "flex", gap: 14 }}>
          {PALETTE.map((p, i) => {
            const t = enter(frame, fps, 112 + i * 5);
            return (
              <div
                key={p.name}
                style={{
                  ...glass(0.6),
                  flex: 1,
                  padding: 14,
                  borderRadius: 18,
                  textAlign: "center",
                  ...rise(t, 14),
                }}
              >
                <div
                  style={{
                    height: 44,
                    borderRadius: 12,
                    background: p.hex,
                    border: "1px solid rgba(17,20,43,0.08)",
                  }}
                />
                <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 15, color: C.muted }}>
                  {p.name}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 16, color: C.ink }}>{p.hex}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </AbsoluteFill>
  );
};
