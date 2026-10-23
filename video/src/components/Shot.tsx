import React, { createContext, useContext } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { bezier, EASE, ramp, SpeedBlur } from "../lib/polish";
import { SHOTS, type Seam, type ShotId } from "../timeline";

/**
 * Seam vocabulary from video-shotcraft's shot-transitions card:
 *  - whip: the camera throws sideways across the cut, peak ~280 px/f with
 *    directional blur, then a long ease-out tail so the eye catches up on
 *    the incoming shot (B-style "brake" whip).
 *  - flash: the outgoing camera pushes in and a white flash straddles the
 *    hard cut (A-style flash-cut, ±5 f).
 */
const WHIP_W = 2400;
const WHIP_PRE = 8; // frames of throw before the seam
const WHIP_POST = 18; // frames of brake after it
const whipEase = bezier(0.62, 0, 0.08, 1);
const whipS = (d: number) => whipEase(Math.min(1, Math.max(0, (d + WHIP_PRE) / (WHIP_PRE + WHIP_POST))));
const whipV = (d: number) => (whipS(d + 0.5) - whipS(d - 0.5)) * WHIP_W;

const LeadIn = createContext(0);

/** The current frame measured from the shot's nominal start (negative during a lead-in). */
export const useShotFrame = () => useCurrentFrame() - useContext(LeadIn);

export const Shot: React.FC<{ id: ShotId; children: React.ReactNode; lead?: number; tail?: number }> = ({
  id,
  children,
  lead = 0,
  tail = 0,
}) => {
  const shot = SHOTS[id];
  const pre = Math.max(lead, shot.in === "whip" ? WHIP_PRE : 0);
  const post = Math.max(tail, shot.out === "whip" ? WHIP_POST : 0);
  return (
    <Sequence from={shot.from - pre} durationInFrames={shot.to - shot.from + pre + post} name={id}>
      <LeadIn.Provider value={pre}>
        <SeamMotion inSeam={shot.in} outSeam={shot.out} len={shot.to - shot.from}>
          {children}
        </SeamMotion>
      </LeadIn.Provider>
    </Sequence>
  );
};

const SeamMotion: React.FC<{ inSeam: Seam; outSeam: Seam; len: number; children: React.ReactNode }> = ({
  inSeam,
  outSeam,
  len,
  children,
}) => {
  const f = useShotFrame();
  let x = 0;
  let vx = 0;
  if (inSeam === "whip" && f < WHIP_POST) {
    x = WHIP_W * (1 - whipS(f));
    vx = -whipV(f);
  }
  if (outSeam === "whip" && f > len - WHIP_PRE) {
    x = -WHIP_W * whipS(f - len);
    vx = -whipV(f - len);
  }
  let scale = 1;
  if (outSeam === "flash") scale *= 1 + 0.07 * ramp(f, len - 9, 9, EASE.exit);
  if (inSeam === "flash") scale *= 1 + 0.05 * (1 - ramp(f, 0, 12, EASE.snappy));
  return (
    <AbsoluteFill style={{ transform: `translateX(${x.toFixed(1)}px) scale(${scale.toFixed(4)})` }}>
      <SpeedBlur vx={vx} amount={0.085} max={64}>
        {children}
      </SpeedBlur>
    </AbsoluteFill>
  );
};

/** The white flash over every flash seam — mounted once at composition level. */
export const FlashLayer: React.FC = () => {
  const frame = useCurrentFrame();
  let a = 0;
  for (const s of Object.values(SHOTS)) {
    if (s.in !== "flash") continue;
    const d = frame - s.from;
    if (d >= -5 && d <= 6) a = Math.max(a, d < 0 ? EASE.exit((d + 5) / 5) : 1 - EASE.out(d / 6));
  }
  if (a <= 0) return null;
  return <AbsoluteFill style={{ background: "#FBFBFF", opacity: a * 0.94, pointerEvents: "none" }} />;
};
