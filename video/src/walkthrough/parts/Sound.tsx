/**
 * Narration, music and SFX.
 *
 * The voice is the jump-cut narration (public/walkthrough/voice.wav), laid
 * per chapter so each chapter card is a breath of silence. Forward Motion
 * loops underneath with a 2 s crossfade, ducked under the voice and lifted
 * wherever nobody is talking: the title, the chapter cards, the
 * fast-forwards and the end card. SFX pins name the picture they belong to
 * and are placed by their peak (analysis/sfx_peaks.json), like the intro film.
 */
import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import peaks from "../../../analysis/sfx_peaks.json";
import { EASE, ramp } from "../../lib/polish";
import { BURSTS, CALLOUTS, CLICKS } from "../script";
import { CHAPTERS, cutToFilm, FPS, INTRO, OUTRO_FROM, SEGS, srcToFilm, TOTAL } from "../timeline";

const MUSIC_LEN = Math.floor(158.088 * FPS);
const XF = 60;
const DUCK = 0.075;
const LIFT = 0.2;
const OPEN = 0.42;

/** Film ranges with nobody talking. */
const QUIET: [number, number][] = [
  ...CHAPTERS.filter((c) => c.index > 0).map((c) => [c.cardFrom, c.from] as [number, number]),
  ...SEGS.filter((s) => s.kind === "ff").map((s) => [cutToFilm(s.cutIn), cutToFilm(s.cutIn) + s.frames] as [number, number]),
];

const musicLevel = (g: number) => {
  if (g < INTRO + 24) return OPEN + (DUCK - OPEN) * ramp(g, INTRO - 24, 48, EASE.smooth);
  if (g >= OUTRO_FROM - 12) {
    const up = ramp(g, OUTRO_FROM - 12, 30, EASE.smooth);
    const down = ramp(g, TOTAL - 70, 68, EASE.smooth);
    return (DUCK + (OPEN - DUCK) * up) * (1 - down);
  }
  let lift = 0;
  for (const [a, b] of QUIET) lift = Math.max(lift, ramp(g, a - 12, 14, EASE.smooth) * (1 - ramp(g, b - 8, 16, EASE.smooth)));
  return DUCK + (LIFT - DUCK) * lift;
};

const Music: React.FC = () => {
  const n = Math.ceil(TOTAL / (MUSIC_LEN - XF));
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const from = i * (MUSIC_LEN - XF);
        const len = Math.min(MUSIC_LEN, TOTAL - from);
        return (
          <Sequence key={i} from={from} durationInFrames={len} name={`music loop ${i + 1}`}>
            <Audio
              src={staticFile("music/forward-motion.mp3")}
              volume={(fr) => {
                const xin = i === 0 ? 1 : ramp(fr, 0, XF, EASE.smooth);
                const xout = i === n - 1 ? 1 : 1 - ramp(fr, MUSIC_LEN - XF, XF, EASE.smooth);
                return musicLevel(from + fr) * xin * xout;
              }}
            />
          </Sequence>
        );
      })}
    </>
  );
};

type Pin = { at: number; src: keyof typeof peaks; volume: number; why: string };

const PINS: Pin[] = [
  { at: 0, src: "riser-cine.mp3", volume: 0.22, why: "title opens" },
  { at: 40, src: "impact-deep-whoosh.mp3", volume: 0.34, why: "mark lands" },
  { at: 62, src: "sparkle-touch.mp3", volume: 0.24, why: "wordmark sets" },
  { at: INTRO - 40, src: "whoosh-big.mp3", volume: 0.3, why: "screen rises in" },
  ...CHAPTERS.filter((c) => c.index > 0).flatMap((c): Pin[] => [
    { at: c.cardFrom + 6, src: "whoosh-big.mp3", volume: 0.26, why: `swing out → ${c.id}` },
    { at: c.cardFrom + 22, src: "sparkle-touch.mp3", volume: 0.14, why: `${c.id} tiles pop` },
    { at: c.from - 6, src: "air-woosh-quick.mp3", volume: 0.24, why: `swing back → ${c.id}` },
  ]),
  ...SEGS.filter((s) => s.kind === "ff" && s.cutIn > 0 && SEGS[SEGS.indexOf(s) - 1]?.kind !== "ff").map(
    (s): Pin => ({ at: cutToFilm(s.cutIn) + 2, src: "sweep-fast-small.mp3", volume: 0.16, why: `fast-forward: ${s.why}` }),
  ),
  ...CALLOUTS.map((c): Pin => ({ at: srcToFilm(c.t) + 6, src: "lock-quick.mp3", volume: 0.12, why: `callout: ${c.label ?? "ring"}` })),
  ...CLICKS.map((c): Pin => ({ at: srcToFilm(c.t), src: "switch-click-quick.mp3", volume: 0.22, why: "click" })),
  ...BURSTS.flatMap((b): Pin[] => [
    { at: srcToFilm(b.t), src: "impact-zoom-quick.mp3", volume: 0.3, why: "sent" },
    { at: srcToFilm(b.t) + 8, src: "shimmer-sparkle-sweep.mp3", volume: 0.22, why: "tiles scatter" },
  ]),
  { at: OUTRO_FROM + 4, src: "whoosh-big.mp3", volume: 0.3, why: "screen falls back" },
  { at: OUTRO_FROM + 70, src: "impact-deep-whoosh.mp3", volume: 0.34, why: "end mark lands" },
  { at: OUTRO_FROM + 92, src: "sparkle.mp3", volume: 0.24, why: "end wordmark sets" },
];

const Sfx: React.FC = () => (
  <>
    {PINS.map((p, i) => {
      const from = Math.round(p.at - peaks[p.src].peak_s * FPS);
      const dur = Math.ceil(peaks[p.src].dur * FPS) + 2;
      const trim = Math.max(0, -from);
      return (
        <Sequence key={i} from={Math.max(0, from)} durationInFrames={Math.max(1, dur - trim)} name={`sfx ${p.src} · ${p.why}`}>
          <Audio src={staticFile(`sfx/${p.src}`)} volume={p.volume} trimBefore={trim || undefined} />
        </Sequence>
      );
    })}
  </>
);

export const Sound: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <>
    {CHAPTERS.map((ch) => (
      <Sequence key={ch.id} from={ch.from} durationInFrames={ch.len} name={`voice ${ch.id}`}>
        <Audio src={staticFile("walkthrough/voice.wav")} trimBefore={ch.cutFrom} />
      </Sequence>
    ))}
    {bgm ? <Music /> : null}
    <Sfx />
  </>
);
