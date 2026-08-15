import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ImageUpload } from "../ImageUpload";
import { ColorPickerField, AlignmentSelect, SizeInput, FieldLabel, ToggleRow } from "./shared";
import { ChevronDown, Lock } from "lucide-react";
import { useState } from "react";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

/**
 * Layout presets define how cells are arranged in rows.
 * Each row is an array of numbers representing relative widths (flex values).
 * Cells are numbered sequentially across all rows.
 */
export interface LayoutPreset {
  id: string;
  label: string;
  rows: number[][];
  totalCells: number;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: "1", label: "1 Column", rows: [[1]], totalCells: 1 },
  { id: "2", label: "2 Columns", rows: [[1, 1]], totalCells: 2 },
  { id: "3", label: "3 Columns", rows: [[1, 1, 1]], totalCells: 3 },
  { id: "4", label: "4 Columns", rows: [[1, 1, 1, 1]], totalCells: 4 },
  { id: "5", label: "5 Columns", rows: [[1, 1, 1, 1, 1]], totalCells: 5 },
  { id: "2-top", label: "2 Col + Full", rows: [[1, 1], [1]], totalCells: 3 },
  { id: "2-bottom", label: "Full + 2 Col", rows: [[1], [1, 1]], totalCells: 3 },
  { id: "1-2-1", label: "1-2-1", rows: [[1], [1, 1], [1]], totalCells: 4 },
  { id: "1-3-1", label: "1-3-1", rows: [[1], [1, 1, 1], [1]], totalCells: 5 },
  { id: "2x2", label: "2×2 Grid", rows: [[1, 1], [1, 1]], totalCells: 4 },
];

export function getLayoutPreset(id: string): LayoutPreset {
  return LAYOUT_PRESETS.find((p) => p.id === id) || LAYOUT_PRESETS[2];
}

/** Mini SVG preview of a layout preset */
function LayoutIcon({ preset, isActive }: { preset: LayoutPreset; isActive: boolean }) {
  const totalRows = preset.rows.length;
  const gapY = 2;
  const gapX = 2;
  const W = 56;
  const H = 36;
  const rowH = (H - gapY * (totalRows - 1)) / totalRows;

  const rects: React.ReactNode[] = [];
  preset.rows.forEach((row, ri) => {
    const y = ri * (rowH + gapY);
    const totalFlex = row.reduce((a, b) => a + b, 0);
    const availW = W - gapX * (row.length - 1);
    let x = 0;
    row.forEach((flex, ci) => {
      const w = (flex / totalFlex) * availW;
      rects.push(
        <rect
          key={`${ri}-${ci}`}
          x={x + 2}
          y={y + 2}
          width={Math.max(w, 3)}
          height={Math.max(rowH, 3)}
          rx={1.5}
          fill={isActive ? "rgba(79,70,229,0.5)" : "rgba(100,116,139,0.2)"}
          stroke={isActive ? "rgba(79,70,229,0.9)" : "rgba(100,116,139,0.5)"}
          strokeWidth={0.6}
        />
      );
      x += w + gapX;
    });
  });

  return (
    <svg viewBox={`0 0 ${W + 4} ${H + 4}`} className="w-full h-full" aria-hidden="true">
      {rects}
    </svg>
  );
}

export function ColumnsBlockEditor({ content, onUpdate }: Props) {
  const layoutId = content.colLayoutPreset || inferLayoutId(content);
  const preset = getLayoutPreset(layoutId);
  const [openCol, setOpenCol] = useState<number>(0);

  const handleLayoutChange = (id: string) => {
    onUpdate("colLayoutPreset", id);
  };

  return (
    <>
      {/* Layout Preset Picker */}
      <div>
        <FieldLabel>Layout</FieldLabel>
        <div className="grid grid-cols-5 gap-1.5 mt-2">
          {LAYOUT_PRESETS.map((p) => {
            const active = layoutId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleLayoutChange(p.id)}
                title={p.label}
                className={`relative flex flex-col items-center gap-0.5 rounded-lg border p-1 transition-all duration-150 ${
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                    : "border-border/50 bg-muted/30 hover:border-primary/30 hover:bg-muted/40"
                }`}
              >
                <div className="w-full h-8">
                  <LayoutIcon preset={p} isActive={active} />
                </div>
                <span className={`text-[8px] leading-tight font-medium truncate w-full text-center ${active ? "text-primary" : "text-muted-foreground/60"}`}>
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global column styling */}
      <div className="flex gap-2.5">
        <AlignmentSelect
          label="Text Align"
          value={content.colTextAlign}
          onChange={(v) => onUpdate("colTextAlign", v)}
          defaultValue="center"
        />
        <SizeInput
          label="Heading Size"
          value={content.colHeadingSize}
          onChange={(v) => onUpdate("colHeadingSize", v)}
          min={12}
          max={32}
          defaultValue="16"
        />
        <SizeInput
          label="Text Size"
          value={content.colTextSize}
          onChange={(v) => onUpdate("colTextSize", v)}
          min={10}
          max={24}
          defaultValue="13"
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <ColorPickerField
          label="Heading Color"
          value={content.colHeadingColor}
          onChange={(c) => onUpdate("colHeadingColor", c)}
          defaultValue="#111827"
        />
        <ColorPickerField
          label="Text Color"
          value={content.colTextColor}
          onChange={(c) => onUpdate("colTextColor", c)}
          defaultValue="#6B7280"
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <ColorPickerField
          label="Cell Background"
          value={content.colBgColor}
          onChange={(c) => onUpdate("colBgColor", c)}
          defaultValue="#f9fafb"
        />
        <ColorPickerField
          label="Border Color"
          value={content.colBorderColor}
          onChange={(c) => onUpdate("colBorderColor", c)}
          defaultValue="#f3f4f6"
        />
      </div>

      {/* Lock horizontal layout on mobile (skip auto-stacking) */}
      <ToggleRow
        id="cols-lock-layout"
        label="Lock layout on mobile"
        description="Keep columns side-by-side instead of stacking"
        icon={<Lock className="h-3 w-3" />}
        checked={content.lockLayout === "true"}
        onCheckedChange={(v) => onUpdate("lockLayout", v ? "true" : "false")}
      />

      {/* Per-cell editors */}
      {Array.from({ length: preset.totalCells }).map((_, i) => {
        const prefix = `col${i + 1}`;
        const isOpen = openCol === i;
        const cellLabel = content[`${prefix}Heading`] || `Column ${i + 1}`;

        return (
          <Collapsible key={i} open={isOpen} onOpenChange={(open) => setOpenCol(open ? i : -1)}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2.5 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors" style={{ background: isOpen ? "hsl(var(--muted))" : "hsl(var(--muted) / 0.5)", border: "1px solid hsl(var(--separator))" }}>
              <Label className="text-[11px] font-semibold text-label-2 cursor-pointer">
                Column {i + 1}
                {content[`${prefix}Heading`] && (
                  <span className="ml-1.5 font-normal text-muted-foreground/60">— {content[`${prefix}Heading`].slice(0, 20)}{(content[`${prefix}Heading`]?.length ?? 0) > 20 ? "…" : ""}</span>
                )}
              </Label>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-2.5 space-y-2 rounded-b-lg" style={{ background: "rgba(255,255,255,0.25)", borderLeft: "1px solid rgba(255,255,255,0.3)", borderRight: "1px solid rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.3)" }}>
                <div>
                  <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Content Order</Label>
                  <Select value={content[`${prefix}Layout`] || "image-first"} onValueChange={(v) => onUpdate(`${prefix}Layout`, v)}>
                    <SelectTrigger className="text-xs h-8 mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image-first">Image → Text → Button</SelectItem>
                      <SelectItem value="text-first">Text → Button → Image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Image</Label>
                  <ImageUpload value={content[`${prefix}ImageUrl`] || ""} onChange={(url) => onUpdate(`${prefix}ImageUrl`, url)} />
                </div>
                {content[`${prefix}ImageUrl`] && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Image Link</Label>
                    <Input value={content[`${prefix}ImageLink`] || ""} onChange={(e) => onUpdate(`${prefix}ImageLink`, e.target.value)} placeholder="https://..." className="text-xs" />
                  </div>
                )}
                <div>
                  <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Heading</Label>
                  <Input value={content[`${prefix}Heading`] || ""} onChange={(e) => onUpdate(`${prefix}Heading`, e.target.value)} placeholder={`Column ${i + 1} heading...`} className="text-xs mt-0.5" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Text</Label>
                  <Textarea value={content[`${prefix}Text`] || ""} onChange={(e) => onUpdate(`${prefix}Text`, e.target.value)} placeholder="Description text..." rows={2} className="text-xs mt-0.5" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Button Text</Label>
                  <Input value={content[`${prefix}ButtonText`] || ""} onChange={(e) => onUpdate(`${prefix}ButtonText`, e.target.value)} placeholder="Optional CTA..." className="text-xs mt-0.5" />
                </div>
                {content[`${prefix}ButtonText`] && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Button URL</Label>
                    <Input value={content[`${prefix}ButtonUrl`] || ""} onChange={(e) => onUpdate(`${prefix}ButtonUrl`, e.target.value)} placeholder="https://..." className="text-xs mt-0.5" />
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </>
  );
}

/** Infer layout ID from legacy columnCount field */
function inferLayoutId(content: Record<string, string>): string {
  const count = content.columnCount || "3";
  // Simple N-column layouts map directly
  if (["1", "2", "3", "4", "5"].includes(count)) return count;
  return "3";
}
