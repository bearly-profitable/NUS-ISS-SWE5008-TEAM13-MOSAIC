/**
 * S10b — the ledger. crane-rise-reveal on the real Logs page: open tight
 * and low on the row the Send just wrote, then rise and pull back until the
 * table of earlier decisions fills the frame.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { Caption } from "../components/Caption";
import { useShotFrame } from "../components/Shot";
import { camPath, PageCam } from "../lib/cam";
import { EASE, ramp } from "../lib/polish";
import { C } from "../theme";
import layout from "../ui-layout.json";

const NEW_ROW = layout["logs-sent"].boxes.rows[0];

const cam = camPath([
  { f: 0, cx: 760, cy: 300, zoom: 2.3, rotX: 36, persp: 1400, sx: 0 },
  { f: 74, cx: 960, cy: 560, zoom: 1.0, rotX: 16, persp: 1900, sx: 300 },
  { f: 150, cx: 960, cy: 585, zoom: 0.97, rotX: 14, persp: 1900, sx: 300 },
]);

export const Ledger: React.FC = () => {
  const f = useShotFrame();
  const mark = ramp(f, 6, 14, EASE.snappy);
  const sweep = ramp(f, 10, 26, EASE.smooth);
  return (
    <AbsoluteFill>
      <PageCam src="ui/logs-sent.jpg" pageH={layout["logs-sent"].pageH} cam={cam(f)} floor="#ECEDF6">
        <div style={{ position: "absolute", left: NEW_ROW.x, top: NEW_ROW.y, width: NEW_ROW.w, height: NEW_ROW.h, overflow: "hidden", borderRadius: 6 }}>
          <div style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: 4, borderRadius: 2, background: C.primary, transform: `scaleY(${mark})` }} />
          <div style={{ position: "absolute", inset: 0, background: `${C.primary}10`, opacity: mark }} />
          {sweep > 0 && sweep < 1 ? (
            <div
              style={{
                position: "absolute", top: 0, bottom: 0, width: 260, left: -260 + (NEW_ROW.w + 260) * sweep,
                background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.85), rgba(255,255,255,0))",
              }}
            />
          ) : null}
        </div>
      </PageCam>
      <Caption
        kicker="APPEND-ONLY LEDGER"
        title="Every decision, on the record."
        sub="Who acted, which agent, which model, which verdict."
        at={18}
        until={140}
        tile={1}
      />
    </AbsoluteFill>
  );
};
