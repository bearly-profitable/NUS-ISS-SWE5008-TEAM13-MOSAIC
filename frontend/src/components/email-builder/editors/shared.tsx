import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";

/** Reusable color picker + hex input combo (used 8+ times across block editors). */
export function ColorPickerField({
  label,
  value,
  onChange,
  defaultValue = "#000000",
}: {
  label: string;
  value: string | undefined;
  onChange: (color: string) => void;
  defaultValue?: string;
}) {
  const color = value || defaultValue;
  return (
    <div>
      <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">{label}</Label>
      <div className="flex gap-2 mt-1.5">
        <Input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 p-1 cursor-pointer rounded-lg"
        />
        <Input
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-xs"
          placeholder={defaultValue}
        />
      </div>
    </div>
  );
}

/** Reusable left/center/right alignment select (used 4+ times). */
export function AlignmentSelect({
  label = "Alignment",
  value,
  onChange,
  defaultValue = "left",
}: {
  label?: string;
  value: string | undefined;
  onChange: (align: string) => void;
  defaultValue?: string;
}) {
  return (
    <div className="flex-1">
      <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">{label}</Label>
      <Select value={value || defaultValue} onValueChange={onChange}>
        <SelectTrigger className="mt-1.5 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Left</SelectItem>
          <SelectItem value="center">Center</SelectItem>
          <SelectItem value="right">Right</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/** Reusable number input with label, min/max (used for sizes, padding, etc). */
export function SizeInput({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  defaultValue = "0",
  className = "w-20",
}: {
  label: string;
  value: string | undefined;
  onChange: (val: string) => void;
  min?: number;
  max?: number;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">{label}</Label>
      <Input
        type="number"
        value={value || defaultValue}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 text-xs"
        min={min}
        max={max}
      />
    </div>
  );
}

/** Standard label style used for block editor fields. */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
      {children}
    </Label>
  );
}

/**
 * Modern toggle row matching the "Dynamic Content" toggle aesthetic:
 * the whole row is a clickable button with an animated pill on the right.
 * Optional icon and description support a header-style or compact-row use.
 *
 * `accentColor` controls the active pill / tint color. `accentColorRgb`
 * is the same color expressed as `r,g,b` so we can build subtle alpha tints
 * for the background and border without coupling to Tailwind config.
 */
export function ToggleRow({
  label,
  description,
  icon,
  checked,
  onCheckedChange,
  accentColor = "#4F46E5",
  accentColorRgb = "249,115,22",
  id,
}: {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  accentColor?: string;
  accentColorRgb?: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onCheckedChange(!checked)}
      className="flex items-center gap-2.5 w-full rounded-lg border px-2.5 py-2 cursor-pointer select-none transition-colors duration-150"
      style={{
        background: checked ? `rgba(${accentColorRgb},0.06)` : "rgba(255,255,255,0.15)",
        borderColor: checked ? `rgba(${accentColorRgb},0.25)` : "rgba(0,0,0,0.05)",
      }}
    >
      {icon && (
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-md transition-colors duration-200"
          style={{
            width: 24,
            height: 24,
            background: checked ? `rgba(${accentColorRgb},0.12)` : "rgba(0,0,0,0.04)",
            color: checked ? accentColor : "#9ca3af",
          }}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0 text-left">
        <div className="text-[11px] font-semibold leading-tight" style={{ color: "#374151" }}>
          {label}
        </div>
        {description && (
          <div className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5 truncate">
            {description}
          </div>
        )}
      </div>
      <div
        className="relative flex-shrink-0 rounded-full transition-colors duration-200"
        style={{
          width: 28,
          height: 16,
          background: checked ? accentColor : "#d1d5db",
          padding: 2,
        }}
      >
        <motion.div
          className="rounded-full"
          style={{ width: 12, height: 12, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
          animate={{ x: checked ? 12 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </div>
    </button>
  );
}
