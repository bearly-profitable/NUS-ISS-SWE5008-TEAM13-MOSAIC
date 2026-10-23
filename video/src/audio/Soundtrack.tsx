/**
 * Music + SFX. One declarative table; every pin is a beat or a shot-relative
 * frame (never a bare number), and each entry names the picture it belongs
 * to (sound-design S2). The sample's own peak lag (analysis/sfx_peaks.json)
 * and the measured output offset are subtracted in one place, so the table
 * states *where the hit should land*, not where the file should start
 * (sound-design §4.6).
 *
 * Vocabulary per aesthetic rule S1: whoosh for camera, impact for landings,
 * riser for build-ups, sparkle for light, real switch clicks for clicks.
 */
import React from "react";
import { Audio, interpolate, Sequence, staticFile } from "remotion";
import peaks from "../../analysis/sfx_peaks.json";
import { beatF, FPS, MUSIC_TRIM_FRAMES, OUTPUT_AUDIO_OFFSET_SEC, SHOTS, SLAMS, TOTAL } from "../timeline";

type Pin = { at: number; src: keyof typeof peaks; volume: number; dur?: number; why: string };

const s = SHOTS;
export const SFX: Pin[] = [
  { at: SLAMS.drop, src: "riser-cine.mp3", volume: 0.32, why: "build into the drop" },
  { at: SLAMS.drop, src: "impact-deep-whoosh.mp3", volume: 0.5, why: "slam #1 — first colour wave" },
  { at: SLAMS.drop + 10, src: "shimmer-sparkle-sweep.mp3", volume: 0.3, why: "the field lights up" },
  { at: beatF(11) + 6, src: "whoosh-fast.mp3", volume: 0.42, why: "keycaps stream into the mark" },
  { at: beatF(13) - 2, src: "sparkle-touch.mp3", volume: 0.34, why: "wordmark sets" },
  { at: s.company.from - 2, src: "air-woosh-quick.mp3", volume: 0.3, why: "Company Info swings upright" },
  { at: beatF(18), src: "paper-slide.mp3", volume: 0.42, why: "CSV chip lands in the drop zone" },
  { at: s.segments.from, src: "whoosh-fast.mp3", volume: 0.38, why: "whip → Segments" },
  { at: beatF(26) + 4, src: "whoosh-big.mp3", volume: 0.36, why: "deal starts" },
  { at: beatF(31) + 4, src: "lock-quick.mp3", volume: 0.4, why: "bracket locks on the age flag" },
  { at: s.breath.from, src: "transition-soft.mp3", volume: 0.36, why: "flash → breath card" },
  { at: s.creative.from, src: "transition-soft.mp3", volume: 0.3, why: "flash → Creative Review" },
  { at: s.compose.from, src: "whoosh-fast.mp3", volume: 0.38, why: "whip → builder" },
  { at: s.compose.from + 12, src: "sweep-fast-small.mp3", volume: 0.26, why: "block rows begin to rain" },
  { at: s.compose.from + 112, src: "air-woosh-quick.mp3", volume: 0.28, why: "pull back to the email grid" },
  { at: s.guardian.from, src: "whoosh-fast.mp3", volume: 0.38, why: "whip → Approval Queue" },
  { at: s.guardian.from + 6, src: "data-scan.mp3", volume: 0.24, dur: 60, why: "scan line" },
  { at: s.guardian.from + 40, src: "lock-quick.mp3", volume: 0.42, why: "REVISE row locks" },
  { at: beatF(67), src: "switch-click-quick.mp3", volume: 0.5, why: "select Seasonal Gift Buyers" },
  { at: SLAMS.send, src: "switch-click-quick.mp3", volume: 0.62, why: "the Send click" },
  { at: SLAMS.send, src: "impact-zoom-quick.mp3", volume: 0.46, why: "slam #2 — crash zoom" },
  { at: SLAMS.send + 10, src: "whoosh-electric.mp3", volume: 0.26, why: "delivered" },
  { at: s.ledger.from, src: "transition-soft.mp3", volume: 0.32, why: "flash → ledger" },
  { at: s.ledger.from + 20, src: "zoom-air-fast.mp3", volume: 0.26, why: "crane rises off the new row" },
  { at: s.evalScore.from, src: "transition-soft.mp3", volume: 0.3, why: "flash → eval" },
  { at: s.evalScore.from + 22, src: "data-compute.mp3", volume: 0.22, dur: 30, why: "odometer roll" },
  { at: SLAMS.stamp, src: "riser-cine.mp3", volume: 0.34, why: "build into the lockup" },
  { at: s.outro.from + 10, src: "whoosh-big.mp3", volume: 0.34, why: "group photo flies in" },
  { at: SLAMS.stamp, src: "impact-deep-whoosh.mp3", volume: 0.5, why: "slam #3 — wordmark stamp (film's loudest SFX)" },
  { at: SLAMS.stamp + 22, src: "sparkle.mp3", volume: 0.36, why: "rule draws" },
];

const lagFrames = (src: keyof typeof peaks) => peaks[src].peak_s * FPS;

export const Soundtrack: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <>
    {bgm ? (
      <Audio
        src={staticFile("music/forward-motion.mp3")}
        trimBefore={MUSIC_TRIM_FRAMES}
        volume={(f) => interpolate(f, [0, 8, TOTAL - 54, TOTAL - 2], [0, 0.52, 0.52, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
    ) : null}
    {SFX.map((p, i) => {
      const from = Math.round(p.at - lagFrames(p.src) - OUTPUT_AUDIO_OFFSET_SEC * FPS);
      const dur = p.dur ?? Math.ceil(peaks[p.src].dur * FPS) + 2;
      // A pin whose sample would start before frame 0 starts at 0, trimmed.
      const trim = Math.max(0, -from);
      return (
        <Sequence key={i} from={Math.max(0, from)} durationInFrames={Math.max(1, dur - trim)} name={`sfx ${p.src} · ${p.why}`}>
          <Audio src={staticFile(`sfx/${p.src}`)} volume={p.volume} trimBefore={trim || undefined} />
        </Sequence>
      );
    })}
  </>
);
