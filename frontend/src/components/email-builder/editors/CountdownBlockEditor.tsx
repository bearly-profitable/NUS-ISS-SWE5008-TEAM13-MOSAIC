import { Input } from "@/components/ui/input";
import { ColorPickerField, FieldLabel } from "./shared";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function CountdownBlockEditor({ content, onUpdate }: Props) {
  return (
    <>
      <div>
        <FieldLabel>Target Date & Time</FieldLabel>
        <Input
          type="datetime-local"
          value={content.targetDate || ""}
          onChange={(e) => onUpdate("targetDate", e.target.value)}
          className="mt-1.5 text-xs"
        />
      </div>
      <div>
        <FieldLabel>Label</FieldLabel>
        <Input
          value={content.label || ""}
          onChange={(e) => onUpdate("label", e.target.value)}
          className="mt-1.5 text-xs"
          placeholder="Offer ends in"
        />
      </div>
      <div className="flex gap-2.5">
        <ColorPickerField label="Background" value={content.bgColor} onChange={(c) => onUpdate("bgColor", c)} defaultValue="#C2703D" />
        <ColorPickerField label="Text Color" value={content.textColor} onChange={(c) => onUpdate("textColor", c)} defaultValue="#ffffff" />
      </div>
    </>
  );
}
