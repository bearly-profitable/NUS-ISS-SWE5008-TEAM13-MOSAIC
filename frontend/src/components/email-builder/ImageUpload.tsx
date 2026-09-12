import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isImageFile, useFileDrop } from "@/hooks/use-file-drop";
import { Upload, X, Images, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { uploadImageFile } from "@/lib/image-file-upload";
import { listImageFolders, type ImageFolder } from "@/services/imageFoldersApi";
import { FolderDestPicker } from "./FolderDestPicker";
import { HeroGallery } from "./HeroGallery";
import { ImageGenerator } from "./ImageGenerator";
import type { ImagePurpose } from "@/services/imageGenApi";

const MAX_IMG_RETRIES = 3;

function retryImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const attempt = Number(img.dataset.retry ?? "0");
  if (attempt >= MAX_IMG_RETRIES) return;
  img.dataset.retry = String(attempt + 1);
  const sep = img.src.includes("?") ? "&" : "?";
  img.src = img.src.replace(/[?&]_rt=\d+/, "") + `${sep}_rt=${Date.now()}`;
}

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  /** What this slot is for -- steers the drafted prompt and default ratio. */
  purpose?: ImagePurpose;
  /** Pulls that segment's creative direction into the drafted prompt. */
  segmentId?: string | null;
}

export function ImageUpload({ value, onChange, purpose = "hero", segmentId = null }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // Generate is never the landing tab: opening this panel should not put the
  // operator one stray click away from spending on a render.
  const [sourceTab, setSourceTab] = useState<"upload" | "gallery" | "generate">(() =>
    value ? "gallery" : "upload",
  );
  // Key to force gallery remount after upload so it refreshes
  const [galleryKey, setGalleryKey] = useState(0);

  // Destination folder for new uploads — syncs with whichever folder the user
  // is viewing in the gallery.
  const [destFolderId, setDestFolderId] = useState<string | null>(null);
  const [destFolderName, setDestFolderName] = useState<string | null>(null);
  const [folders, setFolders] = useState<ImageFolder[]>([]);

  // Load folder list once for the destination picker
  useEffect(() => {
    listImageFolders()
      .then((res) => setFolders(res.folders))
      .catch(() => { /* non-critical */ });
  }, [galleryKey]);

  const handleCurrentFolderChange = useCallback((id: string | null, name: string | null) => {
    setDestFolderId(id);
    setDestFolderName(name);
  }, []);

  const processFile = async (file: File) => {
    setUploading(true);
    const url = await uploadImageFile(file, { folderId: destFolderId, folderName: destFolderName });
    setUploading(false);
    if (url) {
      onChange(url);
      // Remount the gallery so the new file appears in it straight away.
      setGalleryKey((k) => k + 1);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so re-picking the same file after a failed upload still
    // fires a change event.
    e.target.value = "";
    if (file) void processFile(file);
  };

  const { dragging, dropProps } = useFileDrop({
    onFile: (file) => void processFile(file),
    accept: isImageFile,
    rejectMessage: "That isn't an image — drop a png, jpg, gif or webp",
    disabled: uploading,
  });

  const handleGallerySelect = useCallback((url: string) => {
    onChange(url);
    toast.success("Image selected");
  }, [onChange]);

  const handleGalleryDelete = useCallback((url: string) => {
    if (value === url) onChange("");
  }, [value, onChange]);

  return (
    <>
      <div className="space-y-3 mt-1">
        {/* ── Currently selected image preview ── */}
        {value && (
          <div className="relative group rounded-xl overflow-hidden border border-border/60 bg-muted/20">
            <img
              src={value}
              alt="Selected"
              className="w-full max-h-36 object-cover block"
              onError={(e) => {
                // Retry a few times, then show fallback
                retryImageLoad(e);
                const img = e.currentTarget;
                const attempt = Number(img.dataset.retry ?? "0");
                if (attempt >= MAX_IMG_RETRIES) {
                  img.style.display = "none";
                  const fallback = img.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "flex";
                }
              }}
            />
            <div className="items-center justify-center py-6 text-muted-foreground text-xs gap-2 flex-col" style={{ display: "none" }}>
              <span className="text-destructive/70 text-[11px]">⚠ Image not found (404)</span>
              <span className="text-[10px] text-muted-foreground/60 max-w-[200px] truncate">{value}</span>
            </div>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                variant="destructive"
                size="sm"
                className="h-8 w-8 p-0 rounded-full shadow-md"
                title="Remove image"
                onClick={() => onChange("")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Upload / Gallery tab switcher ── */}
        <div className="flex items-center gap-1 glass-card p-1 rounded-2xl w-full">
          {(
            [
              { id: "upload" as const, icon: Upload, label: "Upload" },
              { id: "gallery" as const, icon: Images, label: "Gallery" },
              { id: "generate" as const, icon: Sparkles, label: "Generate" },
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSourceTab(id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors duration-150 flex-1 justify-center",
                sourceTab === id
                  ? "text-label-1"
                  : "text-label-3 hover:text-foreground/65",
              )}
            >
              {sourceTab === id && (
                <motion.div
                  layoutId="image-upload-source-tab"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "rgba(79,70,229,0.12)" }}
                  transition={{ type: "tween", duration: 0.2 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Upload panel */}
        {sourceTab === "upload" && (
          <div className="mt-5 space-y-2">
            {/* Destination folder picker */}
            <FolderDestPicker
              folders={folders}
              destFolderId={destFolderId}
              destFolderName={destFolderName}
              onChange={(id, name) => { setDestFolderId(id); setDestFolderName(name); }}
            />

            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif"
              onChange={handleFile}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              {...dropProps}
              className={cn(
                "w-full flex flex-col items-center justify-center gap-2.5 py-6 rounded-xl",
                "border-2 border-dashed transition-all group disabled:opacity-60",
                dragging
                  ? "border-primary/70 bg-primary/[0.07] text-foreground scale-[1.01]"
                  : "border-border/50 hover:border-primary/40 hover:bg-primary/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                  dragging ? "bg-primary/15 text-primary" : "bg-muted/60 group-hover:bg-primary/10",
                )}
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              </div>
              <p className="text-xs font-medium text-center">
                {uploading ? "Uploading…" : dragging ? "Drop to upload" : "Drop an image here, or click to browse"}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                Saving to: <span className="font-medium">{destFolderName ?? "Unfiled"}</span>
              </p>
            </button>
          </div>
        )}

        {/* Generate panel — every call in here is operator-triggered */}
        {sourceTab === "generate" && (
          <ImageGenerator
            purpose={purpose}
            segmentId={segmentId}
            folderId={destFolderId}
            onUse={(url) => {
              onChange(url);
              // Remount the gallery so a kept render appears in it straight away.
              setGalleryKey((k) => k + 1);
            }}
          />
        )}

        {/* Gallery panel — uses shared HeroGallery */}
        {sourceTab === "gallery" && (
          <div className="mt-4">
            <HeroGallery
              key={galleryKey}
              selectedUrl={value}
              onSelect={handleGallerySelect}
              onDelete={handleGalleryDelete}
              onCurrentFolderChange={handleCurrentFolderChange}
              maxHeight={280}
              columns={3}
            />
          </div>
        )}

      </div>
    </>
  );
}
