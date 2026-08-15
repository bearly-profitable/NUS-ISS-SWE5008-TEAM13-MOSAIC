import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Palette, Loader2, Sparkles, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  generateCreative,
  updateCreative,
  updateSettings,
  type BrandPalette,
  type CreativeDirection,
} from "@/services/workspaceApi";

const PALETTE_FIELDS: { key: keyof BrandPalette; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "accent", label: "Accent" },
  { key: "background", label: "Background" },
  { key: "text", label: "Text" },
];

const DIRECTION_FIELDS: { key: keyof CreativeDirection; label: string; hint: string }[] = [
  { key: "tonality", label: "Tonality", hint: "How the message should feel" },
  { key: "language_style", label: "Language", hint: "Register, sentence length, vocabulary" },
  { key: "cta_style", label: "Call to action", hint: "How the CTA should be phrased" },
  { key: "design_style", label: "Design & shapes", hint: "Layout and shape language" },
];

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="h-4 w-4 rounded-md border border-border/60 shrink-0"
      style={{ background: color }}
      title={color}
    />
  );
}

/** Per-segment direction card — every field is editable and saved on blur. */
function DirectionCard({
  segmentName,
  direction,
  onSaved,
}: {
  segmentName: string;
  direction: CreativeDirection;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(direction);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Regenerating replaces the direction underneath us — take the new values
  // unless the user has unsaved edits in flight.
  useEffect(() => {
    if (!dirty) setDraft(direction);
  }, [direction, dirty]);

  const save = async (patch: Partial<CreativeDirection>) => {
    setSaving(true);
    try {
      await updateCreative(direction.segment_brief_id, patch);
      setDirty(false);
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const accent = draft.palette?.accent ?? "#C2703D";

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Swatch color={accent} />
          <span className="text-sm font-bold truncate">{segmentName}</span>
        </div>
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
        ) : dirty ? (
          <span className="text-[10px] text-warning shrink-0">unsaved</span>
        ) : (
          <Check className="h-3.5 w-3.5 text-success shrink-0" />
        )}
      </div>

      {direction.rationale && (
        <p className="text-[11px] text-muted-foreground leading-snug border-l-2 border-primary/25 pl-2.5">
          {direction.rationale}
        </p>
      )}

      <div className="space-y-3">
        {DIRECTION_FIELDS.map((field) => (
          <div key={field.key}>
            <Label className="text-[10px] font-semibold text-muted-foreground/80">
              {field.label}
              <span className="font-normal text-muted-foreground/50"> — {field.hint}</span>
            </Label>
            <Textarea
              rows={2}
              value={(draft[field.key] as string) ?? ""}
              onChange={(e) => {
                setDirty(true);
                setDraft((d) => ({ ...d, [field.key]: e.target.value }));
              }}
              onBlur={() => dirty && save({ [field.key]: draft[field.key] } as Partial<CreativeDirection>)}
              className="mt-1 text-xs resize-none"
            />
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-border/60">
        <Label className="text-[10px] font-semibold text-muted-foreground/80">Accent colour for this segment</Label>
        <div className="flex items-center gap-2 mt-1.5">
          <input
            type="color"
            value={accent}
            onChange={(e) => {
              const palette = { ...draft.palette, accent: e.target.value };
              setDraft((d) => ({ ...d, palette }));
            }}
            onBlur={() => save({ palette: draft.palette })}
            className="h-8 w-12 rounded-md border border-border/60 bg-transparent cursor-pointer"
          />
          <Input
            value={accent}
            onChange={(e) => {
              setDirty(true);
              setDraft((d) => ({ ...d, palette: { ...d.palette, accent: e.target.value } }));
            }}
            onBlur={() => dirty && save({ palette: draft.palette })}
            className="h-8 text-xs font-mono w-28"
          />
        </div>
      </div>
    </div>
  );
}

export default function CreativeReview() {
  const { state, loading, error, refresh } = useWorkspace();
  const [generating, setGenerating] = useState(false);
  const [palette, setPalette] = useState<BrandPalette | null>(null);
  const [savingPalette, setSavingPalette] = useState(false);

  useEffect(() => {
    if (state?.brand_palette && !palette) setPalette(state.brand_palette);
  }, [state?.brand_palette, palette]);

  const segments = state?.segments ?? [];
  const directions = state?.creative_directions ?? [];
  const directionBySegment = Object.fromEntries(directions.map((d) => [d.segment_brief_id, d]));

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generateCreative();
      toast.success(`Creative direction ready for ${res.creative_directions.length} segments`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Creative direction failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePalette = async () => {
    if (!palette) return;
    setSavingPalette(true);
    try {
      await updateSettings({ brand_palette: palette });
      toast.success("Brand palette saved — new directions will start from it");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save palette");
    } finally {
      setSavingPalette(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading creative…</div>;
  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Creative Review</h1>
          <p className="text-sm text-muted-foreground mt-1">
            No imagery is generated here. Each segment gets a written direction — tonality, language, call to
            action and design style — that the email composer has to follow.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating || segments.length === 0} className="gap-2 shrink-0">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {directions.length ? "Regenerate direction" : "Generate direction"}
        </Button>
      </motion.div>

      {/* ── Brand palette ── */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-sm font-bold">Brand palette</h2>
          <span className="text-[10px] text-muted-foreground">the default every segment starts from</span>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Segments inherit these colours; you can override the accent per segment below.
        </p>

        <div className="flex items-end gap-4 flex-wrap">
          {PALETTE_FIELDS.map((field) => (
            <div key={field.key}>
              <Label className="text-[10px] font-semibold text-muted-foreground/80">{field.label}</Label>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="color"
                  value={palette?.[field.key] ?? "#000000"}
                  onChange={(e) => setPalette((p) => (p ? { ...p, [field.key]: e.target.value } : p))}
                  className="h-8 w-10 rounded-md border border-border/60 bg-transparent cursor-pointer"
                />
                <Input
                  value={palette?.[field.key] ?? ""}
                  onChange={(e) => setPalette((p) => (p ? { ...p, [field.key]: e.target.value } : p))}
                  className="h-8 text-xs font-mono w-24"
                />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setPalette(state?.brand_palette ?? null)}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button onClick={handleSavePalette} disabled={savingPalette} size="sm" className="h-8 gap-1.5 text-xs">
              {savingPalette ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save palette
            </Button>
          </div>
        </div>
      </div>

      {/* ── Per-segment direction ── */}
      {segments.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No segments yet — generate them in the Segments tab first.
        </div>
      ) : directions.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No creative direction yet. Generate it to give each segment its own tonality, language, CTA and design
          style.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {segments.map((seg) => {
            const direction = directionBySegment[seg.id];
            if (!direction) return null;
            return (
              <DirectionCard
                key={seg.id}
                segmentName={seg.name || seg.id}
                direction={direction}
                onSaved={refresh}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
