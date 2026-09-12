import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { ShieldOff } from "lucide-react";
import { C, MONO, TILES, glass } from "../theme";
import { enter, ramp, rise, sceneFade } from "../anim";
import { Card, Chip, SceneHead, Sub } from "../components/Ui";

const PLOT_W = 740;
const PLOT_H = 600;
const N = 190;

const CLUSTERS = [
  { x: 0.24, y: 0.3, color: TILES.red, name: "Price-led switchers", size: "1,540", conf: 0.83 },
  { x: 0.72, y: 0.24, color: TILES.violet, name: "Settled loyalists", size: "1,246", conf: 0.79 },
  { x: 0.3, y: 0.78, color: TILES.teal, name: "Lapsed high-spenders", size: "812", conf: 0.71 },
  { x: 0.78, y: 0.72, color: TILES.blue, name: "New, still browsing", size: "952", conf: 0.86 },
];

/**
 * A deterministic point cloud: a scattered start, a clustered end, and the
 * unassigned tail HDBSCAN leaves behind as noise rather than forcing into a
 * group it does not belong to.
 */
const POINTS = new Array(N).fill(0).map((_, i) => {
  const noise = random("noise-" + i) < 0.09;
  const c = Math.floor(random("cluster-" + i) * CLUSTERS.length);
  const spread = 0.085 + random("spread-" + i) * 0.055;
  return {
    from: { x: 0.08 + random("fx-" + i) * 0.84, y: 0.08 + random("fy-" + i) * 0.84 },
    to: noise
      ? { x: 0.08 + random("nx-" + i) * 0.84, y: 0.08 + random("ny-" + i) * 0.84 }
      : {
          x: CLUSTERS[c].x + (random("tx-" + i) - 0.5) * spread * 2.4,
          y: CLUSTERS[c].y + (random("ty-" + i) - 0.5) * spread * 2.4,
        },
    color: noise ? "#B9BDD0" : CLUSTERS[c].color,
    noise,
    delay: random("d-" + i) * 26,
    r: 5 + random("r-" + i) * 3.5,
  };
});

const FEATURES = [
  { label: "discount_sensitivity", v: 0.92 },
  { label: "tenure_months", v: -0.64 },
  { label: "sessions_per_week", v: 0.48 },
];

export const S04Segments: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, length, 10, 14);
  const cluster = ramp(frame, 34, 104);

  return (
    <AbsoluteFill style={{ opacity: fade, padding: "76px 96px", flexDirection: "row", gap: 48 }}>
      <div style={{ width: 700, display: "flex", flexDirection: "column" }}>
        <SceneHead
          eyebrow="Stage 01 · Segmentation & Insight"
          title={<>Segments that explain themselves.</>}
          sub="Sanitised free text is embedded, joined with engineered numeric features, and clustered with HDBSCAN. The model only names what the numbers already found."
          delay={2}
        />

        <div
          style={{
            marginTop: 30,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            ...rise(enter(frame, fps, 26), 14),
          }}
        >
          <Chip>HDBSCAN</Chip>
          <Chip color={C.secondary}>embeddings</Chip>
          <Chip color={C.info}>z-scored feature contributions</Chip>
        </div>

        <Card delay={60} style={{ marginTop: 30, padding: "26px 30px", display: "flex", gap: 20 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 18,
              background: C.revise + "22",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <ShieldOff size={28} color={C.revise} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 25, fontWeight: 650, color: C.ink }}>
              Protected attributes never enter the feature matrix.
            </div>
            <Sub size={21} style={{ marginTop: 6 }}>
              Age, gender and the rest are held out entirely, then read back to test whether a
              segment ended up correlating with them anyway.
            </Sub>
          </div>
        </Card>

        <div style={{ marginTop: 26, display: "flex", gap: 16 }}>
          {CLUSTERS.slice(0, 2).map((c, i) => {
            const t = enter(frame, fps, 82 + i * 7);
            return (
              <div
                key={c.name}
                style={{ ...glass(0.66), flex: 1, padding: "20px 22px", borderRadius: 22, ...rise(t, 18) }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 99, background: c.color }} />
                  <span style={{ fontSize: 22, fontWeight: 650, color: C.ink }}>{c.name}</span>
                </div>
                <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 18, color: C.muted }}>
                  {c.size} contacts · confidence {c.conf.toFixed(2)}
                </div>
                {i === 0 ? (
                  <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                    {FEATURES.map((f, fi) => {
                      const w = interpolate(
                        enter(frame, fps, 94 + fi * 5),
                        [0, 1],
                        [0, Math.abs(f.v)],
                      );
                      return (
                        <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            style={{
                              fontFamily: MONO,
                              fontSize: 15,
                              color: C.muted,
                              width: 180,
                              textAlign: "right",
                            }}
                          >
                            {f.label}
                          </span>
                          <div
                            style={{
                              flex: 1,
                              height: 9,
                              borderRadius: 5,
                              background: "rgba(17,20,43,0.07)",
                            }}
                          >
                            <div
                              style={{
                                width: w * 100 + "%",
                                height: "100%",
                                borderRadius: 5,
                                background: f.v > 0 ? c.color : C.muted,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <Card delay={10} style={{ flex: 1, padding: 34, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 26, fontWeight: 650, color: C.ink }}>Segment discovery</div>
          <div style={{ fontFamily: MONO, fontSize: 18, color: C.muted }}>
            {Math.round(interpolate(cluster, [0, 1], [0, 5000])).toLocaleString()} / 5,000 profiles
          </div>
        </div>

        <svg width={PLOT_W} height={PLOT_H} style={{ marginTop: 22 }}>
          {CLUSTERS.map((c, i) => (
            <ellipse
              key={i}
              cx={c.x * PLOT_W}
              cy={c.y * PLOT_H}
              rx={112}
              ry={92}
              fill={c.color + "14"}
              stroke={c.color + "55"}
              strokeWidth={2}
              strokeDasharray="7 7"
              opacity={ramp(frame, 88, 112)}
            />
          ))}
          {POINTS.map((p, i) => {
            const t = interpolate(cluster, [p.delay / 90, p.delay / 90 + 0.55], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const x = interpolate(t, [0, 1], [p.from.x, p.to.x]) * PLOT_W;
            const y = interpolate(t, [0, 1], [p.from.y, p.to.y]) * PLOT_H;
            const appear = enter(frame, fps, 6 + p.delay * 0.5);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={p.r * appear}
                fill={p.color}
                opacity={appear * (p.noise ? 0.45 : interpolate(t, [0, 1], [0.35, 0.92]))}
              />
            );
          })}
          {CLUSTERS.map((c, i) => (
            <text
              key={"l-" + i}
              x={c.x * PLOT_W}
              y={c.y * PLOT_H - 112}
              textAnchor="middle"
              fill={c.color}
              fontFamily={MONO}
              fontSize={19}
              fontWeight={600}
              opacity={ramp(frame, 96, 118)}
            >
              {c.name}
            </text>
          ))}
        </svg>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            fontFamily: MONO,
            fontSize: 18,
            color: C.muted,
            opacity: ramp(frame, 100, 120),
          }}
        >
          <span>4 segments · 9% left as noise, not forced into one</span>
          <span style={{ color: C.pass }}>silhouette 0.61</span>
        </div>
      </Card>
    </AbsoluteFill>
  );
};
