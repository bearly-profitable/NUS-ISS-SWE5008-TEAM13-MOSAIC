import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UndoBarProps {
  /** Whether the bar is visible. */
  visible: boolean;
  /** Label shown, e.g. 'Deleted "My Tag"'. */
  label: string;
  /** Duration in ms for the countdown. Default 10000. */
  duration?: number;
  /** Called when the user clicks Undo. */
  onUndo: () => void;
  /** Called when the user dismisses (or timer expires). */
  onDismiss: () => void;
  /** If true, render inline (no portal). Useful inside modals/sheets. */
  inline?: boolean;
}

export function UndoBar({
  visible,
  label,
  duration = 10_000,
  onUndo,
  onDismiss,
  inline = false,
}: UndoBarProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!visible) { setProgress(100); return; }
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct > 0) raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, duration]);

  const content = (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]"
        >
          <div className="glass-surface rounded-2xl shadow-xl border border-white/15 overflow-hidden min-w-[320px] max-w-[440px]">
            {/* Progress bar */}
            <div className="h-0.5 w-full bg-white/5">
              <div
                className="h-full bg-secondary/60 transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-[13px] text-foreground/65 flex-1 truncate">
                {label}
              </span>
              <button
                onClick={onUndo}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold",
                  "bg-secondary/12 text-secondary hover:bg-secondary/20 border border-secondary/20",
                  "transition-all",
                )}
              >
                <Undo2 className="w-3.5 h-3.5" />
                Undo
              </button>
              <button
                onClick={onDismiss}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-foreground/25 hover:text-foreground/50 hover:bg-white/8 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (inline) return content;
  return createPortal(content, document.body);
}
