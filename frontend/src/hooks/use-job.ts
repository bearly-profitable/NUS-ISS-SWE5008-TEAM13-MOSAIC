import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getJob, type Job } from "@/services/workspaceApi";

/**
 * Starts a long-running backend job and polls it to completion.
 *
 * Every slow action (audience load, segmentation, creative direction, email
 * composition) returns a job id instead of blocking, so they all share this
 * hook and the same ProcessPanel.
 */
export function useJob(options: { onDone?: () => Promise<void> | void; successMessage?: (job: Job) => string } = {}) {
  const [job, setJob] = useState<Job | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<number | null>(null);
  // Keep the latest callbacks without making `start` change identity on every
  // render — otherwise a caller passing an inline arrow restarts polling.
  const opts = useRef(options);
  opts.current = options;

  const stop = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    async (begin: () => Promise<{ job_id: string }>) => {
      setStarting(true);
      try {
        const { job_id } = await begin();
        setStarting(false);
        timer.current = window.setInterval(async () => {
          try {
            const next = await getJob(job_id);
            setJob(next);
            if (next.status === "running") return;

            stop();
            if (next.status === "done") {
              toast.success(opts.current.successMessage?.(next) ?? "Done");
              await opts.current.onDone?.();
              // Hold the finished panel briefly so the last step is readable.
              window.setTimeout(() => setJob(null), 1500);
            } else {
              toast.error(next.error ?? "The job failed");
            }
          } catch (err) {
            stop();
            setJob(null);
            toast.error(err instanceof Error ? err.message : "Lost track of the job");
          }
        }, 500);
      } catch (err) {
        setStarting(false);
        toast.error(err instanceof Error ? err.message : "Could not start");
      }
    },
    [stop],
  );

  return { job, start, running: starting || job?.status === "running" };
}
