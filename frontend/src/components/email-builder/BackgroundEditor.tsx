import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { Maximize2, Layers } from "lucide-react";
import type {
  EmailBackground,
  BgType,
  BgPatternType,
  GradientDirection,
  BgPreset,
} from "@/types/email-builder";
import { BG_PRESETS, DEFAULT_BACKGROUND } from "@/types/email-builder";
import { getPatternPreviewSvg } from "./background-patterns";

interface BackgroundEditorProps {
  value: EmailBackground;
  onChange: (bg: EmailBackground) => void;
}

function PresetGrid({ value, onSelect }: { value: EmailBackground; onSelect: (preset: BgPreset) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {BG_PRESETS.map((preset) => {
        const bg = preset.background;
        const isActive =
          value.primaryColor === bg.primaryColor &&
          value.type === bg.type &&
          value.pattern === bg.pattern;

        let style: React.CSSProperties = {};
        if (bg.type === "gradient") {
          const dir = gradientCssDir(bg.gradientDirection);
          style = { background: `linear-gradient(${dir}, ${bg.primaryColor}, ${bg.secondaryColor})` };
        } else if (bg.type === "pattern") {
          style = { backgroundColor: bg.primaryColor };
        } else {
          style = { backgroundColor: bg.primaryColor };
        }

        return (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className={`relative h-12 rounded-lg border-2 transition-all hover:scale-105 active:scale-95 overflow-hidden ${
              isActive ? "border-primary ring-1 ring-primary/30" : "border-transparent hover:border-separator"
            }`}
            style={style}
            title={preset.name}
          >
            {bg.type === "pattern" && bg.pattern !== "none" && (
              <div
                className="absolute inset-0"
                style={{ opacity: bg.patternOpacity / 100 }}
                dangerouslySetInnerHTML={{
                  __html: getPatternPreviewSvg(bg.pattern, bg.secondaryColor, 0.5),
                }}
              />
            )}
            <span className="absolute bottom-0.5 left-0 right-0 text-[8px] font-medium text-center drop-shadow-sm"
              style={{ color: isLightBg(bg.primaryColor) ? "#374151" : "#ffffff" }}
            >
              {preset.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function gradientCssDir(dir: GradientDirection): string {
  const map: Record<GradientDirection, string> = {
    "to-bottom": "to bottom",
    "to-right": "to right",
    "to-bottom-right": "to bottom right",
    "to-top-right": "to top right",
    radial: "to bottom",
  };
  return map[dir] || "to bottom";
}

function isLightBg(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export function BackgroundEditor({ value, onChange }: BackgroundEditorProps) {
  const update = <K extends keyof EmailBackground>(key: K, val: EmailBackground[K]) => {
    onChange({ ...value, [key]: val });
  };

  const isDisabled = value.paddingX === 0 && value.paddingY === 0 && value.contentBorderRadius === 0 && !value.contentShadow && value.primaryColor === value.contentBgColor;

  return (
    <div className="space-y-4">
      {/* ── Layout Mode Toggle ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="grid grid-cols-2 gap-0 p-1">
          <button
            type="button"
            onClick={() => {
              if (isDisabled) onChange({ ...DEFAULT_BACKGROUND });
            }}
            className="relative flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 transition-all duration-200"
          >
            {!isDisabled && (
              <motion.div
                layoutId="bg-mode-indicator"
                className="absolute inset-0 rounded-xl"
                style={{ background: "rgba(79,70,229,0.08)", border: "1.5px solid rgba(79,70,229,0.25)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <div className="relative z-10 h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: !isDisabled ? "rgba(79,70,229,0.12)" : "rgba(0,0,0,0.04)" }}>
              <Layers className="h-4 w-4" style={{ color: !isDisabled ? "#4F46E5" : "#9ca3af" }} />
            </div>
            <span className="relative z-10 text-[11px] font-semibold" style={{ color: !isDisabled ? "#4F46E5" : "#6b7280" }}>
              With Background
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isDisabled) {
                onChange({
                  ...value,
                  primaryColor: "#ffffff",
                  contentBgColor: "#ffffff",
                  contentBorderRadius: 0,
                  contentShadow: false,
                  paddingX: 0,
                  paddingY: 0,
                });
              }
            }}
            className="relative flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 transition-all duration-200"
          >
            {isDisabled && (
              <motion.div
                layoutId="bg-mode-indicator"
                className="absolute inset-0 rounded-xl"
                style={{ background: "rgba(79,70,229,0.08)", border: "1.5px solid rgba(79,70,229,0.25)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <div className="relative z-10 h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: isDisabled ? "rgba(79,70,229,0.12)" : "rgba(0,0,0,0.04)" }}>
              <Maximize2 className="h-4 w-4" style={{ color: isDisabled ? "#4F46E5" : "#9ca3af" }} />
            </div>
            <span className="relative z-10 text-[11px] font-semibold" style={{ color: isDisabled ? "#4F46E5" : "#6b7280" }}>
              Full Width
            </span>
          </button>
        </div>
        <div className="px-3 pb-2.5">
          <p className="text-[10px] text-center text-muted-foreground/60">
            {isDisabled ? "No card wrapper — content fills the full 600px email width" : "Email content is wrapped in a styled card with background"}
          </p>
        </div>
      </div>

      {/* Presets */}
      <div>
        <Label className="text-xs font-semibold mb-2 block">Quick Presets</Label>
        <PresetGrid value={value} onSelect={(p) => onChange({ ...p.background })} />
      </div>

      <Separator />

      {/* Background Type */}
      <div>
        <Label className="text-xs">Background Type</Label>
        <Select value={value.type} onValueChange={(v) => update("type", v as BgType)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid Color</SelectItem>
            <SelectItem value="gradient">Gradient</SelectItem>
            <SelectItem value="pattern">Pattern</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Colors */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Label className="text-xs">{value.type === "gradient" ? "Start Color" : "Background Color"}</Label>
          <div className="flex gap-1.5 mt-1">
            <Input
              type="color"
              value={value.primaryColor}
              onChange={(e) => update("primaryColor", e.target.value)}
              className="h-9 w-12 p-0.5 cursor-pointer"
            />
            <Input
              value={value.primaryColor}
              onChange={(e) => update("primaryColor", e.target.value)}
              className="flex-1 text-xs h-9"
            />
          </div>
        </div>
        {(value.type === "gradient" || value.type === "pattern") && (
          <div className="flex-1">
            <Label className="text-xs">{value.type === "gradient" ? "End Color" : "Pattern Color"}</Label>
            <div className="flex gap-1.5 mt-1">
              <Input
                type="color"
                value={value.secondaryColor}
                onChange={(e) => update("secondaryColor", e.target.value)}
                className="h-9 w-12 p-0.5 cursor-pointer"
              />
              <Input
                value={value.secondaryColor}
                onChange={(e) => update("secondaryColor", e.target.value)}
                className="flex-1 text-xs h-9"
              />
            </div>
          </div>
        )}
      </div>

      {/* M1 color quick-pick */}
      <div>
        <Label className="text-xs mb-1.5 block">Company Brand Colors</Label>
        <div className="flex gap-1.5">
          {[
            { color: "#C2703D", label: "Orange" },
            { color: "#FFFFFF", label: "White" },
            { color: "#000000", label: "Black" },
            { color: "#808080", label: "Grey" },
          ].map(({ color, label }) => (
            <button
              key={color}
              onClick={() => update("primaryColor", color)}
              className="h-7 w-7 rounded-md border border-separator hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              title={`M1 ${label} (${color})`}
            />
          ))}
        </div>
      </div>

      {/* Gradient Direction */}
      {value.type === "gradient" && (
        <div>
          <Label className="text-xs">Gradient Direction</Label>
          <Select value={value.gradientDirection} onValueChange={(v) => update("gradientDirection", v as GradientDirection)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="to-bottom">Top to Bottom</SelectItem>
              <SelectItem value="to-right">Left to Right</SelectItem>
              <SelectItem value="to-bottom-right">Diagonal (Top-Left to Bottom-Right)</SelectItem>
              <SelectItem value="to-top-right">Diagonal (Bottom-Left to Top-Right)</SelectItem>
              <SelectItem value="radial">Radial (Center Out)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Pattern Settings */}
      {value.type === "pattern" && (
        <>
          <div>
            <Label className="text-xs">Pattern Style</Label>
            <Select value={value.pattern} onValueChange={(v) => update("pattern", v as BgPatternType)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="waves">Waves</SelectItem>
                <SelectItem value="dots">Dots</SelectItem>
                <SelectItem value="diagonal-lines">Diagonal Lines</SelectItem>
                <SelectItem value="hexagons">Hexagons</SelectItem>
                <SelectItem value="topography">Topography</SelectItem>
                <SelectItem value="circles">Circles</SelectItem>
                <SelectItem value="diamonds">Diamonds</SelectItem>
                <SelectItem value="cross-hatch">Cross Hatch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">Pattern Opacity</Label>
              <span className="text-xs text-muted-foreground">{value.patternOpacity}%</span>
            </div>
            <Slider
              value={[value.patternOpacity]}
              onValueChange={([v]) => update("patternOpacity", v)}
              min={2}
              max={60}
              step={1}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">Pattern Scale</Label>
              <span className="text-xs text-muted-foreground">{value.patternScale.toFixed(1)}x</span>
            </div>
            <Slider
              value={[value.patternScale * 10]}
              onValueChange={([v]) => update("patternScale", v / 10)}
              min={5}
              max={30}
              step={1}
            />
          </div>
        </>
      )}

      <Separator />

      {/* Content Card Settings */}
      <div>
        <Label className="text-xs font-semibold mb-2 block">Email Card</Label>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Card Background</Label>
            <div className="flex gap-1.5 mt-1">
              <Input
                type="color"
                value={value.contentBgColor}
                onChange={(e) => update("contentBgColor", e.target.value)}
                className="h-9 w-12 p-0.5 cursor-pointer"
              />
              <Input
                value={value.contentBgColor}
                onChange={(e) => update("contentBgColor", e.target.value)}
                className="flex-1 text-xs h-9"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">Corner Radius</Label>
              <span className="text-xs text-muted-foreground">{value.contentBorderRadius}px</span>
            </div>
            <Slider
              value={[value.contentBorderRadius]}
              onValueChange={([v]) => update("contentBorderRadius", v)}
              min={0}
              max={32}
              step={1}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Card Shadow</Label>
            <Switch
              checked={value.contentShadow}
              onCheckedChange={(v) => update("contentShadow", v)}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs">Padding X</Label>
                <span className="text-xs text-muted-foreground">{value.paddingX}px</span>
              </div>
              <Slider
                value={[value.paddingX]}
                onValueChange={([v]) => update("paddingX", v)}
                min={0}
                max={80}
                step={4}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs">Padding Y</Label>
                <span className="text-xs text-muted-foreground">{value.paddingY}px</span>
              </div>
              <Slider
                value={[value.paddingY]}
                onValueChange={([v]) => update("paddingY", v)}
                min={0}
                max={80}
                step={4}
              />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
