import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function SpacerBlockEditor({ content, onUpdate }: Props) {
  const height = parseInt(content.height || "40");
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">Height</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{height}px</span>
      </div>
      <Slider
        value={[height]}
        onValueChange={([v]) => onUpdate("height", String(v))}
        min={8}
        max={120}
        step={4}
      />
    </div>
  );
}
