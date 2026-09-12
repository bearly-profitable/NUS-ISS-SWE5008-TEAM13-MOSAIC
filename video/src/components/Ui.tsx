import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, glass } from "../theme";
import { enter, rise } from "../anim";

export const Card: React.FC<{
  delay?: number;
  style?: React.CSSProperties;
  opacity?: number;
  children?: React.ReactNode;
}> = ({ delay = 0, style, opacity = 0.66, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = enter(frame, fps, delay);
  return (
    <div style={{ ...glass(opacity), ...style, ...rise(t, 22) }}>{children}</div>
  );
};

/** The small uppercase stage marker the console uses above page titles. */
export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = C.primary,
}) => (
  <div
    style={{
      fontFamily: MONO,
      fontSize: 20,
      letterSpacing: 4,
      textTransform: "uppercase",
      color,
      fontWeight: 600,
    }}
  >
    {children}
  </div>
);

export const Title: React.FC<{
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 76, style }) => (
  <div
    style={{
      fontSize: size,
      fontWeight: 700,
      letterSpacing: -size * 0.025,
      lineHeight: 1.04,
      color: C.ink,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Sub: React.FC<{
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 27, style }) => (
  <div
    style={{
      fontSize: size,
      lineHeight: 1.45,
      color: C.muted,
      fontWeight: 450,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Chip: React.FC<{
  children: React.ReactNode;
  color?: string;
  bg?: string;
  style?: React.CSSProperties;
}> = ({ children, color = C.primary, bg, style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 15px",
      borderRadius: 999,
      background: bg ?? `${color}1A`,
      color,
      fontSize: 20,
      fontWeight: 600,
      fontFamily: MONO,
      letterSpacing: 0.2,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </span>
);

/** Header block used at the top-left of every explanatory scene. */
export const SceneHead: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  color?: string;
  delay?: number;
  width?: number;
}> = ({ eyebrow, title, sub, color, delay = 0, width }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = enter(frame, fps, delay);
  return (
    <div style={{ ...rise(t, 20), maxWidth: width, display: "grid", gap: 14 }}>
      <Eyebrow color={color}>{eyebrow}</Eyebrow>
      <Title size={64}>{title}</Title>
      {sub ? <Sub>{sub}</Sub> : null}
    </div>
  );
};
