# Porting the CampaignOS Email Builder into Another App

A practical, self-contained guide to lifting the email builder out of CampaignOS and dropping it into a different React application.

**Scope:** only the email builder (`/email-builder` route). Everything else in CampaignOS — journeys, workflows, audiences, analytics, approvals — is out of scope and is *not* a dependency of the builder.

---

## 1. What the email builder actually is

At its core it is a **block-array editor with two renderers**:

```
EmailBlock[]  ──┬── EmailPreview.tsx  → React/DOM  (what you see while editing)
   (state)      │
                └── export-html.ts    → table-based HTML  (what actually gets sent)
```

Everything else — the palette, the per-block editors, the hero designer, template storage, translation, test send — orbits those three things. If you understand `EmailBlock`, `EmailPreview`, and `generateEmailHtml`, you understand the builder.

### The data model (the one thing you must keep)

```ts
type EmailBlock = {
  id: string;
  type: BlockType;                  // 20 types: header, hero-image, heading, body-text,
                                    // button, divider, image, gif, image-text, icon-grid,
                                    // columns, social-links, footer, spacer, video,
                                    // countdown, table, coupon, accordion, lang-toggle
  content: Record<string, string>;  // ⚠️ ALL values are strings — always
};

type EmailTemplate = {
  id, name, subject, preheader?,
  blocks: EmailBlock[],
  background?: EmailBackground,     // page bg: solid | gradient | pattern | geometric
  updatedAt, folderId?, ownerId?, isPrivate?,
  createdBy?, lastModifiedBy?, createdAt?, tagIds?,
  locale?, hasChineseTranslation?, subjectTranslations?, preheaderTranslations?
};
```

**The flat `Record<string, string>` content bag is deliberate.** Numbers are `"50"`, booleans are `"true"`, nested structures are JSON strings (`content.items`, `content.rows`, `content.heroOverlay`, `content.translations`). Do not "improve" this into a typed union during the port — every editor, every preview renderer, every HTML renderer, and the HTML importer all assume it. Changing it turns a 2-day port into a 3-week rewrite.

Source of truth: [src/types/email-builder.ts](../src/types/email-builder.ts) (478 lines) — block types, defaults (`BLOCK_DEFAULTS`), background presets (`BG_PRESETS`), template/folder/tag/version interfaces. **Port this file first, unchanged.**

---

## 2. File inventory

### Tier 1 — Core (required; the builder is meaningless without these)

| File | LOC | Purpose |
|---|---|---|
| `src/types/email-builder.ts` | 478 | Data model, block defaults, background presets |
| `src/components/email-builder/EmailPreview.tsx` | 1328 | DOM renderer + drag-to-reorder + viewport/dark-mode simulation |
| `src/components/email-builder/export-html.ts` | 1248 | **Email-safe HTML generator** + `.eml` generator |
| `src/components/email-builder/BlockEditor.tsx` | 679 | Block list: reorder, duplicate, hide, lock, delete; dispatches to editors |
| `src/components/email-builder/BlockPalette.tsx` | 112 | "Add block" grid |
| `src/components/email-builder/editors/index.ts` | 74 | `BLOCK_EDITOR_REGISTRY` — the extension point |
| `src/components/email-builder/editors/shared.tsx` | 191 | `ColorPickerField`, `SizeInput`, `AlignmentSelect`, `FieldLabel`, `ToggleRow` |
| `src/components/email-builder/editors/*.tsx` (18 more) | ~2100 | One editor per block type |
| `src/components/email-builder/background-patterns.ts` | 274 | SVG pattern generators (preview + email tile + data-URI) |
| `src/components/email-builder/BackgroundEditor.tsx` | 397 | Background/theme panel |
| `src/lib/email-sanitize.ts` | 105 | DOMPurify wrappers + `safeUrl()` scheme allowlist |
| `src/pages/EmailBuilder.tsx` | 1485 | The page shell wiring it all together |

**Tier 1 total: ~8,500 LOC.** This is the honest minimum.

### Tier 2 — Storage & UX (strongly recommended)

| File | LOC | Purpose |
|---|---|---|
| `src/hooks/use-email-templates.ts` | 807 | Templates/folders/tags/versions — **Supabase + localStorage dual-write** |
| `src/components/email-builder/TemplateBrowser.tsx` | 1558 | Folder tree, search, tag filter, preview, duplicate/move/delete |
| `src/components/email-builder/SaveTemplateDialog.tsx` | 572 | Save-as with folder/tag/privacy picker |
| `src/hooks/use-undo-redo.ts` | 86 | Undo/redo over `{blocks, background, subject}` snapshots |
| `src/hooks/use-autosave.ts` | 172 | localStorage draft recovery |
| `src/hooks/use-undo-delete.ts` | ~60 | Toast-based "undo delete" |
| `src/components/email-builder/ImageUpload.tsx` | 443 | Upload → Supabase Storage; gallery; AI-image entry point |
| `src/lib/email-image-storage.ts` | 38 | Blob → Supabase Storage → public URL |
| `src/lib/email-image-urls.ts` | 321 | **Critical:** rewrites `data:`/relative URLs to public https for mail clients |

### Tier 3 — Optional features (each is independently removable)

| Feature | Files | LOC | External dependency |
|---|---|---|---|
| **Hero image designer** | `HeroImageEditor.tsx`, `hero-export.ts`, `lib/hero-blob-text-layout.ts`, `lib/din-font.ts`, `editors/HeroImageBlockEditor.tsx` | ~2,700 | Orchestrator `/api/hero-composite`, `/api/hero-gif-composite`; DIN Round Pro OTF files |
| **AI generation** | `AIGenerateTab.tsx` | 1036 | `/api/ai-generate-email` (SSE, LLM) |
| **AI images (Midjourney)** | `HeroGallery.tsx`, `FolderDestPicker.tsx`, `lib/midjourney-client.ts`, `services/imageFoldersApi.ts` | ~1,500 | Discord/Midjourney creds |
| **HTML import (SFMC)** | `ImportHtmlDialog.tsx`, `HtmlToBlocks.ts` | ~1,230 | none (pure DOM parsing) |
| **Test send** | `TestSendDialog.tsx`, `EmailInspectorTab.tsx` | 638 | Orchestrator `/api/test-send` → Resend |
| **Translation (EN↔ZH)** | `services/translateApi.ts`, `editors/LangToggleBlockEditor.tsx` | 270 | Orchestrator `/api/translate-email` → LLM |
| **Video thumbnails** | `lib/video-thumbnail.ts`, `editors/VideoBlockEditor.tsx` | 238 | none (canvas) |
| **NFM sync** | `services/nfmTemplateApi.ts` | 50 | M1-internal; **delete this** |
| **GIF optimize** | (inside `ImageUpload.tsx`) | — | Orchestrator `/api/gif-optimize` |

### Dead code — do not port

These three files are **unreferenced anywhere in the codebase**:

- `ImportedHtmlEditor.tsx` (857 LOC)
- `TranslationPanel.tsx` (225 LOC) — superseded by `editors/LangToggleBlockEditor.tsx`
- `editors/ScratchCouponBlockEditor.tsx` (144 LOC) — not in `BLOCK_EDITOR_REGISTRY`

That's ~1,200 LOC you can skip.

---

## 3. External dependencies

### npm packages the builder actually needs

**Required:**
```
react react-dom
@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities   # drag-to-reorder (BlockEditor + EmailPreview)
dompurify                                            # sanitization
react-markdown rehype-raw rehype-sanitize            # body-text rendering in preview
lucide-react                                         # icons (everywhere)
framer-motion                                        # panel/list animations
sonner                                               # toasts
clsx tailwind-merge class-variance-authority         # cn() + shadcn
tailwindcss                                          # all styling
```

**Required only for specific tiers:**
```
@supabase/supabase-js     # Tier 2 storage + image uploads
react-colorful            # BodyTextBlockEditor colour popover
@radix-ui/*               # whatever your shadcn components need (see below)
```

**Not needed by the builder** despite being in `package.json`: `@xyflow/react`, `recharts`, `@azure/msal-*`, `openai`, `midjourney`, `@tanstack/react-query`, `react-hook-form`, `zod`, `date-fns`, `embla-carousel-react`, `input-otp`, `vaul`, `cmdk`, `react-day-picker`.

### shadcn/ui components required

`button`, `input`, `label`, `textarea`, `select`, `slider`, `switch`, `separator`, `tabs`, `dialog`, `dropdown-menu`, `popover`, `collapsible`, `scroll-area`, `resizable`, `toggle-group`

Plus two **custom** (non-shadcn) components you must copy from `src/components/ui/`:
- `confirm-delete-dialog.tsx`
- `undo-bar.tsx`

If your target app already has shadcn/ui, `npx shadcn@latest add <name>` covers all 16 standard ones.

### Backend endpoints (all optional; each degrades gracefully if you cut the feature)

| Endpoint | Used by | Backend |
|---|---|---|
| `POST /api/hero-composite` | `hero-export.ts` | `@napi-rs/canvas` server-side render |
| `POST /api/hero-gif-composite` | `HeroImageBlockEditor.tsx` | `@napi-rs/canvas` + `omggif` |
| `POST /api/gif-optimize` | `ImageUpload.tsx` | `omggif` |
| `POST /api/translate-email` | `translateApi.ts` | LLM |
| `POST /api/test-send` | `orchestratorApi.ts` | Resend API |
| `POST /api/ai-generate-email` | `AIGenerateTab.tsx` | LLM (SSE stream) — **implemented as a Vite dev-server plugin in `vite.config.ts`**, not in the orchestrator |
| `GET /api/midjourney/credentials` | `midjourney-client.ts` | also a Vite plugin |
| `/api/image-folders/*` | `imageFoldersApi.ts` | Supabase-backed asset library |

⚠️ Note the split: `ai-generate-email` and `midjourney/credentials` live in **`vite.config.ts`** as dev middleware. In production these must be reimplemented as real server routes — check how your target app builds before assuming they exist.

### Static assets to copy

```
public/m1logo.png                      # BLOCK_DEFAULTS.header default logo — replace with yours
public/fonts/dinroundpro_light.otf     # hero canvas rendering + @font-face in exported email
public/fonts/dinroundpro_bold.otf
public/social-icons/                   # social-links block PNGs
```

The DIN fonts are **licensed M1 brand fonts**. Do not copy them into a different product — swap `DIN_FONT_FAMILY_STACK` in `src/lib/din-font.ts` for your own stack (or a web-safe one).

---

## 4. The seams you must cut

These are the eight places the builder touches CampaignOS. Every one is a small, well-defined surface.

### Seam 1 — Supabase client
**`src/lib/supabase-client.ts`** — singleton, `db.schema: "campaign"`, auth disabled (MSAL is used instead).

Consumers: `use-email-templates.ts`, `email-image-storage.ts`, `email-image-urls.ts`, `ImageUpload.tsx`, `HeroGallery.tsx`, `AIGenerateTab.tsx`.

**Port options:**
- **Keep Supabase** → copy the file, change `schema` to whatever the target uses (or drop the `db.schema` option for `public`).
- **Different backend** → keep `use-email-templates.ts`'s *public API* identical and rewrite only its `sbLoad*` / `sbSave*` internals. The hook already has a localStorage fallback path, so it degrades to local-only if the network calls are stubbed to return `[]`.

### Seam 2 — Auth
`use-email-templates.ts` imports `useAuth()` from `@/contexts/AuthContext` (MSAL/Azure AD) purely to get `currentUserId` and `currentUserName` for ownership/`created_by` stamping.

**Minimal replacement:**
```ts
// Replace: import { useAuth } from "@/contexts/AuthContext";
const useAuth = () => ({ user: { id: yourUserId, name: yourUserName } });
```
Or hardcode `currentUserId = null` and drop private-template support entirely.

### Seam 3 — Orchestrator base URL
`src/services/orchestratorApi.ts` (~900 LOC of CampaignOS-wide API surface). **Do not port this file.** The email builder uses exactly two things from it:

```ts
export const ORCHESTRATOR_BASE = import.meta.env.VITE_ORCH_API_BASE ?? "";
export async function sendTestEmail(input: { to; subject; html }) { ... }
```

Create a 20-line `src/services/emailApi.ts` in the target app with just those, and repoint the four importers (`export-html.ts`, `hero-export.ts`, `HeroImageBlockEditor.tsx`, `email-image-urls.ts`, `translateApi.ts`).

### Seam 4 — Image storage
`uploadEmailImageBlob(blob, opts) → Promise<string | null>` in `email-image-storage.ts` is a **38-line function against the `email-images` bucket**. Swap the body for S3/Azure Blob/Cloudinary and nothing upstream changes.

### Seam 5 — Public URL resolution (do not skip this)
`src/lib/email-image-urls.ts` exists because **Gmail mobile refuses `data:` URIs and cannot resolve relative paths**. Before generating send-ready HTML, every image URL gets rewritten to an absolute public https URL — uploading `data:` URIs to storage on the fly if necessary.

If you port the builder without this module, emails will look perfect in the preview and have broken images on every phone. Keep it; just repoint `getEmailPublicOrigin()` at your own CDN/origin.

### Seam 6 — Brand defaults
`BLOCK_DEFAULTS` in `types/email-builder.ts` is saturated with M1 branding:
- `header.logoUrl: "/m1logo.png"`
- `hero-image.heroLogoUrl:` a **hardcoded Supabase URL** (`mbtedlrrxchxbdltmjud.supabase.co/...`) — this will 404 or leak against another project
- `social-links`: M1's Facebook/X/Instagram/LinkedIn/YouTube
- `footer`: `m1.com.sg`, contact-us, unsubscribe URLs
- Accent colour `#FF9E1B` (M1 orange) in `button`, `divider`, `countdown`, `table`, `coupon`, `accordion`
- `BG_PRESETS` includes `m1-orange-gradient`, `m1-dark`, `m1-waves`, `m1-hexagons`

**Do a full pass on this file before shipping.** Grep for `FF9E1B`, `m1`, `M1`, and `supabase.co` across `src/components/email-builder/` and `src/types/email-builder.ts`.

### Seam 7 — Path alias
Everything uses `@/…`. Ensure your target has:
```ts
// vite.config.ts
resolve: { alias: { "@": path.resolve(__dirname, "./src") } }
```
plus the matching `paths` entry in `tsconfig.json`. If your target uses a different alias or Next.js `src/app`, a project-wide find/replace on `@/` is the whole job.

### Seam 8 — Routing
`src/App.tsx` registers `<Route path="/email-builder" element={<EmailBuilder />} />` via react-router. `EmailBuilder` is a default-exported, **prop-less** page component that owns all its own state — so it drops into any router, or into a `<Dialog>`, with no adaptation.

---

## 5. Database schema

Four tables in the `campaign` schema. Full DDL: [aurora-migration/001_create_all_tables.sql](../aurora-migration/001_create_all_tables.sql), [supabase-migrations/create_email_template_folders.sql](../supabase-migrations/create_email_template_folders.sql), [supabase-migrations/enhance_template_library.sql](../supabase-migrations/enhance_template_library.sql).

```sql
create table email_template_folder (
  id          text primary key,
  name        text not null,
  description text not null default '',
  owner_id    uuid,                  -- null = shared/team folder
  is_private  boolean not null default false,
  color_key   text not null default 'orange',
  parent_id   text references email_template_folder(id) on delete cascade,
  folder_type text,                  -- 'always-on' | 'ad-hoc' | null
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table email_template (
  id               text primary key,
  name             text not null,
  subject          text not null default '',
  preheader        text,
  blocks           jsonb not null default '[]'::jsonb,   -- EmailBlock[]
  background       jsonb,                                -- EmailBackground
  folder_id        text references email_template_folder(id) on delete set null,
  owner_id         uuid,
  is_private       boolean not null default false,
  created_by       text,
  last_modified_by text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table email_template_tag (
  id text primary key, name text not null,
  color_key text not null default 'blue',
  category  text not null default 'general'   -- product | team | campaign-type | general
);

create table email_template_tag_map (
  template_id text references email_template(id) on delete cascade,
  tag_id      text references email_template_tag(id) on delete cascade,
  primary key (template_id, tag_id)
);

create table email_template_version (
  id text primary key,
  template_id text references email_template(id) on delete cascade,
  version_num int not null default 1,
  name text, subject text,
  blocks jsonb, background jsonb,
  saved_by text, note text default '',
  created_at timestamptz not null default now()
);
```

Plus a **public** storage bucket named `email-images`.

**RLS pattern used:** read if `is_private = false or owner_id = auth.uid()`; insert if `owner_id is null or owner_id = auth.uid()`; update/delete the same. Note that with MSAL auth (Supabase auth disabled), `auth.uid()` is always null in CampaignOS — so RLS is effectively "shared items visible to all, private items visible to none". **If your target app uses real Supabase auth, re-test these policies**; behaviour will change.

---

## 6. Environment variables

```bash
VITE_SUPABASE_URL=          # required for Tier 2 (templates + image upload)
VITE_SUPABASE_ANON_KEY=
VITE_ORCH_API_BASE=         # required for hero compositing, translate, test-send
```

Server-side (only if you port the corresponding features):
```bash
RESEND_API_KEY=             # /api/test-send
RESEND_FROM=
MIDJOURNEY_TOKEN=           # AI images
MIDJOURNEY_SERVER_ID=
MIDJOURNEY_CHANNEL_ID=
OPENAI_API_KEY=             # /api/ai-generate-email, /api/translate-email
```

---

## 7. Recommended port paths

### Path A — "Just the editor" (~1 day, ~8,500 LOC)

Blocks, editors, preview, HTML export, background editor. No persistence (parent app owns save/load), no AI, no hero designer, no test send.

1. Copy `src/types/email-builder.ts`, `src/lib/email-sanitize.ts`, `src/lib/utils.ts`.
2. Copy `src/components/email-builder/` **excluding**: `AIGenerateTab`, `HeroGallery`, `FolderDestPicker`, `HeroImageEditor`, `hero-export`, `ImportHtmlDialog`, `HtmlToBlocks`, `ImportedHtmlEditor`, `TemplateBrowser`, `SaveTemplateDialog`, `TestSendDialog`, `EmailInspectorTab`, `TranslationPanel`, `ImageUpload`.
3. In `editors/index.ts`, replace `HeroImageBlockEditor` with `ImageBlockEditor` for the `hero-image` key.
4. Replace `ImageUpload` usages (in `HeaderBlockEditor`, `ColumnsBlockEditor`, `IconGridBlockEditor`, `ImageBlockEditor`, `ImageTextBlockEditor`, `VideoBlockEditor`) with a plain URL `<Input>` — ~6 small edits.
5. Strip `renderHeroPreview` import from `EmailPreview.tsx` and the hero branch from `export-html.ts`.
6. Install the required npm deps + 16 shadcn components + the 2 custom ones.
7. Write a thin page: hold `blocks`/`background`/`subject` in state, render `<BlockPalette>`, `<BlockEditor>`, `<EmailPreview>`, and a Download button calling `generateEmailHtml()`.

**You keep:** all 20 block types (minus hero compositing), full styling controls, drag reorder, HTML export, `.eml` export, background system, undo-safe block ops.

### Path B — "Editor + template library" (~3 days, ~13,000 LOC)

Path A **plus** `use-email-templates.ts`, `TemplateBrowser`, `SaveTemplateDialog`, `ImageUpload`, `email-image-storage`, `email-image-urls`, the autosave/undo hooks, and the 5 DB tables + storage bucket. This is the sweet spot for most target apps.

### Path C — "Everything" (~1–2 weeks, ~18,000 LOC)

Path B plus hero designer, AI generation, Midjourney, HTML import, translation, test send — and the orchestrator service routes and LLM/Resend/Discord credentials behind them. Only worth it if the target app genuinely needs the hero designer; it's the single largest and most coupled subsystem (~2,700 LOC touching server-side canvas).

---

## 8. Gotchas

1. **`content` values are always strings.** `parseInt(content.size || "0")` is the idiom throughout. Don't hand a block a number.
2. **Two renderers must stay in sync.** Adding a block type means: `BlockType` union → `BLOCK_DEFAULTS` → `BLOCK_EDITOR_REGISTRY` → a renderer in `EmailPreview.tsx` → a renderer in `export-html.ts`. Miss the last one and the block silently vanishes from sent email (unknown types render as `""`).
3. **Preview ≠ email.** `EmailPreview` uses flexbox/modern CSS; `export-html.ts` emits nested `<table>` with inline styles for Outlook. They will never look byte-identical. Always verify against `generateEmailHtml()` output, never against the preview.
4. **Hidden blocks:** `content.hidden === "true"` filters a block out of export but keeps it in the editor. Preserve that check.
5. **Data URIs break mobile Gmail.** See Seam 5. Non-negotiable.
6. **The hero designer has a server-side twin.** Client canvas draws the preview; `/api/hero-composite` (`@napi-rs/canvas`) redraws it server-side for the final PNG. The two renderers must produce identical output — this is why `lib/hero-blob-text-layout.ts` and `lib/din-font.ts` are shared between client and server. Porting the hero designer without the server route gives you a preview that doesn't match what ships.
7. **`generateEmailHtml` is sync but its inputs are async.** The page must `await renderPatternToPng()`, `await renderSocialIconsToPngs()`, `await embedHeroBlocks()`, and `await resolveBlockImageUrlsForEmail()` *before* calling it. Copy the ordering from `EmailBuilder.tsx`'s export handler exactly.
8. **`AIGenerateTab` streams SSE from a Vite dev plugin.** It works in `npm run dev` and silently 404s in a production build unless you implement the route server-side.
9. **`react-markdown` + `rehype-raw` + `rehype-sanitize`** are only used by the preview's `body-text` renderer. `export-html.ts` has its own independent markdown→HTML conversion. Both must be updated together if you change body-text syntax.
10. **`nfmTemplateApi.ts` is M1-internal.** Delete it and its single call site in `EmailBuilder.tsx`.

---

## 9. Verification checklist

After porting, confirm each:

- [ ] Add one of every block type from the palette; each renders in preview
- [ ] Every block type appears in `generateEmailHtml()` output (diff the block count)
- [ ] Drag-reorder works in both the block list **and** the preview pane
- [ ] Undo/redo restores blocks + background + subject together
- [ ] Background presets, gradients, and all 9 SVG patterns render in preview *and* export
- [ ] Downloaded `.html` opens correctly in Gmail web, **Gmail iOS/Android**, and Outlook desktop
- [ ] No `data:` URIs remain in the exported HTML `<img src>` attributes
- [ ] `.eml` export opens in Outlook with hero images intact (`cid:` attachments)
- [ ] Save → reload → template restores identically (blocks, background, subject, preheader)
- [ ] Autosave draft recovery prompt appears after a hard refresh mid-edit
- [ ] `grep -ri "m1\|FF9E1B\|mbtedlrrxchxbdltmjud" src/` returns nothing unintentional
- [ ] Uploaded images land in your storage bucket and are publicly reachable
- [ ] Body-text HTML is sanitized — paste `<img src=x onerror=alert(1)>` and confirm it's stripped

---

## 10. Quick reference — key function signatures

```ts
// The two renderers
generateEmailHtml(
  blocks: EmailBlock[],
  subject: string,
  background?: EmailBackground,
  patternImageSrc?: string,
  socialIconPngs?: Record<string, string>,
  variables?: Record<string, string>,
  chineseData?: { blocks: EmailBlock[]; subject?: string },
): string

<EmailPreview
  blocks, subject, background?, importedHtml?,
  viewport?: "mobile" | "tablet" | "desktop",
  darkMode?, zoom?, onBlockClick?, selectedBlockId?, onReorder?
/>

// Async prep required before generateEmailHtml
renderPatternToPng(bg): Promise<string>
renderSocialIconsToPngs(): Promise<Record<string, string>>
embedHeroBlocks(blocks): Promise<EmailBlock[]>
resolveBlockImageUrlsForEmail(blocks): Promise<EmailBlock[]>

// Other exports
generateEmlFile(blocks, subject, background?, patternPngBase64?, socialIconPngs?): string
parseHtmlToBlocks(html): EmailBlock[]
buildBackgroundStyle(bg): React.CSSProperties
getPatternTileSvg(pattern, color, opacity, scale): string
uploadEmailImageBlob(blob, opts?): Promise<string | null>
sanitizeHtml(dirty): string
safeUrl(url): string

// Editor registry — the extension point for new block types
BLOCK_EDITOR_REGISTRY: Record<BlockType, React.ComponentType<{
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void   // or (content) => void — see isWholeContentEditor
}>>
```
