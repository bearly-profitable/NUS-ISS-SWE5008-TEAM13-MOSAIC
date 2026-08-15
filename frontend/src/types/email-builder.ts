export type BlockType =
  | "header"
  | "hero-image"
  | "heading"
  | "body-text"
  | "button"
  | "divider"
  | "image"
  | "gif"
  | "image-text"
  | "icon-grid"
  | "columns"
  | "social-links"
  | "footer"
  | "spacer"
  | "video"
  | "countdown"
  | "table"
  | "coupon"
  | "accordion"
  | "lang-toggle";

/** A single item in an accordion/FAQ block. */
export interface AccordionItem {
  id: string;
  question: string;
  answer: string;
}

/** Supported locales for multi-language email content. */
export type EmailLocale = "en" | "zh";

/**
 * Per-block translations. Maps locale → field → translated value.
 * Stored in the block's content as JSON string under key "translations".
 */
export type BlockTranslations = Record<EmailLocale, Record<string, string>>;

/** A single item in an icon-grid block. */
export interface IconGridItem {
  imageUrl: string;
  alt: string;
  linkUrl: string;
  size: number; // px, e.g. 50
  /** Optional text label for text-only items (no image). */
  label?: string;
  /** Border radius in px (0 = square, size/2 = circle) */
  borderRadius?: number;
}

export interface EmailBlock {
  id: string;
  type: BlockType;
  content: Record<string, string>;
}

// ─── Hero Image Editor Overlays ───
export type HeroShapeType = "circle" | "semi" | "quadrant";
export type HeroTextAlign = "left" | "center" | "right";
export type HeroFontWeight = "light" | "bold";

export interface HeroTextOverlay {
  id: string;
  text: string;
  color: string;
  fontSize: number;
  fontWeight: HeroFontWeight;
  x: number; // 0–100 %
  y: number; // 0–100 %
  align: HeroTextAlign;
}

export interface HeroShapeTextLine {
  id: string;
  text: string;
  color: string;
  fontSize: number;
  fontWeight: "light" | "bold";
  x?: number; // 0–100 % within shape bounding box (overrides shared textX)
  y?: number; // 0–100 % within shape bounding box (overrides shared textY)
}

export interface HeroShapeOverlay {
  id: string;
  type: HeroShapeType;
  color: string;
  opacity: number; // 0–100
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number; // legacy, unused for new shapes
  rotation?: number; // degrees 0–360
  text?: string; // legacy single text — migrated to textLines on parse
  fontSize?: number; // legacy
  fontWeight?: "light" | "bold"; // legacy
  textColor?: string; // legacy
  textLines?: HeroShapeTextLine[]; // per-line text with individual styling
  textX?: number; // 0–100 % within the shape bounding box
  textY?: number; // 0–100 % within the shape bounding box
  textWidth?: number; // 0–100 % width of the text box within shape
  textAlign?: "left" | "center" | "right";
}

export interface HeroShapeDivider {
  type: "curve" | "wave" | "arch";
  color: string;
  flip?: boolean;
  position?: "top" | "bottom" | "left" | "right";
  waveCount?: number; // only used when type === "wave", default 1
}

export interface HeroOverlayConfig {
  layout: "simple" | "split";
  topBgColor?: string;
  topSectionPercent?: number;      // 20–80, default 45 — how tall the top colored shape is (% of image height)
  curveDepth?: number;             // 0–50, default 30 — how deep the curve/wave/angle cuts in
  topTextOverlays?: HeroTextOverlay[]; // legacy – migrated into textOverlays on parse
  shapeDivider?: HeroShapeDivider;
  textOverlays?: HeroTextOverlay[]; // all text, positioned by x/y % of the full image
  shapeOverlays?: HeroShapeOverlay[];
}

export type BgPatternType =
  | "none"
  | "dots"
  | "waves"
  | "diagonal-lines"
  | "hexagons"
  | "topography"
  | "circles"
  | "cross-hatch"
  | "diamonds";

export type BgType = "solid" | "gradient" | "pattern" | "geometric";
export type GradientDirection = "to-bottom" | "to-right" | "to-bottom-right" | "to-top-right" | "radial";

export interface EmailBackground {
  type: BgType;
  primaryColor: string;
  secondaryColor: string;
  pattern: BgPatternType;
  patternOpacity: number;       // 0-100
  patternScale: number;         // 0.5-3
  gradientDirection: GradientDirection;
  contentBgColor: string;       // the white email card background
  contentBorderRadius: number;  // px
  contentShadow: boolean;
  paddingX: number;             // px
  paddingY: number;             // px
  fontFamily?: string;          // global font family override
  linkColor?: string;           // global link color override
}

export const DEFAULT_BACKGROUND: EmailBackground = {
  type: "solid",
  primaryColor: "#f3f4f6",
  secondaryColor: "#e5e7eb",
  pattern: "none",
  patternOpacity: 15,
  patternScale: 1,
  gradientDirection: "to-bottom",
  contentBgColor: "#ffffff",
  contentBorderRadius: 12,
  contentShadow: true,
  paddingX: 24,
  paddingY: 32,
};

export interface BgPreset {
  id: string;
  name: string;
  background: EmailBackground;
}

export const BG_PRESETS: BgPreset[] = [
  {
    id: "clean-white",
    name: "Clean White",
    background: { ...DEFAULT_BACKGROUND, primaryColor: "#ffffff", contentShadow: true },
  },
  {
    id: "terracotta-waves",
    name: "Terracotta Waves",
    background: { ...DEFAULT_BACKGROUND, type: "pattern", primaryColor: "#FFF3E0", secondaryColor: "#C2703D", pattern: "waves", patternOpacity: 18, patternScale: 3 },
  },
  {
    id: "northbank-gradient",
    name: "Northbank Gradient",
    background: { ...DEFAULT_BACKGROUND, type: "gradient", primaryColor: "#C2703D", secondaryColor: "#E8B792", gradientDirection: "to-bottom-right" },
  },
  {
    id: "northbank-dark",
    name: "Northbank Dark",
    background: { ...DEFAULT_BACKGROUND, type: "gradient", primaryColor: "#1a1a1a", secondaryColor: "#333333", gradientDirection: "to-bottom" },
  },
  {
    id: "northbank-waves",
    name: "Northbank Waves",
    background: { ...DEFAULT_BACKGROUND, type: "pattern", primaryColor: "#FFF8F0", secondaryColor: "#C2703D", pattern: "waves", patternOpacity: 15 },
  },
  {
    id: "northbank-hexagons",
    name: "Northbank Hex",
    background: { ...DEFAULT_BACKGROUND, type: "pattern", primaryColor: "#FFFBF5", secondaryColor: "#C2703D", pattern: "hexagons", patternOpacity: 12 },
  },
  {
    id: "ocean-gradient",
    name: "Ocean",
    background: { ...DEFAULT_BACKGROUND, type: "gradient", primaryColor: "#667eea", secondaryColor: "#764ba2", gradientDirection: "to-bottom-right" },
  },
  {
    id: "sunset",
    name: "Sunset",
    background: { ...DEFAULT_BACKGROUND, type: "gradient", primaryColor: "#f093fb", secondaryColor: "#f5576c", gradientDirection: "to-right" },
  },
  {
    id: "dark-topo",
    name: "Dark Topo",
    background: { ...DEFAULT_BACKGROUND, type: "pattern", primaryColor: "#111827", secondaryColor: "#6b7280", pattern: "topography", patternOpacity: 15 },
  },
  {
    id: "midnight",
    name: "Midnight",
    background: { ...DEFAULT_BACKGROUND, type: "gradient", primaryColor: "#0f0c29", secondaryColor: "#302b63", gradientDirection: "to-bottom" },
  },
  {
    id: "peach-cream",
    name: "Peach",
    background: { ...DEFAULT_BACKGROUND, type: "gradient", primaryColor: "#ffecd2", secondaryColor: "#fcb69f", gradientDirection: "to-bottom-right" },
  },
  {
    id: "arctic",
    name: "Arctic",
    background: { ...DEFAULT_BACKGROUND, type: "gradient", primaryColor: "#e0eafc", secondaryColor: "#cfdef3", gradientDirection: "to-bottom" },
  },
];

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  /** Hidden preheader text shown in inbox preview. */
  preheader?: string;
  blocks: EmailBlock[];
  background?: EmailBackground;
  updatedAt: number;
  /** ID of the folder this template lives in (null = uncategorised). */
  folderId?: string | null;
  /** Supabase auth user id of the owner (null = shared / team-owned). */
  ownerId?: string | null;
  /** When true, only the owner can see this template. */
  isPrivate?: boolean;
  /** Display name of the user who created this template. */
  createdBy?: string | null;
  /** Display name of the user who last modified this template. */
  lastModifiedBy?: string | null;
  /** Timestamp when the template was first created. */
  createdAt?: number;
  /** Tag IDs attached to this template. */
  tagIds?: string[];
  /** Active locale for this template (defaults to "en"). */
  locale?: EmailLocale;
  /** Whether Chinese translations have been generated. */
  hasChineseTranslation?: boolean;
  /** Translated subject line per locale. */
  subjectTranslations?: Record<EmailLocale, string>;
  /** Translated preheader per locale. */
  preheaderTranslations?: Record<EmailLocale, string>;
}

/** Logical grouping for templates. Can be shared (ownerId=null) or private to a user. */
export interface EmailTemplateFolder {
  id: string;
  name: string;
  description?: string;
  /** Folder icon color key. See FOLDER_COLORS in the UI for the palette. */
  colorKey: string;
  /** When null, this folder is a shared / team folder visible to everyone. */
  ownerId: string | null;
  /** When true, the folder (and its templates) is only visible to the owner. */
  isPrivate: boolean;
  updatedAt: number;
  /** Parent folder ID for hierarchical nesting (null = root). */
  parentId?: string | null;
  /** Folder type for Level 1 roots: 'always-on' | 'ad-hoc' | null. */
  folderType?: string | null;
  /** Sort order within the same parent. */
  sortOrder?: number;
}

/** A tag that can be attached to templates for filtering/retrieval. */
export interface EmailTemplateTag {
  id: string;
  name: string;
  colorKey: string;
  /** Grouping: 'product' | 'team' | 'campaign-type' | 'general'. */
  category: string;
}

/** A saved version snapshot of a template for version history / restore. */
export interface EmailTemplateVersion {
  id: string;
  templateId: string;
  versionNum: number;
  name: string;
  subject: string;
  blocks: EmailBlock[];
  background?: EmailBackground;
  savedBy?: string | null;
  createdAt: number;
  note: string;
}

/**
 * Synthetic folder ID used for the read-only "Northbank Templates" group
 * that bundles the PRELOADED_TEMPLATES defined below. Real (DB-backed)
 * folders never use this id.
 */
export const PRELOADED_FOLDER_ID = "folder-preloaded-northbank";

export const BLOCK_DEFAULTS: Record<BlockType, () => Omit<EmailBlock, "id">> = {
  header: () => ({
    type: "header",
    content: { logoUrl: "/northbank-logo.svg", bgColor: "#ffffff" },
  }),
  "hero-image": () => ({
    type: "hero-image",
    content: {
      imageUrl: "",
      alt: "Hero image",
      /** After "Merge for email", hero uses this PNG; overlays in JSON are cleared. */
      heroLayersMerged: "false",
      heroOverlay: JSON.stringify({
        layout: "simple",
        topTextOverlays: [],
        textOverlays: [],
        shapeOverlays: [],
      } as HeroOverlayConfig),
      heroLogoEnabled: "true",
      heroLogoUrl: "/northbank-logo.svg",
      heroLogoX: "5",
      heroLogoY: "5",
      heroLogoSize: "15",
    },
  }),
  heading: () => ({
    type: "heading",
    content: { text: "Your Heading Here", align: "left", size: "24" },
  }),
  "body-text": () => ({
    type: "body-text",
    content: { markdown: "Write your email body text here..." },
  }),
  button: () => ({
    type: "button",
    content: { text: "Click Here", url: "https://example.com", color: "#C2703D", style: "filled", size: "medium" },
  }),
  divider: () => ({
    type: "divider",
    content: { color: "#C2703D", style: "solid", thickness: "2" },
  }),
  "image-text": () => ({
    type: "image-text",
    content: { imageUrl: "", imagePosition: "left", heading: "Feature Title", text: "Describe your feature here...", buttonText: "", buttonUrl: "" },
  }),
  image: () => ({
    type: "image",
    content: { imageUrl: "", alt: "Image", linkUrl: "", width: "auto", height: "auto", align: "center", borderRadius: "8" },
  }),
  gif: () => ({
    type: "gif",
    content: { imageUrl: "", alt: "Animated GIF", linkUrl: "", width: "auto", align: "center", borderRadius: "8" },
  }),
  "icon-grid": () => ({
    type: "icon-grid",
    content: {
      items: JSON.stringify([
        { imageUrl: "", alt: "Icon 1", linkUrl: "", size: 50 },
        { imageUrl: "", alt: "Icon 2", linkUrl: "", size: 50 },
        { imageUrl: "", alt: "Icon 3", linkUrl: "", size: 50 },
      ] satisfies IconGridItem[]),
    },
  }),
  columns: () => ({
    type: "columns",
    content: {
      col1Heading: "Column 1", col1Text: "Description for column 1", col1ImageUrl: "", col1ImageLink: "",
      col2Heading: "Column 2", col2Text: "Description for column 2", col2ImageUrl: "", col2ImageLink: "",
      col3Heading: "Column 3", col3Text: "Description for column 3", col3ImageUrl: "", col3ImageLink: "",
      columnCount: "3",
    },
  }),
  "social-links": () => ({
    type: "social-links",
    content: {
      facebook: "https://www.facebook.com/northbankliving",
      twitter: "https://x.com/northbankliving",
      instagram: "https://www.instagram.com/northbankliving",
      linkedin: "https://sg.linkedin.com/company/northbank-living",
      youtube: "https://www.youtube.com/@northbankliving",
    },
  }),
  footer: () => ({
    type: "footer",
    content: {
      link1Label: "northbankliving.com",
      link1Url: "https://www.northbankliving.com",
      link2Label: "contact us",
      link2Url: "https://www.northbankliving.com/support/contact-us",
      link3Label: "unsubscribe",
      link3Url: "https://www.northbankliving.com/preferences",
    },
  }),
  spacer: () => ({
    type: "spacer",
    content: { height: "40" },
  }),
  video: () => ({
    type: "video",
    content: { videoUrl: "", thumbnailUrl: "", alt: "Video" },
  }),
  countdown: () => ({
    type: "countdown",
    content: { targetDate: "", bgColor: "#C2703D", textColor: "#ffffff", label: "Offer ends in" },
  }),
  table: () => ({
    type: "table",
    content: {
      columns: "3",
      rows: JSON.stringify([
        ["Header 1", "Header 2", "Header 3"],
        ["Cell 1", "Cell 2", "Cell 3"],
        ["Cell 4", "Cell 5", "Cell 6"],
      ]),
      headerBgColor: "#C2703D",
      borderColor: "#e5e7eb",
    },
  }),
  coupon: () => ({
    type: "coupon",
    content: { code: "SAVE20", bgColor: "#FFF8F0", textColor: "#C2703D", label: "Use code at checkout" },
  }),
  accordion: () => ({
    type: "accordion",
    content: {
      items: JSON.stringify([
        { id: "a1", question: "What is this offer?", answer: "This is a limited-time promotion for our valued customers." },
        { id: "a2", question: "How do I redeem?", answer: "Simply click the button above and apply the code at checkout." },
        { id: "a3", question: "When does it expire?", answer: "This offer is valid until the end of the month." },
      ] satisfies AccordionItem[]),
      headerBgColor: "#C2703D",
      headerTextColor: "#ffffff",
      bodyBgColor: "#FFF8F0",
      bodyTextColor: "#374151",
      borderColor: "#e5e7eb",
      borderRadius: "12",
      iconStyle: "chevron",
    },
  }),
  "lang-toggle": () => ({
    type: "lang-toggle",
    content: {
      position: "bottom-right",
      style: "pill",
      bgColor: "#1f2937",
      activeColor: "#C2703D",
      textColor: "#ffffff",
    },
  }),
};

/**
 * Preloaded (brand-master) templates. Intentionally empty — users create and
 * organise their own templates inside folders via the Templates browser.
 * Kept exported so existing imports across the codebase keep compiling.
 */
export const PRELOADED_TEMPLATES: EmailTemplate[] = [];
