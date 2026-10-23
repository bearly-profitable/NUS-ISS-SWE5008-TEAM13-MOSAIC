/**
 * Design tokens lifted straight from the console's own theme
 * (frontend/src/index.css + tailwind.config.js) so the film and the product
 * are unmistakably the same thing. HSL values there, hex here.
 */
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const { fontFamily: SANS } = loadInter("normal", {
  weights: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});
// Italic is used once, for the accented word on the breath card.
loadInter("italic", { weights: ["700"], subsets: ["latin"] });
export const { fontFamily: MONO } = loadMono("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

export const C = {
  bg: "#F3F4FA", // --background 234 30% 97%
  ink: "#11142B", // --foreground 234 40% 8%
  muted: "#6B7091", // --muted-foreground
  line: "#DADCE8", // --border
  primary: "#4F46E5", // --primary 243 75% 59%
  secondary: "#8B5CF6", // --secondary 262 70% 58%
  info: "#0EA5E9", // --info 199 89% 48%
  pass: "#29A06B", // --verdict-pass 152 60% 40%
  revise: "#F59E0B", // --verdict-revise 38 92% 50%
  block: "#DC2626", // --verdict-block 0 72% 51%
} as const;

/** The eight tiles of the MOSAIC mark, in reading order. */
export const TILES = {
  red: "#F04A3C",
  salmon: "#F6A184",
  amber: "#F7B818",
  violet: "#8B5CF6",
  teal: "#3AB295",
  blue: "#3A6FD0",
  sky: "#9BCDE6",
  deep: "#0F6E88",
} as const;

export const TILE_LIST = Object.values(TILES);

/** Matches `.glass-card` — a white wash with a hairline and a soft drop. */
export const glass = (opacity = 0.62): React.CSSProperties => ({
  background: `rgba(255,255,255,${opacity})`,
  backdropFilter: "blur(18px) saturate(150%)",
  border: "1px solid rgba(255,255,255,0.75)",
  borderRadius: 28,
  boxShadow: "0 18px 60px rgba(17,20,43,0.09), 0 2px 10px rgba(17,20,43,0.04)",
});

export const shadowText = {
  textShadow: "0 1px 0 rgba(255,255,255,0.6)",
};

/** Apple-ish ease used everywhere in the console's page transitions. */
export const EASE = [0.16, 1, 0.3, 1] as const;
