/**
 * email-image-urls.ts — Convert in-builder image URLs into email-safe public URLs.
 *
 * Gmail's mobile apps (iOS + Android) refuse to render `data:` URIs in `<img src>`
 * and cannot resolve relative paths once an email leaves your server. Every URL
 * that ends up inside a sent email must therefore be an absolute https:// (or
 * http://) URL pointing at a publicly reachable host.
 *
 * This module is the single chokepoint that every email-send path should pipe
 * its blocks through before generating HTML. It handles three input shapes:
 *
 *   • Absolute http(s) URL  → passthrough (already email-safe).
 *   • Relative `/path`      → prepend the orchestrator's public origin
 *                             (the orchestrator's static plugin already serves
 *                              everything in `public/` at the root prefix).
 *   • `data:` URI           → upload to Supabase Storage and return its public
 *                             URL. This rescues anything that fell back to
 *                             base64 (e.g. a Supabase upload that failed at
 *                             builder time, or a hero composite from canvas).
 *
 * The resolver covers every image-bearing field in our block schema:
 * logoUrl, imageUrl, thumbnail{,WithPlay}Url, icon-grid items, col{N}ImageUrl.
 */

import { supabase } from "@/lib/supabase-client";
import { uploadEmailImageBlob } from "@/lib/email-image-storage";
import { ORCHESTRATOR_BASE } from "@/services/emailApi";
import type { EmailBlock, IconGridItem } from "@/types/email-builder";

/** Social platforms we render in the social-links block. */
export const SUPPORTED_SOCIAL_PLATFORMS = [
  "facebook",
  "twitter",
  "instagram",
  "linkedin",
  "youtube",
] as const;

export type SocialPlatform = (typeof SUPPORTED_SOCIAL_PLATFORMS)[number];

// ── Public origin resolution ─────────────────────────────────────────────────

/**
 * RFC1918 / loopback hostnames that mail clients (and image proxies) cannot
 * reach across the public internet. If our base URL falls into one of these,
 * the rendered email will silently break on every device that isn't on the
 * developer's LAN.
 */
const PRIVATE_HOST_RE = /^https?:\/\/(?:localhost|127\.|0\.0\.0\.0|10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|\[::1\])/i;

/**
 * The public origin we'll use to resolve relative asset paths. Prefers an
 * explicitly-configured orchestrator base (set via VITE_ORCH_API_BASE), and
 * falls back to the browser's own origin only when that origin is public.
 *
 * Returns an empty string if nothing public can be determined — callers should
 * treat that as "image will not load in real mail clients" and surface a warn.
 */
export function getEmailPublicOrigin(): string {
  const orchestrator = (ORCHESTRATOR_BASE || "").replace(/\/+$/, "");
  if (orchestrator && !PRIVATE_HOST_RE.test(orchestrator)) return orchestrator;

  if (typeof window !== "undefined" && window.location?.origin) {
    const browser = window.location.origin.replace(/\/+$/, "");
    if (!PRIVATE_HOST_RE.test(browser)) return browser;
  }

  // Last resort: return the orchestrator URL even if it's private, so dev
  // previews still render in the browser (just not in a real mail client).
  return orchestrator;
}

let warnedAboutPrivateOrigin = false;
function warnIfPrivateOrigin(): void {
  if (warnedAboutPrivateOrigin) return;
  const origin = getEmailPublicOrigin();
  if (!origin || PRIVATE_HOST_RE.test(origin)) {
    warnedAboutPrivateOrigin = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[email-image-urls] No public HTTPS origin configured. Bundled assets " +
        "(logo, social icons, etc.) will not load in mobile Gmail or other " +
        "proxied mail clients. Set VITE_ORCH_API_BASE to a public HTTPS origin.",
    );
  }
}

// ── Social icon URLs (synchronous — no network needed) ───────────────────────

/**
 * Returns a `{ platform: absoluteUrl }` map for the social-links block.
 * Uploads icons to Supabase Storage for guaranteed public access (cached per session).
 * Falls back to orchestrator origin URLs if upload fails.
 */
export async function getSocialIconUrls(): Promise<Record<SocialPlatform, string>> {
  const result = {} as Record<SocialPlatform, string>;
  await Promise.all(
    SUPPORTED_SOCIAL_PLATFORMS.map(async (platform) => {
      const relativePath = `/social-icons/${platform}.png`;
      const resolved = await resolveImageUrlForEmail(relativePath);
      result[platform] = resolved;
    }),
  );
  return result;
}

// ── Single-URL resolver ──────────────────────────────────────────────────────

/** Sniff a likely extension for an arbitrary blob (defaults to png). */
function extForBlob(blob: Blob): string {
  const t = (blob.type || "").toLowerCase();
  if (t.includes("gif")) return "gif";
  if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
  if (t.includes("webp")) return "webp";
  if (t.includes("svg")) return "svg";
  return "png";
}

/**
 * Cache for repeated data-URI uploads within a single session — we hash the
 * first ~256 chars + length to avoid re-uploading the same composite many times
 * during a single send. The cache is intentionally process-local (cleared on
 * page reload) since Supabase Storage handles persistent dedupe via filenames.
 */
const dataUriUploadCache = new Map<string, string>();

function dataUriCacheKey(uri: string): string {
  return `${uri.length}|${uri.slice(0, 256)}`;
}

/**
 * Resolves a single image URL into something that will render in every email
 * client, including mobile Gmail. Never throws — falls back to the original
 * URL with a console warning if upload fails (caller decides whether to abort).
 */
export async function resolveImageUrlForEmail(
  url: string | undefined | null,
): Promise<string> {
  if (!url) return "";

  // Already absolute and public — passthrough.
  if (url.startsWith("https://") || url.startsWith("http://")) return url;

  // Protocol-relative — assume https for safety in mail clients.
  if (url.startsWith("//")) return `https:${url}`;

  // Data URI — upload to Supabase and return public URL.
  if (url.startsWith("data:")) {
    const cacheKey = dataUriCacheKey(url);
    const cached = dataUriUploadCache.get(cacheKey);
    if (cached) return cached;

    try {
      const blob = await (await fetch(url)).blob();
      const ext = extForBlob(blob);
      const publicUrl = await uploadEmailImageBlob(blob, {
        filenamePrefix: "email-inline",
        ext,
      });
      if (publicUrl) {
        dataUriUploadCache.set(cacheKey, publicUrl);
        return publicUrl;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        "[email-image-urls] Failed to upload data: URI to Supabase Storage. " +
          "This image will not load in mobile Gmail.",
        err,
      );
    }
    return url;
  }

  // Relative path — fetch locally and upload to Supabase for guaranteed public access.
  // Azure app service URLs may require auth, so we can't just prepend the origin.
  if (url.startsWith("/") || (!url.includes("://") && !url.startsWith("data:"))) {
    const cacheKey = `rel:${url}`;
    const cached = dataUriUploadCache.get(cacheKey);
    if (cached) return cached;

    try {
      const blob = await (await fetch(url)).blob();
      const ext = extForBlob(blob);
      const publicUrl = await uploadEmailImageBlob(blob, {
        filenamePrefix: "email-asset",
        ext,
      });
      if (publicUrl) {
        dataUriUploadCache.set(cacheKey, publicUrl);
        return publicUrl;
      }
    } catch (err) {
      console.warn("[email-image-urls] Failed to upload relative path to Supabase:", url, err);
    }
    // Fallback: prepend origin (may not work for external recipients)
    warnIfPrivateOrigin();
    const origin = getEmailPublicOrigin();
    if (!origin) return url;
    return url.startsWith("/") ? `${origin}${url}` : `${origin}/${url}`;
  }

  return url;
}

// ── Block walker ─────────────────────────────────────────────────────────────

/**
 * Single-URL string fields on a block's content map that should be resolved.
 * Multi-field structures (icon-grid items, col{N}ImageUrl) are handled
 * separately below.
 */
const SINGLE_URL_FIELDS = [
  "logoUrl",
  "imageUrl",
  "thumbnailUrl",
  "thumbnailWithPlayUrl",
] as const;

/** Max columns we currently support (matches PRESETS in renderColumns). */
const MAX_COLUMNS = 6;

/**
 * Walks every image URL in a template's blocks and resolves them to
 * email-safe absolute HTTPS URLs (uploading any data: URIs to Supabase).
 *
 * Returns a NEW block array (does not mutate the input). Safe to call multiple
 * times — already-resolved URLs short-circuit immediately.
 */
export async function resolveBlockImageUrlsForEmail(
  blocks: EmailBlock[],
): Promise<EmailBlock[]> {
  return Promise.all(
    blocks.map(async (block) => {
      const content: Record<string, string> = { ...block.content };

      // 1. Single-URL string fields.
      for (const field of SINGLE_URL_FIELDS) {
        const value = content[field];
        if (typeof value === "string" && value) {
          content[field] = await resolveImageUrlForEmail(value);
        }
      }

      // 2. icon-grid: items JSON array.
      if (block.type === "icon-grid" && typeof content.items === "string") {
        try {
          const items = JSON.parse(content.items) as IconGridItem[];
          const resolved = await Promise.all(
            items.map(async (item) => ({
              ...item,
              imageUrl: item.imageUrl
                ? await resolveImageUrlForEmail(item.imageUrl)
                : item.imageUrl,
            })),
          );
          content.items = JSON.stringify(resolved);
        } catch {
          /* Malformed items JSON — leave untouched, renderer handles it. */
        }
      }

      // 3. columns: col{N}ImageUrl.
      for (let i = 1; i <= MAX_COLUMNS; i++) {
        const key = `col${i}ImageUrl`;
        const value = content[key];
        if (typeof value === "string" && value) {
          content[key] = await resolveImageUrlForEmail(value);
        }
      }

      return { ...block, content };
    }),
  );
}

// ── Background pattern helper ────────────────────────────────────────────────

/**
 * `renderPatternToPng` returns a data URI for the rasterized pattern tile.
 * For real email sends we need a public HTTPS URL instead — this helper
 * uploads the tile to Supabase Storage and returns its public URL.
 *
 * Returns undefined if there's no pattern to upload, so callers can pass the
 * result straight into `generateEmailHtml`'s `patternImageSrc` parameter.
 */
export async function resolvePatternUrlForEmail(
  dataUri: string | undefined | null,
): Promise<string | undefined> {
  if (!dataUri) return undefined;
  const url = await resolveImageUrlForEmail(dataUri);
  return url || undefined;
}

// ── Convenience: ensure Supabase email-images bucket is reachable ────────────

/**
 * Quick smoke check used by the test-send dialog to surface a clean error
 * before we try to upload N images. Returns true if we can list the bucket;
 * false (and a console warn) otherwise.
 */
export async function isEmailImageBucketReachable(): Promise<boolean> {
  try {
    const { error } = await supabase.storage.from("email-images").list("", {
      limit: 1,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(
        "[email-image-urls] email-images bucket is not reachable:",
        error.message,
      );
      return false;
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[email-image-urls] email-images bucket check failed:", err);
    return false;
  }
}
