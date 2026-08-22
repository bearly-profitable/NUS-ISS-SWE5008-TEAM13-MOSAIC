import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { useChrome } from "@/contexts/ChromeContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { isUnlocked, nextStep } from "@/lib/pipeline";

/**
 * The one way forward.
 *
 * Each pipeline page used to end wherever its content ended, leaving the
 * operator to work out from the dock which tab had just unlocked. Instead the
 * shell raises a single Next button the moment the current step is finished —
 * so "am I done here?" and "where do I go?" have the same answer.
 *
 * It lives in the shell rather than in each page because it is positioned
 * against the app window, which the pages scroll inside of.
 */
export function StepFooter() {
  const { step, revealNav } = useChrome();
  const { state } = useWorkspace();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const next = nextStep(pathname);
  // A step is finished when the next one unlocks — true for every page whose
  // output is saved as it is produced. Company Info is the exception: its form
  // is a local draft until Next saves it, so it registers a gate of its own.
  const ready = Boolean(next && (step ? step.ready : isUnlocked(next, state)));

  // The button appearing and the dock coming back are the same event: the
  // operator has just earned a way forward, so don't make them hunt for the
  // nav to take it.
  const wasReady = useRef(ready);
  useEffect(() => {
    if (ready && !wasReady.current) revealNav();
    wasReady.current = ready;
  }, [ready, revealNav]);

  const go = async () => {
    if (!next || busy) return;
    setBusy(true);
    try {
      // A gate that fails (a rejected save) keeps us here — it has already
      // said why via a toast.
      if ((await step?.onNext?.()) === false) return;
      navigate(next.to);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {ready && next && (
        <motion.div
          // Keyed by destination so moving between steps re-plays the
          // entrance rather than silently relabelling the button.
          key={next.to}
          initial={{ opacity: 0, y: 20, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.94 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="absolute bottom-4 right-5 z-40"
        >
          <button type="button" onClick={go} disabled={busy} className="step-next group">
            <span className="flex flex-col items-start gap-1 leading-none">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Next
              </span>
              <span className="text-[13px] font-semibold">{next.label}</span>
            </span>
            <span className="step-next-chip">
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              )}
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
