import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Palette,
  Loader2,
  Sparkles,
  Check,
  RotateCcw,
  Image as ImageIcon,
  Undo2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/email-builder/ImageUpload";
import { ProcessPanel } from "@/components/ui/process-panel";
import { useJob } from "@/hooks/use-job";
import { isImageFile, useFileDrop } from "@/hooks/use-file-drop";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { uploadImageFile } from "@/lib/image-file-upload";
import { cn } from "@/lib/utils";
import {
  generateCreative,
  updateCompany,
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

/**
 * Logo / hero picker. Nothing is AI-generated — this is a file the user
 * uploads, which ImageUpload puts in the email-images bucket and hands back
 * as a public URL.
 *
 * `inheritedFrom` names where the image came from when the field itself is
 * empty: a segment with no override shows the company asset, and clearing an
 * override falls back to it rather than to nothing.
 */
function AssetField({
  label,
  value,
  inherited,
  inheritedFrom,
  onChange,
}: {
  label: string;
  value: string;
  inherited?: string;
  inheritedFrom?: string;
  onChange: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = value || inherited || "";
  const isInherited = !value && Boolean(inherited);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-[10px] font-semibold text-muted-foreground/80">{label}</Label>
        <div className="flex items-center gap-2">
          {value && (
            <button
              onClick={() => onChange("")}
              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              title={inheritedFrom ? `Fall back to the ${inheritedFrom}` : "Clear"}
            >
              <Undo2 className="h-3 w-3" /> {inheritedFrom ? "Reset" : "Clear"}
            </button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-[10px] text-primary font-semibold inline-flex items-center gap-1"
          >
            <ImageIcon className="h-3 w-3" /> {open ? "Close" : shown ? "Change" : "Upload"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-12 w-20 rounded-lg border border-border/60 bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center">
          {shown ? (
            <img src={shown} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground truncate min-w-0" title={shown}>
          {shown ? (isInherited ? `From ${inheritedFrom}` : shown.split("/").pop()) : "Not set"}
        </span>
      </div>

      {open && (
        <div className="mt-2">
          <ImageUpload value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

// One frame for both tiles, so the two columns are the same height and line
// up whatever shape the artwork is. Each image is `object-contain` inside it,
// so a wide logo and a 16:9 photo both fit without being cropped or stretched.
const ASSET_FRAME = "aspect-[16/9]";

const BRAND_ASSETS = [
  {
    key: "logo" as const,
    field: "logo_url" as const,
    label: "Company logo",
    where: "Centred at the top of the email",
  },
  {
    key: "hero" as const,
    field: "hero_image_url" as const,
    label: "Hero image",
    where: "Full width, directly under the logo",
  },
];

/**
 * One brand asset. The image frame *is* the upload control — drop a file on
 * it or click it. There is no separate picker panel to open: a logo and a
 * hero are single fixed slots, so the builder's tabbed gallery UI is more
 * chrome than the job needs.
 */
function BrandAssetTile({
  asset,
  value,
  onChange,
}: {
  asset: (typeof BRAND_ASSETS)[number];
  value: string;
  onChange: (url: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      const url = await uploadImageFile(file, { notify: false });
      setUploading(false);
      if (url) await onChange(url);
    },
    [onChange],
  );

  const { dragging, dropProps } = useFileDrop({
    onFile: (file) => void upload(file),
    accept: isImageFile,
    rejectMessage: "That isn't an image — drop a png, jpg, gif or webp",
    disabled: uploading,
  });

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-semibold">{asset.label}</span>
        {value && !uploading && (
          <button
            onClick={() => void onChange("")}
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        {...dropProps}
        className={cn(
          "group relative w-full rounded-xl overflow-hidden flex items-center justify-center",
          "border border-dashed transition-all duration-200 disabled:cursor-wait",
          ASSET_FRAME,
          dragging
            ? "border-primary/70 bg-primary/[0.07]"
            : value
              ? "border-transparent bg-muted/40 hover:border-primary/30"
              : "border-border/60 hover:border-primary/40 hover:bg-primary/[0.03]",
        )}
      >
        {value && <img src={value} alt="" className="max-h-full max-w-full object-contain p-2" />}

        {/* Empty, mid-upload, or hovering over an existing image all resolve
            to the same centred prompt — one place to look, whatever the state. */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-1.5 transition-opacity duration-200",
            value && !dragging && !uploading
              ? "opacity-0 group-hover:opacity-100 bg-background/80 backdrop-blur-[2px]"
              : "opacity-100",
          )}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Upload className={cn("h-4 w-4", dragging ? "text-primary" : "text-muted-foreground/50")} />
          )}
          <span className="text-[10px] font-medium text-muted-foreground">
            {uploading ? "Uploading…" : dragging ? "Drop to upload" : value ? "Replace" : "Drop or click to upload"}
          </span>
        </div>
      </button>

      <p className="text-[10px] text-muted-foreground/60 truncate mt-1.5" title={value || undefined}>
        {value ? value.split("/").pop() : asset.where}
      </p>
    </div>
  );
}

/** The company's two brand assets, side by side in matching frames. */
function BrandAssets({
  logo,
  hero,
  onChange,
}: {
  logo: string;
  hero: string;
  onChange: (patch: { logo_url?: string; hero_image_url?: string }) => Promise<void>;
}) {
  const values = { logo, hero };

  return (
    <div className="glass-card p-5 mb-4">
      <div className="flex items-start gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <ImageIcon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-bold">Brand assets</h2>
          <p className="text-[11px] text-muted-foreground">
            Used at the top of every generated email. Anything left empty is left out — no placeholder is inserted.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {BRAND_ASSETS.map((asset) => (
          <BrandAssetTile
            key={asset.key}
            asset={asset}
            value={values[asset.key]}
            onChange={(url) => onChange({ [asset.field]: url })}
          />
        ))}
      </div>
    </div>
  );
}

/** Per-segment direction card — every field is editable and saved on blur. */
function DirectionCard({
  segmentName,
  direction,
  companyLogo,
  companyHero,
  onSaved,
}: {
  segmentName: string;
  direction: CreativeDirection;
  companyLogo: string;
  companyHero: string;
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

      <div className="pt-3 border-t border-border/60 space-y-3">
        <div className="text-[10px] text-muted-foreground/70">
          Override the brand assets for this segment only — otherwise it uses the company's.
        </div>
        <AssetField
          label="Logo"
          value={draft.logo_url === companyLogo ? "" : draft.logo_url}
          inherited={companyLogo}
          inheritedFrom="company logo"
          onChange={(url) => {
            setDraft((d) => ({ ...d, logo_url: url }));
            void save({ logo_url: url || companyLogo });
          }}
        />
        <AssetField
          label="Hero image"
          value={draft.hero_image_url === companyHero ? "" : draft.hero_image_url}
          inherited={companyHero}
          inheritedFrom="company hero"
          onChange={(url) => {
            setDraft((d) => ({ ...d, hero_image_url: url }));
            void save({ hero_image_url: url || companyHero });
          }}
        />
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
  const { job, start, running } = useJob({
    onDone: refresh,
    successMessage: (j) => `Creative direction ready for ${j.result?.count ?? 0} segments`,
  });
  const [palette, setPalette] = useState<BrandPalette | null>(null);
  const [savingPalette, setSavingPalette] = useState(false);

  useEffect(() => {
    if (state?.brand_palette && !palette) setPalette(state.brand_palette);
  }, [state?.brand_palette, palette]);

  const segments = state?.segments ?? [];
  const directions = state?.creative_directions ?? [];
  const directionBySegment = Object.fromEntries(directions.map((d) => [d.segment_brief_id, d]));
  const companyLogo = state?.company.logo_url ?? "";
  const companyHero = state?.company.hero_image_url ?? "";

  const handleGenerate = () => start(() => generateCreative());

  const saveAsset = async (patch: { logo_url?: string; hero_image_url?: string }) => {
    try {
      await updateCompany(patch);
      await refresh();
      toast.success("Brand asset saved — it will be used in every email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the asset");
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
        <h1 className="text-2xl font-bold tracking-tight">Creative Review</h1>
        <Button onClick={handleGenerate} disabled={running || segments.length === 0} className="gap-2 shrink-0">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {directions.length ? "Regenerate" : "Generate direction"}
        </Button>
      </motion.div>

      <AnimatePresence>
        {job && <ProcessPanel key="progress" job={job} title="Writing creative direction" />}
      </AnimatePresence>

      <BrandAssets
        logo={companyLogo}
        hero={companyHero}
        onChange={saveAsset}
      />

      {/* ── Brand palette ── */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-sm font-bold">Brand palette</h2>
        </div>
        <div className="mb-4" />

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
          No segments yet.
        </div>
      ) : directions.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No creative direction yet.
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
                companyLogo={companyLogo}
                companyHero={companyHero}
                onSaved={refresh}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
