import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Users,
  Palette,
  Mail,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { approveEmail, revokeApproval, type Verdict } from "@/services/workspaceApi";

const VERDICT_META: Record<Verdict, { icon: typeof ShieldCheck; className: string }> = {
  PASS: { icon: ShieldCheck, className: "glass-badge-pass" },
  REVISE: { icon: ShieldAlert, className: "glass-badge-revise" },
  BLOCK: { icon: ShieldX, className: "glass-badge-block" },
};

export default function ApprovalQueue() {
  const { state, loading, error, refresh } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading approval queue…</div>;
  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>;

  const segments = state?.segments ?? [];
  const emails = state?.emails ?? [];
  const verdicts = state?.verdicts ?? {};
  const approvals = state?.approvals ?? [];
  const directions = state?.creative_directions ?? [];
  const manipulation = state?.manipulation_scores ?? [];

  const segmentById = Object.fromEntries(segments.map((s) => [s.id, s]));
  const directionBySegment = Object.fromEntries(directions.map((d) => [d.segment_brief_id, d]));

  if (emails.length === 0) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Nothing to approve yet — generate emails in the Email Review tab first.
      </div>
    );
  }

  const items = emails.map((email) => ({
    email,
    segment: segmentById[email.segment_brief_id],
    direction: directionBySegment[email.segment_brief_id],
    verdict: (verdicts[email.id]?.verdict ?? null) as Verdict | null,
    checks: verdicts[email.id]?.checks ?? [],
    approval: approvals.find((a) => a.target_id === email.id),
    manipulation: manipulation.find((m) => m.message_id === email.id),
  }));

  const selected = items.find((i) => i.email.id === selectedId) ?? items[0];

  const handleApprove = async () => {
    if (!selected) return;
    setBusy(selected.email.id);
    try {
      await approveEmail(selected.email.id);
      toast.success("Approved — recorded in the Logs");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async () => {
    if (!selected) return;
    setBusy(selected.email.id);
    try {
      await revokeApproval(selected.email.id);
      toast.success("Approval revoked");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full flex">
      {/* ── Queue list ── */}
      <div className="w-80 shrink-0 border-r border-border/60 p-4 overflow-y-auto scrollbar-thin">
        <h2 className="text-sm font-bold px-1 mb-1">Approval Queue</h2>
        <p className="text-[11px] text-muted-foreground px-1 mb-4">
          One item per segment email. Nothing is dispatched without an explicit approval, and a BLOCK cannot be
          approved at all.
        </p>
        <div className="space-y-2">
          {items.map((it) => {
            const meta = it.verdict ? VERDICT_META[it.verdict] : null;
            return (
              <button
                key={it.email.id}
                onClick={() => setSelectedId(it.email.id)}
                className={cn(
                  "w-full text-left rounded-xl p-3 border transition-colors",
                  selected?.email.id === it.email.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/60 hover:bg-muted/40",
                )}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-xs font-semibold truncate">
                    {it.segment?.name ?? it.email.segment_brief_id}
                  </span>
                  {it.approval ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  ) : meta ? (
                    <span
                      className={`glass-badge ${meta.className} px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0`}
                    >
                      {it.verdict}
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{it.email.subject}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Detail ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="wait">
          {selected && (
            <motion.div
              key={selected.email.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="p-8 max-w-3xl mx-auto"
            >
              <div className="flex items-center justify-between mb-1">
                <h1 className="text-lg font-bold">Why this email</h1>
                {selected.verdict &&
                  (() => {
                    const meta = VERDICT_META[selected.verdict];
                    const Icon = meta.icon;
                    return (
                      <span
                        className={`glass-badge ${meta.className} px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5`}
                      >
                        <Icon className="h-3.5 w-3.5" /> {selected.verdict}
                      </span>
                    );
                  })()}
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                {selected.segment?.name ?? selected.email.segment_brief_id} · subject “{selected.email.subject}”
              </p>

              {/* Chain: segment → direction → email */}
              <div className="glass-card p-5 mb-4">
                <div className="text-xs font-bold mb-3">Decision chain</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Segment",
                      icon: Users,
                      ok: !!selected.segment,
                      detail: selected.segment
                        ? `${selected.segment.size.toLocaleString()} contacts · ${Math.round(
                            selected.segment.confidence * 100,
                          )}% confidence`
                        : "missing",
                    },
                    {
                      label: "Creative direction",
                      icon: Palette,
                      ok: !!selected.direction,
                      detail: selected.direction?.tonality || "missing",
                    },
                    {
                      label: "Email",
                      icon: Mail,
                      ok: true,
                      detail: `${selected.email.blocks?.length ?? 0} blocks · ${selected.email.status}`,
                    },
                  ].map((step) => (
                    <div key={step.label} className="rounded-lg bg-muted/50 py-2.5 px-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <step.icon className="h-3 w-3 text-muted-foreground shrink-0" />
                        <div className="text-[10px] font-semibold text-foreground/80">{step.label}</div>
                      </div>
                      <div className={`text-[9px] ${step.ok ? "text-muted-foreground" : "text-destructive"}`}>
                        {step.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Marketing permission + Guardian checks */}
              <div className="glass-card p-5 mb-4">
                <div className="text-xs font-bold mb-3">Guardian verdict — check by check</div>
                {selected.checks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No check breakdown recorded for this email.</p>
                ) : (
                  <div className="space-y-2">
                    {selected.checks.map((check) => (
                      <div key={check.name} className="flex items-start gap-2.5 py-1.5">
                        {check.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="text-xs font-semibold">{check.name}</div>
                          <div className="text-[11px] text-muted-foreground">{check.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selected.manipulation && (
                <div className="glass-card p-5 mb-6">
                  <div className="text-xs font-bold mb-3">Manipulation index</div>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "Urgency", value: selected.manipulation.urgency },
                      { label: "Scarcity", value: selected.manipulation.scarcity },
                      { label: "Loss framing", value: selected.manipulation.loss_framing },
                      { label: "Social proof", value: selected.manipulation.social_proof },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg bg-muted/50 py-2 px-2.5">
                        <div className="text-[9px] text-muted-foreground">{s.label}</div>
                        <div className="text-sm font-bold tabular-nums">{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                {selected.approval ? (
                  <Button
                    variant="outline"
                    onClick={handleRevoke}
                    disabled={busy === selected.email.id}
                    className="gap-2"
                  >
                    {busy === selected.email.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Revoke approval
                  </Button>
                ) : (
                  <Button
                    onClick={handleApprove}
                    disabled={busy === selected.email.id || selected.verdict === "BLOCK"}
                    className="gap-2"
                  >
                    {busy === selected.email.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Approve for dispatch
                  </Button>
                )}
                {selected.approval && (
                  <span className="text-[11px] text-success">
                    Approved {new Date(selected.approval.created_at).toLocaleString()}
                  </span>
                )}
              </div>

              {selected.verdict === "BLOCK" && !selected.approval && (
                <p className="text-[11px] text-destructive mt-2">
                  BLOCKed emails cannot be approved. Fix the failing check — usually an uncited claim or a segment
                  where most contacts have withdrawn marketing permission — then re-check from Email Review.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
