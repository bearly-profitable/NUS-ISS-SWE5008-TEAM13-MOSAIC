/**
 * Uploads a picked or dropped image file and returns a URL the email can use.
 *
 * Shared by every image field in the app — the builder's ImageUpload panel and
 * the brand-asset tiles in Creative Review — so the awkward parts are handled
 * the same way everywhere: oversized GIFs get compressed (Gmail refuses to
 * load large ones), and a failed Supabase upload degrades to a local data URI
 * rather than losing the file.
 *
 * Reports its own problems through toasts and returns null only when there is
 * genuinely no usable URL, so callers can stay a single `if`.
 */
import { toast } from "sonner";
import { uploadEmailImageBlob } from "@/lib/email-image-storage";
import { registerImageAsset } from "@/services/imageFoldersApi";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Gmail will not render a GIF much past this, so we re-encode instead. */
const GIF_COMPRESS_THRESHOLD = 5 * 1024 * 1024;

async function putInStorage(file: File, folderId: string | null): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  // Goes through the Orchestrator, not the browser's Supabase client: the
  // bucket's RLS policies don't let the anon key write, so a direct upload
  // failed and every picked image degraded to a data URI that mail clients
  // then stripped. See email-image-storage.ts.
  const url = await uploadEmailImageBlob(file, {
    filenamePrefix: file.name.replace(/\.[^.]+$/, "") || "image",
    ext,
    contentType: file.type,
  });
  if (!url) return null;

  registerImageAsset({
    storagePath: url.split("/").pop() ?? "",
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    folderId,
  }).catch(() => {
    /* the image is already usable; the folder index is a nicety */
  });
  return url;
}

function asDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export interface UploadImageOptions {
  folderId?: string | null;
  /** Named in the success toast so the user knows where it landed. */
  folderName?: string | null;
  /** Set false for one-off assets that shouldn't announce themselves. */
  notify?: boolean;
}

export async function uploadImageFile(
  file: File,
  { folderId = null, folderName = null, notify = true }: UploadImageOptions = {},
): Promise<string | null> {
  if (file.size > MAX_IMAGE_BYTES) {
    toast.error(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max is ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`,
    );
    return null;
  }

  try {
    const url = await putInStorage(file, folderId);
    if (url) {
      const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
      if (isGif && file.size > GIF_COMPRESS_THRESHOLD) {
        toast.info("GIF is over 5MB — auto-compressing for email compatibility…", { duration: 4000 });
        try {
          const { ORCHESTRATOR_BASE } = await import("@/services/emailApi");
          const resp = await fetch(`${ORCHESTRATOR_BASE}/api/gif-optimize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: url }),
          });
          if (resp.ok) {
            const blob = await resp.blob();
            const optimised = await putInStorage(new File([blob], file.name, { type: "image/gif" }), folderId);
            if (optimised) {
              const savedMB = ((file.size - blob.size) / 1024 / 1024).toFixed(1);
              toast.success(`GIF compressed (saved ${savedMB}MB). Email-safe!`);
              return optimised;
            }
          }
        } catch {
          // Compression is best-effort — the original still uploaded fine.
        }
        toast.warning("GIF compression failed — using original. It may not load in Gmail.", { duration: 6000 });
      }

      if (notify) {
        toast.success(folderName ? `Image uploaded to “${folderName}”` : "Image uploaded");
      }
      return url;
    }
  } catch {
    // Fall through to the local fallback below.
  }

  // Supabase upload failed (transient network error, or Storage not set up
  // yet). Keep the image as a base64 data URI so the preview works now; the
  // resolver in lib/email-image-urls.ts re-uploads it to a public https URL
  // at send time, so mobile Gmail still renders it.
  try {
    const dataUri = await asDataUri(file);
    toast.warning(
      "Upload to storage failed — image kept locally. It will be re-uploaded to public storage when you send.",
      { duration: 6000 },
    );
    return dataUri;
  } catch {
    toast.error("Could not read that image file.");
    return null;
  }
}
