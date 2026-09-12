/**
 * The email builder, scoped to one segment's generated email.
 *
 * This composes exactly the same editing primitives the standalone builder
 * used — BlockPalette, BlockEditor, BackgroundEditor, EmailPreview — so
 * editing behaviour is identical. What it drops is the template-library
 * chrome (folders, tags, version history, save-as dialogs), which no longer
 * applies: an email here belongs to a segment, not to a template folder.
 *
 * Saving writes the blocks back to segment_email and re-runs the Guardian
 * checks, since an edit can introduce manipulation language or PII.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Layers,
  Paintbrush,
  Plus,
  ChevronRight,
  Save,
  Loader2,
  X,
  Monitor,
  Tablet,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { BlockPalette } from "@/components/email-builder/BlockPalette";
import { BlockEditor } from "@/components/email-builder/BlockEditor";
import { BackgroundEditor } from "@/components/email-builder/BackgroundEditor";
import { EmailPreview } from "@/components/email-builder/EmailPreview";
import { buildBackgroundStyle } from "@/components/email-builder/background-patterns";
import { BLOCK_DEFAULTS, DEFAULT_BACKGROUND } from "@/types/email-builder";
import type { EmailBlock, EmailBackground, BlockType } from "@/types/email-builder";
import { updateEmail, type SegmentEmail } from "@/services/workspaceApi";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

interface SegmentEmailEditorProps {
  email: SegmentEmail;
  segmentName: string;
  onClose: () => void;
  /** Called after a successful save so the parent can refresh workspace state. */
  onSaved: () => Promise<void>;
}

export function SegmentEmailEditor({ email, segmentName, onClose, onSaved }: SegmentEmailEditorProps) {
  const [subject, setSubject] = useState(email.subject);
  const [preheader, setPreheader] = useState(email.preheader);
  const [blocks, setBlocks] = useState<EmailBlock[]>(email.blocks ?? []);
  const [background, setBackground] = useState<EmailBackground>(email.background ?? { ...DEFAULT_BACKGROUND });
  const [activeTab, setActiveTab] = useState<"blocks" | "background">("blocks");
  const [addBlocksOpen, setAddBlocksOpen] = useState(false);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [saving, setSaving] = useState(false);

  // Switching to a different segment's email reloads the editor in place.
  useEffect(() => {
    setSubject(email.subject);
    setPreheader(email.preheader);
    setBlocks(email.blocks ?? []);
    setBackground(email.background ?? { ...DEFAULT_BACKGROUND });
    setExpandedBlockId(null);
  }, [email.id, email.subject, email.preheader, email.blocks, email.background]);

  const dirty = useMemo(
    () =>
      subject !== email.subject ||
      preheader !== email.preheader ||
      JSON.stringify(blocks) !== JSON.stringify(email.blocks ?? []) ||
      JSON.stringify(background) !== JSON.stringify(email.background ?? { ...DEFAULT_BACKGROUND }),
    [subject, preheader, blocks, background, email],
  );

  const addBlock = (type: BlockType) => {
    setBlocks((b) => [...b, { id: generateId(), ...BLOCK_DEFAULTS[type]() }]);
  };

  const handleInsertAt = (type: BlockType, index: number) => {
    setBlocks((b) => {
      const next = [...b];
      next.splice(index, 0, { id: generateId(), ...BLOCK_DEFAULTS[type]() });
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateEmail(email.id, { subject, preheader, blocks, background });
      const verdict = res.verdict.verdict;
      if (verdict === "BLOCK") {
        toast.warning("Saved — but the Guardian now BLOCKs this email. Check the Approval Queue.");
      } else if (verdict === "REVISE") {
        toast.warning("Saved — the Guardian flagged it for revision. Check the Approval Queue.");
      } else {
        toast.success("Saved and re-checked — verdict PASS");
      }
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the email");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <div className="w-full h-full max-w-[1500px] glass-card overflow-hidden flex flex-col">
        {/* ── Toolbar ── */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/60 shrink-0">
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{segmentName}</div>
            <div className="text-[10px] text-muted-foreground">Editing the generated email</div>
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-1 ml-4">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-8 text-xs flex-1 min-w-0"
              placeholder="Email subject…"
            />
            <Label className="text-xs text-muted-foreground whitespace-nowrap ml-2">Preheader</Label>
            <Input
              value={preheader}
              onChange={(e) => setPreheader(e.target.value)}
              className="h-8 text-xs flex-1 min-w-0"
              placeholder="Inbox preview text…"
            />
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {([
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const).map(([key, Icon]) => (
              <Button
                key={key}
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7", viewport === key && "bg-primary/10 text-primary")}
                onClick={() => setViewport(key)}
                title={key}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>

          <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="h-8 gap-1.5 text-xs shrink-0">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {dirty ? "Save & re-check" : "Saved"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Split: editor | preview ── */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={42} minSize={30} maxSize={58}>
            <div className="h-full flex flex-col border-r border-border/40">
              <div className="px-4 pt-3 pb-0 shrink-0">
                <div className="flex items-center gap-1 glass-card p-1 rounded-2xl">
                  {([
                    { id: "blocks", icon: Layers, label: "Content" },
                    { id: "background", icon: Paintbrush, label: "Background" },
                  ] as const).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={cn(
                        "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-1 justify-center",
                        activeTab === id ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                {activeTab === "blocks" ? (
                  <div className="p-4 space-y-3">
                    <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/40">
                      <button
                        type="button"
                        onClick={() => setAddBlocksOpen((o) => !o)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-muted/60 transition-colors"
                      >
                        <span className="h-5 w-5 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <Plus className="h-3 w-3 text-primary" />
                        </span>
                        <span className="text-sm font-semibold flex-1 text-left">Add blocks</span>
                        <ChevronRight
                          className="h-4 w-4 text-muted-foreground transition-transform"
                          style={{ transform: addBlocksOpen ? "rotate(90deg)" : "none" }}
                        />
                      </button>
                      {addBlocksOpen && (
                        <div className="px-3.5 pb-3.5 pt-1 border-t border-border/50">
                          <BlockPalette onAdd={addBlock} />
                        </div>
                      )}
                    </div>

                    <BlockEditor
                      blocks={blocks}
                      onChange={setBlocks}
                      expandedBlockId={expandedBlockId}
                      onBlockExpand={setExpandedBlockId}
                      onInsertAt={handleInsertAt}
                    />
                  </div>
                ) : (
                  <div className="p-4">
                    <BackgroundEditor value={background} onChange={setBackground} />
                  </div>
                )}
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle className="bg-muted/40 hover:bg-muted/70 transition-colors" />

          <ResizablePanel defaultSize={58} minSize={40}>
            <div className="h-full overflow-auto" style={buildBackgroundStyle(background)}>
              <EmailPreview
                blocks={blocks}
                subject={subject}
                background={background}
                viewport={viewport}
                onBlockClick={setExpandedBlockId}
                selectedBlockId={expandedBlockId}
                onReorder={setBlocks}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </motion.div>
  );
}
