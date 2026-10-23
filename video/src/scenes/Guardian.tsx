/**
 * S8–S10 — Guardian → human gate → Send, one continuous camera on the real
 * Approval Queue.
 *
 *  1. scanline-annotate-focus: a scan line sweeps the ten pre-flight checks
 *     of "Loyal Full-Price Buyers" at a steady machine pace; each row's
 *     result is revealed as the line passes it, and the one REVISE row gets
 *     the bracket lock + typed tag.
 *  2. cursor-flyover: the pointer selects "Seasonal Gift Buyers" (10/10) and
 *     the camera rides down to Dispatch while "Nothing sends itself." lands
 *     on the bar-19 dip.
 *  3. Slam #2 on beat 72: the Send click, a crash-zoom punch (6 f in, one
 *     overshoot) and the page flips to its sent state with a toast.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { Caption } from "../components/Caption";
import { ClickRing, Cursor } from "../components/Cursor";
import { useShotFrame } from "../components/Shot";
import { camPath, PageCam, toScreen } from "../lib/cam";
import { bezier, EASE, ramp } from "../lib/polish";
import { C, MONO } from "../theme";
import { local } from "../timeline";
import layout from "../ui-layout.json";

// Check titles' top edge (page px), from the live DOM — see capture/shots.mjs.
const CHECK_Y = [479, 529, 578, 628, 715, 765, 814, 902, 951, 1001];
const REVISE_ROW = 3;
const ROW = { x: 712, w: 764, top: -9, h: 42 };
const SCAN = { from: 6, dur: 84, y0: 452, y1: 1046 };
const scanY = (f: number) => SCAN.y0 + (SCAN.y1 - SCAN.y0) * Math.min(1, Math.max(0, (f - SCAN.from) / SCAN.dur));
const passAt = (y: number) => SCAN.from + ((y - SCAN.y0) / (SCAN.y1 - SCAN.y0)) * SCAN.dur;
const LOCK = Math.round(passAt(CHECK_Y[REVISE_ROW] + 34));

const LIST_CLICK = local("guardian", 67); // select Seasonal Gift Buyers
const SEND_CLICK = local("guardian", 72); // slam #2
const GIFT_ITEM = { x: 520, y: 700 };
const SEND_BTN = layout["approvals-gift"].boxes.buttons.find((b) => b.y > 1600)!;
const SEND = { x: SEND_BTN.x + SEND_BTN.w / 2, y: SEND_BTN.y + SEND_BTN.h / 2 };

const cam = camPath([
  { f: -8, cx: 1090, cy: 700, zoom: 1.2, sx: 320 },
  { f: 92, cx: 1090, cy: 712, zoom: 1.24, sx: 320 },
  { f: 112, cx: 800, cy: 660, zoom: 1.3, sx: 120 },
  { f: LIST_CLICK + 6, cx: 800, cy: 662, zoom: 1.3, sx: 120 },
  { f: 196, cx: 1090, cy: 1560, zoom: 1.4, sx: 360 },
  { f: SEND_CLICK, cx: 1100, cy: 1580, zoom: 1.44, sx: 360 },
  { f: SEND_CLICK + 6, cx: 1290, cy: 1690, zoom: 2.16, sx: 190 },
  { f: SEND_CLICK + 11, cx: 1270, cy: 1690, zoom: 2.02, sx: 190 },
  { f: 300, cx: 1240, cy: 1700, zoom: 1.98, sx: 190 },
]);

const glide = bezier(0.45, 0, 0.12, 1);

/** Cursor path in page space (it belongs to the page, so it rides the camera). */
const cursorAt = (f: number) => {
  if (f < 98) return null;
  if (f < LIST_CLICK + 16) {
    const t = glide(Math.min(1, (f - 98) / (LIST_CLICK - 4 - 98)));
    return { x: 1250 + (GIFT_ITEM.x - 1250) * t, y: 980 + (GIFT_ITEM.y - 980) * t };
  }
  const t = glide(Math.min(1, Math.max(0, (f - (LIST_CLICK + 16)) / 62)));
  return { x: GIFT_ITEM.x + (SEND.x - 8 - GIFT_ITEM.x) * t, y: GIFT_ITEM.y + (SEND.y - 4 - GIFT_ITEM.y) * t };
};

const Pending: React.FC<{ y: number; f: number; tint: string }> = ({ y, f, tint }) => {
  const sy = scanY(f);
  const top = y + ROW.top;
  if (sy >= top + ROW.h) return null;
  const clip = Math.max(0, sy - top);
  const pulse = 0.55 + 0.25 * Math.sin(f * 0.35 + y);
  return (
    <div style={{ position: "absolute", left: ROW.x, top, width: ROW.w, height: ROW.h, background: tint, clipPath: `inset(${clip}px 0 0 0)` }}>
      <div style={{ position: "absolute", left: 10, top: 13, width: 20, height: 20, borderRadius: 10, border: "2px solid #C9CBDB", opacity: pulse }} />
      <div style={{ position: "absolute", left: 42, top: 10, width: 190, height: 11, borderRadius: 6, background: "#E3E4EE", opacity: pulse }} />
      <div style={{ position: "absolute", left: 42, top: 28, width: 330, height: 9, borderRadius: 5, background: "#ECEDF4", opacity: pulse }} />
    </div>
  );
};

const ScanLine: React.FC<{ f: number }> = ({ f }) => {
  const on = ramp(f, SCAN.from - 4, 4, EASE.out) * (1 - ramp(f, SCAN.from + SCAN.dur, 8, EASE.out));
  if (on <= 0) return null;
  const y = scanY(f);
  const passed = CHECK_Y.filter((cy) => y >= cy + 34).length;
  return (
    <div style={{ position: "absolute", left: 690, top: y - 70, width: 800, height: 72, opacity: on, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(79,70,229,0) 0%, rgba(79,70,229,0.10) 100%)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: C.primary, boxShadow: `0 0 10px ${C.primary}, 0 0 2px ${C.primary}` }} />
      <div
        style={{
          position: "absolute", right: -6, bottom: 8, padding: "3px 9px", borderRadius: 6, background: C.primary, color: "#fff",
          fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: "0.06em",
        }}
      >
        GUARDIAN-V4 · {String(passed).padStart(2, "0")}/10
      </div>
    </div>
  );
};

const ReviseLock: React.FC<{ f: number }> = ({ f }) => {
  if (f < LOCK || f > 112) return null;
  const t = EASE.overshoot(Math.min(1, (f - LOCK) / 12));
  const pad = 6 + 30 * (1 - t);
  const op = ramp(f, LOCK, 5, EASE.out) * (1 - ramp(f, 100, 10, EASE.out));
  const top = CHECK_Y[REVISE_ROW] + ROW.top;
  const text = "REVISE · AGE PROXY 37%";
  const shown = text.slice(0, Math.round(text.length * ramp(f, LOCK + 8, 14, EASE.linear)));
  const corner = (k: number): React.CSSProperties => ({
    position: "absolute", width: 18, height: 18, borderColor: C.revise, borderStyle: "solid", borderWidth: 0, borderRadius: 3,
    ...(k < 2 ? { top: -pad, borderTopWidth: 3 } : { bottom: -pad, borderBottomWidth: 3 }),
    ...(k % 2 === 0 ? { left: -pad, borderLeftWidth: 3 } : { right: -pad, borderRightWidth: 3 }),
  });
  return (
    <div style={{ position: "absolute", left: ROW.x, top, width: ROW.w, height: ROW.h, opacity: op }}>
      {[0, 1, 2, 3].map((k) => (
        <div key={k} style={corner(k)} />
      ))}
      <div
        style={{
          position: "absolute", right: 10, top: 9, padding: "4px 10px", borderRadius: 7, background: C.revise, color: "#fff",
          fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap",
          boxShadow: "0 6px 16px rgba(245,158,11,0.35)",
        }}
      >
        {shown || "·"}
      </div>
    </div>
  );
};

/** Hover ring + press fill on the real Send button (page space). */
const SendButtonFx: React.FC<{ f: number }> = ({ f }) => {
  const hover = ramp(f, SEND_CLICK - 22, 10, EASE.out) * (1 - ramp(f, SEND_CLICK + 4, 10, EASE.out));
  const press = f >= SEND_CLICK && f < SEND_CLICK + 6 ? Math.sin(((f - SEND_CLICK) / 6) * Math.PI) : 0;
  if (hover <= 0 && press <= 0) return null;
  const b = SEND_BTN;
  return (
    <div
      style={{
        position: "absolute", left: b.x - 4, top: b.y - 4, width: b.w + 8, height: b.h + 8, borderRadius: 14,
        boxShadow: `0 0 0 ${(2 + 3 * hover).toFixed(1)}px rgba(79,70,229,${(0.35 * hover).toFixed(3)}), 0 8px 22px rgba(79,70,229,${(0.25 * hover).toFixed(3)})`,
        background: `rgba(79,70,229,${(0.18 * press).toFixed(3)})`,
        transform: `scale(${(1 - 0.06 * press).toFixed(4)})`,
      }}
    />
  );
};

const Toast: React.FC<{ f: number }> = ({ f }) => {
  const at = SEND_CLICK + 8;
  const t = ramp(f, at, 16, EASE.snappy) * (1 - ramp(f, 282, 10, EASE.exit));
  if (t <= 0) return null;
  return (
    <div
      style={{
        position: "absolute", right: 70, top: 64, display: "flex", alignItems: "center", gap: 18, padding: "22px 30px 22px 22px",
        borderRadius: 22, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(18px)", border: "1px solid #fff",
        boxShadow: "0 24px 60px rgba(17,20,43,0.18)", opacity: t, transform: `translateY(${((1 - t) * -40).toFixed(1)}px)`,
      }}
    >
      <div style={{ width: 52, height: 52, borderRadius: 26, background: "#E3F5EC", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 24 24" width={30} height={30} fill="none" stroke={C.pass} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 34, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>Sent · A Thoughtful Fat Cat Gift</div>
        <div style={{ fontFamily: MONO, fontSize: 24, color: C.muted, marginTop: 4 }}>to demo@fcp.com.sg · via Resend</div>
      </div>
    </div>
  );
};

export const Guardian: React.FC = () => {
  const f = useShotFrame();
  const c = cam(f);
  const page = f < LIST_CLICK + 2 ? "loyal" : f < SEND_CLICK + 3 ? "gift" : "sent";
  const src = { loyal: "ui/approvals-loyal.jpg", gift: "ui/approvals-gift.jpg", sent: "ui/approvals-gift-sent.jpg" }[page];
  const pageH = { loyal: layout["approvals-loyal"].pageH, gift: layout["approvals-gift"].pageH, sent: layout["approvals-gift-sent"].pageH }[page];
  const cur = cursorAt(f);
  const curS = cur ? toScreen(c, cur.x, cur.y) : null;
  const pressAt = (at: number) => (f >= at && f < at + 6 ? Math.sin(((f - at) / 6) * Math.PI) : 0);
  const press = Math.max(pressAt(LIST_CLICK), pressAt(SEND_CLICK));
  const ringT = (at: number) => (f >= at ? (f - at) / 16 : 0);
  const listRing = toScreen(c, GIFT_ITEM.x, GIFT_ITEM.y);
  const sendRing = toScreen(c, SEND.x, SEND.y);
  return (
    <AbsoluteFill>
      <PageCam src={src} pageH={pageH} cam={c} floor="#ECEDF6">
        {page === "loyal" ? CHECK_Y.map((y, i) => <Pending key={i} y={y} f={f} tint={i === REVISE_ROW ? "#F5EFEE" : i < 3 ? "#F2F2FB" : "#F6F6FB"} />) : null}
        {page === "loyal" ? <ScanLine f={f} /> : null}
        {page === "loyal" ? <ReviseLock f={f} /> : null}
        {page !== "loyal" ? <SendButtonFx f={f} /> : null}
      </PageCam>
      <ClickRing x={listRing.x} y={listRing.y} t={ringT(LIST_CLICK)} color={C.primary} />
      <ClickRing x={sendRing.x} y={sendRing.y} t={ringT(SEND_CLICK)} color={C.primary} />
      {curS ? <Cursor x={curS.x} y={curS.y} press={press} opacity={ramp(f, 98, 6, EASE.out) * (1 - ramp(f, SEND_CLICK + 20, 10, EASE.out))} /> : null}
      <Toast f={f} />
      <Caption
        kicker="AGENT 04 · GUARDIAN"
        title="Ten checks. Any one can stop a send."
        sub="Compliance, content, deliverability: PASS, REVISE or BLOCK."
        at={6}
        until={104}
        tile={6}
      />
      <Caption
        kicker="HUMAN APPROVAL"
        title="Nothing sends itself."
        sub="The Guardian advises. A person presses Send."
        at={local("guardian", 68)}
        until={286}
        tile={7}
      />
    </AbsoluteFill>
  );
};
