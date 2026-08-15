import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Image, Type, Heading1, MousePointerClick, Minus, Share2, FileText,
  LayoutTemplate, Columns3, ImageIcon, ImagePlus, Grid2x2,
  Space, Play, Timer, Table2, Ticket, FileImage, ListCollapse, Languages,
} from "lucide-react";
import type { BlockType } from "@/types/email-builder";

// ─── Block definitions with categories ───────────────────────────────────────

type BlockCategory = "content" | "media" | "layout" | "utility";

interface BlockDef {
  type: BlockType;
  label: string;
  icon: React.ElementType;
  color: string;
  category: BlockCategory;
}

const BLOCKS: BlockDef[] = [
  // Content
  { type: "header",      label: "Logo",          icon: LayoutTemplate,    color: "text-primary",  category: "content" },
  { type: "heading",     label: "Heading",       icon: Heading1,          color: "text-primary",  category: "content" },
  { type: "body-text",   label: "Body Text",     icon: Type,              color: "text-green-500",   category: "content" },
  { type: "button",      label: "Button / CTA",  icon: MousePointerClick, color: "text-red-500",     category: "content" },
  { type: "coupon",      label: "Coupon",        icon: Ticket,            color: "text-yellow-500",  category: "content" },
  { type: "accordion",   label: "Accordion/FAQ", icon: ListCollapse,      color: "text-blue-500",    category: "content" },
  { type: "countdown",   label: "Countdown",     icon: Timer,             color: "text-violet-500",  category: "content" },
  // Media
  { type: "hero-image",  label: "Hero Image",    icon: Image,             color: "text-purple-500",  category: "media" },
  { type: "image",       label: "Image",         icon: ImagePlus,         color: "text-teal-500",    category: "media" },
  { type: "gif",         label: "GIF",           icon: FileImage,         color: "text-fuchsia-500", category: "media" },
  { type: "video",       label: "Video",         icon: Play,              color: "text-rose-500",    category: "media" },
  { type: "image-text",  label: "Image + Text",  icon: ImageIcon,         color: "text-cyan-500",    category: "media" },
  { type: "icon-grid",   label: "Icon Grid",     icon: Grid2x2,          color: "text-amber-500",   category: "media" },
  // Layout
  { type: "columns",     label: "Columns",       icon: Columns3,          color: "text-indigo-500",  category: "layout" },
  { type: "divider",     label: "Divider",       icon: Minus,             color: "text-gray-400",    category: "layout" },
  { type: "spacer",      label: "Spacer",        icon: Space,             color: "text-slate-400",   category: "layout" },
  { type: "table",       label: "Table",         icon: Table2,            color: "text-emerald-500", category: "layout" },
  // Utility
  { type: "social-links", label: "Social Links", icon: Share2,            color: "text-pink-500",    category: "utility" },
  { type: "footer",      label: "Footer",        icon: FileText,          color: "text-gray-500",    category: "utility" },
  { type: "lang-toggle", label: "Language Toggle", icon: Languages,       color: "text-blue-500",    category: "utility" },
];

const CATEGORIES: { id: BlockCategory | "all"; label: string }[] = [
  { id: "all",     label: "All" },
  { id: "content", label: "Content" },
  { id: "media",   label: "Media" },
  { id: "layout",  label: "Layout" },
  { id: "utility", label: "Utility" },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface BlockPaletteProps {
  onAdd: (type: BlockType) => void;
}

export function BlockPalette({ onAdd }: BlockPaletteProps) {
  const [activeCategory, setActiveCategory] = useState<BlockCategory | "all">("all");

  const filtered = activeCategory === "all"
    ? BLOCKS
    : BLOCKS.filter((b) => b.category === activeCategory);

  return (
    <div className="space-y-2.5">
      {/* Category filter pills */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors",
              activeCategory === cat.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/40",
            )}
          >
            {cat.label}
            <span className="ml-1 opacity-50">
              {cat.id === "all" ? BLOCKS.length : BLOCKS.filter((b) => b.category === cat.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Block grid */}
      <div className="grid grid-cols-2 gap-2">
        {filtered.map((block) => (
          <Button
            key={block.type}
            variant="outline"
            className="h-auto py-3 px-3 flex flex-col items-center gap-1.5 text-xs hover:border-separator hover:bg-card/80 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
            style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.5)" }}
            onClick={() => onAdd(block.type)}
          >
            <block.icon className={`h-5 w-5 ${block.color}`} />
            <span className="font-medium">{block.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
