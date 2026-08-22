import { motion } from "framer-motion";

/**
 * Animated MOSAIC mark — the eight tiles of the logo's "M", assembling on a
 * loop while a long job runs.
 *
 * Built as inline SVG rather than animating the PNG so it stays crisp at any
 * size and each tile can move independently. Geometry mirrors the brand mark:
 * two outer columns of three tiles, and the two centre triangles that form
 * the M's notch.
 */

const TILES = [
  // ── left column ──
  { id: "l1", color: "#E8433A", d: "M22 26 L48 26 L48 52 L22 52 Z", delay: 0.0 },
  { id: "l2", color: "#F5936A", d: "M22 56 L48 56 L48 80 L22 80 Z", delay: 0.08 },
  { id: "l3", color: "#F5BC18", d: "M22 84 L48 84 L48 108 L22 108 Z", delay: 0.16 },
  // ── centre notch ──
  { id: "c1", color: "#8B5FD6", d: "M54 50 L86 50 L70 76 Z", delay: 0.24 },
  { id: "c2", color: "#48B79A", d: "M70 82 L86 108 L54 108 Z", delay: 0.32 },
  // ── right column ──
  { id: "r1", color: "#4169D0", d: "M92 26 L118 26 L118 52 L92 52 Z", delay: 0.12 },
  { id: "r2", color: "#8FC7E8", d: "M92 56 L118 56 L118 80 L92 80 Z", delay: 0.2 },
  { id: "r3", color: "#17708F", d: "M92 84 L118 84 L118 108 L92 108 Z", delay: 0.28 },
];

interface MosaicLoaderProps {
  /** Rendered width in px. */
  size?: number;
  /** Hides the wordmark when false — useful in tight inline spots. */
  showWordmark?: boolean;
  className?: string;
}

export function MosaicLoader({ size = 96, showWordmark = true, className }: MosaicLoaderProps) {
  return (
    <div className={className} style={{ width: size }} aria-label="Working" role="status">
      <svg viewBox="0 0 140 134" width={size} height={(size * 134) / 140} aria-hidden="true">
        {TILES.map((tile) => (
          <motion.path
            key={tile.id}
            d={tile.d}
            fill={tile.color}
            initial={{ opacity: 0.15, scale: 0.82 }}
            animate={{ opacity: [0.15, 1, 0.15], scale: [0.82, 1, 0.82] }}
            transition={{
              duration: 1.8,
              times: [0, 0.45, 1],
              repeat: Infinity,
              delay: tile.delay,
              ease: "easeInOut",
            }}
            // Scale each tile about its own centre rather than the SVG origin,
            // so they pulse in place instead of drifting toward the corner.
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        ))}
      </svg>

      {showWordmark && (
        <motion.div
          className="text-center font-semibold text-foreground/70"
          style={{ fontSize: Math.max(9, size * 0.11), letterSpacing: size * 0.055 }}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          MOSAIC
        </motion.div>
      )}
    </div>
  );
}
