/**
 * S7 — Composer. Part A is row-embed (video-shotcraft demos/ui-entrance) on
 * the real email builder: the composer's typed blocks (Logo, Hero Image,
 * Heading … Footer) fall out of the air row by row, rotateX flattening as
 * they land in their slots, each landing marked by a 2 px accent seam. The
 * live preview of the same email sits beside them. Part B pulls back over the
 * Email Review grid: six segments, six different emails.
 *
 * Kept from the card: rows cut from the page texture itself (never redrawn),
 * a real-background patch + 20% dashed slot until each row lands, the
 * fast-at-contact fall bezier(.5,0,.8,.75), 1.06→0.995 press, seam 5 f out
 * from centre then 8 f fade, camera drifting down while rows rain.
 */
import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { Caption } from "../components/Caption";
import { useShotFrame } from "../components/Shot";
import { camPath, PageCam } from "../lib/cam";
import { bezier, EASE, ramp } from "../lib/polish";
import { C } from "../theme";
import layout from "../ui-layout.json";

const ROWS = layout.editor.boxes.rows;
const PANEL = "#F6F7FB";
const FALL = bezier(0.5, 0, 0.8, 0.75);
const SWITCH = 118; // editor → email grid

// Accelerating rain: interval 7 f shrinking 0.3 f per row.
const CUES = ROWS.map((_, k) => 6 + 7 * k - 0.15 * k * (k - 1));

const editorCam = camPath([
  { f: -8, cx: 720, cy: 440, zoom: 1.32, rotX: 10, persp: 1700, sx: -130 },
  { f: 70, cx: 720, cy: 640, zoom: 1.3, rotX: 6, persp: 1700, sx: -130 },
  { f: 104, cx: 900, cy: 620, zoom: 1.24, rotX: 2, rotY: -6, persp: 1700, sx: -150 },
  { f: 130, cx: 1040, cy: 560, zoom: 1.12, rotX: 0, rotY: -8, persp: 1700, sx: -100 },
]);
const gridCam = camPath([
  { f: SWITCH - 6, cx: 684, cy: 330, zoom: 1.7, rotX: 0, persp: 1800, sx: 0 },
  { f: SWITCH + 56, cx: 960, cy: 760, zoom: 0.76, rotX: 14, persp: 1800, sx: 250 },
  { f: 234, cx: 960, cy: 770, zoom: 0.73, rotX: 15, persp: 1800, sx: 250 },
]);

const Row: React.FC<{ b: (typeof ROWS)[number]; cue: number; f: number }> = ({ b, cue, f }) => {
  const air = 1 - FALL(Math.min(1, Math.max(0, (f - cue) / 12)));
  const landed = f >= cue + 12;
  const press = landed ? 1 - 0.005 * Math.sin(Math.min(1, (f - cue - 12) / 4) * Math.PI) : 1.06 - 0.065 * (1 - air);
  const seam = ramp(f, cue + 12, 5, EASE.out);
  const seamFade = 1 - ramp(f, cue + 17, 8, EASE.out);
  const bg = `url(${staticFile("ui/editor.jpg")}) ${-b.x}px ${-b.y}px / 1920px 1080px no-repeat`;
  return (
    <>
      {/* empty slot: real panel colour + faint dashed frame, gone 2 f after landing */}
      {f < cue + 14 ? (
        <div style={{ position: "absolute", left: b.x - 2, top: b.y - 2, width: b.w + 4, height: b.h + 4, background: PANEL }}>
          <div style={{ position: "absolute", inset: 2, borderRadius: 12, border: `1.5px dashed rgba(79,70,229,${(0.22 * (f > cue - 30 ? 1 : 0.6)).toFixed(2)})` }} />
        </div>
      ) : null}
      {f >= cue ? (
        <div
          style={{
            position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, borderRadius: 12, background: bg,
            transform: `perspective(900px) translateY(${(-160 * air).toFixed(1)}px) rotateX(${(18 * air).toFixed(2)}deg) scale(${press.toFixed(4)})`,
            boxShadow: `0 ${(2 + 26 * air).toFixed(1)}px ${(6 + 40 * air).toFixed(1)}px rgba(17,20,43,${(0.06 + 0.14 * air).toFixed(3)})`,
            opacity: Math.min(1, (f - cue) / 3),
            filter: air > 0.15 ? `blur(${(air * 2.2).toFixed(2)}px)` : undefined,
          }}
        />
      ) : null}
      {seam > 0 && seamFade > 0 ? (
        <div style={{ position: "absolute", left: b.x + 12, top: b.y + b.h - 1, width: b.w - 24, height: 2, overflow: "visible" }}>
          <div
            style={{
              position: "absolute", left: "50%", top: 0, height: 2, width: `${seam * 100}%`, transform: "translateX(-50%)",
              background: `linear-gradient(90deg, transparent, ${C.primary} 20%, ${C.primary} 80%, transparent)`,
              boxShadow: `0 0 7px ${C.primary}`, opacity: seamFade,
            }}
          />
        </div>
      ) : null}
    </>
  );
};

export const Compose: React.FC = () => {
  const f = useShotFrame();
  const toGrid = ramp(f, SWITCH - 6, 12, EASE.smooth);
  return (
    <AbsoluteFill>
      {toGrid < 1 ? (
        <AbsoluteFill style={{ opacity: 1 - toGrid, transform: `scale(${(1 - 0.35 * toGrid).toFixed(4)})`, filter: toGrid > 0 ? `blur(${(toGrid * 8).toFixed(2)}px)` : undefined }}>
          <PageCam src="ui/editor.jpg" pageH={1080} cam={editorCam(f)} floor="#ECEDF6">
            {ROWS.map((b, k) => (
              <Row key={k} b={b} cue={CUES[k]} f={f} />
            ))}
          </PageCam>
        </AbsoluteFill>
      ) : null}
      {toGrid > 0 ? (
        <AbsoluteFill style={{ opacity: toGrid }}>
          <PageCam src="ui/emails.jpg" pageH={layout.emails.pageH} cam={gridCam(f)} floor="#ECEDF6" />
        </AbsoluteFill>
      ) : null}
      <Caption
        kicker="AGENT 03 · COMPOSER"
        title="Real email blocks. Not a picture."
        sub="Every block stays editable. Every offer is cited."
        at={14}
        until={112}
        x={1110}
        width={720}
        tile={5}
      />
      <Caption
        kicker="AGENT 03 · COMPOSER"
        title="Six segments. Six different emails."
        sub="Headline, copy and offer framed for each audience."
        at={SWITCH + 16}
        until={214}
        tile={5}
      />
    </AbsoluteFill>
  );
};
