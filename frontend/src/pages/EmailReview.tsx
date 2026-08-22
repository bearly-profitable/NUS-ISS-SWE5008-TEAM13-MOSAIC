import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Loader2, Sparkles, Pencil, Tag, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessPanel } from "@/components/ui/process-panel";
import { useJob } from "@/hooks/use-job";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { SegmentEmailEditor } from "@/components/email-builder/SegmentEmailEditor";
import { EmailPreview } from "@/components/email-builder/EmailPreview";
import { generateEmails, type Verdict } from "@/services/workspaceApi";
import { DEFAULT_BACKGROUND } from "@/types/email-builder";

const VERDICT_META: Record<Verdict, { icon: typeof ShieldCheck; className: string }> = {
  PASS: { icon: ShieldCheck, className: "glass-badge-pass" },
  REVISE: { icon: ShieldAlert, className: "glass-badge-revise" },
  BLOCK: { icon: ShieldX, className: "glass-badge-block" },
};

export default function EmailReview() {
  const { state, loading, error, refresh } = useWorkspace();
  const { job, start, running } = useJob({
    onDone: refresh,
    successMessage: (j) => `Composed ${j.result?.count ?? 0} segment emails`,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const segments = state?.segments ?? [];
  const emails = state?.emails ?? [];
  const directions = state?.creative_directions ?? [];
  const verdicts = state?.verdicts ?? {};
  const segmentById = Object.fromEntries(segments.map((s) => [s.id, s]));

  const editing = emails.find((e) => e.id === editingId) ?? null;

  const handleGenerate = () => start(() => generateEmails());

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading emails…</div>;
  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Email Review</h1>
        <Button
          onClick={handleGenerate}
          disabled={running || directions.length === 0}
          className="gap-2 shrink-0"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {emails.length ? "Regenerate all" : "Generate emails"}
        </Button>
      </motion.div>

      <AnimatePresence>
        {job && <ProcessPanel key="progress" job={job} title="Composing emails" />}
      </AnimatePresence>


      {directions.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No creative direction yet — generate it in Creative Review first.
        </div>
      ) : emails.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No emails yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {emails.map((email) => {
            const segment = segmentById[email.segment_brief_id];
            const verdict = verdicts[email.id]?.verdict;
            const meta = verdict ? VERDICT_META[verdict] : null;
            const Icon = meta?.icon;

            return (
              <div key={email.id} className="glass-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{segment?.name ?? email.segment_brief_id}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {segment ? `${segment.size.toLocaleString()} contacts` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {meta && Icon && (
                      <span className={`glass-badge ${meta.className} px-2 py-0.5 rounded-full text-[9px] font-bold inline-flex items-center gap-1`}>
                        <Icon className="h-3 w-3" /> {verdict}
                      </span>
                    )}
                    {email.status === "edited" && (
                      <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">edited</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-muted-foreground/70 font-medium">Subject</div>
                  <div className="text-xs font-semibold">{email.subject}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{email.preheader}</div>
                </div>

                {/* Live preview of the actual blocks, scaled down */}
                <div className="rounded-xl border border-border/60 bg-muted/30 h-56 overflow-hidden relative">
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div style={{ transform: "scale(0.42)", transformOrigin: "top left", width: "238%" }}>
                      <EmailPreview
                        blocks={email.blocks ?? []}
                        subject={email.subject}
                        background={email.background ?? { ...DEFAULT_BACKGROUND }}
                        viewport="desktop"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 flex-wrap min-w-0">
                    {email.cited_offer_ids.length === 0 ? (
                      <span className="text-[10px] text-destructive">no offers cited</span>
                    ) : (
                      email.cited_offer_ids.map((o) => (
                        <span
                          key={o}
                          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full"
                        >
                          <Tag className="h-2.5 w-2.5" /> {o}
                        </span>
                      ))
                    )}
                  </div>
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs shrink-0" onClick={() => setEditingId(email.id)}>
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {emails.length === 0 && directions.length > 0 && (
        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          {directions.length} segments are ready to compose.
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <SegmentEmailEditor
            key={editing.id}
            email={editing}
            segmentName={segmentById[editing.segment_brief_id]?.name ?? editing.segment_brief_id}
            onClose={() => setEditingId(null)}
            onSaved={refresh}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
