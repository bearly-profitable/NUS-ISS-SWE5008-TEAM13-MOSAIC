import { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { HexColorPicker } from "react-colorful";
import { Bold, Italic, Underline, Link2, Braces, List, ListOrdered, Eye, EyeOff } from "lucide-react";
import { ColorPickerField, AlignmentSelect, SizeInput, FieldLabel } from "./shared";
import { sanitizeHtml } from "@/lib/email-sanitize";

// ─── Minimal markdown → HTML for live preview ────────────────────────────────

function markdownToPreviewHtml(md: string): string {
  let html = md
    // Escape HTML entities first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Restore allowed HTML tags (span, u)
  html = html
    .replace(/&lt;span style=&quot;color:(.*?)&quot;&gt;/g, '<span style="color:$1">')
    .replace(/&lt;span style="color:(.*?)"&gt;/g, '<span style="color:$1">')
    .replace(/&lt;\/span&gt;/g, "</span>")
    .replace(/&lt;u&gt;/g, "<u>")
    .replace(/&lt;\/u&gt;/g, "</u>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#4F46E5;text-decoration:underline">$1</a>');
  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul style="margin:4px 0;padding-left:20px">${m}</ul>`);
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  // Variables
  html = html.replace(/%%(\w+)%%/g, '<span style="background:#FFF7ED;color:#EA580C;padding:0 3px;border-radius:3px;font-family:monospace;font-size:0.85em">%%$1%%</span>');
  // Line breaks
  html = html.replace(/\n/g, "<br>");

  return html;
}

// ─── Rich text toolbar ───────────────────────────────────────────────────────

function RichTextToolbar({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (v: string) => void;
}) {
  const [lastColor, setLastColor] = useState("#c2703d");

  const wrap = (before: string, after: string, placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(newValue);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const insertAtLineStart = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(newValue);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const insertLink = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "link text";
    const url = window.prompt("Enter URL:", "https://");
    if (!url) return;
    const newValue = value.slice(0, start) + `[${selected}](${url})` + value.slice(end);
    onChange(newValue);
    setTimeout(() => el.focus(), 0);
  };

  const insertVariable = (token: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newValue = value.slice(0, start) + token + value.slice(end);
    onChange(newValue);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  // Track selection anchor so rapid color changes (dragging the picker)
  // always replace the same span instead of nesting new ones.
  const colorAnchorRef = useRef<{ start: number; end: number; innerText: string } | null>(null);

  /** Strip all color span tags from text, returning only the inner content. */
  const stripColorSpans = (text: string): string =>
    text.replace(/<span style="color:#[0-9a-fA-F]{3,8}">/g, "").replace(/<\/span>/g, "");

  /**
   * Expand selection outward to include any wrapping color span tags.
   * If the cursor/selection is inside `<span style="color:...">text</span>`,
   * we want to select the entire span so we can replace it cleanly.
   */
  const expandToColorSpan = (text: string, start: number, end: number): { start: number; end: number } => {
    // Look backward from start for an opening color span tag
    const before = text.slice(0, start);
    const openMatch = before.match(/<span style="color:#[0-9a-fA-F]{3,8}">$/);
    if (openMatch) {
      start = start - openMatch[0].length;
    }
    // Look forward from end for a closing </span> tag
    const after = text.slice(end);
    const closeMatch = after.match(/^<\/span>/);
    if (closeMatch) {
      end = end + closeMatch[0].length;
    }
    return { start, end };
  };

  const applyColor = (color: string) => {
    setLastColor(color);
    const el = textareaRef.current;
    if (!el) return;

    let start: number;
    let end: number;
    let innerText: string;

    const anchor = colorAnchorRef.current;
    if (anchor) {
      // We're mid-drag — reuse the original anchor positions and plain text
      start = anchor.start;
      end = anchor.end;
      innerText = anchor.innerText;
    } else {
      // First application — capture the selection
      start = el.selectionStart;
      end = el.selectionEnd;

      // Expand selection to include any wrapping color span around the cursor/selection
      const expanded = expandToColorSpan(value, start, end);
      start = expanded.start;
      end = expanded.end;

      const selected = value.slice(start, end) || "colored text";
      // Strip any wrapping/nested color spans to get plain inner text
      innerText = stripColorSpans(selected);
      // Save anchor for subsequent drag events
      colorAnchorRef.current = { start, end, innerText };
    }

    const before = `<span style="color:${color}">`;
    const after = `</span>`;
    const wrapped = before + innerText + after;
    const newValue = value.slice(0, start) + wrapped + value.slice(end);
    // Update end to match new wrapped length so next drag iteration slices correctly
    colorAnchorRef.current = { start, end: start + wrapped.length, innerText };
    onChange(newValue);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + innerText.length);
    }, 0);
  };

  // Reset anchor when the color picker closes (user lifts mouse / confirms color)
  const handleColorPickerClose = () => {
    colorAnchorRef.current = null;
  };

  return (
    <div className="flex items-center gap-0.5 px-1 py-1 border rounded-t-md bg-muted/70 border-separator border-b-0 flex-wrap">
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" title="Bold (**text**)" onClick={() => wrap("**", "**", "bold text")}>
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" title="Italic (*text*)" onClick={() => wrap("*", "*", "italic text")}>
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" title="Underline" onClick={() => wrap("<u>", "</u>", "underlined text")}>
        <Underline className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-4 bg-border mx-0.5" />
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" title="Bullet list" onClick={() => insertAtLineStart("- ")}>
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" title="Numbered list" onClick={() => insertAtLineStart("1. ")}>
        <ListOrdered className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-4 bg-border mx-0.5" />
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" title="Hyperlink" onClick={insertLink}>
        <Link2 className="h-3.5 w-3.5" />
      </Button>
      <Popover onOpenChange={(open) => { if (!open) handleColorPickerClose(); }}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 flex flex-col items-center justify-center gap-0" title="Text color">
            <span className="text-[11px] font-bold leading-none" style={{ color: lastColor }}>A</span>
            <span className="w-3.5 h-[3px] rounded-full mt-[-1px]" style={{ backgroundColor: lastColor }} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" side="bottom" align="start">
          <HexColorPicker color={lastColor} onChange={(color) => applyColor(color)} />
          <div className="flex items-center gap-2 mt-2">
            <div className="w-6 h-6 rounded border border-border" style={{ backgroundColor: lastColor }} />
            <Input
              value={lastColor}
              onChange={(e) => {
                const v = e.target.value;
                const hex = v.startsWith("#") ? v : `#${v}`;
                setLastColor(hex);
                if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
                  applyColor(hex);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const hex = lastColor.startsWith("#") ? lastColor : `#${lastColor}`;
                  if (/^#[0-9a-fA-F]{3,6}$/.test(hex)) {
                    const fullHex = hex.length === 4
                      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
                      : hex;
                    applyColor(fullHex);
                    handleColorPickerClose();
                  }
                }
              }}
              className="flex-1 h-7 text-xs font-mono"
              placeholder="#c2703d"
            />
          </div>
        </PopoverContent>
      </Popover>
      <div className="w-px h-4 bg-border mx-0.5" />
      {["%%name%%", "%%email%%"].map((token) => (
        <Button key={token} type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] font-mono font-semibold text-primary/70 hover:text-primary hover:bg-primary/10" title={`Insert ${token}`} onClick={() => insertVariable(token)}>
          <Braces className="h-3 w-3 mr-0.5" />{token.slice(2, -2)}
        </Button>
      ))}
    </div>
  );
}

// ─── Main editor ─────────────────────────────────────────────────────────────

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function BodyTextBlockEditor({ content, onUpdate }: Props) {
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const previewHtml = useMemo(
    () => sanitizeHtml(markdownToPreviewHtml(content.markdown || "")),
    [content.markdown],
  );

  const fontSize = parseInt(content.fontSize || "14");
  const textColor = content.color || "#374151";
  const textAlign = (content.align || "left") as "left" | "center" | "right";

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <FieldLabel>Body Text</FieldLabel>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPreview((p) => !p)}
          >
            {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showPreview ? "Edit" : "Preview"}
          </Button>
        </div>

        {showPreview ? (
          <div
            className="rounded-lg border border-border/60 bg-white px-4 py-3 min-h-[120px] text-sm leading-relaxed overflow-auto"
            style={{ fontSize, color: textColor, textAlign }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <div>
            <RichTextToolbar
              textareaRef={bodyTextareaRef}
              value={content.markdown || ""}
              onChange={(v) => onUpdate("markdown", v)}
            />
            <Textarea
              ref={bodyTextareaRef}
              value={content.markdown || ""}
              onChange={(e) => onUpdate("markdown", e.target.value)}
              rows={5}
              className="font-mono text-xs rounded-t-none"
            />
          </div>
        )}
      </div>
      <div className="flex gap-2.5">
        <ColorPickerField
          label="Color"
          value={content.color}
          onChange={(c) => onUpdate("color", c)}
          defaultValue="#374151"
        />
        <SizeInput
          label="Size"
          value={content.fontSize}
          onChange={(v) => onUpdate("fontSize", v)}
          min={10}
          max={36}
          defaultValue="14"
        />
        <AlignmentSelect
          label="Align"
          value={content.align}
          onChange={(v) => onUpdate("align", v)}
        />
      </div>
    </>
  );
}
