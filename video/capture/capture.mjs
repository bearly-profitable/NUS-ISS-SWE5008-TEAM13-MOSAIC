// Captures the real MOSAIC Console as film textures.
//
// The Console runs from `frontend/` (vite dev on :5173). Every Orchestrator
// call is answered from fixture/*.json (see build_fixture.py) and the brand
// images from assets/, so the pages render exactly as they did for the
// FatCatPillow run without a live backend or Supabase project.
//
// Produces, per shot in SHOTS:
//   public/ui/<name>.png      2x viewport (or full-page) screenshot
//   public/ui/<name>@<el>.png element cutouts
//   src/ui-layout.json        bbox of every recorded element, in CSS px
//
//   node capture/capture.mjs            # all shots
//   node capture/capture.mjs survey     # 1x full-page of every route, to look at
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5173";
const API = "http://localhost:8055";
const OUT = path.resolve(here, "../public/ui");
const LAYOUT = path.resolve(here, "../src/ui-layout.json");
const fixture = (name) => fs.readFileSync(path.join(here, "fixture", `${name}.json`), "utf8");
fs.mkdirSync(OUT, { recursive: true });

const IMAGES = {
  "email-asset-b78febe59c86.png": ["assets/fcp-logo.png", "image/png"],
  "email-asset-13648166940a.png": ["assets/fcp-hero.jpg", "image/jpeg"],
  "email-asset-5d21c0a7e913.png": ["assets/fcp-hero-pink.jpg", "image/jpeg"],
};

/** `patch` optionally rewrites fixtures per shot: { state: (s) => s, logs: (l) => l }. */
async function wire(page, patch = {}) {
  const served = (name) => (patch[name] ? JSON.stringify(patch[name](JSON.parse(fixture(name)))) : fixture(name));
  // Registered first so the specific routes below win (Playwright tries the
  // most recently added match first). Supabase REST/listing calls: empty.
  await page.route("**/*.supabase.co/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route(`${API}/**`, (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body });
    if (p === "/api/state") return json(served("state"));
    if (p === "/api/company") return json(served("company"));
    if (p === "/api/audience") return json(served("audience"));
    if (p === "/api/logs") return json(served("logs"));
    if (p === "/api/settings") return json(served("settings"));
    if (p === "/api/health")
      return json(JSON.stringify({ status: "ok", openrouter_configured: true, supabase_configured: true, resend_configured: true }));
    if (p.startsWith("/api/image-folders")) return json("[]");
    if (p.startsWith("/api/image-assets")) return json("[]");
    return json("{}");
  });
  await page.route("**/storage/v1/object/public/email-images/**", (route) => {
    const file = route.request().url().split("/").pop();
    const hit = IMAGES[file];
    if (!hit) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: hit[1], body: fs.readFileSync(path.join(here, hit[0])) });
  });
}

async function settle(page, ms = 900) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

const browser = await chromium.launch();
const mode = process.argv[2] ?? "all";

if (mode === "survey") {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && console.log("  console:", m.text().slice(0, 160)));
  if (process.env.DEBUG)
    page.on("request", (r) => !r.url().startsWith(BASE) && console.log("  req:", r.resourceType(), r.url().slice(0, 140)));
  await wire(page);
  for (const r of ["company", "segments", "creative", "emails", "approvals", "logs", "settings"]) {
    await page.goto(`${BASE}/${r}`, { waitUntil: "networkidle" });
    await settle(page, 1500);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: path.join(OUT, `survey-${r}.png`), fullPage: true });
    console.log("survey", r, h);
  }
  await browser.close();
  process.exit(0);
}

if (mode === "probe") {
  // node capture/capture.mjs probe <shot name> <js expression> — prints the
  // expression's value after that shot's prepare(), for finding selectors.
  const { SHOTS } = await import("./shots.mjs");
  const shot = SHOTS.find((s) => s.name === process.argv[3]);
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await wire(page, shot.patch);
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
  await settle(page, 1400);
  if (shot.prepare) await shot.prepare(page);
  await settle(page, 900);
  console.log(JSON.stringify(await page.evaluate(process.argv[4]), null, 1));
  await browser.close();
  process.exit(0);
}

// ── Shot list: filled in once the storyboard is locked ─────────────────────
const { SHOTS } = await import("./shots.mjs");
const layout = fs.existsSync(LAYOUT) ? JSON.parse(fs.readFileSync(LAYOUT, "utf8")) : {};
const contexts = new Map();
const contextFor = async (dpr) => {
  if (!contexts.has(dpr))
    contexts.set(dpr, await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr }));
  return contexts.get(dpr);
};

const box = (el) =>
  el.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height };
  });

for (const shot of SHOTS) {
  if (mode !== "all" && mode !== shot.name) continue;
  // A fresh page per shot: prepare() injects styles and resizes the viewport.
  const page = await (await contextFor(shot.dpr ?? 3)).newPage();
  await wire(page, shot.patch);
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
  await settle(page, 1400);
  if (shot.prepare) {
    await shot.prepare(page);
    await settle(page, shot.prepareWait ?? 900);
  }
  const entry = { pageH: await page.evaluate(() => document.documentElement.scrollHeight), boxes: {} };
  for (const b of shot.boxes ?? []) {
    const els = await page.$$(b.selector);
    const picked = b.all ? els.slice(0, b.max ?? els.length) : els.slice(0, 1);
    const bs = [];
    for (const el of picked) bs.push(await box(el));
    entry.boxes[b.key] = b.all ? bs : bs[0] ?? null;
  }
  await page.screenshot({ path: path.join(OUT, `${shot.name}.png`), fullPage: !!shot.fullPage });
  for (const c of shot.cutouts ?? []) {
    const els = await page.$$(c.selector);
    const picked = c.all ? els.slice(0, c.max ?? els.length) : els.slice(0, 1);
    for (let i = 0; i < picked.length; i++) {
      const name = c.all ? `${shot.name}@${c.name}${i + 1}` : `${shot.name}@${c.name}`;
      await picked[i].screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: !!c.transparent });
      entry.boxes[c.all ? `${c.name}${i + 1}` : c.name] = await box(picked[i]);
    }
  }
  layout[shot.name] = { ...entry, dpr: shot.dpr ?? 3, viewH: page.viewportSize().height };
  if (shot.after) await shot.after(page);
  await page.close();
  console.log("captured", shot.name, entry.pageH, Object.keys(entry.boxes).join(","));
}
fs.writeFileSync(LAYOUT, JSON.stringify(layout, null, 1));
await browser.close();
