import React from "react";

/** Screen-space pointer. `press` 0→1 squashes it like a real click. */
export const Cursor: React.FC<{ x: number; y: number; press?: number; opacity?: number; size?: number }> = ({
  x,
  y,
  press = 0,
  opacity = 1,
  size = 44,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: size,
      height: size,
      opacity,
      transform: `scale(${(1 - 0.14 * press).toFixed(4)})`,
      transformOrigin: "4px 4px",
      filter: "drop-shadow(0 6px 10px rgba(17,20,43,0.32))",
      pointerEvents: "none",
    }}
  >
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <path d="M3.2 2.4 20 11.1l-7.3 1.6-3.6 6.9z" fill="#11142B" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  </div>
);

/** Expanding click ring, screen-space, centred on (x, y). */
export const ClickRing: React.FC<{ x: number; y: number; t: number; color: string }> = ({ x, y, t, color }) =>
  t > 0 && t < 1 ? (
    <div
      style={{
        position: "absolute",
        left: x - 70 * t,
        top: y - 70 * t,
        width: 140 * t,
        height: 140 * t,
        borderRadius: "50%",
        border: `3px solid ${color}`,
        opacity: 0.7 * (1 - t),
        pointerEvents: "none",
      }}
    />
  ) : null;
