import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { ColorPickerField, FieldLabel, SizeInput } from "./shared";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function TableBlockEditor({ content, onUpdate }: Props) {
  let rows: string[][] = [];
  try { rows = JSON.parse(content.rows || "[]"); } catch { /* ignore */ }
  const cols = parseInt(content.columns || "3");

  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    const next = rows.map((row, ri) => ri === rowIdx ? row.map((cell, ci) => ci === colIdx ? value : cell) : [...row]);
    onUpdate("rows", JSON.stringify(next));
  };

  const addRow = () => {
    const newRow = Array.from({ length: cols }, () => "");
    onUpdate("rows", JSON.stringify([...rows, newRow]));
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    onUpdate("rows", JSON.stringify(rows.filter((_, i) => i !== idx)));
  };

  const handleColumnsChange = (newCols: string) => {
    const n = Math.max(2, Math.min(6, parseInt(newCols) || 2));
    // Adjust existing rows to match column count, then update both at once
    const adjusted = rows.map((row) => {
      if (row.length < n) return [...row, ...Array(n - row.length).fill("")];
      return row.slice(0, n);
    });
    // Update columns first, then rows in a single batch via setTimeout to avoid stale closure
    onUpdate("columns", String(n));
    // Use a microtask to ensure the columns update is processed before rows
    Promise.resolve().then(() => {
      onUpdate("rows", JSON.stringify(adjusted));
    });
  };

  return (
    <>
      <div className="flex gap-2.5">
        <div className="w-28">
          <FieldLabel>Columns</FieldLabel>
          <Select value={content.columns || "3"} onValueChange={handleColumnsChange}>
            <SelectTrigger className="mt-1.5 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="6">6</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Table Data</FieldLabel>
        {rows.map((row, ri) => (
          <div key={ri} className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/50 w-4 text-right shrink-0 tabular-nums">{ri === 0 ? "H" : ri}</span>
            {row.map((cell, ci) => (
              <Input
                key={ci}
                value={cell}
                onChange={(e) => updateCell(ri, ci, e.target.value)}
                className={`text-xs h-7 flex-1 ${ri === 0 ? "font-semibold" : ""}`}
                placeholder={ri === 0 ? `Header ${ci + 1}` : ""}
              />
            ))}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground/40 hover:text-destructive shrink-0"
              onClick={() => removeRow(ri)}
              disabled={rows.length <= 1}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 w-full" onClick={addRow}>
          <Plus className="h-3 w-3" /> Add Row
        </Button>
      </div>

      <div className="flex gap-2.5">
        <ColorPickerField label="Header BG" value={content.headerBgColor} onChange={(c) => onUpdate("headerBgColor", c)} defaultValue="#C2703D" />
        <ColorPickerField label="Border" value={content.borderColor} onChange={(c) => onUpdate("borderColor", c)} defaultValue="#e5e7eb" />
      </div>
    </>
  );
}
