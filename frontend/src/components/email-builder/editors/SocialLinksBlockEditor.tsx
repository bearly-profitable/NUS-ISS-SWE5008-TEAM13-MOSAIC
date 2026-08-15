import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

const PLATFORMS = ["facebook", "twitter", "instagram", "linkedin", "youtube"] as const;

export function SocialLinksBlockEditor({ content, onUpdate }: Props) {
  return (
    <div className="space-y-2">
      {PLATFORMS.map((platform) => (
        <div key={platform} className="flex items-center gap-2">
          <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider w-20 shrink-0 text-right">
            {platform === "twitter" ? "X" : platform}
          </Label>
          <Input
            value={content[platform] || ""}
            onChange={(e) => onUpdate(platform, e.target.value)}
            placeholder={platform === "website" ? "https://yoursite.com" : `https://${platform}.com/...`}
            className="flex-1 text-xs"
          />
          {content[platform] && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground/50 hover:text-destructive"
              onClick={() => onUpdate(platform, "")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
