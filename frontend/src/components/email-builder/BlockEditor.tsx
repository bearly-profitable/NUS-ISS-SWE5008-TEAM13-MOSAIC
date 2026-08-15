import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, Trash2, GripVertical, Copy, Eye, EyeOff, Lock, Unlock, Zap, Plus,
  Image, Type, Heading1, MousePointerClick, Minus, Share2, FileText,
  LayoutTemplate, Columns3, ImageIcon, ImagePlus, Grid2x2,
  Space, Play, Timer, Table2, Ticket, FileImage, ListCollapse, Languages,
} from "lucide-react";
import type { EmailBlock, BlockType } from "@/types/email-builder";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BLOCK_EDITOR_REGISTRY, isWholeContentEditor } from "./editors";

const TYPE_LABELS: Record<string, string> = {
  header: "Logo",
  "hero-image": "Hero Image",
  heading: "Heading",
  "body-text": "Body Text",
  button: "Button / CTA",
  image: "Image",
  gif: "GIF",
  divider: "Divider",
  "image-text": "Image + Text",
  "icon-grid": "Icon Grid",
  columns: "Columns",
  "social-links": "Social Links",
  footer: "Footer",
  spacer: "Spacer",
  video: "Video",
  countdown: "Countdown",
  table: "Table",
  coupon: "Coupon",
  accordion: "Accordion/FAQ",
  "lang-toggle": "Language Toggle",
};

const TYPE_COLORS: Record<string, string> = {
  header: "bg-primary",
  "hero-image": "bg-purple-500",
  heading: "bg-primary",
  "body-text": "bg-green-500",
  button: "bg-red-500",
  image: "bg-teal-500",
  gif: "bg-fuchsia-500",
  divider: "bg-gray-400",
  "image-text": "bg-cyan-500",
  "icon-grid": "bg-amber-500",
  columns: "bg-indigo-500",
  "social-links": "bg-pink-500",
  footer: "bg-gray-500",
  spacer: "bg-slate-400",
  video: "bg-rose-500",
  countdown: "bg-violet-500",
  table: "bg-emerald-500",
  coupon: "bg-yellow-500",
  accordion: "bg-blue-500",
  "lang-toggle": "bg-blue-500",
};

interface BlockEditorProps {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
  /** ID of the block that should be auto-expanded (for click-to-select). */
  expandedBlockId?: string | null;
  /** Callback when a block is expanded/collapsed. */
  onBlockExpand?: (blockId: string | null) => void;
  /** Callback to insert a new block at a specific index. */
  onInsertAt?: (type: BlockType, index: number) => void;
}

/** Extract a short preview string from block content for the collapsed header. */
function getBlockPreview(block: EmailBlock): string {
  const c = block.content;
  switch (block.type) {
    case "heading":
      return c.text || "";
    case "body-text":
      return (c.markdown || "").replace(/[#*_~`>\[\]]/g, "").trim();
    case "button":
      return c.text ? `"${c.text}"${c.url ? ` → ${c.url.slice(0, 30)}` : ""}` : "";
    case "image":
    case "gif":
      return c.alt || (c.imageUrl ? "Image uploaded" : "");
    case "hero-image":
      return c.heroHeadline || (c.imageUrl ? "Hero uploaded" : "");
    case "image-text":
      return c.heading || "";
    case "columns": {
      const count = c.columnCount || "3";
      return `${count} columns`;
    }
    case "footer":
      return [c.link1Label, c.link2Label, c.link3Label].filter(Boolean).join(" | ");
    case "coupon":
      return c.code || "";
    case "accordion": {
      try {
        const items = JSON.parse(c.items || "[]");
        return `${items.length} items`;
      } catch { return ""; }
    }
    case "lang-toggle":
      return `EN/中文 ${c.position || "bottom-right"}`;
    case "countdown":
      return c.targetDate ? `Until ${c.targetDate}` : "";
    case "video":
      return c.url || "";
    case "divider":
      return "";
    case "spacer":
      return `${c.height || 40}px`;
    case "social-links": {
      const platforms = Object.keys(c).filter((k) => c[k]);
      return platforms.join(", ");
    }
    default:
      return "";
  }
}

/** All block types with icons for the insertion popover. */
const INSERT_BLOCKS: { type: BlockType; label: string; icon: React.ElementType; color: string }[] = [
  { type: "header",       label: "Logo",          icon: LayoutTemplate,    color: "text-primary" },
  { type: "heading",      label: "Heading",       icon: Heading1,          color: "text-primary" },
  { type: "body-text",    label: "Body Text",     icon: Type,              color: "text-green-500" },
  { type: "button",       label: "Button",        icon: MousePointerClick, color: "text-red-500" },
  { type: "hero-image",   label: "Hero Image",    icon: Image,             color: "text-purple-500" },
  { type: "image",        label: "Image",         icon: ImagePlus,         color: "text-teal-500" },
  { type: "gif",          label: "GIF",           icon: FileImage,         color: "text-fuchsia-500" },
  { type: "video",        label: "Video",         icon: Play,              color: "text-rose-500" },
  { type: "image-text",   label: "Image + Text",  icon: ImageIcon,         color: "text-cyan-500" },
  { type: "icon-grid",    label: "Icon Grid",     icon: Grid2x2,           color: "text-amber-500" },
  { type: "columns",      label: "Columns",       icon: Columns3,          color: "text-indigo-500" },
  { type: "divider",      label: "Divider",       icon: Minus,             color: "text-gray-400" },
  { type: "spacer",       label: "Spacer",        icon: Space,             color: "text-slate-400" },
  { type: "table",        label: "Table",         icon: Table2,            color: "text-emerald-500" },
  { type: "countdown",    label: "Countdown",     icon: Timer,             color: "text-violet-500" },
  { type: "coupon",       label: "Coupon",        icon: Ticket,            color: "text-yellow-500" },
  { type: "accordion",    label: "Accordion",     icon: ListCollapse,      color: "text-blue-500" },
  { type: "social-links", label: "Social Links",  icon: Share2,            color: "text-pink-500" },
  { type: "footer",       label: "Footer",        icon: FileText,          color: "text-gray-500" },
  { type: "lang-toggle",  label: "Lang Toggle",   icon: Languages,         color: "text-blue-500" },
];

/** Inline "+" insertion point between blocks — renders popover via portal. */
function InsertionPoint({ onInsert }: { onInsert: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position the popover relative to the button (above or below depending on space)
  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const popoverHeight = 240 + 40; // max-h-[240px] + header/padding
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Position above if not enough space below
      const shouldPositionAbove = spaceBelow < popoverHeight && spaceAbove > spaceBelow;
      
      setPos({
        top: shouldPositionAbove ? rect.top - popoverHeight - 6 : rect.bottom + 6,
        left: rect.left + rect.width / 2 - 140, // center the 280px popover
      });
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="group/insert relative flex items-center justify-center h-3 -my-0.5">
      <div className="absolute inset-x-3 h-px bg-transparent group-hover/insert:bg-primary/40 transition-colors" />
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative z-10 h-5 w-5 rounded-full flex items-center justify-center opacity-0 group-hover/insert:opacity-100 transition-opacity bg-primary text-white shadow-sm hover:bg-primary/90 hover:scale-110 active:scale-95"
        title="Insert block here"
      >
        <Plus className="h-3 w-3" />
      </button>
      {open && pos && createPortal(
        <div
          ref={popoverRef}
          className="fixed rounded-xl shadow-4 border border-separator overflow-hidden"
          style={{
            top: pos.top,
            left: pos.left,
            width: 280,
            zIndex: 99999,
            background: "#ffffff",
          }}
        >
          <div className="px-3 py-2 border-b border-separator">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Insert Block</span>
          </div>
          <div className="overflow-y-auto max-h-[240px] p-1.5 grid grid-cols-3 gap-1">
            {INSERT_BLOCKS.map((b) => (
              <button
                key={b.type}
                type="button"
                onClick={() => { onInsert(b.type); setOpen(false); }}
                className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium hover:bg-primary/[0.07] active:bg-primary/12 transition-colors cursor-pointer"
              >
                <b.icon className={`h-4 w-4 ${b.color}`} />
                <span className="text-muted-foreground/80 leading-tight text-center">{b.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function BlockItem({
  block,
  onUpdate,
  onDelete,
  onDuplicate,
  isExpanded,
  onToggleExpand,
}: {
  block: EmailBlock;
  index: number;
  total: number;
  onUpdate: (content: Record<string, string>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const isHidden = block.content.hidden === "true";
  const isLocked = block.content.locked === "true";

  // Parse per-field dynamic flags
  const dynamicFields: Record<string, string> = (() => {
    try { return JSON.parse(block.content.dynamicFields || "{}"); } catch { return {}; }
  })();
  const hasDynamic = Object.values(dynamicFields).some((v) => v === "true");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, disabled: isLocked });

  const updateField = (key: string, value: string) => {
    onUpdate({ ...block.content, [key]: value });
  };

  const Editor = BLOCK_EDITOR_REGISTRY[block.type as BlockType];

  return (
    <div
      ref={setNodeRef}
      data-block-editor-id={block.id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        position: isDragging ? "relative" : undefined,
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isDragging ? 0.6 : 1, scale: isDragging ? 1.01 : 1 }}
        exit={{ opacity: 0 }}
        className={`group/block rounded-xl overflow-hidden transition-shadow ${isDragging ? "shadow-xl" : ""}`}
        style={{
          background: "rgba(255,255,255,0.88)",
          border: "1px solid rgba(220,224,232,0.70)",
          ...(isDragging ? { boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 0 0 2px rgba(79,70,229,0.2)" } : {}),
        }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={onToggleExpand}
        >
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 -ml-0.5 rounded hover:bg-muted/60 transition-colors shrink-0"
            onClick={(e) => e.stopPropagation()}
            title="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
          </div>

          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${TYPE_COLORS[block.type] || "bg-gray-400"}`} />
          <div className={`flex-1 min-w-0 ${isHidden ? "text-label-4 line-through" : ""}`}>
            <span className="text-[13px] font-medium text-label-1">{TYPE_LABELS[block.type] || block.type}</span>
            {!isExpanded && (() => {
              const preview = getBlockPreview(block);
              return preview ? (
                <span className="text-[11px] text-muted-foreground/50 ml-2 truncate inline-block max-w-[140px] align-middle" title={preview}>
                  {preview.length > 35 ? preview.slice(0, 35) + "…" : preview}
                </span>
              ) : null;
            })()}
          </div>

          {/* Dynamic content indicator */}
          {hasDynamic && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold shrink-0" style={{ background: "rgba(99,102,241,0.08)", color: "#6366f1" }}>
              <Zap className="h-2.5 w-2.5" />
              Dynamic
            </span>
          )}

          <div className="flex items-center gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity">
            {/* Visibility toggle */}
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 ${isHidden ? "text-amber-500" : "text-muted-foreground/60 hover:text-foreground"}`}
              onClick={(e) => { e.stopPropagation(); updateField("hidden", isHidden ? "false" : "true"); }}
              title={isHidden ? "Show block" : "Hide block"}
            >
              {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            {/* Lock toggle */}
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 ${isLocked ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}
              onClick={(e) => { e.stopPropagation(); updateField("locked", isLocked ? "false" : "true"); }}
              title={isLocked ? "Unlock block" : "Lock block"}
            >
              {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              title="Duplicate"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 text-muted-foreground/60 hover:text-destructive ${isLocked ? "pointer-events-none opacity-30" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (!isLocked) onDelete(); }}
              title={isLocked ? "Unlock to delete" : "Delete"}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-muted-foreground/40 shrink-0"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.span>
        </div>

        <AnimatePresence>
          {isExpanded && Editor && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 pt-2 space-y-3 border-t border-separator">
                {isWholeContentEditor(block.type as BlockType) ? (
                  <Editor content={block.content} onUpdate={onUpdate} />
                ) : (
                  <Editor content={block.content} onUpdate={updateField} />
                )}

                {/* ── Block Spacing & Background (hidden for tool-only blocks) ── */}
                {block.type !== "lang-toggle" && (
                <div className="pt-2 mt-2 border-t border-separator space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Pad Top</Label>
                        <span className="text-[10px] text-muted-foreground/50 tabular-nums">{parseInt(block.content.paddingTop || "0")}px</span>
                      </div>
                      <Slider
                        value={[parseInt(block.content.paddingTop || "0")]}
                        onValueChange={([v]) => updateField("paddingTop", String(v))}
                        min={0} max={60} step={2}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Pad Bottom</Label>
                        <span className="text-[10px] text-muted-foreground/50 tabular-nums">{parseInt(block.content.paddingBottom || "0")}px</span>
                      </div>
                      <Slider
                        value={[parseInt(block.content.paddingBottom || "0")]}
                        onValueChange={([v]) => updateField("paddingBottom", String(v))}
                        min={0} max={60} step={2}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Block Background</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="color"
                        value={block.content.blockBgColor || "#ffffff"}
                        onChange={(e) => updateField("blockBgColor", e.target.value)}
                        className="h-7 w-10 p-0.5 cursor-pointer rounded"
                      />
                      <Input
                        value={block.content.blockBgColor || ""}
                        onChange={(e) => updateField("blockBgColor", e.target.value)}
                        className="flex-1 text-xs h-7"
                        placeholder="transparent"
                      />
                      {block.content.blockBgColor && (
                        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-[10px]" onClick={() => updateField("blockBgColor", "")}>
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* ── Per-Field Dynamic Content Toggles ── */}
                  {(() => {
                    /** Registry of dynamicable fields per block type */
                    const DYNAMIC_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
                      header: [{ key: "logoUrl", label: "Logo" }],
                      "hero-image": [{ key: "imageUrl", label: "Hero Image" }, { key: "heroHeadline", label: "Headline" }, { key: "heroSubheadline", label: "Sub-headline" }],
                      heading: [{ key: "text", label: "Heading Text" }],
                      "body-text": [{ key: "markdown", label: "Body Text" }],
                      button: [{ key: "text", label: "Button Text" }, { key: "url", label: "Button URL" }],
                      "image-text": [{ key: "heading", label: "Heading" }, { key: "text", label: "Text" }, { key: "imageUrl", label: "Image" }],
                      columns: (() => {
                        const PRESET_CELLS: Record<string, number> = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "2-top": 3, "2-bottom": 3, "1-2-1": 4, "1-3-1": 5, "2x2": 4 };
                        const presetId = block.content.colLayoutPreset || "";
                        const cellCount = (presetId && PRESET_CELLS[presetId]) || parseInt(block.content.columnCount || "3");
                        return Array.from({ length: cellCount }, (_, i) => ({ key: `col${i + 1}Heading`, label: `Column ${i + 1}` }));
                      })(),
                      footer: [{ key: "link1Url", label: "Link 1 URL" }, { key: "link2Url", label: "Link 2 URL" }, { key: "link3Url", label: "Link 3 URL (Unsubscribe)" }],
                      coupon: [{ key: "code", label: "Promo Code" }, { key: "label", label: "Label" }],
                      countdown: [{ key: "targetDate", label: "Target Date" }, { key: "label", label: "Label" }],
                      image: [{ key: "src", label: "Image" }],
                      gif: [{ key: "src", label: "GIF" }],
                      video: [{ key: "url", label: "Video URL" }],
                      accordion: [{ key: "items", label: "FAQ Items" }],
                    };
                    const fields = DYNAMIC_FIELDS[block.type] || [];
                    if (fields.length === 0) return null;

                    const toggleField = (fieldKey: string) => {
                      const next = { ...dynamicFields };
                      if (next[fieldKey] === "true") {
                        delete next[fieldKey];
                      } else {
                        next[fieldKey] = "true";
                      }
                      updateField("dynamicFields", JSON.stringify(next));
                    };

                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-3 w-3" style={{ color: "#6366f1" }} />
                          <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Dynamic Content</Label>
                        </div>
                        <p className="text-[9px] text-muted-foreground/40 leading-relaxed">
                          Mark fields as dynamic to override them per journey path.
                        </p>
                        <div className="space-y-1">
                          {fields.map(({ key, label }) => {
                            const isOn = dynamicFields[key] === "true";
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => toggleField(key)}
                                className="flex items-center gap-2 w-full rounded-lg border px-2 py-1.5 cursor-pointer select-none transition-colors duration-150"
                                style={{
                                  background: isOn ? "rgba(99,102,241,0.05)" : "transparent",
                                  borderColor: isOn ? "rgba(99,102,241,0.2)" : "rgba(0,0,0,0.05)",
                                }}
                              >
                                <span className="text-[11px] font-medium flex-1 text-left" style={{ color: "#374151" }}>
                                  {label}
                                </span>
                                <div
                                  className="relative flex-shrink-0 rounded-full transition-colors duration-200"
                                  style={{
                                    width: 28,
                                    height: 16,
                                    background: isOn ? "#6366f1" : "#d1d5db",
                                    padding: 2,
                                  }}
                                >
                                  <motion.div
                                    className="rounded-full"
                                    style={{ width: 12, height: 12, background: "#fff" }}
                                    animate={{ x: isOn ? 12 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                  />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export function BlockEditor({ blocks, onChange, expandedBlockId, onBlockExpand, onInsertAt }: BlockEditorProps) {
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null);

  // Use external expandedBlockId if provided, otherwise local state
  const activeExpandedId = expandedBlockId !== undefined ? expandedBlockId : localExpandedId;
  const setExpandedId = onBlockExpand || setLocalExpandedId;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      onChange(arrayMove(blocks, oldIndex, newIndex));
    }
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const newBlocks = [...blocks];
    const target = index + direction;
    [newBlocks[index], newBlocks[target]] = [newBlocks[target], newBlocks[index]];
    onChange(newBlocks);
  };

  const updateBlock = (index: number, content: Record<string, string>) => {
    const newBlocks = blocks.map((b, i) => (i === index ? { ...b, content } : b));
    onChange(newBlocks);
  };

  const deleteBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const duplicateBlock = (index: number) => {
    const block = blocks[index];
    const newBlock = { ...block, id: Math.random().toString(36).slice(2, 10) };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    onChange(newBlocks);
  };

  if (blocks.length === 0) {
    return (
      <div className="relative py-2">
        <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-primary/8 via-purple-500/5 to-cyan-500/8 blur-2xl pointer-events-none" />
        <div className="relative rounded-2xl px-6 py-8 flex flex-col items-center gap-3 text-center" style={{ border: "1.5px dashed rgba(79,70,229,0.25)", background: "rgba(255,255,255,0.5)" }}>
          <p className="text-sm font-semibold text-label-1">Start Building Your Email</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[180px]">
            Add blocks from the panel above to craft your email
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
            {[
              { label: "Hero", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
              { label: "Heading", color: "bg-primary/10 text-primary border-primary/20" },
              { label: "Button", color: "bg-red-500/10 text-red-400 border-red-500/20" },
              { label: "Image", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
            ].map(({ label, color }) => (
              <span key={label} className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${color}`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={blocks.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          <AnimatePresence mode="popLayout">
            {blocks.map((block, index) => (
              <div key={block.id}>
                {/* Inline insertion point before each block (except first) */}
                {index > 0 && onInsertAt && (
                  <InsertionPoint onInsert={(type) => onInsertAt(type, index)} />
                )}
                <BlockItem
                  block={block}
                  index={index}
                  total={blocks.length}
                  onUpdate={(content) => updateBlock(index, content)}
                  onMoveUp={() => moveBlock(index, -1)}
                  onMoveDown={() => moveBlock(index, 1)}
                  onDelete={() => deleteBlock(index)}
                  onDuplicate={() => duplicateBlock(index)}
                  isExpanded={activeExpandedId === block.id}
                  onToggleExpand={() => setExpandedId(activeExpandedId === block.id ? null : block.id)}
                />
              </div>
            ))}
          </AnimatePresence>
          {/* Insertion point at the end */}
          {blocks.length > 0 && onInsertAt && (
            <InsertionPoint onInsert={(type) => onInsertAt(type, blocks.length)} />
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
