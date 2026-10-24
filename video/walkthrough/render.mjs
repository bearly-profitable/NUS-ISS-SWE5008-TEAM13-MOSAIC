// Crash-tolerant render of MosaicWalkthrough.
//
//   node walkthrough/render.mjs            -> out/mosaic-walkthrough.mp4
//
// A single 12k-frame pass over 2838×1428 footage can run Chromium or the frame
// extractor out of memory partway through ("Page crashed!"). This renders in
// chunks (each retried on failure, and skipped on a rerun once it is
// complete), then joins the picture without re-encoding. Each chunk's audio is
// decoded to PCM trimmed to exactly its frames' worth of samples, so the
// joined soundtrack has no gaps or clicks at the seams, and is encoded once.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ID = "MosaicWalkthrough";
const CHUNK = 2500;
const OUT = path.resolve("out/mosaic-walkthrough.mp4");
const PARTS = path.resolve("out/walkthrough-parts");
const FFMPEG = path.resolve("node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");
const FFPROBE = path.resolve("node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe");
const tool = (exe, fallback) => (fs.existsSync(exe) ? exe : fallback);

const frameCount = (file) => {
  try {
    const out = execFileSync(tool(FFPROBE, "ffprobe"), ["-v", "error", "-select_streams", "v", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", file]);
    return parseInt(out.toString().trim(), 10);
  } catch {
    return -1;
  }
};

const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

// Chunks left by a crashed run are reused only if nothing that feeds the film
// has changed since: the source tree's contents and the media files' sizes and dates.
const fingerprint = () => {
  const h = crypto.createHash("sha256");
  const walk = (dir, content) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, content);
      else if (content) h.update(p).update(fs.readFileSync(p));
      else h.update(`${p}:${fs.statSync(p).size}:${fs.statSync(p).mtimeMs}`);
    }
  };
  walk(path.resolve("src"), true);
  walk(path.resolve("public"), false);
  return h.digest("hex");
};
const stamp = path.join(PARTS, "fingerprint.txt");
const print = fingerprint();
if (fs.existsSync(PARTS) && (!fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== print)) {
  fs.rmSync(PARTS, { recursive: true, force: true });
}
fs.mkdirSync(PARTS, { recursive: true });
fs.writeFileSync(stamp, print);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: ID });
const total = composition.durationInFrames;
const common = {
  composition,
  serveUrl,
  chromiumOptions: { gl: "angle" },
  concurrency: 6,
  offthreadVideoCacheSizeInBytes: 2 * 1024 ** 3,
};

const chunks = [];
for (let a = 0; a < total; a += CHUNK) chunks.push([a, Math.min(total, a + CHUNK) - 1]);
for (const [a, b] of chunks) {
  const file = path.join(PARTS, `video_${String(a).padStart(5, "0")}.mp4`);
  if (fs.existsSync(file) && frameCount(file) === b - a + 1) {
    log(`frames ${a}-${b}: already rendered`);
    continue;
  }
  for (let attempt = 1; ; attempt++) {
    try {
      log(`frames ${a}-${b}: attempt ${attempt}`);
      let shown = -1;
      await renderMedia({
        ...common,
        codec: "h264",
        audioBitrate: "320k",
        frameRange: [a, b],
        imageFormat: "jpeg",
        jpegQuality: 94,
        crf: 18,
        x264Preset: "medium",
        pixelFormat: "yuv420p",
        outputLocation: file,
        onProgress: ({ renderedFrames }) => {
          const step = Math.floor(renderedFrames / 250);
          if (step > shown) {
            shown = step;
            log(`  ${a + renderedFrames}/${total}`);
          }
        },
      });
      break;
    } catch (err) {
      log(`  failed: ${String(err.message ?? err).split("\n")[0]}`);
      if (attempt >= 3) throw err;
    }
  }
}

const ff = (...args) => execFileSync(tool(FFMPEG, "ffmpeg"), ["-v", "error", "-y", ...args], { stdio: "inherit" });
const part = (a, ext) => path.join(PARTS, `video_${String(a).padStart(5, "0")}.${ext}`).replace(/\\/g, "/");
const SR = 48000;
log("joining");
for (const [a, b] of chunks) {
  const n = ((b - a + 1) * SR) / composition.fps;
  ff("-i", part(a, "mp4"), "-vn", "-af", `aresample=${SR},apad=whole_len=${n},atrim=end_sample=${n}`, "-ac", "2", "-c:a", "pcm_s16le", part(a, "wav"));
}
const vlist = path.join(PARTS, "video.txt");
const alist = path.join(PARTS, "audio.txt");
fs.writeFileSync(vlist, chunks.map(([a]) => `file '${part(a, "mp4")}'\n`).join(""));
fs.writeFileSync(alist, chunks.map(([a]) => `file '${part(a, "wav")}'\n`).join(""));
ff("-f", "concat", "-safe", "0", "-i", vlist, "-f", "concat", "-safe", "0", "-i", alist, "-map", "0:v", "-map", "1:a",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", OUT);
const frames = frameCount(OUT);
log(`done: ${OUT} (${frames} frames of ${total})`);
if (frames === total) fs.rmSync(PARTS, { recursive: true, force: true });
