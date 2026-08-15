import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Users, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { generateSegments } from "@/services/workspaceApi";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function Segments() {
  const { state, loading, error, refresh } = useWorkspace();
  const [generating, setGenerating] = useState(false);

  const segments = state?.segments ?? [];
  const audienceCount = state?.audience_count ?? 0;
  const proxyBySegment = Object.fromEntries((state?.proxy_checks ?? []).map((p) => [p.segment_brief_id, p]));

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generateSegments();
      toast.success(`Discovered ${res.segments.length} micro-segments`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Segmentation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading segments…</div>;
  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Segments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real HDBSCAN clusters over {audienceCount.toLocaleString()} contacts — free-text embeddings plus
            engineered behavioural features. Capped at the {state?.max_segments ?? 6} largest clusters.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating || audienceCount === 0} className="gap-2 shrink-0">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {segments.length ? "Regenerate segments" : "Generate segments"}
        </Button>
      </motion.div>

      {generating && (
        <div className="glass-card p-4 mb-5 text-xs text-primary flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          Embedding customer notes, clustering, and writing one brief per segment — this calls real models and can
          take a few minutes.
        </div>
      )}

      {audienceCount === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          Load the audience first — segmentation needs contacts to cluster.
        </div>
      ) : segments.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No segments yet. Generate them to discover micro-segments in the audience.
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-3 gap-4">
          {segments.map((seg) => {
            const proxy = proxyBySegment[seg.id];
            return (
              <motion.div key={seg.id} variants={item} className="glass-card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <span className="glass-badge glass-badge-primary px-2 py-0.5 rounded-full text-[10px] font-semibold">
                    {Math.round(seg.confidence * 100)}% confidence
                  </span>
                </div>

                <div>
                  <div className="text-sm font-bold leading-tight">{seg.name || seg.id}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{seg.size.toLocaleString()} contacts</div>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="text-muted-foreground/70 font-medium mb-0.5">Motivation</div>
                    <p className="text-foreground/80 leading-snug">{seg.motivation}</p>
                  </div>
                  <div>
                    <div className="text-muted-foreground/70 font-medium mb-0.5">Tone guidance</div>
                    <p className="text-foreground/80 leading-snug">{seg.tone_guidance}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60">
                  <div className="text-[10px] text-muted-foreground/70 font-medium mb-1.5">
                    Feature contributions (z-score vs. whole base)
                  </div>
                  <div className="space-y-1.5">
                    {seg.feature_contributions.map((f) => (
                      <div key={f.feature} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-32 truncate">{f.feature}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, Math.abs(f.weight) * 40)}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className={`h-full rounded-full ${f.weight >= 0 ? "bg-primary" : "bg-destructive/70"}`}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-muted-foreground w-9 text-right">
                          {f.weight > 0 ? "+" : ""}
                          {f.weight.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {proxy?.flagged && (
                  <div className="flex items-start gap-1.5 text-[10px] text-warning bg-warning/10 rounded-md px-2 py-1.5">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
                    <span>
                      Skews on the held-out {proxy.protected_attribute} attribute (
                      {Math.round(proxy.correlation * 100)}% deviation) — flagged for human review.
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
