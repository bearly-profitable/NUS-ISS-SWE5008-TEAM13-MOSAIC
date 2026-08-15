import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Braces } from "lucide-react";
import { ColorPickerField, AlignmentSelect, SizeInput, FieldLabel } from "./shared";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function HeadingBlockEditor({ content, onUpdate }: Props) {
  const headingInputRef = useRef<HTMLInputElement>(null);

  const insertVariable = (token: string) => {
    const el = headingInputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? (content.text || "").length;
    const end = el.selectionEnd ?? start;
    const val = content.text || "";
    onUpdate("text", val.slice(0, start) + token + val.slice(end));
    setTimeout(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); }, 0);
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <FieldLabel>Heading Text</FieldLabel>
          <div className="flex items-center gap-0.5">
            {["%%name%%", "%%email%%"].map((token) => (
              <button
                key={token}
                type="button"
                className="h-5 px-1.5 text-[10px] font-mono font-semibold text-primary/70 hover:text-primary hover:bg-primary/10 rounded flex items-center gap-0.5 transition-colors"
                title={`Insert ${token}`}
                onClick={() => insertVariable(token)}
              >
                <Braces className="h-2.5 w-2.5 mr-0.5" />{token.slice(2, -2)}
              </button>
            ))}
          </div>
        </div>
        <Input
          ref={headingInputRef}
          value={content.text || ""}
          onChange={(e) => onUpdate("text", e.target.value)}
          className="text-xs"
        />
      </div>
      <div className="flex gap-2.5">
        <AlignmentSelect
          value={content.align}
          onChange={(v) => onUpdate("align", v)}
        />
        <SizeInput
          label="Size"
          value={content.size}
          onChange={(v) => onUpdate("size", v)}
          min={12}
          max={48}
          defaultValue="24"
        />
      </div>
      <ColorPickerField
        label="Color"
        value={content.color}
        onChange={(c) => onUpdate("color", c)}
        defaultValue="#111827"
      />
    </>
  );
}
