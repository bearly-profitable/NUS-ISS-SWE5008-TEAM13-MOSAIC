import { motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MosaicLoader } from "@/components/ui/mosaic-loader";
import type { Job } from "@/services/workspaceApi";

/**
 * Live step list for a running backend job, shared by every slow action.
 *
 * Steps and their detail lines come from the server, so this reflects what is
 * genuinely happening rather than a timed animation.
 */
export function ProcessPanel({ job, title }: { job: Job; title: string }) {
  const done = job.steps.filter((s) => s.state === "done").length;
  const failed = job.status === "failed";
  const pct = Math.round((done / Math.max(job.steps.length, 1)) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="glass-card p-5 mb-5 flex gap-6"
    >
      <div className="shrink-0 flex flex-col items-center justify-center pr-5 border-r border-border/50">
        <MosaicLoader size={84} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold">{failed ? `${title} failed` : title}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {done} / {job.steps.length}
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
          <motion.div
            className={cn(
              "h-full rounded-full",
              failed ? "bg-destructive" : "bg-gradient-to-r from-primary to-secondary",
            )}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <div className="space-y-2">
          {job.steps.map((step) => (
            <div key={step.label} className="flex items-start gap-2.5">
              <span className="h-4 w-4 shrink-0 mt-px flex items-center justify-center">
                {step.state === "done" ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : step.state === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : step.state === "failed" ? (
                  <X className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                )}
              </span>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-xs",
                    step.state === "pending"
                      ? "text-muted-foreground/50"
                      : step.state === "running"
                        ? "font-semibold text-foreground"
                        : "text-foreground/80",
                  )}
                >
                  {step.label}
                </div>
                {step.detail && (
                  <div className="text-[11px] text-muted-foreground tabular-nums">{step.detail}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {job.error && (
          <div className="mt-3 text-[11px] text-destructive bg-destructive/10 rounded-md px-2.5 py-2">
            {job.error}
          </div>
        )}
      </div>
    </motion.div>
  );
}
