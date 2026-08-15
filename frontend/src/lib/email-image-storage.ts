/**
 * Uploads email images to the public `email-images` Supabase Storage bucket
 * and hands back a public HTTPS URL.
 *
 * This exists because inline `data:` URIs and same-origin relative paths do
 * not render in most email clients (mobile Gmail in particular strips them).
 * Anything destined for exported HTML has to become a real public URL first —
 * see email-image-urls.ts, which is the main consumer.
 *
 * Returns null rather than throwing when Supabase isn't configured or the
 * upload fails, so callers can fall back to the original URL and the rest of
 * the builder keeps working during local setup.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase-client";

const BUCKET = "email-images";

export interface UploadEmailImageOptions {
  /** Prefix for the generated object name, e.g. "email-inline". */
  filenamePrefix: string;
  /** File extension without the dot, e.g. "png" | "jpg" | "gif". */
  ext: string;
  /** Overrides the blob's own MIME type when it is missing or generic. */
  contentType?: string;
}

export async function uploadEmailImageBlob(
  blob: Blob,
  { filenamePrefix, ext, contentType }: UploadEmailImageOptions,
): Promise<string | null> {
  if (!isSupabaseConfigured) {
    console.warn(
      "[email-image-storage] Supabase is not configured — skipping upload. " +
        "This image will not load for external recipients.",
    );
    return null;
  }

  const path = `${filenamePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: contentType || blob.type || `image/${ext}`,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      console.warn("[email-image-storage] Upload failed:", error.message);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.warn("[email-image-storage] Upload threw:", err);
    return null;
  }
}
