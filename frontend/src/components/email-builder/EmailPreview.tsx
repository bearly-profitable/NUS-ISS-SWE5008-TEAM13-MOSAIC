import { useRef, useEffect, useState, memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { EmailBlock, EmailBackground, IconGridItem, AccordionItem } from "@/types/email-builder";
import { DEFAULT_BACKGROUND } from "@/types/email-builder";
import { getPatternPreviewSvg, buildBackgroundStyle } from "./background-patterns";
import { DIN_FONT_FAMILY_STACK } from "@/lib/din-font";
import { sanitizeHtml, safeUrl } from "@/lib/email-sanitize";

/** Custom rehype-sanitize schema: allow inline color spans from SFMC import. */
const MARKDOWN_SANITIZE_SCHEMA = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span || []), ["style", /^color\s*:\s*#[0-9a-fA-F]{3,6}$/]],
    a: [...(defaultSchema.attributes?.a || []), "href", "style"],
  },
  tagNames: [...(defaultSchema.tagNames || []), "span"],
};
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

/* ─── Custom Social Icons (PNG from /social-icons/) ─── */
const SUPPORTED_PLATFORMS = ["facebook", "twitter", "instagram", "linkedin", "youtube"] as const;

const SocialIcon = ({ platform, size = 24 }: { platform: string; size?: number }) => {
  if (!(SUPPORTED_PLATFORMS as readonly string[]).includes(platform)) return null;
  return (
    <img
      src={`/social-icons/${platform}.png`}
      width={size}
      height={size}
      alt={platform}
      style={{ display: "block" }}
    />
  );
};

function HeaderBlock({ content }: { content: Record<string, string> }) {
  const bgColor = content.bgColor || "#ffffff";
  const logoHeight = parseInt(content.logoHeight || "56");

  // Non-floating: original block layout
  if (content.floating !== "true") {
    return (
      <div className="email-header-block" style={{
        padding: "20px 32px",
        textAlign: "center",
        backgroundColor: bgColor,
        borderBottom: "1px solid #e5e7eb",
      }}>
        {content.logoUrl ? (
          <img src={content.logoUrl} alt="Logo" style={{ maxHeight: logoHeight, margin: "0 auto", display: "block" }} />
        ) : (
          <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 12 }}>
            Upload a logo
          </div>
        )}
      </div>
    );
  }

  // Floating: renders as a zero-height container with absolutely positioned logo
  // The logo visually overlaps the next block
  const floatAlign = content.floatAlign || "left";
  const floatX = parseInt(content.floatX || "16");
  const floatY = parseInt(content.floatY || "16");

  const positionStyle: React.CSSProperties = {
    position: "absolute",
    top: floatY,
    zIndex: 10,
    pointerEvents: "none",
  };

  if (floatAlign === "left") {
    positionStyle.left = floatX;
  } else if (floatAlign === "right") {
    positionStyle.right = floatX;
  } else {
    positionStyle.left = "50%";
    positionStyle.transform = "translateX(-50%)";
  }

  return (
    <div style={{ position: "relative", height: 0, overflow: "visible", zIndex: 10 }}>
      <div style={positionStyle}>
        {content.logoUrl ? (
          <img
            src={content.logoUrl}
            alt="Logo"
            style={{
              height: logoHeight,
              display: "block",
              pointerEvents: "auto",
            }}
          />
        ) : (
          <div style={{
            height: 40,
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9ca3af",
            fontSize: 11,
            backgroundColor: "rgba(255,255,255,0.8)",
            borderRadius: 6,
            border: "1px dashed #d1d5db",
          }}>
            Upload a logo
          </div>
        )}
      </div>
    </div>
  );
}

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function HeroImageBlock({ content }: { content: Record<string, string> }) {
  return <ImageBlock content={content} />;
}

function HeadingBlock({ content }: { content: Record<string, string> }) {
  const align = (content.align || "left") as "left" | "center" | "right";
  const size = parseInt(content.size || "24");
  const color = content.color || "#111827";
  return (
    <div className="email-heading-block" style={{ padding: "24px 32px 8px", textAlign: align }}>
      <h1 style={{ fontSize: size, fontWeight: 700, color, margin: 0, lineHeight: 1.3, fontFamily: DIN_FONT_FAMILY_STACK }}>
        {content.text || "Your Heading"}
      </h1>
    </div>
  );
}

function BodyTextBlock({ content }: { content: Record<string, string> }) {
  const color = content.color || "#374151";
  const fontSize = parseInt(content.fontSize || "14");
  const align = (content.align || "left") as "left" | "center" | "right";
  return (
    <div className="email-body-text-block" style={{ padding: "8px 32px 16px", fontSize, lineHeight: 1.7, color, textAlign: align, fontFamily: DIN_FONT_FAMILY_STACK, fontWeight: 400 }}>
      <div className="prose prose-sm max-w-none [&>*]:m-0 [&>p+p]:mt-3 [&_*]:font-sans">
        <ReactMarkdown rehypePlugins={[rehypeRaw, [rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA]]}>{content.markdown || ""}</ReactMarkdown>
      </div>
    </div>
  );
}

function ButtonBlock({ content }: { content: Record<string, string> }) {
  const color = content.color || "#C2703D";
  const style = content.style || "filled";
  const size = content.size || "medium";
  const align = (content.align || "center") as "left" | "center" | "right";
  const url = content.url || "";
  const isDynamicLink = url === "%%PROMO_LINK%%";

  const paddings = { small: "8px 20px", medium: "12px 32px", large: "16px 48px" };
  const fontSizes = { small: 12, medium: 14, large: 16 };

  const baseStyle: React.CSSProperties = {
    display: "inline-block",
    padding: paddings[size as keyof typeof paddings],
    textDecoration: "none",
    fontWeight: 700,
    fontFamily: DIN_FONT_FAMILY_STACK,
    fontSize: fontSizes[size as keyof typeof fontSizes],
    letterSpacing: "0.01em",
    transition: "all 0.2s",
  };

  const textColor = content.textColor || "#ffffff";
  const variants: Record<string, React.CSSProperties> = {
    filled: { ...baseStyle, backgroundColor: color, color: textColor, borderRadius: 8 },
    outline: { ...baseStyle, backgroundColor: "transparent", color, border: `2px solid ${color}`, borderRadius: 8 },
    rounded: { ...baseStyle, backgroundColor: color, color: textColor, borderRadius: 50 },
  };

  return (
    <div className="email-button-block" style={{ padding: "16px 32px", textAlign: align }}>
      <a href={isDynamicLink ? "#" : (url || "#")} style={variants[style] || variants.filled} className="email-btn">
        {content.text || "Click Here"}
      </a>
      {isDynamicLink && (
        <div style={{ marginTop: 6, fontSize: 10, color: "#d97706", fontFamily: DIN_FONT_FAMILY_STACK, display: "flex", alignItems: "center", justifyContent: align, gap: 4 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          Dynamic link — unique URL per recipient
        </div>
      )}
    </div>
  );
}

function DividerBlock({ content }: { content: Record<string, string> }) {
  const thickness = content.thickness || "2";
  const widthPct = content.widthPercent || "100";
  const marginTop = parseInt(content.marginTop || "16");
  const marginBottom = parseInt(content.marginBottom || "16");
  return (
    <div className="email-divider-block" style={{ paddingLeft: 32, paddingRight: 32, paddingTop: marginTop, paddingBottom: marginBottom }}>
      <hr style={{
        border: "none",
        borderTop: `${thickness}px ${content.style || "solid"} ${content.color || "#C2703D"}`,
        margin: "0 auto",
        width: `${widthPct}%`,
      }} />
    </div>
  );
}

function ImageTextBlock({ content }: { content: Record<string, string> }) {
  const isLeft = content.imagePosition !== "right";
  const verticalAlign = content.verticalAlign || "center";
  const alignMap: Record<string, string> = { top: "flex-start", center: "center", bottom: "flex-end" };
  const imageEl = (
    <div style={{ flex: "0 0 45%", minHeight: 120, background: content.imageUrl ? undefined : "#f3f4f6", borderRadius: 8, overflow: "hidden" }}>
      {content.imageUrl ? (
        <img src={content.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, color: "#9ca3af", fontSize: 12 }}>
          Image
        </div>
      )}
    </div>
  );
  const textEl = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: alignMap[verticalAlign] || "center" }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: content.headingColor || "#111827", margin: "0 0 8px", fontFamily: DIN_FONT_FAMILY_STACK }}>
        {content.heading || "Feature Title"}
      </h3>
      <p
        style={{ fontSize: 14, color: content.textColor || "#4b5563", lineHeight: 1.6, margin: 0, fontFamily: DIN_FONT_FAMILY_STACK, fontWeight: 400 }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.text || "Description") }}
      />
      {content.buttonText && (
        <div style={{ marginTop: 12 }}>
          <a href={content.buttonUrl || "#"} style={{
            display: "inline-block",
            padding: "8px 20px",
            backgroundColor: "#C2703D",
            color: "#ffffff",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 700,
            fontFamily: DIN_FONT_FAMILY_STACK,
            fontSize: 13,
          }}>
            {content.buttonText}
          </a>
        </div>
      )}
    </div>
  );

  return (
    <div className="email-image-text-block" style={{ padding: "20px 32px" }}>
      <div className="email-image-text-flex" style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
        {isLeft ? <>{imageEl}{textEl}</> : <>{textEl}{imageEl}</>}
      </div>
    </div>
  );
}

function ImageBlock({ content }: { content: Record<string, string> }) {
  const align = (content.align || "center") as "left" | "center" | "right";
  const rawWidth = content.width || "";
  const isAutoWidth = !rawWidth || rawWidth === "auto";
  const width = isAutoWidth ? undefined : rawWidth;
  const radius = parseInt(content.borderRadius ?? "8");
  const imgEl = content.imageUrl ? (
    <img
      src={content.imageUrl}
      alt={content.alt || ""}
      style={{
        display: "block",
        width: width || undefined,
        maxWidth: "100%",
        height: "auto",
        borderRadius: radius,
        margin: align === "center" ? "0 auto" : undefined,
        marginLeft: align === "right" ? "auto" : undefined,
      }}
    />
  ) : (
    <div style={{
      width: 200, height: 100, backgroundColor: "#f3f4f6", borderRadius: radius,
      display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 12,
      margin: align === "center" ? "0 auto" : undefined,
      marginLeft: align === "right" ? "auto" : undefined,
    }}>
      Image
    </div>
  );

  return (
    <div className="email-image-block" style={{ padding: "16px 32px", textAlign: align }}>
      {content.linkUrl ? (
        <a href={content.linkUrl} style={{ display: "inline-block", borderRadius: radius }}>{imgEl}</a>
      ) : imgEl}
    </div>
  );
}

function IconGridBlock({ content }: { content: Record<string, string> }) {
  let items: IconGridItem[] = [];
  try { items = JSON.parse(content.items || "[]"); } catch { /* ignore */ }

  if (items.length === 0) {
    return (
      <div style={{ padding: "16px 32px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
        No icons configured
      </div>
    );
  }

  const isLocked = content.lockLayout === "true";

  return (
    <div className="email-icon-grid-block" style={{ padding: "16px 32px", textAlign: "center" }}>
      <div className={`email-icon-grid-flex${isLocked ? " lock-layout" : ""}`} style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "nowrap", alignItems: "center" }}>
        {items.map((item, i) => {
          // Text-only item (no image, has label)
          if (item.label && !item.imageUrl) {
            const textEl = (
              <span style={{
                fontSize: 14, fontWeight: 700, color: "#424242",
                textDecoration: "underline", fontFamily: DIN_FONT_FAMILY_STACK,
              }}>
                {item.label}
              </span>
            );
            return item.linkUrl ? (
              <a key={i} href={item.linkUrl} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>{textEl}</a>
            ) : (
              <span key={i}>{textEl}</span>
            );
          }

          // Image item
          const borderRadius = item.borderRadius ?? 0;
          const img = item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.alt}
              style={{ 
                width: item.size, 
                height: item.size, 
                objectFit: "cover", 
                display: "block",
                borderRadius: borderRadius
              }}
            />
          ) : (
            <div style={{
              width: item.size, 
              height: item.size, 
              backgroundColor: "#f3f4f6", 
              borderRadius: borderRadius,
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              color: "#9ca3af", 
              fontSize: 10,
            }}>
              Icon
            </div>
          );
          return item.linkUrl ? (
            <a key={i} href={item.linkUrl} style={{ display: "inline-block" }}>{img}</a>
          ) : (
            <span key={i}>{img}</span>
          );
        })}
      </div>
    </div>
  );
}

function ColumnsBlock({ content }: { content: Record<string, string> }) {
  const textAlign = (content.colTextAlign || "center") as "left" | "center" | "right";
  const headingSize = parseInt(content.colHeadingSize || "15");
  const textSize = parseInt(content.colTextSize || "13");
  const headingColor = content.colHeadingColor || "#111827";
  const textColor = content.colTextColor || "#6b7280";
  const colBgColor = content.colBgColor || "#f9fafb";
  const colBorderColor = content.colBorderColor || "#f3f4f6";

  // Layout presets define row structure
  const layoutId = content.colLayoutPreset || "";
  const PRESETS: Record<string, number[][]> = {
    "1": [[1]],
    "2": [[1, 1]],
    "3": [[1, 1, 1]],
    "4": [[1, 1, 1, 1]],
    "5": [[1, 1, 1, 1, 1]],
    "2-top": [[1, 1], [1]],
    "2-bottom": [[1], [1, 1]],
    "1-2-1": [[1], [1, 1], [1]],
    "1-3-1": [[1], [1, 1, 1], [1]],
    "2x2": [[1, 1], [1, 1]],
  };

  // Fallback: if no preset, use columnCount as simple N-column row
  const count = parseInt(content.columnCount || "3");
  const rows = (layoutId && PRESETS[layoutId]) ? PRESETS[layoutId] : [Array.from({ length: count }, () => 1)];

  // Reset cell index for each render
  let cellIndex = 0;

  const renderCell = (flex: number) => {
    const i = cellIndex++;
    const colImgUrl = content[`col${i + 1}ImageUrl`];
    const colImgLink = content[`col${i + 1}ImageLink`];
    const imgEl = colImgUrl ? (
      <img src={colImgUrl} alt="" style={{ maxWidth: "100%", height: "auto", borderRadius: 6, display: "block", marginBottom: 8 }} />
    ) : null;
    const wrappedImg = imgEl && colImgLink ? (
      <a href={colImgLink} style={{ display: "block" }}>{imgEl}</a>
    ) : imgEl;

    const layout = content[`col${i + 1}Layout`] || "image-first";
    const btnText = content[`col${i + 1}ButtonText`];
    const btnUrl = content[`col${i + 1}ButtonUrl`] || "#";

    const heading = (
      <h4 style={{ fontSize: headingSize, fontWeight: 700, color: headingColor, margin: "0 0 6px", fontFamily: DIN_FONT_FAMILY_STACK }}>
        {content[`col${i + 1}Heading`] || `Column ${i + 1}`}
      </h4>
    );
    const textContent = content[`col${i + 1}Text`];
    const text = (
      <p
        style={{ fontSize: textSize, color: textColor, lineHeight: 1.5, margin: 0, whiteSpace: "pre-line" }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(textContent || `Description for column ${i + 1}`) }}
      />
    );
    const btn = btnText ? (
      <div style={{ marginTop: 10 }}>
        <a href={btnUrl} style={{
          display: "inline-block", padding: "7px 16px", backgroundColor: "#C2703D",
          color: "#ffffff", borderRadius: 6, textDecoration: "none", fontWeight: 700,
          fontFamily: DIN_FONT_FAMILY_STACK, fontSize: 12,
        }}>
          {btnText}
        </a>
      </div>
    ) : null;

    return (
      <div key={i} className="email-column-card" style={{
        flex,
        padding: 16,
        backgroundColor: colBgColor,
        borderRadius: 10,
        textAlign,
        border: `1px solid ${colBorderColor}`,
      }}>
        {layout === "text-first" ? (
          <>{heading}{text}{btn}{wrappedImg}</>
        ) : (
          <>{wrappedImg}{heading}{text}{btn}</>
        )}
      </div>
    );
  };

  const isLocked = content.lockLayout === "true";

  return (
    <div className="email-columns-block" style={{ padding: "20px 32px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((row, ri) => (
          <div key={ri} className={`email-columns-flex${isLocked ? " lock-layout" : ""}`} style={{ display: "flex", gap: 16 }}>
            {row.map((flex) => renderCell(flex))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialLinksBlock({ content }: { content: Record<string, string> }) {
  const links = Object.entries(content).filter(([, url]) => url);
  return (
    <div className="email-social-links-block" style={{ padding: "20px 32px", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
        {links.length === 0 ? (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>No social links configured</span>
        ) : (
          links.map(([platform, url]) => (
            <a
              key={platform}
              href={url}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                transition: "transform 0.2s",
              }}
            >
              <SocialIcon platform={platform} size={20} />
            </a>
          ))
        )}
      </div>
    </div>
  );
}

function FooterBlock({ content }: { content: Record<string, string> }) {
  const links: { label: string; url: string }[] = [];
  if (content.link1Label && content.link1Url) links.push({ label: content.link1Label, url: content.link1Url });
  if (content.link2Label && content.link2Url) links.push({ label: content.link2Label, url: content.link2Url });
  if (content.link3Label && content.link3Url) links.push({ label: content.link3Label, url: content.link3Url });

  return (
    <div className="email-footer-block" style={{
      padding: "24px 32px",
      textAlign: "center",
      fontSize: 12,
      color: "#9ca3af",
      borderTop: "1px solid #e5e7eb",
      backgroundColor: "#f9fafb",
    }}>
      {links.length > 0 ? (
        <div>
          {links.map((link, i) => (
            <span key={i}>
              {i > 0 && <span style={{ margin: "0 8px", color: "#d1d5db" }}>|</span>}
              <a href={link.url} style={{ color: "#6b7280", textDecoration: "none", fontSize: 12 }}>
                {link.label}
              </a>
            </span>
          ))}
        </div>
      ) : (
        <span style={{ color: "#d1d5db" }}>No footer links configured</span>
      )}
    </div>
  );
}

function SpacerBlock({ content }: { content: Record<string, string> }) {
  const height = parseInt(content.height || "40");
  return <div style={{ height, minHeight: 8 }} />;
}

function VideoBlock({ content }: { content: Record<string, string> }) {
  // When the editor has baked the play button into the composite thumbnail,
  // the source image already has the play icon embedded — skip the CSS overlay
  // to avoid showing it twice.
  const baked = content.thumbnailWithPlayUrl;
  const thumb = baked || content.thumbnailUrl;
  const aspectRatio = content.aspectRatio || "16:9";
  const aspectMap: Record<string, string> = { "16:9": "56.25%", "9:16": "177.78%", "4:3": "75%", "1:1": "100%" };
  const paddingTop = aspectMap[aspectRatio] || "56.25%";

  return (
    <div className="email-video-block" style={{ padding: "16px 32px", textAlign: "center" }}>
      <div style={{
        position: "relative",
        display: "inline-block",
        width: aspectRatio === "9:16" ? "56.25%" : "100%",
        maxWidth: "100%",
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#000",
      }}>
        <div style={{ position: "relative", width: "100%", paddingTop }}>
          {thumb ? (
            <img src={thumb} alt={content.alt || "Video"} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14, backgroundColor: "#1a1a1a" }}>
              Paste a YouTube/Vimeo URL
            </div>
          )}
          {!baked && thumb && (
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 64, height: 64, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}>
              <div style={{ width: 0, height: 0, borderLeft: "22px solid #111", borderTop: "14px solid transparent", borderBottom: "14px solid transparent", marginLeft: 4 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CountdownBlock({ content }: { content: Record<string, string> }) {
  const bgColor = content.bgColor || "#C2703D";
  const textColor = content.textColor || "#ffffff";
  const target = content.targetDate ? new Date(content.targetDate) : null;

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target?.getTime()]);

  let days = 0, hours = 0, mins = 0, secs = 0;
  if (target) {
    const diff = Math.max(0, target.getTime() - now);
    days = Math.floor(diff / 86400000);
    hours = Math.floor((diff % 86400000) / 3600000);
    mins = Math.floor((diff % 3600000) / 60000);
    secs = Math.floor((diff % 60000) / 1000);
  }

  const unitStyle: React.CSSProperties = {
    display: "inline-flex", flexDirection: "column", alignItems: "center", padding: "12px 16px",
    backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 8, minWidth: 64,
  };

  return (
    <div className="email-countdown-block" style={{ padding: "24px 32px", textAlign: "center", backgroundColor: bgColor, color: textColor }}>
      {content.label && <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, fontFamily: DIN_FONT_FAMILY_STACK }}>{content.label}</div>}
      <div className="email-countdown-units" style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        {[{ v: days, l: "Days" }, { v: hours, l: "Hours" }, { v: mins, l: "Mins" }, { v: secs, l: "Secs" }].map(({ v, l }) => (
          <div key={l} className="email-countdown-unit" style={unitStyle}>
            <span className="email-countdown-num" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, fontFamily: DIN_FONT_FAMILY_STACK }}>{String(v).padStart(2, "0")}</span>
            <span style={{ fontSize: 10, fontWeight: 500, marginTop: 4, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableBlock({ content }: { content: Record<string, string> }) {
  let rows: string[][] = [];
  try { rows = JSON.parse(content.rows || "[]"); } catch { /* ignore */ }
  const headerBg = content.headerBgColor || "#C2703D";
  const borderColor = content.borderColor || "#e5e7eb";

  if (rows.length === 0) return <div style={{ padding: "16px 32px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>No table data</div>;

  return (
    <div className="email-table-block" style={{ padding: "16px 32px" }}>
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: DIN_FONT_FAMILY_STACK }}>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => ri === 0 ? (
                <th key={ci} style={{ padding: "10px 12px", backgroundColor: headerBg, color: "#fff", fontWeight: 700, fontSize: 13, textAlign: "left", border: `1px solid ${borderColor}` }}>{cell}</th>
              ) : (
                <td key={ci} style={{ padding: "8px 12px", fontSize: 13, border: `1px solid ${borderColor}`, color: "#374151" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </table>
      </div>
    </div>
  );
}

function CouponBlock({ content }: { content: Record<string, string> }) {
  const bgColor = content.bgColor || "#FFF8F0";
  const textColor = content.textColor || "#C2703D";
  const code = content.code || "CODE";
  const isDynamic = code === "%%PROMO_CODE%%";

  return (
    <div className="email-coupon-block" style={{ padding: "24px 32px", textAlign: "center" }}>
      {content.label && (
        <div className="email-coupon-label" style={{ fontSize: 13, color: "#6b7280", marginBottom: 8, fontFamily: DIN_FONT_FAMILY_STACK }}>{content.label}</div>
      )}
      <div className="email-coupon-box" style={{
        display: "inline-block", padding: "16px 40px", borderRadius: 10,
        backgroundColor: bgColor, border: `2px ${isDynamic ? "solid" : "dashed"} ${textColor}`,
        fontSize: 24, fontWeight: 800, letterSpacing: "0.15em", color: textColor,
        fontFamily: DIN_FONT_FAMILY_STACK,
        position: "relative",
      }}>
        {isDynamic ? "ABC123XYZ" : code}
      </div>
      {isDynamic && (
        <div style={{ marginTop: 6, fontSize: 10, color: "#d97706", fontFamily: DIN_FONT_FAMILY_STACK, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          Dynamic — unique code per recipient
        </div>
      )}
    </div>
  );
}

function AccordionBlock({ content }: { content: Record<string, string> }) {
  let items: AccordionItem[] = [];
  try { items = JSON.parse(content.items || "[]"); } catch { /* ignore */ }
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const headerBg = content.headerBgColor || "#C2703D";
  const headerText = content.headerTextColor || "#ffffff";
  const bodyBg = content.bodyBgColor || "#FFF8F0";
  const bodyText = content.bodyTextColor || "#374151";
  const borderColor = content.borderColor || "#e5e7eb";
  const radius = parseInt(content.borderRadius || "12");
  const iconStyle = content.iconStyle || "chevron";

  if (items.length === 0) {
    return (
      <div style={{ padding: "16px 32px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
        No FAQ items configured
      </div>
    );
  }

  return (
    <div className="email-accordion-block" style={{ padding: "16px 32px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={item.id}
              className="accordion-card"
              style={{
                borderRadius: radius,
                overflow: "hidden",
                border: `1px solid ${isOpen ? headerBg : borderColor}`,
                boxShadow: isOpen
                  ? "0 4px 16px rgba(0,0,0,0.08)"
                  : "0 1px 3px rgba(0,0,0,0.04)",
                transition: "all 0.2s ease",
                background: "#fff",
              }}
            >
              {/* Header row */}
              <div
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="accordion-header"
                style={{
                  backgroundColor: isOpen ? headerBg : "#fff",
                  color: isOpen ? headerText : "#1f2937",
                  padding: "14px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: DIN_FONT_FAMILY_STACK,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  transition: "background-color 0.2s ease, color 0.2s ease",
                  userSelect: "none",
                }}
              >
                <span style={{ flex: 1, lineHeight: 1.4 }}>{item.question}</span>
                {/* Icon */}
                <span style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  backgroundColor: isOpen ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.05)",
                  color: isOpen ? headerText : "#9ca3af",
                  fontSize: 13,
                  fontWeight: 700,
                  transition: "all 0.2s ease",
                  transform: isOpen && iconStyle === "chevron" ? "rotate(180deg)" : "rotate(0deg)",
                }}>
                  {iconStyle === "plus" ? (isOpen ? "−" : "+") : iconStyle === "arrow" ? "›" : "▾"}
                </span>
              </div>

              {/* Body */}
              {isOpen && (
                <div
                  className="accordion-body"
                  style={{
                    backgroundColor: bodyBg,
                    color: bodyText,
                    padding: "14px 18px",
                    fontSize: 13,
                    lineHeight: 1.65,
                    fontFamily: DIN_FONT_FAMILY_STACK,
                    fontWeight: 400,
                    borderTop: `1px solid ${borderColor}22`,
                  }}
                >
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LangToggleBlock({ content }: { content: Record<string, string> }) {
  const [isZh, setIsZh] = useState(false);
  const position = content.position || "bottom-right";
  const style = content.style || "pill";
  const autoTheme = content.autoTheme !== "false";

  // Auto-theme: detect if the email background is dark or light
  // For preview, we use a light background by default
  const bgColor = autoTheme ? "rgba(255,255,255,0.95)" : (content.bgColor || "#1f2937");
  const textInactive = autoTheme ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.4)";
  const activeColor = content.activeColor || "#C2703D";
  const borderStyle = autoTheme ? "1px solid rgba(0,0,0,0.08)" : "1.5px solid rgba(255,255,255,0.08)";

  // This block renders as a floating overlay — it uses position:fixed
  // relative to the email preview container
  return null; // Rendered via the special floating overlay in EmailPreview
}

const blockRenderers: Record<string, React.ComponentType<{ content: Record<string, string> }>> = {
  header: memo(HeaderBlock),
  "hero-image": memo(HeroImageBlock),
  heading: memo(HeadingBlock),
  "body-text": memo(BodyTextBlock),
  button: memo(ButtonBlock),
  image: memo(ImageBlock),
  gif: memo(ImageBlock),
  divider: memo(DividerBlock as any),
  "image-text": memo(ImageTextBlock),
  "icon-grid": memo(IconGridBlock),
  columns: memo(ColumnsBlock),
  "social-links": memo(SocialLinksBlock),
  footer: memo(FooterBlock),
  spacer: memo(SpacerBlock),
  video: memo(VideoBlock),
  countdown: memo(CountdownBlock),
  table: memo(TableBlock),
  coupon: memo(CouponBlock),
  accordion: memo(AccordionBlock),
  "lang-toggle": memo(LangToggleBlock),
};

const VIEWPORT_WIDTHS: Record<string, number> = {
  mobile: 375,
  tablet: 480,
  desktop: 600,
};

interface EmailPreviewProps {
  blocks: EmailBlock[];
  subject: string;
  background?: EmailBackground;
  /** When set, renders raw HTML in an iframe instead of blocks */
  importedHtml?: string;
  viewport?: "mobile" | "tablet" | "desktop";
  /** When true, simulates dark mode */
  darkMode?: boolean;
  /** Zoom level (0.5 to 1.5) */
  zoom?: number;
  /** Callback when a block is clicked in preview */
  onBlockClick?: (blockId: string) => void;
  /** ID of the currently selected/expanded block in the editor */
  selectedBlockId?: string | null;
  /** Callback to reorder blocks via drag in the preview */
  onReorder?: (blocks: EmailBlock[]) => void;
}

/** Single draggable/hoverable block wrapper rendered inside EmailPreview. */
const PreviewBlockItem = memo(function PreviewBlockItem({
  block,
  isSelected,
  interactive,
  darkMode,
  onBlockClick,
}: {
  block: EmailBlock;
  isSelected: boolean;
  interactive: boolean;
  darkMode: boolean;
  onBlockClick?: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const Renderer = blockRenderers[block.type];

  const paddingTop = parseInt(block.content.paddingTop || "0");
  const paddingBottom = parseInt(block.content.paddingBottom || "0");
  const blockBgColor = block.content.blockBgColor || undefined;

  const innerStyle: React.CSSProperties = {
    ...(paddingTop ? { paddingTop } : {}),
    ...(paddingBottom ? { paddingBottom } : {}),
    ...(blockBgColor ? { backgroundColor: blockBgColor } : {}),
  };

  if (block.content.hidden === "true") {
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        opacity: isDragging ? 0.4 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle — appears on hover in interactive mode */}
      {interactive && (
        <div
          {...attributes}
          {...listeners}
          style={{
            position: "absolute",
            left: 6,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 20,
            cursor: "grab",
            padding: "3px 2px",
            borderRadius: 4,
            background: "rgba(255,255,255,0.92)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.15s ease",
            pointerEvents: hovered ? "auto" : "none",
          }}
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical style={{ width: 13, height: 13, color: "#6b7280", display: "block" }} />
        </div>
      )}

      <div
        data-block-id={block.id}
        onClick={interactive ? () => onBlockClick!(block.id) : undefined}
        style={{
          ...innerStyle,
          cursor: interactive ? "pointer" : undefined,
          position: "relative",
          boxShadow: isSelected
            ? "inset 0 0 0 2px rgba(79,70,229,0.55)"
            : hovered && interactive
            ? "inset 0 0 0 1px rgba(79,70,229,0.22)"
            : undefined,
          transition: "box-shadow 0.12s ease",
        }}
      >
        {Renderer && <Renderer content={block.content} />}
      </div>
    </div>
  );
});
export function EmailPreview({ blocks, subject, background, importedHtml, viewport = "desktop", darkMode = false, zoom = 1, onBlockClick, selectedBlockId, onReorder }: EmailPreviewProps) {
  const bg = background || DEFAULT_BACKGROUND;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const maxW = VIEWPORT_WIDTHS[viewport] ?? 600;
  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";
  const isCompact = isMobile || isTablet;
  const interactive = !!onBlockClick;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Memoize block IDs to prevent SortableContext re-initialization
  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && onReorder) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      onReorder(arrayMove(blocks, oldIndex, newIndex));
    }
  };

  // Auto-resize the iframe to match its content height
  useEffect(() => {
    if (!importedHtml || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          // Set a small delay to let images load
          setTimeout(() => {
            const height = doc.body.scrollHeight;
            iframe.style.height = `${height + 20}px`;
          }, 300);
        }
      } catch {
        // sandbox may prevent access
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [importedHtml]);

  /* ── Imported HTML mode: render in iframe ── */
  if (importedHtml) {
    return (
      <div
        className="flex flex-col items-center"
        style={{
          backgroundColor: "#E4E4E4",
          minHeight: "100dvh",
          paddingTop: 24,
          paddingBottom: 40,
        }}
      >
        {/* Subject line preview */}
        {subject && (
          <div className="w-full mb-3 px-3" style={{ maxWidth: maxW }}>
            <span className="text-xs text-muted-foreground">Subject: </span>
            <span className="text-sm font-medium text-foreground">{subject}</span>
          </div>
        )}

        {/* Imported HTML in sandboxed iframe */}
        <div
          className="w-full rounded-xl overflow-hidden"
          style={{
            maxWidth: maxW,
            boxShadow: "0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={importedHtml}
            title="Imported Email Preview"
            className="w-full border-0 bg-white"
            sandbox="allow-same-origin"
            style={{ display: "block", minHeight: 600 }}
          />
        </div>
      </div>
    );
  }

  /* ── Empty blocks: glass card centered in viewport ── */
  if (blocks.length === 0 && !importedHtml) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "80vh", padding: "32px 24px" }}
      >
        <div
          className="flex flex-col items-center"
          style={{
            maxWidth: 320,
            textAlign: "center",
            background: "rgba(255,255,255,0.65)",
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.60)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.03)",
            transform: "translateY(-24px)",
            padding: "48px 36px 40px",
          }}
        >
          {/* Top accent */}
          <div style={{ width: 48, height: 4, borderRadius: 99, background: "linear-gradient(90deg, #818CF8, #a78bfa)", marginBottom: 28, opacity: 0.6 }} />
          {/* Animated Icon */}
          <div 
            style={{ position: "relative", width: 64, height: 64, borderRadius: 20, background: "rgba(79,70,229,0.09)", border: "1.5px solid rgba(79,70,229,0.16)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}
          >
            {/* SVG Envelope */}
            <svg 
              width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          {/* Title */}
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1e1b4b", letterSpacing: "-0.02em", marginBottom: 8, fontFamily: DIN_FONT_FAMILY_STACK }}>
            Start Building Your Email
          </div>
          {/* Subtitle */}
          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, maxWidth: 240, marginBottom: 28, fontFamily: DIN_FONT_FAMILY_STACK, fontWeight: 400 }}>
            Add blocks from the panel on the left to compose your email
          </div>
          {/* Step pills */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { label: "1. Add Blocks", bg: "rgba(240,253,244,0.85)", border: "#bbf7d0", color: "#16a34a" },
              { label: "2. Edit Content", bg: "rgba(239,246,255,0.85)", border: "#bfdbfe", color: "#2563eb" },
              { label: "3. Preview & Export", bg: "rgba(250,245,255,0.85)", border: "#e9d5ff", color: "#9333ea" },
            ].map((s) => (
              <div key={s.label} style={{ padding: "5px 12px", borderRadius: 99, background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontSize: 11, fontWeight: 700, fontFamily: DIN_FONT_FAMILY_STACK, letterSpacing: "0.01em" }}>
                {s.label}
              </div>
            ))}
          </div>
          {/* Bottom accent */}
          <div style={{ width: 32, height: 3, borderRadius: 99, background: "linear-gradient(90deg, #a78bfa, #818CF8)", marginTop: 32, opacity: 0.3 }} />
        </div>
      </div>
    );
  }

  /* ── Normal block-based mode ── */
  const outerStyle: React.CSSProperties = {
    ...buildBackgroundStyle(bg),
    position: "relative",
    minHeight: "100dvh",
    overflow: "hidden",
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: maxW,
    backgroundColor: bg.contentBgColor,
    borderRadius: bg.contentBorderRadius,
    overflow: "hidden",
    fontFamily: DIN_FONT_FAMILY_STACK,
    fontWeight: 400,
    ...(bg.contentShadow
      ? { boxShadow: "0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)" }
      : {}),
  };

  const hasPattern = bg.type === "pattern" && bg.pattern !== "none";

  return (
    <div style={outerStyle}>
      {/* Pattern overlay */}
      {hasPattern && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: bg.patternOpacity / 100,
            pointerEvents: "none",
          }}
          dangerouslySetInnerHTML={{
            __html: getPatternPreviewSvg(bg.pattern, bg.secondaryColor, bg.patternScale),
          }}
        />
      )}

      <div
        className="flex flex-col items-center relative"
        style={{
          paddingLeft: bg.paddingX,
          paddingRight: bg.paddingX,
          paddingTop: bg.paddingY,
          paddingBottom: bg.paddingY,
          minHeight: "100dvh",
        }}
      >
        {/* Subject line preview */}
        {subject && (
          <div className="w-full mb-3 px-1" style={{ maxWidth: maxW }}>
            <span className="text-xs" style={{ color: isLightColor(bg.primaryColor) ? "#6b7280" : "rgba(255,255,255,0.6)" }}>
              Subject:{" "}
            </span>
            <span className="text-sm font-medium" style={{ color: isLightColor(bg.primaryColor) ? "#111827" : "#ffffff" }}>
              {subject}
            </span>
          </div>
        )}

        {/* Email body */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            <div style={{ ...cardStyle, ...(darkMode ? { backgroundColor: "#1a1a1a" } : {}), transform: `scale(${zoom})`, transformOrigin: "top center" }} className={`${darkMode ? "email-dark-mode" : ""} ${isCompact ? "email-compact" : ""}`}>
              {darkMode && (
                <style dangerouslySetInnerHTML={{ __html: `
                  .email-dark-mode h1, .email-dark-mode h2, .email-dark-mode h3, .email-dark-mode h4, .email-dark-mode h5, .email-dark-mode h6,
                  .email-dark-mode p, .email-dark-mode span, .email-dark-mode li, .email-dark-mode td, .email-dark-mode div,
                  .email-dark-mode strong, .email-dark-mode em, .email-dark-mode label {
                    color: #e2e8f0 !important;
                  }
                  .email-dark-mode a:not(.email-btn) {
                    color: #6db3f2 !important;
                  }
                  .email-dark-mode hr {
                    border-color: #2a2a2a !important;
                  }
                  .email-dark-mode .email-footer-block {
                    background-color: #1a1a1a !important;
                    border-top-color: #2a2a2a !important;
                  }
                  .email-dark-mode .email-header-block {
                    background-color: #1a1a1a !important;
                    border-bottom-color: #2a2a2a !important;
                  }
                  .email-dark-mode .email-column-card {
                    background-color: #1e1e1e !important;
                    border-color: #2a2a2a !important;
                  }
                  .email-dark-mode .email-coupon-box {
                    background-color: rgba(194,112,61,0.12) !important;
                    border-color: #C2703D !important;
                    color: #D99A6C !important;
                  }
                  .email-dark-mode .email-coupon-label {
                    color: #94a3b8 !important;
                  }
                  .email-dark-mode .email-footer-block a {
                    color: #94a3b8 !important;
                  }
                  .email-dark-mode th {
                    background-color: #c2410c !important;
                  }
                  .email-dark-mode th, .email-dark-mode td {
                    border-color: #2a2a2a !important;
                  }
                  .email-dark-mode .accordion-card {
                    background-color: #252525 !important;
                    border-color: #3a3a3a !important;
                  }
                  .email-dark-mode .accordion-header {
                    background-color: #252525 !important;
                    color: #e2e8f0 !important;
                  }
                  .email-dark-mode .accordion-body {
                    background-color: #1e1e1e !important;
                    color: #cbd5e1 !important;
                    border-top: 1px solid #2a2a2a !important;
                  }
                ` }} />
              )}
              {/* Responsive overrides for compact viewports (mobile/tablet).
                  Blocks with .lock-layout opt out of stacking to stay horizontal. */}
              {isCompact && (
                <style dangerouslySetInnerHTML={{ __html: `
                  .email-compact .email-header-block,
                  .email-compact .email-heading-block,
                  .email-compact .email-body-text-block,
                  .email-compact .email-button-block,
                  .email-compact .email-divider-block,
                  .email-compact .email-image-text-block,
                  .email-compact .email-image-block,
                  .email-compact .email-icon-grid-block,
                  .email-compact .email-columns-block,
                  .email-compact .email-social-links-block,
                  .email-compact .email-footer-block,
                  .email-compact .email-video-block,
                  .email-compact .email-countdown-block,
                  .email-compact .email-table-block,
                  .email-compact .email-coupon-block {
                    padding-left: 12px !important;
                    padding-right: 12px !important;
                  }
                  .email-compact .email-columns-flex:not(.lock-layout) {
                    flex-direction: column !important;
                    gap: 10px !important;
                  }
                  .email-compact .email-countdown-units {
                    gap: 4px !important;
                  }
                  .email-compact .email-countdown-unit {
                    min-width: 48px !important;
                    padding: 8px 6px !important;
                  }
                  .email-compact .email-countdown-num {
                    font-size: 20px !important;
                  }
                  .email-compact .email-icon-grid-flex:not(.lock-layout) {
                    flex-wrap: wrap !important;
                  }
                ` }} />
              )}
              {blocks.map((block) => (
                <PreviewBlockItem
                  key={block.id}
                  block={block}
                  isSelected={selectedBlockId === block.id}
                  interactive={interactive}
                  darkMode={darkMode}
                  onBlockClick={onBlockClick}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
