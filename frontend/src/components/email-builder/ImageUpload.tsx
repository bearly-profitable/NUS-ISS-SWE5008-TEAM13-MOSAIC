import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, X, Images, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase-client";
import {
  registerImageAsset,
  listImageFolders,
  type ImageFolder,
} from "@/services/imageFoldersApi";
import { FolderDestPicker } from "./FolderDestPicker";
import { HeroGallery } from "./HeroGallery";

const BUCKET = "email-images";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMG_RETRIES = 3;

function retryImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const attempt = Number(img.dataset.retry ?? "0");
  if (attempt >= MAX_IMG_RETRIES) return;
  img.dataset.retry = String(attempt + 1);
  const sep = img.src.includes("?") ? "&" : "?";
  img.src = img.src.replace(/[?&]_rt=\d+/, "") + `${sep}_rt=${Date.now()}`;
}

async function uploadToStorage(file: File, targetFolderId: string | null): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return null;
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  // Register in image_asset table — defaults to the currently viewed folder
  registerImageAsset({
    storagePath: path,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    folderId: targetFolderId,
  }).catch(() => { /* non-critical */ });
  return url;
}

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sourceTab, setSourceTab] = useState<"upload" | "gallery">(() => (value ? "gallery" : "upload"));
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max is 10MB.`);
      return;
    }

    setUploading(true);
    try {
      const url = await uploadToStorage(file, destFolderId);
      if (url) {
        // Auto-compress GIF if over 5MB (Gmail won't load large GIFs)
        const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
        if (isGif && file.size > 5 * 1024 * 1024) {
          toast.info("GIF is over 5MB — auto-compressing for email compatibility...", { duration: 4000 });
          try {
            const { ORCHESTRATOR_BASE } = await import("@/services/emailApi");
            const resp = await fetch(`${ORCHESTRATOR_BASE}/api/gif-optimize`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl: url }),
            });
            if (resp.ok) {
              const blob = await resp.blob();
              const optimizedUrl = await uploadToStorage(
                new File([blob], file.name, { type: "image/gif" }),
                destFolderId,
              );
              if (optimizedUrl) {
                onChange(optimizedUrl);
                const savedMB = ((file.size - blob.size) / 1024 / 1024).toFixed(1);
                toast.success(`GIF compressed (saved ${savedMB}MB). Email-safe!`);
                setGalleryKey((k) => k + 1);
                return;
              }
            }
          } catch {
            // Compression failed — use original (user was warned)
          }
          toast.warning("GIF compression failed — using original. It may not load in Gmail.", { duration: 6000 });
        }
        onChange(url);
        toast.success(
          destFolderName
            ? `Image uploaded to "${destFolderName}"`
            : "Image uploaded",
        );
        setGalleryKey((k) => k + 1);
        return;
      }
    } catch {
      // Fall through to base64
    } finally {
      setUploading(false);
    }
    // Fallback path: Supabase Storage upload failed (e.g. transient network
    // error). Store the image as a base64 data: URI so the in-builder preview
    // keeps working. On real email send (test or campaign), the resolver in
    // `src/lib/email-image-urls.ts` will re-upload this blob to Supabase and
    // rewrite it to a public https:// URL — so mobile Gmail still renders the
    // image. We just warn the user about the local-only state.
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
      toast.warning(
        "Supabase upload failed — image stored locally. It will be re-uploaded to public storage when you send.",
        { duration: 6000 },
      );
    };
    reader.readAsDataURL(file);
  };

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
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSourceTab(id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150 flex-1 justify-center",
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
              className="w-full flex flex-col items-center justify-center gap-2.5 py-6 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/40 hover:bg-primary/[0.03] transition-all text-muted-foreground hover:text-foreground group disabled:opacity-60"
            >
              <div className="h-10 w-10 rounded-xl bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              </div>
              <p className="text-xs font-medium text-center">
                {uploading ? "Uploading…" : "Click to upload (png, jpg, gif)"}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                Saving to: <span className="font-medium">{destFolderName ?? "Unfiled"}</span>
              </p>
            </button>
          </div>
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
