import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { FieldLabel } from "./shared";
import { ImageUpload } from "../ImageUpload";
import { generateAndUploadPlayThumbnail } from "@/lib/video-thumbnail";

interface Props {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

/** Extract YouTube/Vimeo thumbnail from URL. */
function getThumbnail(url: string): string {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  // Vimeo (just uses a placeholder — real thumbnails require API call)
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return "";
  return "";
}

export function VideoBlockEditor({ content, onUpdate }: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tracks the source URL we last composited so we don't re-upload on every render.
  const lastSourceRef = useRef<string>("");

  const handleVideoUrlChange = (url: string) => {
    onUpdate("videoUrl", url);
  };

  // Auto-fill the thumbnail when the user enters a YouTube URL and no
  // thumbnail is set yet. Runs in its own render cycle so it cannot clobber
  // the videoUrl update above (the per-field `onUpdate` reads from a stale
  // closure when called twice synchronously).
  useEffect(() => {
    const videoUrl = content.videoUrl || "";
    if (!videoUrl || content.thumbnailUrl) return;
    const thumb = getThumbnail(videoUrl);
    if (thumb) onUpdate("thumbnailUrl", thumb);
  }, [content.videoUrl, content.thumbnailUrl, onUpdate]);

  // Auto-build the play-button composite whenever the raw thumbnail changes
  // (or on first mount if older saved blocks don't have a composite yet).
  useEffect(() => {
    const source = content.thumbnailUrl || "";
    if (!source) return;
    if (lastSourceRef.current === source && content.thumbnailWithPlayUrl) return;
    lastSourceRef.current = source;

    let cancelled = false;
    setGenerating(true);
    setError(null);

    generateAndUploadPlayThumbnail(source)
      .then((url) => {
        if (cancelled) return;
        if (url) {
          onUpdate("thumbnailWithPlayUrl", url);
        } else {
          // Browser couldn't load the source cross-origin or upload failed.
          // Fall back to using the raw thumbnail so preview still works.
          onUpdate("thumbnailWithPlayUrl", "");
          setError("Couldn't build playable thumbnail — using raw image instead.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't build playable thumbnail — using raw image instead.");
      })
      .finally(() => {
        if (!cancelled) setGenerating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [content.thumbnailUrl, content.thumbnailWithPlayUrl, onUpdate]);

  return (
    <>
      <div>
        <FieldLabel>Video URL</FieldLabel>
        <Input
          value={content.videoUrl || ""}
          onChange={(e) => handleVideoUrlChange(e.target.value)}
          className="mt-1.5 text-xs"
          placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
        />
        <p className="text-[10px] text-muted-foreground mt-1">Clicking the thumbnail in the sent email opens this link.</p>
      </div>
      <div>
        <FieldLabel>Thumbnail</FieldLabel>
        <div className="mt-1.5">
          <ImageUpload value={content.thumbnailUrl || ""} onChange={(url) => onUpdate("thumbnailUrl", url)} purpose="block" />
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {generating ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Baking play button into thumbnail…</span>
            </>
          ) : error ? (
            <span className="text-amber-600">{error}</span>
          ) : (
            <span>Auto-detected from YouTube, or upload/paste a custom thumbnail.</span>
          )}
        </div>
      </div>
      <div>
        <FieldLabel>Aspect Ratio</FieldLabel>
        <Select value={content.aspectRatio || "16:9"} onValueChange={(v) => onUpdate("aspectRatio", v)}>
          <SelectTrigger className="mt-1.5 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
            <SelectItem value="9:16">9:16 (Vertical / Reels)</SelectItem>
            <SelectItem value="4:3">4:3 (Classic)</SelectItem>
            <SelectItem value="1:1">1:1 (Square)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <FieldLabel>Alt Text</FieldLabel>
        <Input
          value={content.alt || ""}
          onChange={(e) => onUpdate("alt", e.target.value)}
          className="mt-1.5 text-xs"
          placeholder="Video description..."
        />
      </div>
    </>
  );
}
