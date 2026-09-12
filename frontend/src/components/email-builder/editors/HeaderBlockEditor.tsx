import { ImageUpload } from "../ImageUpload";
import { ColorPickerField, FieldLabel } from "./shared";
import { Slider } from "@/components/ui/slider";
import { Layers } from "lucide-react";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function HeaderBlockEditor({ content, onUpdate }: Props) {
  const logoHeight = parseInt(content.logoHeight || "56");

  return (
    <>
      <div>
        <FieldLabel>Logo</FieldLabel>
        <div className="mt-1.5">
          <ImageUpload
            value={content.logoUrl || ""}
            onChange={(url) => onUpdate("logoUrl", url)}
            purpose="logo"
          />
        </div>
      </div>

      {/* Floating toggle — disabled, use Hero Image instead */}
      <div className="pt-1">
        <div
          className="flex items-center gap-3 w-full rounded-lg border px-3 py-2.5 select-none opacity-50"
          style={{ background: "transparent", borderColor: "rgba(0,0,0,0.06)" }}
        >
          <div
            className="flex items-center justify-center rounded-md"
            style={{ width: 28, height: 28, background: "#f3f4f6", flexShrink: 0 }}
          >
            <Layers style={{ width: 14, height: 14, color: "#9ca3af" }} />
          </div>
          <div className="flex-1 text-left">
            <span className="text-[12px] font-medium" style={{ color: "#9ca3af" }}>
              Floating Logo
            </span>
            <span className="text-[10px] text-muted-foreground/50 block mt-0.5">Disabled</span>
          </div>
        </div>
        <div className="mt-2 rounded-lg border border-blue-500/15 bg-blue-500/5 px-3 py-2">
          <p className="text-[10px] text-label-2 leading-relaxed">
            <strong className="text-label-1">Want a floating logo?</strong>{" "}
            Add it as an overlay in the <strong>Hero Image</strong> block instead. It will be merged into the hero on export, ensuring it displays correctly in all email clients (Gmail, Outlook, etc).
          </p>
        </div>
      </div>

      {/* Static logo controls */}
      <div className="space-y-3">
        <ColorPickerField
          label="Background Color"
          value={content.bgColor}
          onChange={(c) => onUpdate("bgColor", c)}
          defaultValue="#ffffff"
        />
        <div>
          <div className="flex items-center justify-between">
            <FieldLabel>Logo Size</FieldLabel>
            <span className="text-xs text-muted-foreground tabular-nums">{logoHeight}px</span>
          </div>
          <Slider
            min={20}
            max={120}
            step={2}
            value={[logoHeight]}
            onValueChange={([v]) => onUpdate("logoHeight", String(v))}
            className="mt-1.5"
          />
        </div>
      </div>
    </>
  );
}
