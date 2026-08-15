/**
 * email-sanitize.ts — Centralized sanitization utilities for the Content Builder.
 *
 * 1. DOMPurify wrapper for user-generated HTML rendered via dangerouslySetInnerHTML.
 * 2. URL scheme validator to prevent javascript: / data: injection from imported templates.
 */
import DOMPurify from "dompurify";

// ── DOMPurify configuration ──────────────────────────────────────────────────

/**
 * Sanitize user-generated HTML for safe rendering in the builder preview.
 * Allows inline styles (needed for colored spans from SFMC import) but strips
 * event handlers, scripts, and dangerous attributes.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p", "br", "span", "strong", "b", "em", "i", "u", "a",
      "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
      "div", "img", "table", "thead", "tbody", "tr", "th", "td",
      "blockquote", "pre", "code", "hr", "sup", "sub", "small",
    ],
    ALLOWED_ATTR: [
      "style", "href", "src", "alt", "width", "height", "target",
      "class", "align", "valign", "cellpadding", "cellspacing",
      "border", "colspan", "rowspan",
    ],
    ALLOW_DATA_ATTR: false,
    // Strip javascript: and data: from href/src
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|cid):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * Sanitize a full HTML document (e.g. imported SFMC template) for iframe preview.
 * More permissive — allows full document structure but strips scripts and event handlers.
 */
export function sanitizeFullHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    WHOLE_DOCUMENT: true,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|cid):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false,
    ADD_TAGS: ["style", "link", "meta", "title", "head", "body", "html"],
    ADD_ATTR: ["xmlns", "xmlns:v", "xmlns:o", "http-equiv", "content", "name", "charset"],
  });
}

// ── URL scheme validation ────────────────────────────────────────────────────

/** Allowed URL schemes for links in email blocks. */
const SAFE_SCHEMES = /^(https?:|mailto:|tel:|cid:|#|%%)/i;

/**
 * Validate a URL for safe use in href/src attributes.
 * Returns the URL if safe, or "#" if the scheme is dangerous.
 *
 * Allows:
 * - http:// and https://
 * - mailto: and tel:
 * - cid: (for embedded images in EML)
 * - # (anchor / placeholder)
 * - %% (SFMC AMPscript merge fields like %%unsub_url%%)
 * - Relative paths (no colon before first slash)
 */
export function safeUrl(url: string | undefined | null): string {
  if (!url) return "#";
  const trimmed = url.trim();
  if (!trimmed) return "#";

  // Relative URLs are safe (no scheme)
  if (!trimmed.includes(":") || trimmed.startsWith("/") || trimmed.startsWith(".")) {
    return trimmed;
  }

  // Check against allowed schemes
  if (SAFE_SCHEMES.test(trimmed)) {
    return trimmed;
  }

  // Block everything else (javascript:, data:, vbscript:, etc.)
  return "#";
}

/**
 * Sanitize all URL fields in a block content record (mutates nothing, returns new object).
 * Applies safeUrl to known URL fields.
 */
const URL_FIELDS = [
  "url", "linkUrl", "imageUrl", "logoUrl", "src", "videoUrl", "thumbnailUrl", "thumbnailWithPlayUrl",
  "buttonUrl", "link1Url", "link2Url", "link3Url",
  "col1ImageLink", "col2ImageLink", "col3ImageLink", "col4ImageLink", "col5ImageLink",
  "col1ButtonUrl", "col2ButtonUrl", "col3ButtonUrl", "col4ButtonUrl", "col5ButtonUrl",
  "facebook", "twitter", "instagram", "linkedin", "youtube", "tiktok",
];

export function sanitizeBlockUrls(content: Record<string, string>): Record<string, string> {
  const result = { ...content };
  for (const field of URL_FIELDS) {
    if (result[field]) {
      result[field] = safeUrl(result[field]);
    }
  }
  return result;
}
