/**
 * The film's clock. Everything — shot boundaries, beat-locked motion, every
 * SFX pin — is written in beats against the music grid measured in
 * analysis/beat_data.json, never as bare frame numbers. Retime here.
 */
export const FPS = 30;

// Source-music analysis (analysis/beat_data.json). Audit values: never mix
// render offsets into these.
export const SOURCE_BEAT0 = 0.28314; // s, beat 0 of Forward Motion.mp3
export const BEAT = 0.59998; // s  (100.00 BPM)

/** The film starts on track beat 8, two quiet bars before the drop. */
export const MUSIC_FIRST_BEAT = 8;
/** Where <Audio> starts reading the track, in whole frames (rounded up, so the
 *  trim residue and the output offset below largely cancel). */
export const MUSIC_TRIM_FRAMES = Math.ceil((SOURCE_BEAT0 + MUSIC_FIRST_BEAT * BEAT) * FPS); // 153
/**
 * Rendered audio trails the picture by the AAC encoder's priming delay.
 * Measured on this pipeline (Remotion 4.0.523, h264 + AAC 48 kHz, mp4) by
 * cross-correlating the rendered BGM against the source: 2032 samples.
 * sound-design §4.6; re-measure if the codec, sample rate or Remotion changes.
 */
export const OUTPUT_AUDIO_OFFSET_SEC = 2032 / 48000;

/** When film beat m is actually heard in the rendered file, in seconds. */
export const beatT = (m: number) =>
  SOURCE_BEAT0 + (m + MUSIC_FIRST_BEAT) * BEAT - MUSIC_TRIM_FRAMES / FPS + OUTPUT_AUDIO_OFFSET_SEC;
/** The frame on screen while beat m sounds (it lands 0.76 f into that frame). */
export const beatF = (m: number) => Math.floor(beatT(m) * FPS + 1e-6);

export const TOTAL = beatF(100); // 1800 f = 60.0 s

export type Seam = "whip" | "flash" | "none";

/** Shot table. `in`/`out` name the transition on each seam (SPEC.md §3). */
export const SHOTS = {
  opening: { from: 0, to: beatF(16), in: "none", out: "none" },
  company: { from: beatF(16), to: beatF(24), in: "none", out: "whip" },
  segments: { from: beatF(24), to: beatF(36), in: "whip", out: "flash" },
  breath: { from: beatF(36), to: beatF(40), in: "flash", out: "flash" },
  creative: { from: beatF(40), to: beatF(48), in: "flash", out: "whip" },
  compose: { from: beatF(48), to: beatF(60), in: "whip", out: "whip" },
  guardian: { from: beatF(60), to: beatF(76), in: "whip", out: "flash" },
  ledger: { from: beatF(76), to: beatF(84), in: "flash", out: "flash" },
  evalScore: { from: beatF(84), to: beatF(90), in: "flash", out: "none" },
  outro: { from: beatF(90), to: TOTAL, in: "none", out: "none" },
} as const satisfies Record<string, { from: number; to: number; in: Seam; out: Seam }>;

export type ShotId = keyof typeof SHOTS;

/** The three camera-level slams (aesthetic rule R4), on the strongest hits. */
export const SLAMS = { drop: beatF(8), send: beatF(72), stamp: beatF(92) } as const;

/** A frame inside a shot, from its own start. */
export const local = (shot: ShotId, m: number) => beatF(m) - SHOTS[shot].from;
