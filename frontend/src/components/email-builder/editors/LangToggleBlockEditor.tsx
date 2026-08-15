import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Languages, Loader2, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { EmailLocale } from "@/types/email-builder";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

type TranslationStatus = "idle" | "translating" | "done" | "error";

/**
 * The LangToggle block is a translation tool.
 * It lets users translate all email content to Chinese via AI,
 * and switch the preview between EN/ZH.
 * Nothing renders in the actual exported email.
 */
export function LangToggleBlockEditor({ content, onUpdate }: Props) {
  const [status, setStatus] = useState<TranslationStatus>(
    content._translationDone === "true" ? "done" : "idle"
  );
  const activeLocale: EmailLocale = (content._activeLocale as EmailLocale) || "en";
  const hasTranslation = content._translationDone === "true";

  const handleTranslate = useCallback(async () => {
    setStatus("translating");
    try {
      document.dispatchEvent(new CustomEvent("lang-toggle-translate", {
        detail: { blockId: content._blockId },
        bubbles: true,
      }));

      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        const handler = (e: Event) => {
          const detail = (e as CustomEvent).detail;
          document.removeEventListener("lang-toggle-translate-result", handler);
          resolve(detail);
        };
        document.addEventListener("lang-toggle-translate-result", handler);
        setTimeout(() => {
          document.removeEventListener("lang-toggle-translate-result", handler);
          resolve({ success: false, error: "Translation timed out" });
        }, 60000);
      });

      if (result.success) {
        onUpdate("_translationDone", "true");
        setStatus("done");
        toast.success("Email translated to Chinese!");
      } else {
        setStatus("error");
        toast.error(result.error || "Translation failed");
      }
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "Translation failed");
    }
  }, [content._blockId, onUpdate]);

  const handleSwitchLocale = (locale: EmailLocale) => {
    onUpdate("_activeLocale", locale);
    document.dispatchEvent(new CustomEvent("lang-toggle-locale-change", {
      detail: { locale },
      bubbles: true,
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Languages className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Multi-Language
        </span>
        {hasTranslation && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full ml-auto" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
            ZH ready
          </span>
        )}
      </div>

      {/* Language switcher */}
      <div className="flex gap-1.5 p-1 rounded-lg" style={{ background: "rgba(0,0,0,0.04)" }}>
        <button
          type="button"
          onClick={() => handleSwitchLocale("en")}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeLocale === "en"
              ? "bg-card shadow-1 text-label-1"
              : "text-muted-foreground/60 hover:text-muted-foreground"
          }`}
        >
          EN English
        </button>
        <button
          type="button"
          onClick={hasTranslation ? () => handleSwitchLocale("zh") : undefined}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeLocale === "zh"
              ? "bg-card shadow-1 text-label-1"
              : hasTranslation
              ? "text-muted-foreground/60 hover:text-muted-foreground cursor-pointer"
              : "text-muted-foreground/30 cursor-default"
          }`}
        >
          ZH Chinese
          {hasTranslation && activeLocale === "en" && (
            <span className="ml-1 text-[9px] text-emerald-500">done</span>
          )}
        </button>
      </div>

      {/* Translation action */}
      <AnimatePresence mode="wait">
        {status === "idle" && !hasTranslation && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1.5" onClick={handleTranslate}>
              <Languages className="h-3.5 w-3.5" />
              Auto-Translate to Chinese
            </Button>
            <p className="text-[9px] text-muted-foreground/40 mt-1.5 text-center leading-relaxed">
              Uses AI (GPT-5) to translate all text content. Review before sending.
            </p>
          </motion.div>
        )}
        {status === "translating" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(79,70,229,0.06)", border: "1px solid rgba(79,70,229,0.15)" }}
          >
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-primary">Translating...</p>
              <p className="text-[9px] text-muted-foreground/50">AI is translating all text blocks</p>
            </div>
          </motion.div>
        )}
        {status === "done" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <p className="text-[11px] font-semibold text-emerald-600">Translation complete</p>
            </div>
            <Button variant="ghost" size="sm" className="w-full text-xs h-7 gap-1.5 text-muted-foreground/60" onClick={handleTranslate}>
              <RotateCcw className="h-3 w-3" /> Re-translate
            </Button>
          </motion.div>
        )}
        {status === "error" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <p className="text-[11px] font-semibold text-red-600">Translation failed</p>
            </div>
            <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1.5" onClick={handleTranslate}>
              <RotateCcw className="h-3 w-3" /> Retry
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info */}
      {hasTranslation && activeLocale === "zh" && (
        <div className="rounded-lg border border-blue-500/15 bg-blue-500/5 px-3 py-2">
          <p className="text-[9px] text-label-3 leading-relaxed">
            Viewing Chinese preview. Switch to English to edit source content. Re-translate after changes.
          </p>
        </div>
      )}
    </div>
  );
}
