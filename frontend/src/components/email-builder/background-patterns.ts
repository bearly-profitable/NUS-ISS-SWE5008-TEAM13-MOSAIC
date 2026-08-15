import type { BgPatternType } from "@/types/email-builder";

let _idCounter = 0;
function uid() {
  return `pat${++_idCounter}`;
}

/**
 * Returns an inline SVG string for use with dangerouslySetInnerHTML.
 * Each call generates a unique pattern ID so multiple can coexist on the page.
 */
export function getPatternPreviewSvg(
  pattern: BgPatternType,
  color: string,
  scale: number = 1,
): string {
  const s = scale;
  const c = color;
  const id = uid();

  switch (pattern) {
    /* ── Dots ── */
    case "dots": {
      const size = Math.round(20 * s);
      const r = Math.max(2 * s, 1.2);
      return makeSvg(id, size, size,
        `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${c}"/>`
      );
    }

    /* ── Waves: multi-layer smooth sine waves ── */
    case "waves": {
      const w = Math.round(120 * s);
      const h = Math.round(50 * s);
      const sw = Math.max(1.5 * s, 0.8);
      let paths = "";
      for (let row = 0; row < 4; row++) {
        const y = h * 0.15 + row * h * 0.22;
        const amp = h * 0.1 + row * h * 0.02;
        paths += `<path d="M 0 ${y} Q ${w * 0.25} ${y - amp}, ${w * 0.5} ${y} Q ${w * 0.75} ${y + amp}, ${w} ${y}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>`;
      }
      return makeSvg(id, w, h, paths);
    }

    /* ── Diagonal Lines ── */
    case "diagonal-lines": {
      const size = Math.round(12 * s);
      const sw = Math.max(1 * s, 0.5);
      return makeSvgRaw(id, size, size,
        `<line x1="0" y1="${size}" x2="${size}" y2="0" stroke="${c}" stroke-width="${sw}"/>` +
        `<line x1="${-size * 0.5}" y1="${size * 0.5}" x2="${size * 0.5}" y2="${-size * 0.5}" stroke="${c}" stroke-width="${sw}"/>` +
        `<line x1="${size * 0.5}" y1="${size * 1.5}" x2="${size * 1.5}" y2="${size * 0.5}" stroke="${c}" stroke-width="${sw}"/>`
      );
    }

    /* ── Hexagons ── */
    case "hexagons": {
      const w = Math.round(52 * s);
      const h = Math.round(30 * s);
      const sw = Math.max(0.8 * s, 0.4);
      // Proper interlocking hexagon grid
      const qw = w / 4;
      const hh = h / 2;
      return makeSvg(id, w, h,
        `<path d="M ${qw} 0 L ${qw * 3} 0 L ${w} ${hh} L ${qw * 3} ${h} L ${qw} ${h} L 0 ${hh} Z" fill="none" stroke="${c}" stroke-width="${sw}"/>` +
        `<path d="M ${qw} 0 L 0 ${hh}" fill="none" stroke="${c}" stroke-width="${sw}"/>` +
        `<path d="M ${qw * 3} 0 L ${w} ${hh}" fill="none" stroke="${c}" stroke-width="${sw}"/>`
      );
    }

    /* ── Topography: contour map lines ── */
    case "topography": {
      const size = Math.round(80 * s);
      const sw = Math.max(1 * s, 0.5);
      return makeSvg(id, size, size,
        `<path d="M ${size * 0.05} ${size * 0.25} C ${size * 0.2} ${size * 0.05}, ${size * 0.55} ${size * 0.1}, ${size * 0.8} ${size * 0.3}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>` +
        `<path d="M ${size * 0.0} ${size * 0.55} C ${size * 0.2} ${size * 0.4}, ${size * 0.45} ${size * 0.38}, ${size * 0.7} ${size * 0.5} S ${size * 0.95} ${size * 0.65}, ${size * 0.85} ${size * 0.78}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>` +
        `<path d="M ${size * 0.15} ${size * 0.82} C ${size * 0.35} ${size * 0.7}, ${size * 0.6} ${size * 0.75}, ${size * 0.95} ${size * 0.92}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>` +
        `<path d="M ${size * 0.3} ${size * 0.08} C ${size * 0.4} ${size * 0.15}, ${size * 0.42} ${size * 0.25}, ${size * 0.35} ${size * 0.32}" fill="none" stroke="${c}" stroke-width="${sw * 0.7}" stroke-linecap="round"/>`
      );
    }

    /* ── Circles: concentric ring pattern ── */
    case "circles": {
      const size = Math.round(48 * s);
      const sw = Math.max(0.8 * s, 0.4);
      const cx = size / 2;
      const cy = size / 2;
      return makeSvg(id, size, size,
        `<circle cx="${cx}" cy="${cy}" r="${size * 0.15}" fill="none" stroke="${c}" stroke-width="${sw}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${size * 0.3}" fill="none" stroke="${c}" stroke-width="${sw * 0.7}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${size * 0.45}" fill="none" stroke="${c}" stroke-width="${sw * 0.5}"/>`
      );
    }

    /* ── Grid ── */
    case "grid": {
      const size = Math.round(24 * s);
      const sw = Math.max(0.5 * s, 0.3);
      return makeSvg(id, size, size,
        `<path d="M ${size} 0 L 0 0 0 ${size}" fill="none" stroke="${c}" stroke-width="${sw}"/>`
      );
    }

    /* ── Cross Hatch ── */
    case "cross-hatch": {
      const size = Math.round(16 * s);
      const sw = Math.max(0.6 * s, 0.3);
      return makeSvg(id, size, size,
        `<path d="M 0 0 L ${size} ${size}" stroke="${c}" stroke-width="${sw}"/>` +
        `<path d="M ${size} 0 L 0 ${size}" stroke="${c}" stroke-width="${sw}"/>`
      );
    }

    /* ── Diamonds ── */
    case "diamonds": {
      const size = Math.round(24 * s);
      const half = size / 2;
      const sw = Math.max(0.8 * s, 0.4);
      return makeSvg(id, size, size,
        `<path d="M ${half} 0 L ${size} ${half} L ${half} ${size} L 0 ${half} Z" fill="none" stroke="${c}" stroke-width="${sw}"/>`
      );
    }

    default:
      return "";
  }
}

/** Generates a full SVG with a pattern + rect fill, using a unique pattern ID */
function makeSvg(id: string, pw: number, ph: number, patternContent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="position:absolute;inset:0">` +
    `<defs><pattern id="${id}" width="${pw}" height="${ph}" patternUnits="userSpaceOnUse">${patternContent}</pattern></defs>` +
    `<rect width="100%" height="100%" fill="url(#${id})"/>` +
    `</svg>`;
}

/** Same but content goes directly (no pattern wrapper – for manual transforms) */
function makeSvgRaw(id: string, pw: number, ph: number, patternContent: string): string {
  return makeSvg(id, pw, ph, patternContent);
}

/**
 * Builds a raw SVG tile string + its dimensions for a given pattern.
 * Returned SVG has opacity baked in.
 */
export function getPatternTileSvg(
  pattern: BgPatternType,
  color: string,
  scale: number,
  opacity: number,
): { svg: string; width: number; height: number } | null {
  if (pattern === "none") return null;

  const s = scale;
  const c = color;
  const op = (opacity / 100).toFixed(3);
  let w = 20, h = 20, content = "";

  switch (pattern) {
    case "dots": {
      w = Math.round(20 * s); h = w;
      const r = Math.max(2 * s, 1.2);
      content = `<circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="${c}"/>`;
      break;
    }
    case "waves": {
      w = Math.round(120 * s); h = Math.round(50 * s);
      const sw = Math.max(1.5 * s, 0.8);
      for (let row = 0; row < 4; row++) {
        const y = h * 0.15 + row * h * 0.22;
        const amp = h * 0.1 + row * h * 0.02;
        content += `<path d="M 0 ${y} Q ${w * 0.25} ${y - amp}, ${w * 0.5} ${y} Q ${w * 0.75} ${y + amp}, ${w} ${y}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>`;
      }
      break;
    }
    case "diagonal-lines": {
      w = Math.round(12 * s); h = w;
      const sw = Math.max(1 * s, 0.5);
      content = `<line x1="0" y1="${w}" x2="${w}" y2="0" stroke="${c}" stroke-width="${sw}"/>` +
        `<line x1="${-w * 0.5}" y1="${w * 0.5}" x2="${w * 0.5}" y2="${-w * 0.5}" stroke="${c}" stroke-width="${sw}"/>` +
        `<line x1="${w * 0.5}" y1="${w * 1.5}" x2="${w * 1.5}" y2="${w * 0.5}" stroke="${c}" stroke-width="${sw}"/>`;
      break;
    }
    case "hexagons": {
      w = Math.round(52 * s); h = Math.round(30 * s);
      const sw = Math.max(0.8 * s, 0.4);
      const qw = w / 4, hh = h / 2;
      content = `<path d="M ${qw} 0 L ${qw * 3} 0 L ${w} ${hh} L ${qw * 3} ${h} L ${qw} ${h} L 0 ${hh} Z" fill="none" stroke="${c}" stroke-width="${sw}"/>` +
        `<path d="M ${qw} 0 L 0 ${hh}" fill="none" stroke="${c}" stroke-width="${sw}"/>` +
        `<path d="M ${qw * 3} 0 L ${w} ${hh}" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
      break;
    }
    case "topography": {
      w = Math.round(80 * s); h = w;
      const sw = Math.max(1 * s, 0.5);
      content =
        `<path d="M ${w * .05} ${w * .25} C ${w * .2} ${w * .05}, ${w * .55} ${w * .1}, ${w * .8} ${w * .3}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>` +
        `<path d="M 0 ${w * .55} C ${w * .2} ${w * .4}, ${w * .45} ${w * .38}, ${w * .7} ${w * .5} S ${w * .95} ${w * .65}, ${w * .85} ${w * .78}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>` +
        `<path d="M ${w * .15} ${w * .82} C ${w * .35} ${w * .7}, ${w * .6} ${w * .75}, ${w * .95} ${w * .92}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>`;
      break;
    }
    case "circles": {
      w = Math.round(48 * s); h = w;
      const sw = Math.max(0.8 * s, 0.4);
      const cx = w / 2;
      content =
        `<circle cx="${cx}" cy="${cx}" r="${w * .15}" fill="none" stroke="${c}" stroke-width="${sw}"/>` +
        `<circle cx="${cx}" cy="${cx}" r="${w * .3}" fill="none" stroke="${c}" stroke-width="${sw * .7}"/>` +
        `<circle cx="${cx}" cy="${cx}" r="${w * .45}" fill="none" stroke="${c}" stroke-width="${sw * .5}"/>`;
      break;
    }
    case "grid": {
      w = Math.round(24 * s); h = w;
      const sw = Math.max(0.5 * s, 0.3);
      content = `<path d="M ${w} 0 L 0 0 0 ${w}" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
      break;
    }
    case "cross-hatch": {
      w = Math.round(16 * s); h = w;
      const sw = Math.max(0.6 * s, 0.3);
      content = `<path d="M 0 0 L ${w} ${w}" stroke="${c}" stroke-width="${sw}"/>` +
        `<path d="M ${w} 0 L 0 ${w}" stroke="${c}" stroke-width="${sw}"/>`;
      break;
    }
    case "diamonds": {
      w = Math.round(24 * s); h = w;
      const half = w / 2;
      const sw = Math.max(0.8 * s, 0.4);
      content = `<path d="M ${half} 0 L ${w} ${half} L ${half} ${w} L 0 ${half} Z" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
      break;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" opacity="${op}">${content}</svg>`;
  return { svg, width: w, height: h };
}

/** Returns a base64 CSS url() for the pattern tile SVG (for browser use). */
export function getPatternTileDataUri(
  pattern: BgPatternType,
  color: string,
  scale: number,
  opacity: number,
): string {
  const tile = getPatternTileSvg(pattern, color, scale, opacity);
  if (!tile) return "";
  return `url(data:image/svg+xml;base64,${btoa(tile.svg)})`;
}

/**
 * Build the CSS background style for the outer email wrapper.
 */
export function buildBackgroundStyle(bg: {
  type: string;
  primaryColor: string;
  secondaryColor: string;
  gradientDirection: string;
}): React.CSSProperties {
  if (bg.type === "gradient") {
    if (bg.gradientDirection === "radial") {
      return { background: `radial-gradient(circle at center, ${bg.primaryColor}, ${bg.secondaryColor})` };
    }
    const dir = ({
      "to-bottom": "to bottom",
      "to-right": "to right",
      "to-bottom-right": "to bottom right",
      "to-top-right": "to top right",
    } as Record<string, string>)[bg.gradientDirection] || "to bottom";
    return { background: `linear-gradient(${dir}, ${bg.primaryColor}, ${bg.secondaryColor})` };
  }

  return { backgroundColor: bg.primaryColor };
}
