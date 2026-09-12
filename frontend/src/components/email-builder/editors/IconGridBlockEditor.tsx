import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ChevronRight, Lock, Plus, X } from "lucide-react";
import { ImageUpload } from "../ImageUpload";
import { ToggleRow } from "./shared";
import type { IconGridItem } from "@/types/email-builder";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function IconGridBlockEditor({ content, onUpdate }: Props) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  let items: IconGridItem[] = [];
  try { items = JSON.parse(content.items || "[]"); } catch { /* ignore */ }

  const updateItem = (idx: number, field: keyof IconGridItem, value: string | number) => {
    const next = items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    onUpdate("items", JSON.stringify(next));
  };

  const addItem = () => {
    const newItem: IconGridItem = { imageUrl: "", alt: `Icon ${items.length + 1}`, linkUrl: "", size: 50, borderRadius: 8 };
    onUpdate("items", JSON.stringify([...items, newItem]));
    setExpandedItems(new Set([...expandedItems, items.length]));
  };

  const removeItem = (idx: number) => {
    onUpdate("items", JSON.stringify(items.filter((_, i) => i !== idx)));
    const newExpanded = new Set(expandedItems);
    newExpanded.delete(idx);
    setExpandedItems(newExpanded);
  };

  const toggleExpanded = (idx: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(idx)) newExpanded.delete(idx);
    else newExpanded.add(idx);
    setExpandedItems(newExpanded);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">Icons ({items.length})</Label>
        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={addItem}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>

      {/* Lock horizontal layout on mobile (skip auto-wrapping) */}
      <ToggleRow
        id="icon-grid-lock-layout"
        label="Lock layout on mobile"
        description="Keep icons in one row instead of wrapping"
        icon={<Lock className="h-3 w-3" />}
        checked={content.lockLayout === "true"}
        onCheckedChange={(v) => onUpdate("lockLayout", v ? "true" : "false")}
      />

      {items.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">No icons yet</div>
      )}

      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
        {items.map((item, i) => {
          const isExpanded = expandedItems.has(i);
          return (
            <div key={i} className="rounded-lg overflow-hidden border border-border/60" style={{ background: "rgba(255,255,255,0.25)" }}>
              <div className="flex items-center justify-between px-2.5 py-2 cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => toggleExpanded(i)}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {item.imageUrl && (
                    <div className="h-8 w-8 rounded overflow-hidden bg-muted/40 shrink-0" style={{ borderRadius: item.borderRadius || 0 }}>
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-label-2 truncate">{item.label || item.alt || `Icon ${i + 1}`}</p>
                    <p className="text-[10px] text-muted-foreground/60">{item.size}px {item.borderRadius ? `· ${item.borderRadius}px radius` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/60 hover:text-destructive" onClick={(e) => { e.stopPropagation(); removeItem(i); }}>
                    <X className="h-3 w-3" />
                  </Button>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground/60 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="px-2.5 pb-2.5 space-y-2 border-t border-border/40">
                  <ImageUpload value={item.imageUrl} onChange={(url) => updateItem(i, "imageUrl", url)} purpose="block" />
                  {/* Size slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Size</Label>
                      <span className="text-[10px] text-muted-foreground/50 tabular-nums">{item.size}px</span>
                    </div>
                    <Slider
                      value={[item.size]}
                      onValueChange={([v]) => updateItem(i, "size", v)}
                      min={20} max={200} step={2}
                    />
                    <div className="flex gap-1 mt-1.5">
                      {[32, 48, 64, 80, 100, 120].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => updateItem(i, "size", sz)}
                          className={`flex-1 py-1 text-[9px] rounded border transition-colors ${
                            item.size === sz
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-muted/60"
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Border radius slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Radius</Label>
                      <span className="text-[10px] text-muted-foreground/50 tabular-nums">{item.borderRadius ?? 0}px</span>
                    </div>
                    <Slider
                      value={[item.borderRadius ?? 0]}
                      onValueChange={([v]) => updateItem(i, "borderRadius", v)}
                      min={0} max={Math.round(item.size / 2)} step={1}
                    />
                    <div className="flex gap-1 mt-1.5">
                      {[{ label: "Square", val: 0 }, { label: "Rounded", val: 8 }, { label: "Circle", val: Math.round(item.size / 2) }].map(({ label, val }) => (
                        <Button key={label} variant="outline" size="sm" className="h-6 text-[9px] flex-1" onClick={() => updateItem(i, "borderRadius", val)}>{label}</Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Alt Text</Label>
                    <Input value={item.alt} onChange={(e) => updateItem(i, "alt", e.target.value)} placeholder="Alt text..." className="text-xs h-8 mt-1" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Link URL</Label>
                    <Input value={item.linkUrl} onChange={(e) => updateItem(i, "linkUrl", e.target.value)} placeholder="https://..." className="text-xs h-8 mt-1" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
