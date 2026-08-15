import { Input } from "@/components/ui/input";
import { FieldLabel } from "./shared";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function FooterBlockEditor({ content, onUpdate }: Props) {
  return (
    <>
      {/* ── Hyperlinks (shown side-by-side with | divider) ── */}
      <div className="space-y-2">
        <FieldLabel>Footer Links</FieldLabel>
        <p className="text-[10px] text-muted-foreground/50 -mt-1">
          Three links displayed side-by-side separated by &ldquo;|&rdquo;
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground/60">Link 1 Label</label>
            <Input value={content.link1Label || ""} onChange={(e) => onUpdate("link1Label", e.target.value)} className="mt-0.5 text-xs h-7" placeholder="m1.com.sg" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground/60">Link 1 URL</label>
            <Input value={content.link1Url || ""} onChange={(e) => onUpdate("link1Url", e.target.value)} className="mt-0.5 text-xs h-7" placeholder="https://www.m1.com.sg" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground/60">Link 2 Label</label>
            <Input value={content.link2Label || ""} onChange={(e) => onUpdate("link2Label", e.target.value)} className="mt-0.5 text-xs h-7" placeholder="contact us" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground/60">Link 2 URL</label>
            <Input value={content.link2Url || ""} onChange={(e) => onUpdate("link2Url", e.target.value)} className="mt-0.5 text-xs h-7" placeholder="https://www.m1.com.sg/support/contact-us" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground/60">Link 3 Label</label>
            <Input value={content.link3Label || ""} onChange={(e) => onUpdate("link3Label", e.target.value)} className="mt-0.5 text-xs h-7" placeholder="unsubscribe" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground/60">Link 3 URL</label>
            <Input value={content.link3Url || ""} onChange={(e) => onUpdate("link3Url", e.target.value)} className="mt-0.5 text-xs h-7" placeholder="https://shop.m1.com.sg/communication-preferences" />
          </div>
        </div>
      </div>
    </>
  );
}
