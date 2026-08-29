import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmailPreview } from "@/components/email-builder/EmailPreview";
import { generateEmailHtml, renderPatternToPng } from "@/components/email-builder/export-html";
import {
  getSocialIconUrls,
  resolveBlockImageUrlsForEmail,
  resolvePatternUrlForEmail,
} from "@/lib/email-image-urls";
import { DEFAULT_BACKGROUND } from "@/types/email-builder";
import { cn } from "@/lib/utils";
import { ProcessPanel } from "@/components/ui/process-panel";
import { useJob } from "@/hooks/use-job";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  readjudicateEmail,
  sendEmail,
  startEval,
  type CheckCategory,
  type EmailSend,
  type EvalAgentId,
  type EvalRun,
  type GuardianCheck,
  type SegmentEmail,
} from "@/services/workspaceApi";

/**
 * Stage 4 — the last thing between a composed email and a real inbox.
 *
 * This page sends for real (Resend, via the backend's /api/emails/{id}/send),
 * so it is built around the one question that matters here: is this safe to
 * put in front of a person? Everything on screen is either a pre-flight check
 * the backend actually ran, the email as it will arrive, or the dispatch
 * itself. The rendering path is the builder's own generateEmailHtml, so what
 * is previewed is byte-for-byte what ships.
 *
 * Pressing Send is the sign-off. There is no separate approve step — it was a
 * second click that recorded a row and changed nothing about what shipped, and
 * the confirm dialog already makes the decision explicit.
 */

const CATEGORY_LABELS: Record<CheckCategory, string> = {
  compliance: "Compliance",
  content: "Content",
  deliverability: "Deliverability",
};

const CATEGORY_BLURBS: Record<CheckCategory, string> = {
  compliance: "May we lawfully send this",
  content: "Does the copy hold up",
  deliverability: "Will it land and render",
};

const CATEGORY_ORDER: CheckCategory[] = ["compliance", "content", "deliverability"];

const AGENT_LABELS: Record<EvalAgentId, string> = {
  segmentation: "Segmentation",
  creative: "Creative",
  composer: "Composer",
  guardian: "Guardian",
};

const AGENT_RUBRIC: Record<EvalAgentId, { name: string; kind: string; weight: number; earned: number | null }[]> = {
  segmentation: [
    { name: "Silhouette", kind: "Code", weight: 38.5, earned: null },
    { name: "Coverage", kind: "Code", weight: 17.5, earned: null },
    { name: "HDBSCAN confidence", kind: "Code", weight: 14, earned: null },
    { name: "Faithfulness", kind: "LLM Judge", weight: 15, earned: null },
    { name: "Specificity", kind: "LLM Judge", weight: 15, earned: null },
  ],
  creative: [
    { name: "Tonality length", kind: "Code", weight: 8, earned: null },
    { name: "Language length", kind: "Code", weight: 8, earned: null },
    { name: "CTA length", kind: "Code", weight: 8, earned: null },
    { name: "Design length", kind: "Code", weight: 8, earned: null },
    { name: "Accent hex", kind: "Code", weight: 8, earned: null },
    { name: "Segment fit", kind: "LLM Judge", weight: 20, earned: null },
    { name: "Brand fit", kind: "LLM Judge", weight: 20, earned: null },
    { name: "No dark patterns", kind: "LLM Judge", weight: 20, earned: null },
  ],
  composer: [
    { name: "Has citation", kind: "Code", weight: 10, earned: null },
    { name: "Citations in catalogue", kind: "Code", weight: 10, earned: null },
    { name: "Subject length", kind: "Code", weight: 10, earned: null },
    { name: "Preheader length", kind: "Code", weight: 10, earned: null },
    { name: "Follows direction", kind: "LLM Judge", weight: 20, earned: null },
    { name: "Segment fit", kind: "LLM Judge", weight: 20, earned: null },
    { name: "Grounded", kind: "LLM Judge", weight: 20, earned: null },
  ],
  guardian: [
    { name: "Check pass rate", kind: "Code", weight: 70, earned: null },
    { name: "Email PASS rate", kind: "Code", weight: 30, earned: null },
  ],
};

const AGENT_ORDER: EvalAgentId[] = ["segmentation", "creative", "composer", "guardian"];

function formatPts(value: number | null | undefined) {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

type Action = "recheck" | "send";

/** Hosts a recipient's mail client (or Gmail's image proxy) cannot reach. */
const PRIVATE_HOST_RE =
  /^https?:\/\/(?:localhost|127\.|0\.0\.0\.0|10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|\[::1\])/i;

/**
 * Image sources in the rendered HTML that will not load for a recipient:
 * still inline (`data:`/`blob:`), still relative, or pointing at a host only
 * reachable from this machine. Each means a resolver silently fell back, and
 * each arrives as a broken image box.
 */
function findUnhostedImages(html: string): string[] {
  const broken: string[] = [];
  for (const [, src] of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    if (!/^https?:\/\//i.test(src) || PRIVATE_HOST_RE.test(src)) broken.push(src.slice(0, 48));
  }
  return [...new Set(broken)];
}

/** Where an email sits in the queue. Order matters — first match wins. */
type Stage = "sent" | "blocked" | "attention" | "ready";

const STAGE_META: Record<Stage, { label: string; className: string }> = {
  sent: { label: "Sent", className: "glass-badge-primary" },
  blocked: { label: "Blocked", className: "glass-badge-block" },
  attention: { label: "Needs attention", className: "glass-badge-revise" },
  ready: { label: "Ready to send", className: "glass-badge-pass" },
};

interface QueueItem {
  email: SegmentEmail;
  segmentName: string;
  segmentSize: number | null;
  checks: GuardianCheck[];
  passed: number;
  blockers: GuardianCheck[];
  sends: EmailSend[];
  lastSent: EmailSend | null;
  stage: Stage;
}

export default function ApprovalQueue() {
  const { state, loading, error, refresh } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { job, start: startScore, running: scoring } = useJob({
    onDone: refresh,
    successMessage: (j) =>
      j.result?.overall != null ? `Scored — overall ${j.result.overall}` : "Scored",
  });

  const dispatch = state?.dispatch;

  // The recipient field is pre-filled from the backend's configured default,
  // but stays editable — the operator confirms the address on every send.
  useEffect(() => {
    if (dispatch?.default_recipient && !recipient) setRecipient(dispatch.default_recipient);
  }, [dispatch?.default_recipient, recipient]);

  const items = useMemo<QueueItem[]>(() => {
    if (!state) return [];
    const segmentById = Object.fromEntries(state.segments.map((s) => [s.id, s]));

    return state.emails.map((email) => {
      const checks = state.verdicts[email.id]?.checks ?? [];
      const verdict = state.verdicts[email.id]?.verdict ?? null;
      const blockers = checks.filter((c) => !c.passed && c.severity === "block");
      const sends = state.sends.filter((s) => s.email_id === email.id);
      const lastSent = sends.find((s) => s.status === "sent") ?? null;
      const segment = segmentById[email.segment_brief_id];

      const stage: Stage = lastSent
        ? "sent"
        : verdict === "BLOCK" || blockers.length > 0
          ? "blocked"
          : checks.some((c) => !c.passed)
            ? "attention"
            : "ready";

      return {
        email,
        segmentName: segment?.name ?? email.segment_brief_id,
        segmentSize: segment?.size ?? null,
        checks,
        passed: checks.filter((c) => c.passed).length,
        blockers,
        sends,
        lastSent,
        stage,
      };
    });
  }, [state]);

  const selected = items.find((i) => i.email.id === selectedId) ?? items[0] ?? null;

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading approval queue…</div>;
  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>;

  /**
   * Runs one action, then reloads the workspace, then reports.
   *
   * The refresh has to finish before the toast fires and the spinner clears.
   * /api/state re-reads the whole workspace — every segment, email, verdict and
   * send — so it takes a visible moment; announcing success while the button is
   * still spinning reads as a hang, and the panel behind it would still be
   * showing pre-action data.
   */
  const run = async (kind: Action, work: () => Promise<string>, failure: string) => {
    setBusy(kind);
    try {
      const message = await work();
      await refresh();
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failure);
    } finally {
      setBusy(null);
    }
  };

  const handleRecheck = () =>
    run(
      "recheck",
      async () => {
        const result = await readjudicateEmail(selected!.email.id);
        return `Pre-flight re-run — ${result.verdict}`;
      },
      "Could not re-run the checks",
    );

  const handleSend = async () => {
    const item = selected!;
    setConfirming(false);
    await run(
      "send",
      async () => {
        const background = item.email.background ?? { ...DEFAULT_BACKGROUND };
        // Everything image-shaped goes through the builder's own chokepoint
        // first: inline `data:` sources are uploaded to Supabase Storage and
        // rewritten to public https URLs, because mobile Gmail strips inline
        // images outright. Then the same renderer the builder previews with,
        // so the approved artifact and the dispatched one cannot drift.
        const [blocks, pattern, socialIcons] = await Promise.all([
          resolveBlockImageUrlsForEmail(item.email.blocks ?? []),
          renderPatternToPng(background).then((p) => resolvePatternUrlForEmail(p?.dataUri)),
          getSocialIconUrls(),
        ]);
        const html = generateEmailHtml(
          blocks,
          item.email.subject,
          background,
          pattern,
          socialIcons,
        );

        // Every resolver above degrades to the original URL on failure rather
        // than throwing, so a storage outage used to ship an email whose images
        // Gmail then stripped — discovered only in the recipient's inbox. Refuse
        // instead: this is the last point where it is still cheap to stop.
        const unhosted = findUnhostedImages(html);
        if (unhosted.length > 0) {
          throw new Error(
            `${unhosted.length} image${unhosted.length > 1 ? "s" : ""} could not be uploaded to ` +
              `storage (${unhosted[0]}) and would arrive broken. Check the browser console for ` +
              "the upload error, then try again.",
          );
        }
        const send = await sendEmail(item.email.id, {
          to: recipient.trim(),
          html,
          subject: item.email.subject,
        });
        return `Sent to ${send.recipient}`;
      },
      "Send failed",
    );
  };

  const counts = {
    sent: items.filter((i) => i.stage === "sent").length,
    ready: items.filter((i) => i.stage === "ready").length,
    blocked: items.filter((i) => i.stage === "blocked").length,
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Approval Queue</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {dispatch?.configured ? (
            <>
              Approved emails are delivered for real from{" "}
              <span className="font-medium text-foreground/80">{dispatch.from_address}</span>.
            </>
          ) : (
            <span className="text-warning">
              Dispatch is off — set RESEND_API_KEY in backend/.env to enable sending.
            </span>
          )}
        </p>
        <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
          <span>{items.length} in queue</span>
          {counts.ready > 0 && <span className="text-success">{counts.ready} ready to send</span>}
          {counts.blocked > 0 && <span className="text-destructive">{counts.blocked} blocked</span>}
          {counts.sent > 0 && <span className="text-primary">{counts.sent} sent</span>}
        </div>
      </motion.div>

      <AnimatePresence>
        {job && <ProcessPanel key="eval-progress" job={job} title="Scoring the four agents" />}
      </AnimatePresence>

      <EvalScorecard
        run={state?.eval ?? null}
        scoring={scoring}
        onScore={() => startScore(() => startEval())}
      />

      {items.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          Nothing to approve yet — compose emails in Email Review first.
        </div>
      ) : (
      <div className="grid grid-cols-[240px_1fr] gap-5 items-start">
        {/* ── Queue rail ── */}
        <div className="space-y-2 sticky top-4">
          {items.map((item) => {
            const meta = STAGE_META[item.stage];
            const isSelected = selected?.email.id === item.email.id;
            return (
              <button
                key={item.email.id}
                onClick={() => setSelectedId(item.email.id)}
                className={cn(
                  "w-full text-left rounded-xl p-3 border transition-colors",
                  isSelected ? "border-primary/40 bg-primary/5" : "border-border/60 hover:bg-muted/40",
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold truncate">{item.segmentName}</span>
                  <span
                    className={`glass-badge ${meta.className} px-1.5 py-0.5 rounded-full text-[8px] font-bold shrink-0 uppercase tracking-wide`}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate mb-1.5">{item.email.subject}</div>
                <CheckMeter checks={item.checks} />
              </button>
            );
          })}
        </div>

        {/* ── Detail ── */}
        <AnimatePresence mode="wait">
          {selected && (
            <motion.div
              key={selected.email.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-4 min-w-0"
            >
              <PreflightCard
                item={selected}
                onRecheck={handleRecheck}
                rechecking={busy === "recheck"}
              />

              <div className="glass-card p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold">What the recipient sees</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {selected.email.subject}
                      {selected.email.preheader ? ` — ${selected.email.preheader}` : ""}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {selected.email.blocks?.length ?? 0} blocks
                  </span>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 h-[420px] overflow-y-auto scrollbar-thin">
                  <div style={{ transform: "scale(0.72)", transformOrigin: "top left", width: "139%" }}>
                    <EmailPreview
                      blocks={selected.email.blocks ?? []}
                      subject={selected.email.subject}
                      background={selected.email.background ?? { ...DEFAULT_BACKGROUND }}
                      viewport="desktop"
                    />
                  </div>
                </div>
              </div>

              <DispatchCard
                item={selected}
                recipient={recipient}
                onRecipientChange={setRecipient}
                dispatchReady={Boolean(dispatch?.configured)}
                busy={busy}
                onSend={() => setConfirming(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send this email for real?</DialogTitle>
            <DialogDescription>
              It will be delivered to a live inbox and cannot be recalled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-xs">
            <Row label="To" value={recipient} />
            <Row label="From" value={dispatch?.from_address ?? ""} />
            <Row label="Subject" value={selected?.email.subject ?? ""} />
            <Row label="Segment" value={selected?.segmentName ?? ""} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} className="gap-2">
              <Send className="h-4 w-4" />
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatScore(value: number | null | undefined) {
  return value == null ? "—" : value.toFixed(1);
}

function Delta({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const tone = value > 0 ? "text-success" : value < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <span className={cn("text-[10px] tabular-nums", tone)}>
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}
    </span>
  );
}

function EvalScorecard({
  run,
  scoring,
  onScore,
}: {
  run: EvalRun | null;
  scoring: boolean;
  onScore: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const when = run?.created_at
    ? new Date(run.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="glass-card p-5 mb-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-xs font-bold">Model scores</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {run?.id
              ? `${run.rubric_version}${when ? ` · ${when}` : ""}${run.judge_model ? ` · ${run.judge_model}` : ""}`
              : "Not scored yet — grades the four agents against the current campaign."}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-lg font-bold tabular-nums leading-none">
              {formatScore(run?.overall ?? null)}
              {run?.delta?.overall != null && (
                <span className="ml-1.5 text-xs font-medium">
                  <Delta value={run.delta.overall} />
                </span>
              )}
            </div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">overall</div>
          </div>
          <Button size="sm" variant="outline" onClick={onScore} disabled={scoring} className="h-7 gap-1.5 text-xs">
            {scoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Score models
          </Button>
        </div>
      </div>
      <Collapsible open={detailOpen} onOpenChange={setDetailOpen}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {AGENT_ORDER.map((id) => {
            const agent = run?.agents?.[id];
            const rows = agent?.breakdown ?? run?.rubric?.[id] ?? AGENT_RUBRIC[id];
            return (
              <div key={id} className="rounded-lg border border-border/50 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">
                  {AGENT_LABELS[id]}
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-base font-bold tabular-nums">{formatScore(agent?.score ?? null)}</span>
                  <Delta value={run?.delta?.[id]} />
                </div>
                {!agent?.available && (
                  <div className="text-[10px] text-muted-foreground mt-1.5">No artifacts yet</div>
                )}
                <AnimatePresence initial={false}>
                  {detailOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-1 border-t border-border/50 divide-y divide-border/40">
                        {rows.map((row) => (
                          <div key={row.name} className="flex items-baseline justify-between gap-4 py-2.5">
                            <div className="min-w-0 text-xs leading-relaxed">
                              <span className="text-foreground/85">{row.name}</span>
                              <span className="text-muted-foreground"> – {row.kind}</span>
                            </div>
                            <div className="shrink-0 text-xs tabular-nums text-foreground/85">
                              {formatPts(row.earned)}{" "}
                              <span className="text-muted-foreground">(max {formatPts(row.weight)})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {detailOpen ? "Hide scoring detail" : "Show scoring detail"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", detailOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
      </Collapsible>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium break-all">{value || "—"}</span>
    </div>
  );
}

/** One tick per check — green passed, red a blocker, amber a soft failure. */
function CheckMeter({ checks }: { checks: GuardianCheck[] }) {
  if (checks.length === 0) {
    return <div className="text-[10px] text-muted-foreground">not checked yet</div>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5 flex-1">
        {checks.map((check) => (
          <span
            key={check.name}
            title={`${check.name} — ${check.detail}`}
            className={cn(
              "h-1 flex-1 rounded-full",
              check.passed ? "bg-success" : check.severity === "block" ? "bg-destructive" : "bg-warning",
            )}
          />
        ))}
      </div>
      <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
        {checks.filter((c) => c.passed).length}/{checks.length}
      </span>
    </div>
  );
}

function PreflightCard({
  item,
  onRecheck,
  rechecking,
}: {
  item: QueueItem;
  onRecheck: () => void;
  rechecking: boolean;
}) {
  const total = item.checks.length;
  const headline = item.blockers.length
    ? `${item.blockers.length} blocking issue${item.blockers.length > 1 ? "s" : ""}`
    : total === 0
      ? "Not checked yet"
      : item.passed === total
        ? "All checks passed"
        : `${total - item.passed} to review`;

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold truncate">{item.segmentName}</h2>
            <span
              className={`glass-badge ${STAGE_META[item.stage].className} px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0`}
            >
              {STAGE_META[item.stage].label}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {item.segmentSize !== null ? `${item.segmentSize.toLocaleString()} contacts · ` : ""}
            <span className={item.blockers.length ? "text-destructive font-medium" : ""}>{headline}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-lg font-bold tabular-nums leading-none">
              {item.passed}
              <span className="text-muted-foreground text-xs">/{total}</span>
            </div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">checks</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onRecheck}
            disabled={rechecking}
            className="h-7 gap-1.5 text-xs"
          >
            {rechecking ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Re-run
          </Button>
        </div>
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted-foreground">
          No pre-flight run on record — press Re-run to check this email.
        </p>
      ) : (
        <div className="space-y-4">
          {CATEGORY_ORDER.map((category) => {
            const group = item.checks.filter((c) => c.category === category);
            if (group.length === 0) return null;
            const failed = group.filter((c) => !c.passed).length;
            return (
              <div key={category}>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{CATEGORY_BLURBS[category]}</span>
                  {failed > 0 && (
                    <span className="text-[10px] text-warning font-medium ml-auto">{failed} failing</span>
                  )}
                </div>
                <div className="rounded-lg border border-border/50 divide-y divide-border/40">
                  {group.map((check) => (
                    <CheckRow key={check.name} check={check} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckRow({ check }: { check: GuardianCheck }) {
  const Icon = check.passed ? CheckCircle2 : check.severity === "block" ? XCircle : AlertTriangle;
  const tone = check.passed
    ? "text-success"
    : check.severity === "block"
      ? "text-destructive"
      : "text-warning";

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 px-3 py-2",
        !check.passed && (check.severity === "block" ? "bg-destructive/5" : "bg-warning/5"),
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", tone)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold">{check.name}</span>
          {!check.passed && check.severity === "block" && (
            <span className="text-[8px] font-bold uppercase tracking-wide text-destructive border border-destructive/40 rounded px-1 py-px">
              blocking
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">{check.detail}</div>
      </div>
    </div>
  );
}

function DispatchCard({
  item,
  recipient,
  onRecipientChange,
  dispatchReady,
  busy,
  onSend,
}: {
  item: QueueItem;
  recipient: string;
  onRecipientChange: (value: string) => void;
  dispatchReady: boolean;
  busy: Action | null;
  onSend: () => void;
}) {
  const blocked = item.blockers.length > 0;
  const canSend = dispatchReady && !blocked && recipient.trim().length > 0;

  return (
    <div className="glass-card p-5">
      <div className="text-xs font-bold mb-1">Dispatch</div>
      <p className="text-[11px] text-muted-foreground mb-4">
        Delivered to a live inbox. Merge tags are filled from a real contact in this segment on the
        way out, and inline images are uploaded to storage so they render.
      </p>

      <div className="flex items-end gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <label
            htmlFor="recipient"
            className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Send to
          </label>
          <Input
            id="recipient"
            type="email"
            value={recipient}
            onChange={(e) => onRecipientChange(e.target.value)}
            placeholder="name@example.com"
            className="h-9 mt-1 text-xs"
          />
        </div>
        <Button onClick={onSend} disabled={busy !== null || !canSend} className="h-9 gap-2 shrink-0">
          {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {item.lastSent ? "Send again" : "Send"}
        </Button>
      </div>

      {blocked ? (
        <p className="text-[11px] text-destructive">
          {item.blockers.map((b) => b.name).join(", ")} must pass before this can be sent. Fix it in
          Email Review, then re-run the checks.
        </p>
      ) : !dispatchReady ? (
        <p className="text-[11px] text-warning">
          Dispatch is not configured — set RESEND_API_KEY and RESEND_FROM in backend/.env.
        </p>
      ) : null}

      {item.sends.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70 mb-2">
            Delivery history
          </div>
          <div className="space-y-1.5">
            {item.sends.map((send) => (
              <div key={send.id} className="flex items-start gap-2 text-[11px]">
                {send.status === "sent" ? (
                  <Mail className="h-3 w-3 text-success shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{send.recipient}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {new Date(send.created_at).toLocaleString()}
                  </span>
                  {send.error && <div className="text-destructive">{send.error}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
