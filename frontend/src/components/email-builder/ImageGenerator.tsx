/**
 * Generate an image from a prompt — manually, and only when asked.
 *
 * The shape of this panel is the point. Nothing here fires on mount, on tab
 * switch, or as a side effect of a pipeline run: the operator writes or
 * drafts a prompt, *reads it*, presses Generate, then decides whether to keep
 * the result. Three separate deliberate acts.
 *
 * - "Draft with AI" only writes a suggestion into the textarea. It never
 *   renders an image, so the expensive call always sits behind a prompt a
 *   person has actually looked at.
 * - The result is held locally until "Use this image" is pressed, so a bad
 *   render never silently becomes the hero of an email.
 * - Earlier renders from this session stay pickable, because the usual way to
 *   lose a good image is to regenerate over it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImageOff, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { registerImageAsset } from "@/services/imageFoldersApi";
import {
  draftImagePrompt,
  generateImage,
  getImageGenConfig,
  type GeneratedImage,
  type ImageGenConfig,
  type ImagePurpose,
} from "@/services/imageGenApi";

/** Shown before the backend answers, so the controls render immediately. */
const FALLBACK_RATIOS = ["1:1", "3:2", "2:3", "16:9", "9:16", "4:3", "3:4"];
const QUALITIES = ["auto", "low", "medium", "high"];
const BACKGROUNDS = ["auto", "transparent", "opaque"];
const DEFAULT_MAX_CHARS = 4000;

/** Aspect ratio that suits each slot, so the default is usually right. */
const DEFAULT_RATIO: Record<ImagePurpose, string> = {
  hero: "3:2",
  logo: "1:1",
  block: "4:3",
};

function ChipRow({
  options,
  value,
  onChange,
  disabled,
}: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-50",
            value === option
              ? "border-primary/60 bg-primary/10 text-foreground"
              : "border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export interface ImageGeneratorProps {
  /** What the image is for — sets the default ratio and steers the draft. */
  purpose?: ImagePurpose;
  /** Pulls that segment's creative direction into the drafted prompt. */
  segmentId?: string | null;
  /** Gallery folder a kept image is filed under, matching uploads. */
  folderId?: string | null;
  /** Called only when the operator presses "Use this image". */
  onUse: (url: string) => void;
}

export function ImageGenerator({
  purpose = "hero",
  segmentId = null,
  folderId = null,
  onUse,
}: ImageGeneratorProps) {
  const [config, setConfig] = useState<ImageGenConfig | null>(null);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_RATIO[purpose]);
  const [quality, setQuality] = useState("auto");
  const [background, setBackground] = useState("auto");
  const [showOptions, setShowOptions] = useState(false);

  const [drafting, setDrafting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every render from this session, newest first, plus which one is on screen.
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Guards a setState after the panel closes mid-request — the operator can
  // switch tabs while a 30-second render is in flight.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Reads configuration only. This makes no image and spends nothing; it is
  // what lets the panel name the model and disable itself when no API key is
  // set, instead of failing at the moment the operator presses Generate.
  useEffect(() => {
    getImageGenConfig()
      .then((next) => {
        if (alive.current) setConfig(next);
      })
      .catch(() => {
        /* the panel still works; it just can't name the model up front */
      });
  }, []);

  const ratios = config?.aspect_ratios ?? FALLBACK_RATIOS;
  const maxChars = config?.max_prompt_chars ?? DEFAULT_MAX_CHARS;
  const trimmed = prompt.trim();
  // Image models reward short, concrete prompts, so words are the number
  // worth watching — the character cap is only a backstop.
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const tooLong = trimmed.length > maxChars;
  const unconfigured = config?.configured === false;
  const active = results[activeIndex] ?? null;

  const handleDraft = useCallback(async () => {
    setDrafting(true);
    setError(null);
    try {
      // The current textarea contents become the hint, so asking for a draft
      // builds on what the operator typed rather than discarding it.
      const { prompt: drafted, ai_written } = await draftImagePrompt({
        purpose,
        hint: trimmed,
        segmentId,
      });
      if (!alive.current) return;
      setPrompt(drafted);
      toast.success(
        ai_written
          ? "Prompt drafted — read it over and edit before generating"
          : "Prompt model unavailable — filled in a basic starting point to edit",
      );
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof Error ? err.message : "Could not draft a prompt.");
    } finally {
      if (alive.current) setDrafting(false);
    }
  }, [purpose, segmentId, trimmed]);

  const handleGenerate = useCallback(async () => {
    if (!trimmed || tooLong) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateImage({
        prompt: trimmed,
        aspectRatio,
        quality,
        background,
        purpose,
        segmentId,
      });
      if (!alive.current) return;
      setResults((prev) => [result, ...prev]);
      setActiveIndex(0);
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof Error ? err.message : "Image generation failed.");
    } finally {
      if (alive.current) setGenerating(false);
    }
  }, [trimmed, tooLong, aspectRatio, quality, background, purpose, segmentId]);

  const handleUse = useCallback(() => {
    if (!active) return;
    onUse(active.url);
    // File it in the gallery the same way an upload is, so a kept image is
    // reusable later. Best-effort — the image already works without it.
    registerImageAsset({
      storagePath: active.url.split("/").pop() ?? "",
      filename: `generated-${active.aspect_ratio.replace(":", "x")}.png`,
      mimeType: "image/png",
      folderId,
    }).catch(() => {
      /* the URL is already usable; the folder index is a nicety */
    });
    toast.success("Image applied");
  }, [active, folderId, onUse]);

  const handleDiscard = useCallback(() => {
    setResults((prev) => prev.filter((_, i) => i !== activeIndex));
    setActiveIndex(0);
  }, [activeIndex]);

  return (
    <div className="mt-4 space-y-3">
      {/* ── Prompt: the review step. Always editable, never auto-submitted. ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[10px] font-semibold text-muted-foreground/80">
            Prompt — review before generating
          </Label>
          <button
            type="button"
            onClick={() => void handleDraft()}
            disabled={drafting || generating || unconfigured}
            className="text-[10px] text-primary font-semibold inline-flex items-center gap-1 disabled:opacity-50"
            title="Writes a suggestion into the box. Does not generate an image."
          >
            {drafting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            {drafting ? "Drafting…" : "Draft with AI"}
          </button>
        </div>

        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          spellCheck
          placeholder="Subject first, then setting, light and shot — one or two plain sentences, around 30 words. Short and concrete beats long and detailed."
          className="text-xs leading-relaxed resize-y min-h-[120px]"
          disabled={generating}
        />

        <div className="flex items-center justify-between text-[10px]">
          <span className={cn("text-muted-foreground/70", tooLong && "text-destructive")}>
            {tooLong
              ? `${trimmed.length.toLocaleString()} / ${maxChars.toLocaleString()} characters`
              : `${wordCount} ${wordCount === 1 ? "word" : "words"}${wordCount > 45 ? " — consider trimming" : ""}`}
          </span>
          {config?.model && (
            <span className="text-muted-foreground/60 truncate max-w-[55%]" title={config.model}>
              {config.model}
            </span>
          )}
        </div>
      </div>

      {/* ── Shape ── */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold text-muted-foreground/80">Aspect ratio</Label>
        <ChipRow options={ratios} value={aspectRatio} onChange={setAspectRatio} disabled={generating} />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowOptions((open) => !open)}
          className="text-[10px] text-muted-foreground hover:text-foreground font-medium"
        >
          {showOptions ? "Hide options" : "More options"}
        </button>
        {showOptions && (
          <div className="mt-2 space-y-2.5">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground/80">Quality</Label>
              <ChipRow
                options={config?.qualities ?? QUALITIES}
                value={quality}
                onChange={setQuality}
                disabled={generating}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground/80">Background</Label>
              <ChipRow
                options={config?.backgrounds ?? BACKGROUNDS}
                value={background}
                onChange={setBackground}
                disabled={generating}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── The one expensive button ── */}
      <Button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={!trimmed || tooLong || generating || drafting || unconfigured}
        className="w-full gap-2"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {generating ? "Generating…" : results.length ? "Generate again" : "Generate image"}
      </Button>

      {unconfigured && (
        <p className="text-[10px] text-muted-foreground/80">
          Image generation is off — set <span className="font-medium">OPENROUTER_API_KEY</span> in
          backend/.env and restart the Orchestrator.
        </p>
      )}

      {error && (
        <p className="text-[11px] text-destructive/90 flex items-start gap-1.5">
          <ImageOff className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}

      {/* ── Result: kept out of the email until it's explicitly chosen ── */}
      {active && (
        <div className="space-y-2 pt-1">
          <div className="rounded-xl overflow-hidden border border-border/60 bg-muted/20">
            <img src={active.url} alt="Generated" className="w-full max-h-56 object-contain block" />
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
            <span>
              {active.aspect_ratio} · est. ${active.cost_usd.toFixed(3)} per render
            </span>
            {results.length > 1 && (
              <span>
                {activeIndex + 1} of {results.length}
              </span>
            )}
          </div>

          {results.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {results.map((result, index) => (
                <button
                  key={result.url}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "h-12 w-12 shrink-0 rounded-lg overflow-hidden border-2 transition-colors",
                    index === activeIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100",
                  )}
                  title={`Attempt ${results.length - index}`}
                >
                  <img src={result.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" onClick={handleUse} className="flex-1 gap-1.5" size="sm">
              <Check className="h-3.5 w-3.5" /> Use this image
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              className="gap-1.5"
              title="Drop this attempt"
            >
              <Trash2 className="h-3.5 w-3.5" /> Discard
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground/60">
            Nothing is applied until you press “Use this image”.
          </p>
        </div>
      )}
    </div>
  );
}
