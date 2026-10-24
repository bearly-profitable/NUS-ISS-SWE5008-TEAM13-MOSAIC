/**
 * Poster for the walkthrough: the README thumbnail (with a play button) and
 * the YouTube thumbnail (without one; YouTube draws its own). Same ground and
 * mark as the film's title card, with the real Console captures from
 * public/ui/ on the right and the seven chapters along the left.
 */
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Background } from "../components/Background";
import { MosaicMark } from "../components/MosaicMark";
import { Grain } from "../lib/polish";
import { C, MONO, SANS, TILE_LIST } from "../theme";
import { CHAPTER_META } from "./script";
import { FPS, TOTAL } from "./timeline";

export type PosterProps = { play: boolean };

const secs = Math.round(TOTAL / FPS);
const DURATION = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

const Chapter: React.FC<{ num: string; title: string; color: string }> = ({ num, title, color }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 18px 10px 10px",
      borderRadius: 16,
      background: "rgba(255,255,255,0.72)",
      border: "1px solid rgba(255,255,255,0.9)",
      boxShadow: "0 6px 18px rgba(17,20,43,0.06)",
    }}
  >
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        background: color,
        color: "#fff",
        fontFamily: MONO,
        fontSize: 17,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {num}
    </div>
    <div style={{ fontSize: 25, fontWeight: 600, color: C.ink, whiteSpace: "nowrap" }}>{title}</div>
  </div>
);

const Play: React.FC = () => (
  <div
    style={{
      width: 168,
      height: 168,
      borderRadius: 84,
      background: "rgba(255,255,255,0.94)",
      boxShadow: "0 24px 70px rgba(79,70,229,0.35), 0 4px 14px rgba(17,20,43,0.12)",
      border: "1px solid rgba(255,255,255,1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <svg width={70} height={70} viewBox="0 0 24 24" style={{ marginLeft: 10 }}>
      <path d="M6 3.8v16.4a1 1 0 0 0 1.5.86l13.6-8.2a1 1 0 0 0 0-1.72L7.5 2.94A1 1 0 0 0 6 3.8z" fill={C.primary} />
    </svg>
  </div>
);

export const Poster: React.FC<PosterProps> = ({ play }) => (
  <AbsoluteFill style={{ fontFamily: SANS, background: C.bg, overflow: "hidden" }}>
    <Background />

    {/* the Console, tilted away from the copy */}
    <div
      style={{
        position: "absolute",
        left: 905,
        top: 175,
        width: 1240,
        height: 698,
        transform: "perspective(2200px) rotateY(-17deg) rotateX(4deg)",
        transformOrigin: "0% 50%",
      }}
    >
      <Img
        src={staticFile("ui/approvals-view.jpg")}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 26,
          boxShadow: "0 40px 110px rgba(17,20,43,0.22), 0 4px 16px rgba(17,20,43,0.08)",
        }}
      />
    </div>

    {/* one generated email, standing in front of it */}
    <div
      style={{
        position: "absolute",
        left: 925,
        top: 300,
        width: 330,
        height: 640,
        borderRadius: 24,
        overflow: "hidden",
        transform: "rotate(-4deg)",
        boxShadow: "0 34px 80px rgba(17,20,43,0.24), 0 3px 10px rgba(17,20,43,0.08)",
        background: "#FFF8F2",
      }}
    >
      <Img src={staticFile("ui/email-loyal@full.png")} style={{ width: "100%", display: "block", marginTop: -6 }} />
    </div>

    {/* one segment card, at the screen's lower edge */}
    <div
      style={{
        position: "absolute",
        left: 1530,
        top: 640,
        width: 352,
        height: 393,
        borderRadius: 18,
        overflow: "hidden",
        transform: "rotate(3deg) scale(0.92)",
        boxShadow: "0 30px 70px rgba(17,20,43,0.2), 0 3px 10px rgba(17,20,43,0.08)",
      }}
    >
      <Img src={staticFile("ui/segments@card2.png")} style={{ width: "100%", height: "100%" }} />
    </div>

    {play ? (
      <div style={{ position: "absolute", left: 1450 - 84, top: 480 - 84 }}>
        <Play />
      </div>
    ) : null}

    {/* copy */}
    <div style={{ position: "absolute", left: 112, top: 104, width: 760, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <MosaicMark width={84} still />
        <div style={{ fontSize: 40, fontWeight: 300, letterSpacing: 40 * 0.26, color: C.ink }}>MOSAIC</div>
      </div>

      <div style={{ marginTop: 58, display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, letterSpacing: "0.2em", color: C.primary }}>
          PRODUCT WALKTHROUGH
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 22,
            fontWeight: 600,
            color: C.ink,
            padding: "6px 14px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.8)",
            border: `1px solid ${C.line}`,
          }}
        >
          {DURATION}
        </div>
      </div>

      <div style={{ marginTop: 22, fontSize: 86, fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.035em", color: C.ink }}>
        From one CSV to an email for{" "}
        <span
          style={{
            background: `linear-gradient(90deg, ${C.primary}, ${C.secondary} 55%, ${TILE_LIST[4]})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          every segment
        </span>
      </div>

      <div style={{ marginTop: 28, fontSize: 31, lineHeight: 1.35, color: C.muted, width: 700 }}>
        A narrated run of the whole Console, end to end, with a person pressing send.
      </div>

      <div style={{ marginTop: 44, display: "flex", flexWrap: "wrap", gap: 12, width: 760 }}>
        {CHAPTER_META.map((c) => (
          <Chapter key={c.id} num={c.num} title={c.title} color={TILE_LIST[c.tile]} />
        ))}
      </div>
    </div>

    <div
      style={{
        position: "absolute",
        left: 112,
        bottom: 54,
        fontFamily: MONO,
        fontSize: 22,
        letterSpacing: "0.16em",
        color: C.muted,
      }}
    >
      TEAM 13 · NUS-ISS
    </div>

    <Grain opacity={0.03} step={2} />
  </AbsoluteFill>
);
