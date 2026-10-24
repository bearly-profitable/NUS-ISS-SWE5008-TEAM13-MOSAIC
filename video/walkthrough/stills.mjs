// Renders stills of MosaicWalkthrough without re-bundling per frame.
//   node walkthrough/stills.mjs <outDir> <frame|sNNN.N|cN> ...
// A bare number is a film frame; sNNN.N is a second of the source recording;
// cN is the middle of chapter card N.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const [outDir, ...targets] = process.argv.slice(2);
const edl = JSON.parse(fs.readFileSync(new URL("../src/walkthrough/data/edl.json", import.meta.url)));
const INTRO = 150, CARD = 60;
const srcToCut = (sec) => {
  const f = sec * 30;
  for (const s of edl.segs) {
    if (f < s.srcIn) return s.cutIn;
    if (f < s.srcOut) return s.cutIn + (f - s.srcIn) / s.speed;
  }
  return edl.cutTotal;
};
const starts = [];
let t = INTRO;
edl.chapters.forEach((c, i) => {
  const cutTo = edl.chapters[i + 1]?.cutFrom ?? edl.cutTotal;
  const cardFrom = t;
  if (i > 0) t += CARD;
  starts.push({ cutFrom: c.cutFrom, cutTo, from: t, cardFrom });
  t += cutTo - c.cutFrom;
});
const film = (tok) => {
  if (tok.startsWith("s")) {
    const c = srcToCut(parseFloat(tok.slice(1)));
    const ch = starts.find((x) => c >= x.cutFrom && c < x.cutTo) ?? starts[starts.length - 1];
    return Math.round(ch.from + c - ch.cutFrom);
  }
  if (tok.startsWith("c")) return starts[parseInt(tok.slice(1))].cardFrom + parseInt(tok.split("+")[1] ?? "30");
  return parseInt(tok);
};

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "MosaicWalkthrough" });
fs.mkdirSync(outDir, { recursive: true });
for (const tok of targets) {
  const frame = film(tok);
  const output = path.join(outDir, `${tok.replace(/[^\w.+-]/g, "_")}_f${frame}.jpg`);
  await renderStill({ composition, serveUrl, frame, output, imageFormat: "jpeg", jpegQuality: 85, chromiumOptions: { gl: "angle" } });
  console.log(tok, "->", frame, output);
}
