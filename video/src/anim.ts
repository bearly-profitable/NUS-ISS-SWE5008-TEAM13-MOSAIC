import { interpolate, spring } from "remotion";

/** Standard entrance spring — snappy but not bouncy, like the console's cards. */
export const enter = (frame: number, fps: number, delay = 0) =>
  spring({ frame: frame - delay, fps, config: { damping: 18, mass: 0.8, stiffness: 120 } });

/** Rise + fade, the console's page-transition motion in one object. */
export const rise = (t: number, distance = 26) => ({
  opacity: interpolate(t, [0, 0.6], [0, 1], { extrapolateRight: "clamp" }),
  transform: `translateY(${(1 - t) * distance}px)`,
});

/**
 * Fades a scene's contents in at the head and out at the tail so cuts never
 * hard-flash. `length` is the scene's own duration in frames.
 */
export const sceneFade = (frame: number, length: number, head = 12, tail = 12) =>
  Math.min(
    interpolate(frame, [0, head], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(frame, [length - tail, length], [1, 0], { extrapolateLeft: "clamp" }),
  );

/** 0 → 1 ramp between two frames with both ends clamped. */
export const ramp = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
