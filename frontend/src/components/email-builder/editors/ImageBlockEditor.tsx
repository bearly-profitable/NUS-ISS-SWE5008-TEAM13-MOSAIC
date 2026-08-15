import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "../ImageUpload";
import { AlignmentSelect, FieldLabel } from "./shared";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function ImageBlockEditor({ content, onUpdate }: Props) {
  const radius = parseInt(content.borderRadius ?? "8");

  // Derive widthMode from the actual width value for consistency
  const widthMode = (() => {
    const stored = content.widthMode;
    if (stored) return stored;
    // Infer from width value if widthMode was never set
    const w = content.width || "";
    if (!w || w === "auto") return "auto";
    if (w === "100%") return "full";
    if (w.endsWith("px")) return "px";
    return "auto";
  })();

  const handleWidthModeChange = (v: string) => {
    onUpdate("widthMode", v);
    if (v === "auto") onUpdate("width", "");
    else if (v === "full") onUpdate("width", "100%");
    else if (v === "px") onUpdate("width", "300px");
  };

  return (
    <>
      <div>
        <FieldLabel>Image</FieldLabel>
        <div className="mt-1.5">
          <ImageUpload value={content.imageUrl || ""} onChange={(url) => onUpdate("imageUrl", url)} />
        </div>
      </div>
      <div className="flex gap-2.5">
        <div className="flex-1">
          <FieldLabel>Alt Text</FieldLabel>
          <Input value={content.alt || ""} onChange={(e) => onUpdate("alt", e.target.value)} className="mt-1.5 text-xs" placeholder="Describe the image..." />
        </div>
        <div className="flex-1">
          <FieldLabel>Link URL</FieldLabel>
          <Input value={content.linkUrl || ""} onChange={(e) => onUpdate("linkUrl", e.target.value)} className="mt-1.5 text-xs" placeholder="https://..." />
        </div>
      </div>
      <div className="flex gap-2.5">
        <div className="flex-1">
          <FieldLabel>Width</FieldLabel>
          <Select value={widthMode} onValueChange={handleWidthModeChange}>
            <SelectTrigger className="mt-1.5 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (original)</SelectItem>
              <SelectItem value="full">Full width (100%)</SelectItem>
              <SelectItem value="px">Custom px</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AlignmentSelect label="Alignment" value={content.align} onChange={(v) => onUpdate("align", v)} defaultValue="left" />
      </div>
      {/* Custom width slider */}
      {widthMode === "px" && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">Width</Label>
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">{content.width?.replace("px", "") || "300"}px</span>
          </div>
          <Slider
            value={[parseInt(content.width?.replace("px", "") || "300", 10)]}
            onValueChange={([v]) => onUpdate("width", `${v}px`)}
            min={50} max={600} step={5}
          />
        </div>
      )}
      {/* Border radius */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">Corner Radius</Label>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">{radius}px</span>
        </div>
        <Slider
          value={[radius]}
          onValueChange={([v]) => onUpdate("borderRadius", String(v))}
          min={0} max={50} step={1}
        />
      </div>
    </>
  );
}
