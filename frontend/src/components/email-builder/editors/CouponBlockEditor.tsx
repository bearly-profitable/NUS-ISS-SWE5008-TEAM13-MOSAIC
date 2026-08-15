import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPickerField, AlignmentSelect, SizeInput, FieldLabel } from "./shared";
import { Zap } from "lucide-react";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

const DYNAMIC_PLACEHOLDER = "%%PROMO_CODE%%";

export function CouponBlockEditor({ content, onUpdate }: Props) {
  const code = content.code || "";
  const isDynamic = code === DYNAMIC_PLACEHOLDER;

  return (
    <>
      {/* Dynamic promo indicator */}
      {isDynamic && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-amber-600">Dynamic Promo Code</p>
            <p className="text-[10px] text-label-3 leading-relaxed mt-0.5">
              This code will be replaced with a unique promo code per recipient at send time.
              Connect a Promo node in your journey to supply the codes.
            </p>
          </div>
        </div>
      )}

      {/* Live coupon preview */}
      {code && (
        <div
          className="rounded-xl border-2 border-dashed p-4 text-center"
          style={{
            borderColor: content.borderColor || content.textColor || "#C2703D",
            backgroundColor: content.bgColor || "#FFF8F0",
          }}
        >
          {content.label && (
            <p className="text-xs text-muted-foreground mb-1.5">{content.label}</p>
          )}
          <span
            className="text-lg font-mono font-bold tracking-[0.2em]"
            style={{ color: content.textColor || "#C2703D" }}
          >
            {isDynamic ? "ABC123XYZ" : code}
          </span>
          {isDynamic && (
            <p className="text-[9px] text-label-4 mt-1.5 italic">Preview — actual code varies per recipient</p>
          )}
        </div>
      )}

      <div>
        <FieldLabel>Coupon Code</FieldLabel>
        <Input
          value={code}
          onChange={(e) => onUpdate("code", e.target.value.toUpperCase())}
          className="mt-1.5 text-sm font-mono font-bold tracking-widest"
          placeholder="SAVE20"
        />
        {!isDynamic && (
          <button
            type="button"
            onClick={() => onUpdate("code", DYNAMIC_PLACEHOLDER)}
            className="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-600 hover:text-amber-500 transition-colors"
          >
            <Zap className="w-3 h-3" />
            Use dynamic promo code from Promo node
          </button>
        )}
        {isDynamic && (
          <button
            type="button"
            onClick={() => onUpdate("code", "")}
            className="mt-1.5 flex items-center gap-1.5 text-[10px] text-label-3 hover:text-foreground/60 transition-colors"
          >
            Switch to static code
          </button>
        )}
      </div>
      <div>
        <FieldLabel>Label Text</FieldLabel>
        <Input
          value={content.label || ""}
          onChange={(e) => onUpdate("label", e.target.value)}
          className="mt-1.5 text-xs"
          placeholder="Use code at checkout"
        />
      </div>
      <div className="flex gap-2.5">
        <ColorPickerField label="Background" value={content.bgColor} onChange={(c) => onUpdate("bgColor", c)} defaultValue="#FFF8F0" />
        <ColorPickerField label="Code Color" value={content.textColor} onChange={(c) => onUpdate("textColor", c)} defaultValue="#C2703D" />
      </div>
      <div className="flex gap-2.5">
        <ColorPickerField label="Border Color" value={content.borderColor} onChange={(c) => onUpdate("borderColor", c)} defaultValue="#C2703D" />
        <div className="flex-1">
          <FieldLabel>Border Style</FieldLabel>
          <Select value={content.borderStyle || "dashed"} onValueChange={(v) => onUpdate("borderStyle", v)}>
            <SelectTrigger className="mt-1.5 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dashed">Dashed</SelectItem>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="dotted">Dotted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2.5">
        <SizeInput label="Code Size" value={content.codeSize} onChange={(v) => onUpdate("codeSize", v)} min={14} max={40} defaultValue="22" />
        <AlignmentSelect label="Align" value={content.align} onChange={(v) => onUpdate("align", v)} defaultValue="center" />
      </div>
    </>
  );
}
