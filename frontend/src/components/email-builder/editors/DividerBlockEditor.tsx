import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { FieldLabel } from "./shared";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function DividerBlockEditor({ content, onUpdate }: Props) {
  const thickness = parseInt(content.thickness || "1");
  const widthPct = parseInt(content.widthPercent || "100");
  const marginTop = parseInt(content.marginTop || "16");
  const marginBottom = parseInt(content.marginBottom || "16");

  return (
    <>
      {/* Live preview */}
      <div className="flex justify-center py-3 px-4 rounded-lg bg-muted/50">
        <hr
          style={{
            width: `${widthPct}%`,
            borderTop: `${thickness}px ${content.style || "solid"} ${content.color || "#e5e7eb"}`,
            borderBottom: "none",
            borderLeft: "none",
            borderRight: "none",
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <FieldLabel>Color</FieldLabel>
          <div className="flex gap-2 mt-1.5">
            <Input
              type="color"
              value={content.color || "#e5e7eb"}
              onChange={(e) => onUpdate("color", e.target.value)}
              className="h-9 w-12 p-1 cursor-pointer rounded-lg shrink-0"
            />
            <Input
              value={content.color || "#e5e7eb"}
              onChange={(e) => onUpdate("color", e.target.value)}
              className="flex-1 text-xs font-mono"
              placeholder="#e5e7eb"
            />
          </div>
        </div>
        <div>
          <FieldLabel>Style</FieldLabel>
          <Select value={content.style || "solid"} onValueChange={(v) => onUpdate("style", v)}>
            <SelectTrigger className="mt-1.5 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="dashed">Dashed</SelectItem>
              <SelectItem value="dotted">Dotted</SelectItem>
              <SelectItem value="double">Double</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Thickness */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">Thickness</Label>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">{thickness}px</span>
        </div>
        <Slider
          value={[thickness]}
          onValueChange={([v]) => onUpdate("thickness", String(v))}
          min={1}
          max={8}
          step={1}
        />
      </div>

      {/* Width */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">Width</Label>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">{widthPct}%</span>
        </div>
        <Slider
          value={[widthPct]}
          onValueChange={([v]) => onUpdate("widthPercent", String(v))}
          min={10}
          max={100}
          step={5}
        />
      </div>

      {/* Margin */}
      <div className="flex gap-2.5">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Margin Top</Label>
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">{marginTop}px</span>
          </div>
          <Slider
            value={[marginTop]}
            onValueChange={([v]) => onUpdate("marginTop", String(v))}
            min={0}
            max={60}
            step={2}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Margin Bottom</Label>
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">{marginBottom}px</span>
          </div>
          <Slider
            value={[marginBottom]}
            onValueChange={([v]) => onUpdate("marginBottom", String(v))}
            min={0}
            max={60}
            step={2}
          />
        </div>
      </div>
    </>
  );
}
