/**
 * Three clocks, one file.
 *
 *  - source seconds: the raw recording. Everything hand-authored in script.ts
 *    (camera, callouts, clicks) is written against it, so re-cutting never
 *    moves a zoom off the thing it was aimed at.
 *  - cut frames: cut.mp4 / voice.wav, the jump-cut recording (data/edl.json).
 *  - film frames: the composition — intro, then each chapter's slice of the
 *    cut with a chapter card in front of every chapter after the first, then
 *    the outro.
 */
import edl from "./data/edl.json";
import { CHAPTER_META, type ChapterId } from "./script";

export const FPS = 30;
export const SRC_W = edl.srcW;
export const SRC_H = edl.srcH;

export type Seg = {
  srcIn: number;
  srcOut: number;
  speed: number;
  cutIn: number;
  frames: number;
  kind: "talk" | "ff";
  /** What a fast-forward skips over, shown on its badge. */
  why?: string;
  privacy: { kind: string; keep: number[][] } | null;
};
export type Word = { text: string; from: number; to: number };
export type Cue = { from: number; to: number; words: Word[] };

export const SEGS = edl.segs as Seg[];
export const CUES = edl.cues as Cue[];
export const CUT_TOTAL = edl.cutTotal;

/** Source second → cut frame. A moment inside a removed pause lands on the next kept frame. */
export const srcToCut = (sec: number): number => {
  const f = sec * FPS;
  for (const s of SEGS) {
    if (f < s.srcIn) return s.cutIn;
    if (f < s.srcOut) return s.cutIn + (f - s.srcIn) / s.speed;
  }
  return CUT_TOTAL;
};

export const segAtCut = (c: number): Seg | undefined => SEGS.find((s) => c >= s.cutIn && c < s.cutIn + s.frames);

export const INTRO = 150;
export const CARD = 60;
export const OUTRO = 210;

export type Chapter = (typeof CHAPTER_META)[number] & {
  index: number;
  cutFrom: number;
  cutTo: number;
  /** First film frame of the chapter's footage. */
  from: number;
  len: number;
  /** First film frame of the card in front of it (= from for the first chapter). */
  cardFrom: number;
};

export const CHAPTERS: Chapter[] = (() => {
  const cuts = new Map(edl.chapters.map((c) => [c.id as ChapterId, c.cutFrom]));
  let t = INTRO;
  return CHAPTER_META.map((meta, index) => {
    const cutFrom = cuts.get(meta.id)!;
    const next = CHAPTER_META[index + 1];
    const cutTo = next ? cuts.get(next.id)! : CUT_TOTAL;
    const cardFrom = t;
    if (index > 0) t += CARD;
    const ch = { ...meta, index, cutFrom, cutTo, from: t, len: cutTo - cutFrom, cardFrom };
    t += ch.len;
    return ch;
  });
})();

const last = CHAPTERS[CHAPTERS.length - 1];
export const OUTRO_FROM = last.from + last.len;
export const TOTAL = OUTRO_FROM + OUTRO;

export const chapterAtCut = (c: number) =>
  CHAPTERS.find((ch) => c >= ch.cutFrom && c < ch.cutTo) ?? CHAPTERS[CHAPTERS.length - 1];

/** Cut frame → the film frame it plays on. */
export const cutToFilm = (c: number) => {
  const ch = chapterAtCut(c);
  return ch.from + (c - ch.cutFrom);
};

/** Source second → film frame. */
export const srcToFilm = (sec: number) => cutToFilm(srcToCut(sec));

export type Phase =
  | { kind: "intro"; t: number; cut: number }
  | { kind: "play"; ch: Chapter; t: number; cut: number }
  | { kind: "card"; ch: Chapter; prev: Chapter; t: number; cut: number }
  | { kind: "outro"; t: number; cut: number };

/** Where the film is at frame f, and which cut frame the screen shows. */
export const phaseAt = (f: number): Phase => {
  if (f < INTRO) return { kind: "intro", t: f, cut: 0 };
  if (f >= OUTRO_FROM) return { kind: "outro", t: f - OUTRO_FROM, cut: CUT_TOTAL - 1 };
  for (const ch of CHAPTERS) {
    if (ch.index > 0 && f >= ch.cardFrom && f < ch.from) {
      const prev = CHAPTERS[ch.index - 1];
      const t = f - ch.cardFrom;
      return { kind: "card", ch, prev, t, cut: t < CARD / 2 ? prev.cutTo - 1 : ch.cutFrom };
    }
    if (f >= ch.from && f < ch.from + ch.len) return { kind: "play", ch, t: f - ch.from, cut: ch.cutFrom + (f - ch.from) };
  }
  return { kind: "outro", t: 0, cut: CUT_TOTAL - 1 };
};
