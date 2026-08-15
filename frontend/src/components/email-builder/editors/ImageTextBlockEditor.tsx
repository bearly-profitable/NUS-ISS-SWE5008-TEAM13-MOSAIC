import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "../ImageUpload";
import { ColorPickerField, FieldLabel } from "./shared";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function ImageTextBlockEditor({ content, onUpdate }: Props) {
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
          <FieldLabel>Position</FieldLabel>
          <Select value={content.imagePosition || "left"} onValueChange={(v) => onUpdate("imagePosition", v)}>
            <SelectTrigger className="mt-1.5 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <FieldLabel>Vertical Align</FieldLabel>
          <Select value={content.verticalAlign || "center"} onValueChange={(v) => onUpdate("verticalAlign", v)}>
            <SelectTrigger className="mt-1.5 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <FieldLabel>Alt Text</FieldLabel>
        <Input value={content.alt || ""} onChange={(e) => onUpdate("alt", e.target.value)} className="mt-1.5 text-xs" placeholder="Describe the image for accessibility..." />
      </div>
      <div>
        <FieldLabel>Heading</FieldLabel>
        <Input value={content.heading || ""} onChange={(e) => onUpdate("heading", e.target.value)} className="mt-1.5 text-xs" />
      </div>
      <div>
        <FieldLabel>Text</FieldLabel>
        <Textarea value={content.text || ""} onChange={(e) => onUpdate("text", e.target.value)} rows={3} className="mt-1.5 text-xs" />
      </div>
      <div className="flex gap-2.5">
        <ColorPickerField label="Heading Color" value={content.headingColor} onChange={(c) => onUpdate("headingColor", c)} defaultValue="#111827" />
        <ColorPickerField label="Text Color" value={content.textColor} onChange={(c) => onUpdate("textColor", c)} defaultValue="#6B7280" />
      </div>
      <div className="flex gap-2.5">
        <div className="flex-1">
          <FieldLabel>Button Text</FieldLabel>
          <Input value={content.buttonText || ""} onChange={(e) => onUpdate("buttonText", e.target.value)} className="mt-1.5 text-xs" placeholder="Optional" />
        </div>
        <div className="flex-1">
          <FieldLabel>Button URL</FieldLabel>
          <Input value={content.buttonUrl || ""} onChange={(e) => onUpdate("buttonUrl", e.target.value)} className="mt-1.5 text-xs" placeholder="https://..." />
        </div>
      </div>
    </>
  );
}
