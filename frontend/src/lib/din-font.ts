/**
 * Email-safe font stack used inside rendered/previewed messages.
 * CampaignOS used a licensed M1 font here (DIN Round Pro) — replaced with a
 * web-safe stack for Northbank Living. Swap this to a licensed brand font
 * later if Northbank Living picks one; every block renderer in
 * EmailPreview.tsx and export-html.ts references this single constant.
 */
export const DIN_FONT_FAMILY_STACK =
  '"Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif';

/**
 * @font-face CSS injected into exported email <head>. Returns "" since the
 * web-safe stack above needs no embedded font file (CampaignOS embedded the
 * licensed DIN Round Pro OTF here).
 */
export function dinRoundProEmailFontFaceCss(): string {
  return "";
}
