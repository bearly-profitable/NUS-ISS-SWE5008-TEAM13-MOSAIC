import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPickerField, SizeInput, FieldLabel } from "./shared";
import { Plus, Trash2, GripVertical, ChevronDown } from "lucide-react";
import type { AccordionItem } from "@/types/email-builder";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function AccordionBlockEditor({ content, onUpdate }: Props) {
  let items: AccordionItem[] = [];
  try { items = JSON.parse(content.items || "[]"); } catch { /* ignore */ }

  const updateItems = (newItems: AccordionItem[]) => {
    onUpdate("items", JSON.stringify(newItems));
  };

  const addItem = () => {
    updateItems([...items, { id: generateId(), question: "New Question", answer: "Answer goes here..." }]);
  };

  const removeItem = (id: string) => {
    updateItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: "question" | "answer", value: string) => {
    updateItems(items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  return (
    <>
      {/* Live preview */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: content.borderColor || "#C2703D" }}>
        {items.slice(0, 2).map((item, i) => (
          <div key={item.id}>
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{
                backgroundColor: content.headerBgColor || "#C2703D",
                color: content.headerTextColor || "#ffffff",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <span>{item.question}</span>
              <ChevronDown className="h-3 w-3" />
            </div>
            {i === 0 && (
              <div
                className="px-3 py-2"
                style={{
                  backgroundColor: content.bodyBgColor || "#FFF8F0",
                  color: content.bodyTextColor || "#374151",
                  fontSize: 11,
                }}
              >
                {item.answer}
              </div>
            )}
          </div>
        ))}
        {items.length > 2 && (
          <div className="text-center py-1 text-[10px] text-muted-foreground/50">
            +{items.length - 2} more items
          </div>
        )}
      </div>

      {/* FAQ Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <FieldLabel>FAQ Items ({items.length})</FieldLabel>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={addItem}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>

        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-separator p-2.5 space-y-2" style={{ background: "rgba(255,255,255,0.3)" }}>
            <div className="flex items-center gap-2">
              <GripVertical className="h-3 w-3 text-muted-foreground/30 shrink-0" />
              <Input
                value={item.question}
                onChange={(e) => updateItem(item.id, "question", e.target.value)}
                className="flex-1 text-xs font-semibold h-7"
                placeholder="Question"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/50 hover:text-destructive shrink-0"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Textarea
              value={item.answer}
              onChange={(e) => updateItem(item.id, "answer", e.target.value)}
              className="text-xs min-h-[48px] resize-none"
              placeholder="Answer"
              rows={2}
            />
          </div>
        ))}
      </div>

      {/* Styling */}
      <div className="flex gap-2.5">
        <ColorPickerField label="Header BG" value={content.headerBgColor} onChange={(c) => onUpdate("headerBgColor", c)} defaultValue="#C2703D" />
        <ColorPickerField label="Header Text" value={content.headerTextColor} onChange={(c) => onUpdate("headerTextColor", c)} defaultValue="#ffffff" />
      </div>
      <div className="flex gap-2.5">
        <ColorPickerField label="Body BG" value={content.bodyBgColor} onChange={(c) => onUpdate("bodyBgColor", c)} defaultValue="#FFF8F0" />
        <ColorPickerField label="Body Text" value={content.bodyTextColor} onChange={(c) => onUpdate("bodyTextColor", c)} defaultValue="#374151" />
      </div>
      <div className="flex gap-2.5">
        <ColorPickerField label="Border" value={content.borderColor} onChange={(c) => onUpdate("borderColor", c)} defaultValue="#C2703D" />
        <SizeInput label="Radius" value={content.borderRadius} onChange={(v) => onUpdate("borderRadius", v)} min={0} max={24} defaultValue="8" />
      </div>
      <div>
        <FieldLabel>Icon Style</FieldLabel>
        <Select value={content.iconStyle || "chevron"} onValueChange={(v) => onUpdate("iconStyle", v)}>
          <SelectTrigger className="mt-1.5 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="chevron">Chevron ▼</SelectItem>
            <SelectItem value="plus">Plus +/−</SelectItem>
            <SelectItem value="arrow">Arrow →</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
