/**
 * S3 — Company Info. overhead-camera-moves · tilt-reveal: the real page lies
 * back at ~62° and swings upright with a small overshoot as the brand
 * lockup lifts away, then a CSV file chip drops out of the air and lands in
 * the page's real drop zone (Q9: flying elements land in real slots).
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { Caption } from "../components/Caption";
import { useShotFrame } from "../components/Shot";
import { camPath, PageCam } from "../lib/cam";
import { bezier, EASE, ramp } from "../lib/polish";
import { C, MONO } from "../theme";
import { local } from "../timeline";
import layout from "../ui-layout.json";

const PAGE_H = layout.company.pageH;
const DROP = { x: 502, y: 206, w: 915, h: 148 }; // the dashed drop zone, page px
const LAND = local("company", 18); // chip lands on the beat

const cam = camPath([
  { f: -18, cx: 960, cy: 560, zoom: 0.9, rotX: 62, persp: 1500, sy: 260, sx: 0 },
  { f: 10, cx: 960, cy: 330, zoom: 1.18, rotX: -2.5, persp: 1700, sy: 0, sx: 340 },
  { f: 22, cx: 960, cy: 300, zoom: 1.2, rotX: 0, persp: 1700, sx: 360 },
  { f: 72, cx: 960, cy: 296, zoom: 1.24, rotX: 0, persp: 1700, sx: 360 },
  { f: 162, cx: 960, cy: 540, zoom: 1.2, rotX: 5, persp: 1700, sx: 360 },
]);

const FALL = bezier(0.5, 0, 0.8, 0.75); // still moving at contact, like row-embed
const SETTLE = bezier(0.3, 0, 0.25, 1.15);

const Chip: React.FC<{ f: number }> = ({ f }) => {
  const cue = LAND - 14;
  if (f < cue) return null;
  const fall = FALL(Math.min(1, Math.max(0, (f - cue) / 14)));
  const settle = SETTLE(Math.min(1, Math.max(0, (f - LAND) / 6)));
  const press = f >= LAND && f < LAND + 6 ? 1 - 0.03 * Math.sin(((f - LAND) / 6) * Math.PI) : 1;
  const y = -420 * (1 - fall) + 10 * (1 - settle) * (f >= LAND ? 1 : 0);
  const rot = -9 * (1 - fall);
  const s = (1.18 - 0.18 * fall) * press;
  const count = Math.round(1000 * EASE.out(ramp(f, LAND + 2, 22, (t) => t)));
  const air = 1 - fall;
  return (
    <div
      style={{
        position: "absolute",
        left: 960 - 230,
        top: 280 - 40,
        width: 460,
        height: 80,
        borderRadius: 18,
        background: "linear-gradient(180deg,#FFFFFF,#F7F7FD)",
        border: `1.5px solid ${C.primary}55`,
        boxShadow: `0 ${8 + 40 * air}px ${18 + 50 * air}px rgba(17,20,43,${0.12 + 0.08 * air}), inset 0 1px 0 #fff`,
        transform: `translateY(${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(4)})`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 22px",
      }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 12, background: "#E7F6EE", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke={C.pass} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h8M12 11v8" />
        </svg>
      </div>
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontSize: 21, fontWeight: 600, color: C.ink }}>mosaic_customers.csv</div>
        <div style={{ fontFamily: MONO, fontSize: 15, color: C.muted, marginTop: 4 }}>
          {count.toLocaleString("en-US")} contacts · 28 columns
        </div>
      </div>
    </div>
  );
};

/** Landing ripple, clipped to the drop zone's rounded rectangle (Q4). */
const Ripple: React.FC<{ f: number }> = ({ f }) => {
  const t = ramp(f, LAND, 22, EASE.out);
  if (f < LAND || t >= 1) return null;
  const glow = 1 - ramp(f, LAND + 4, 24, EASE.out);
  return (
    <div style={{ position: "absolute", left: DROP.x, top: DROP.y, width: DROP.w, height: DROP.h, borderRadius: 14, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 458 - 520 * t,
          top: 74 - 520 * t,
          width: 1040 * t,
          height: 1040 * t,
          borderRadius: "50%",
          border: `3px solid ${C.primary}`,
          opacity: 0.45 * (1 - t),
        }}
      />
      <div style={{ position: "absolute", inset: 0, borderRadius: 14, boxShadow: `inset 0 0 0 2px ${C.primary}`, opacity: 0.7 * glow, background: `${C.primary}0D` }} />
    </div>
  );
};

export const Company: React.FC = () => {
  const f = useShotFrame();
  const c = cam(f);
  const appear = ramp(f, -18, 16, EASE.out);
  return (
    <AbsoluteFill style={{ opacity: appear }}>
      <PageCam src="ui/company.jpg" pageH={PAGE_H} cam={c}>
        <Ripple f={f} />
        <Chip f={f} />
      </PageCam>
      <Caption
        kicker="STEP 01 · COMPANY INFO"
        title="Start with your own customer list."
        sub="Any CSV. Columns are profiled; protected attributes are held out."
        at={26}
        until={150}
        tile={2}
      />
    </AbsoluteFill>
  );
};
