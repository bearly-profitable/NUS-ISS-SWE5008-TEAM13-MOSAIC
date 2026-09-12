import React from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, TILES } from "../theme";

/**
 * The MOSAIC mark, rebuilt as eight vector tiles so they can fly into place.
 *
 * Coordinates traced off frontend/public/mosaic_logo_cropped.png in an 840×690
 * space; the right limb is the left limb mirrored about x = 420, which is how
 * the asset itself is built.
 *
 * Rounded corners come from insetting each polygon and then stroking it with
 * its own fill colour and a round line-join — the outline lands back on the
 * traced edge, and it is far cheaper than hand-rolling arc paths.
 */
const ROUND = 26;

type Pt = [number, number];

const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [840 - x, y] as Pt);

const LEFT_RED: Pt[] = [[48, 30], [245, 205], [48, 272]];
const LEFT_SALMON: Pt[] = [[58, 285], [248, 238], [248, 530], [58, 437]];
const LEFT_AMBER: Pt[] = [[50, 472], [250, 556], [250, 655], [50, 655]];

export const TILE_SHAPES: { pts: Pt[]; color: string }[] = [
  { pts: LEFT_RED, color: TILES.red },
  { pts: LEFT_SALMON, color: TILES.salmon },
  { pts: LEFT_AMBER, color: TILES.amber },
  { pts: [[290, 235], [552, 235], [421, 425]], color: TILES.violet },
  { pts: [[421, 465], [552, 655], [290, 655]], color: TILES.teal },
  { pts: mirror(LEFT_RED), color: TILES.blue },
  { pts: mirror(LEFT_SALMON), color: TILES.sky },
  { pts: mirror(LEFT_AMBER), color: TILES.deep },
];

const centroid = (pts: Pt[]): Pt => [
  pts.reduce((a, p) => a + p[0], 0) / pts.length,
  pts.reduce((a, p) => a + p[1], 0) / pts.length,
];

/** Pull every vertex `d` units toward the centroid so the stroke lands back
 *  on the traced outline instead of fattening the tile. */
const inset = (pts: Pt[], d: number): string => {
  const [cx, cy] = centroid(pts);
  return pts
    .map(([x, y]) => {
      const len = Math.hypot(cx - x, cy - y) || 1;
      return `${x + ((cx - x) / len) * d},${y + ((cy - y) / len) * d}`;
    })
    .join(" ");
};

export const MOSAIC_VIEWBOX = "34 14 772 656";

export const MosaicMark: React.FC<{
  width?: number;
  /** Frames to wait before the first tile lands. */
  delay?: number;
  /** Frames between consecutive tiles. */
  stagger?: number;
  /** Skip the fly-in entirely (outro, lockups). */
  still?: boolean;
}> = ({ width = 520, delay = 0, stagger = 3.5, still = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <svg
      width={width}
      height={(width * 656) / 772}
      viewBox={MOSAIC_VIEWBOX}
      style={{ overflow: "visible" }}
    >
      {TILE_SHAPES.map((tile, i) => {
        const t = still
          ? 1
          : spring({
              frame: frame - delay - i * stagger,
              fps,
              config: { damping: 15, mass: 0.85, stiffness: 115 },
            });

        const [cx, cy] = centroid(tile.pts);
        // Tiles start pushed out along the ray from the mark's centre, so they
        // converge on the logo rather than sliding in from one side.
        const dx = (cx - 420) * 2.1;
        const dy = (cy - 340) * 2.1;
        const spin = (random(`mosaic-spin-${i}`) - 0.5) * 55;

        return (
          <g
            key={i}
            style={{
              opacity: interpolate(t, [0, 0.32], [0, 1], { extrapolateRight: "clamp" }),
              transform: `translate(${dx * (1 - t)}px, ${dy * (1 - t)}px) rotate(${spin * (1 - t)}deg) scale(${interpolate(t, [0, 1], [0.5, 1])})`,
              transformOrigin: `${cx}px ${cy}px`,
            }}
          >
            <polygon
              points={inset(tile.pts, ROUND / 2)}
              fill={tile.color}
              stroke={tile.color}
              strokeWidth={ROUND}
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </svg>
  );
};

/** The wordmark under the tiles — Inter Light, wide-tracked, matching the asset. */
export const Wordmark: React.FC<{ size?: number; progress: number }> = ({
  size = 92,
  progress,
}) => (
  <div style={{ display: "flex", justifyContent: "center", paddingLeft: size * 0.26 }}>
    {"MOSAIC".split("").map((ch, i) => {
      const t = interpolate(progress, [i * 0.08, i * 0.08 + 0.45], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return (
        <span
          key={i}
          style={{
            fontSize: size,
            fontWeight: 300,
            letterSpacing: size * 0.26,
            color: C.ink,
            opacity: t,
            transform: `translateY(${(1 - t) * size * 0.3}px)`,
            display: "inline-block",
          }}
        >
          {ch}
        </span>
      );
    })}
  </div>
);
