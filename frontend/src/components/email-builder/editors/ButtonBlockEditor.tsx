import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPickerField, AlignmentSelect, FieldLabel } from "./shared";
import { Zap } from "lucide-react";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

const DYNAMIC_LINK_PLACEHOLDER = "%%PROMO_LINK%%";

export function ButtonBlockEditor({ content, onUpdate }: Props) {
  const url = content.url || "";
  const isDynamicLink = url === DYNAMIC_LINK_PLACEHOLDER;

  return (
    <>
      {/* Dynamic promo link indicator */}
      {isDynamicLink && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-amber-600">Dynamic Promo Link</p>
            <p className="text-[10px] text-label-3 leading-relaxed mt-0.5">
              This button URL will be replaced with a unique promo link per recipient at send time.
              Connect a Promo node in your journey to supply the links.
            </p>
          </div>
        </div>
      )}

      <div>
        <FieldLabel>Button Text</FieldLabel>
        <Input value={content.text || ""} onChange={(e) => onUpdate("text", e.target.value)} className="mt-1.5 text-xs" />
      </div>
      <div>
        <FieldLabel>URL</FieldLabel>
        <Input
          value={url}
          onChange={(e) => onUpdate("url", e.target.value)}
          className="mt-1.5 text-xs"
          placeholder="https://..."
        />
        {!isDynamicLink && (
          <button
            type="button"
            onClick={() => onUpdate("url", DYNAMIC_LINK_PLACEHOLDER)}
            className="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-600 hover:text-amber-500 transition-colors"
          >
            <Zap className="w-3 h-3" />
            Use dynamic promo link from Promo node
          </button>
        )}
        {isDynamicLink && (
          <button
            type="button"
            onClick={() => onUpdate("url", "")}
            className="mt-1.5 flex items-center gap-1.5 text-[10px] text-label-3 hover:text-foreground/60 transition-colors"
          >
            Switch to static URL
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <ColorPickerField label="Button Color" value={content.color} onChange={(c) => onUpdate("color", c)} defaultValue="#4F46E5" />
        <ColorPickerField label="Text Color" value={content.textColor} onChange={(c) => onUpdate("textColor", c)} defaultValue="#ffffff" />
      </div>
      <div className="flex gap-2.5">
        <div className="flex-1">
          <FieldLabel>Style</FieldLabel>
          <Select value={content.style || "filled"} onValueChange={(v) => onUpdate("style", v)}>
            <SelectTrigger className="mt-1.5 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="filled">Filled</SelectItem>
              <SelectItem value="outline">Outline</SelectItem>
              <SelectItem value="rounded">Pill / Rounded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <FieldLabel>Size</FieldLabel>
          <Select value={content.size || "medium"} onValueChange={(v) => onUpdate("size", v)}>
            <SelectTrigger className="mt-1.5 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AlignmentSelect
          label="Align"
          value={content.align}
          onChange={(v) => onUpdate("align", v)}
          defaultValue="center"
        />
      </div>
    </>
  );
}
