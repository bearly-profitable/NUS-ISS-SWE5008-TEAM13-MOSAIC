/**
 * Uploads email images to the public `email-images` bucket and hands back a
 * public HTTPS URL.
 *
 * This exists because inline `data:` URIs and same-origin relative paths do
 * not render in most email clients (mobile Gmail in particular strips them).
 * Anything destined for exported HTML has to become a real public URL first —
 * see email-image-urls.ts, which is the main consumer.
 *
 * The upload goes through the Orchestrator rather than straight at Supabase
 * from the browser. The bucket is public to *read*, but its RLS policies do
 * not grant the anon key insert rights, so the direct client call failed with
 * "new row violates row-level security policy" — and because this function
 * swallows failures, emails silently shipped with their images still inline.
 * The backend holds the service-role key, which bypasses RLS.
 *
 * Still returns null rather than throwing, so a builder-time upload degrades
 * to a local data URI instead of losing the image. Send-time callers must
 * check the result — see EmailReview's dispatch path.
 */
import { ORCHESTRATOR_BASE } from "@/services/emailApi";

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
  const base = (ORCHESTRATOR_BASE || "").replace(/\/+$/, "");
  // FormData forwards the blob's own MIME type, so an override has to be
  // applied to the blob itself rather than passed alongside it.
  const typed =
    contentType && contentType !== blob.type ? new Blob([blob], { type: contentType }) : blob;
  const body = new FormData();
  body.append("file", typed, `${filenamePrefix}.${ext}`);

  try {
    const res = await fetch(`${base}/api/email-assets/upload`, { method: "POST", body });
    if (!res.ok) {
      const text = await res.text();
      let message = text;
      try {
        message = JSON.parse(text)?.detail ?? text;
      } catch {
        /* not JSON — keep the raw body */
      }
      console.warn("[email-image-storage] Upload failed:", message);
      return null;
    }
    const { url } = (await res.json()) as { url: string };
    return url || null;
  } catch (err) {
    console.warn("[email-image-storage] Upload threw:", err);
    return null;
  }
}
