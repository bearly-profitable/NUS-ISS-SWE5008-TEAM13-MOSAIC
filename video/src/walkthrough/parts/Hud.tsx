/**
 * Everything drawn in frame space over the screen: subtitles, the chapter
 * pill, the fast-forward badge, the chapter rail along the bottom edge, and
 * the chapter-card titles.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { EASE, ramp } from "../../lib/polish";
import { TextReveal } from "../../lib/text";
import { C, MONO, SANS, TILE_LIST } from "../../theme";
import { CARD, CHAPTERS, CUES, INTRO, OUTRO_FROM, phaseAt, segAtCut, type Cue } from "../timeline";

const HOLD = 14; // frames a line lingers after its last word

/** One subtitle line: a dark glass plate, words light up as they are spoken. */
export const Subtitles: React.FC = () => {
  const f = useCurrentFrame();
  const ph = phaseAt(f);
  if (ph.kind !== "play") return null;
  const c = ph.cut;
  let cue: Cue | undefined;
  let end = 0;
  for (let i = 0; i < CUES.length; i++) {
    const cu = CUES[i];
    const nextFrom = CUES[i + 1]?.from ?? Infinity;
    const until = Math.min(cu.to + HOLD, nextFrom - 1);
    if (c >= cu.from - 3 && c <= until && cu.from >= ph.ch.cutFrom - 3 && cu.from < ph.ch.cutTo) {
      cue = cu;
      end = until;
      break;
    }
  }
  if (!cue) return null;
  const inT = ramp(c, cue.from - 3, 7, EASE.snappy);
  const outT = ramp(c, end - 5, 5, EASE.exit);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 58,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 1480,
          padding: "16px 30px 18px",
          borderRadius: 24,
          background: "rgba(17,20,43,0.80)",
          backdropFilter: "blur(14px) saturate(140%)",
          boxShadow: "0 18px 50px rgba(17,20,43,0.28), inset 0 1px 0 rgba(255,255,255,0.10)",
          fontFamily: SANS,
          fontSize: 44,
          fontWeight: 600,
          lineHeight: 1.22,
          letterSpacing: "-0.01em",
          color: "#fff",
          textAlign: "center",
          opacity: inT * (1 - outT),
          transform: `translateY(${((1 - inT) * 16 + outT * 8).toFixed(1)}px) scale(${(0.96 + 0.04 * inT).toFixed(4)})`,
        }}
      >
        {cue.words.map((w, i) => {
          const said = c >= w.from;
          const active = c >= w.from && (c < w.to + 2 || i === cue!.words.length - 1) && (cue!.words[i + 1]?.from ?? Infinity) > c;
          const pop = ramp(c, w.from, 6, EASE.overshoot);
          return (
            <React.Fragment key={i}>
              {i > 0 ? " " : null}
              <span
                style={{
                  display: "inline-block",
                  padding: "0 6px",
                  margin: "0 -6px",
                  borderRadius: 10,
                  color: said ? "#fff" : "rgba(255,255,255,0.42)",
                  background: active ? `linear-gradient(135deg, ${C.primary}, ${C.secondary})` : "transparent",
                  transform: active ? `translateY(${(-2 * pop).toFixed(2)}px) scale(${(1 + 0.04 * pop).toFixed(4)})` : undefined,
                  boxShadow: active ? "0 6px 18px rgba(79,70,229,0.45)" : undefined,
                }}
              >
                {w.text}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/** Top-left: which chapter we are in. */
export const ChapterPill: React.FC = () => {
  const f = useCurrentFrame();
  const ph = phaseAt(f);
  if (ph.kind !== "play") return null;
  const ch = ph.ch;
  const inT = ramp(ph.t, 6, 18, EASE.snappy);
  const outT = ramp(f, ch.from + ch.len - 8, 8, EASE.exit);
  const tile = TILE_LIST[ch.tile];
  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        top: 34,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 24px 12px 14px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(16px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.95)",
        boxShadow: "0 12px 34px rgba(17,20,43,0.14)",
        opacity: inT * (1 - outT),
        transform: `translateX(${((1 - inT) * -40).toFixed(1)}px)`,
        fontFamily: SANS,
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          background: tile,
          color: "#fff",
          fontFamily: MONO,
          fontSize: 17,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {ch.num}
      </span>
      <span style={{ fontSize: 26, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>{ch.title}</span>
    </div>
  );
};

/** Top-right while a wait is fast-forwarded. */
export const FastForward: React.FC = () => {
  const f = useCurrentFrame();
  const ph = phaseAt(f);
  if (ph.kind !== "play") return null;
  const seg = segAtCut(ph.cut);
  if (!seg || seg.kind !== "ff") return null;
  const d = ph.cut - seg.cutIn;
  const inT = ramp(d, 0, 9, EASE.snappy);
  const outT = ramp(d, seg.frames - 7, 7, EASE.exit);
  const speed = seg.speed >= 10 ? Math.round(seg.speed) : Math.round(seg.speed * 2) / 2;
  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        top: 34,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 26px 12px 20px",
        borderRadius: 999,
        background: "rgba(17,20,43,0.84)",
        backdropFilter: "blur(14px)",
        boxShadow: "0 14px 40px rgba(17,20,43,0.3)",
        opacity: inT * (1 - outT),
        transform: `translateY(${((1 - inT) * -18).toFixed(1)}px) scale(${(0.92 + 0.08 * inT).toFixed(4)})`,
        fontFamily: SANS,
        color: "#fff",
      }}
    >
      <span style={{ display: "flex", gap: 2 }}>
        {[0, 1, 2].map((i) => {
          const phase = ((d * 0.32 - i * 0.55) % 3 + 3) % 3;
          const lit = phase < 1 ? 1 : 0.32;
          return (
            <svg key={i} width={18} height={24} viewBox="0 0 18 24" style={{ opacity: lit }}>
              <path d="M3 3 L14 12 L3 21" fill="none" stroke={TILE_LIST[2]} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          );
        })}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700 }}>{speed}×</span>
      {seg.why ? <span style={{ fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.72)" }}>{seg.why}</span> : null}
    </div>
  );
};

/** A thin rail along the bottom edge: one segment per chapter, filling as the film plays. */
export const ChapterRail: React.FC = () => {
  const f = useCurrentFrame();
  const vis = ramp(f, INTRO - 10, 20, EASE.out) * (1 - ramp(f, OUTRO_FROM, 16, EASE.exit));
  if (vis <= 0) return null;
  const span = OUTRO_FROM - INTRO;
  const GAP = 8;
  const W = 1920 - 80;
  return (
    <div style={{ position: "absolute", left: 40, bottom: 20, width: W, height: 6, opacity: vis }}>
      {CHAPTERS.map((ch, i) => {
        const a = ch.cardFrom - INTRO;
        const b = (CHAPTERS[i + 1]?.cardFrom ?? OUTRO_FROM) - INTRO;
        const x = (a / span) * W;
        const w = ((b - a) / span) * W - GAP;
        const fill = Math.max(0, Math.min(1, (f - ch.cardFrom) / (b - a)));
        return (
          <div key={ch.id} style={{ position: "absolute", left: x, width: w, top: 0, height: 6, borderRadius: 3, background: "rgba(17,20,43,0.12)", overflow: "hidden" }}>
            <div style={{ width: `${fill * 100}%`, height: "100%", background: TILE_LIST[ch.tile], borderRadius: 3 }} />
          </div>
        );
      })}
    </div>
  );
};

/** The chapter card's words, left of the swung-away screen. */
export const ChapterTitle: React.FC = () => {
  const f = useCurrentFrame();
  const ph = phaseAt(f);
  if (ph.kind !== "card") return null;
  const { ch, t } = ph;
  const tile = TILE_LIST[ch.tile];
  const exit = ramp(t, CARD - 22, 16, EASE.exit);
  const rule = ramp(t, 6, 16, EASE.snappy);
  return (
    <div
      style={{
        position: "absolute",
        left: 120,
        top: 0,
        bottom: 0,
        width: 820,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        fontFamily: SANS,
        opacity: 1 - exit,
        transform: `translateX(${(-80 * exit).toFixed(1)}px)`,
        filter: exit > 0 ? `blur(${(exit * 8).toFixed(2)}px)` : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22, fontFamily: MONO, fontSize: 30, fontWeight: 700, color: tile, letterSpacing: "0.08em" }}>
        <span style={{ opacity: ramp(t, 4, 10, EASE.out) }}>{ch.num}</span>
        <span style={{ height: 3, width: 140 * rule, background: tile, borderRadius: 2 }} />
        <span style={{ opacity: ramp(t, 10, 10, EASE.out), fontSize: 24, color: C.muted }}>
          STEP {ch.index + 1} OF {CHAPTERS.length}
        </span>
      </div>
      <div style={{ fontSize: 108, fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.035em", color: C.ink }}>
        <TextReveal text={ch.title} by="word" variant="rise" start={6} each={18} gap={4} frame={t} />
      </div>
      <div style={{ marginTop: 26, fontSize: 36, lineHeight: 1.3, color: C.muted, maxWidth: 760 }}>
        <TextReveal text={ch.sub} by="word" variant="blur" start={14} each={14} gap={1.6} frame={t} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 34 }}>
        {TILE_LIST.map((col, i) => {
          const p = ramp(t, 16 + i * 1.6, 12, EASE.overshoot);
          return <span key={i} style={{ width: 26, height: 26, borderRadius: 7, background: col, opacity: Math.min(1, p * 2) * (i === ch.tile ? 1 : 0.5), transform: `scale(${p.toFixed(3)}) rotate(${((1 - p) * 40).toFixed(1)}deg)` }} />;
        })}
      </div>
    </div>
  );
};
