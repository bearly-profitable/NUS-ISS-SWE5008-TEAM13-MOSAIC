import type { EmailBlock, EmailBackground, IconGridItem } from "@/types/email-builder";
import { DEFAULT_BACKGROUND } from "@/types/email-builder";
import { DIN_FONT_FAMILY_STACK, dinRoundProEmailFontFaceCss } from "@/lib/din-font";
import { getPatternTileSvg } from "./background-patterns";

// â”€â”€ Simple markdown â†’ HTML (handles bold, italic, links, lists, paragraphs) â”€â”€
function markdownToHtml(md: string, color = "#374151", fontSize = 14): string {
  if (!md) return "";

  const lines = md.split("\n");
  const output: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw.trim();

    // Blank line = paragraph break
    if (line === "") {
      if (inList) {
        output.push("</ul>");
        inList = false;
      }
      output.push('<br style="display:block;margin:6px 0;content:\'\'"/>');
      continue;
    }

    // Unordered list item
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        output.push(`<ul style="margin:8px 0 8px 20px;padding:0;color:${color};font-size:${fontSize}px;line-height:1.7;font-family:${DIN_FONT_FAMILY_STACK};font-weight:400">`);
        inList = true;
      }
      const item = inlineFormat(line.replace(/^[-*]\s+/, ""));
      output.push(`<li style="margin:2px 0">${item}</li>`);
      continue;
    }

    if (inList) {
      output.push("</ul>");
      inList = false;
    }

    output.push(`<p style="margin:4px 0;color:${color};font-size:${fontSize}px;line-height:1.7;font-family:${DIN_FONT_FAMILY_STACK};font-weight:400">${inlineFormat(line)}</p>`);
  }

  if (inList) output.push("</ul>");
  return output.join("\n");
}

function inlineFormat(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links [text](url)
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#C2703D;text-decoration:underline">$1</a>');
}

// â”€â”€ Background CSS â”€â”€
function buildBgCss(bg: EmailBackground, patternImageUri?: string): string {
  if (bg.type === "gradient") {
    if (bg.gradientDirection === "radial") {
      return `background: radial-gradient(circle at center, ${bg.primaryColor}, ${bg.secondaryColor});`;
    }
    const dir: Record<string, string> = {
      "to-bottom": "to bottom",
      "to-right": "to right",
      "to-bottom-right": "to bottom right",
      "to-top-right": "to top right",
    };
    return `background: linear-gradient(${dir[bg.gradientDirection] || "to bottom"}, ${bg.primaryColor}, ${bg.secondaryColor});`;
  }

  if (bg.type === "pattern" && bg.pattern !== "none" && patternImageUri) {
    return `background-color:${bg.primaryColor};background-image:url(${patternImageUri});background-repeat:repeat;`;
  }

  return `background-color:${bg.primaryColor};`;
}

/**
 * Converts the current background pattern into a PNG data URI using canvas.
 * Returns null if no pattern, or a { dataUri, base64 } object.
 */
export async function renderPatternToPng(
  bg: EmailBackground,
): Promise<{ dataUri: string; base64: string } | null> {
  if (bg.type !== "pattern" || bg.pattern === "none") return null;

  const tile = getPatternTileSvg(bg.pattern, bg.secondaryColor, bg.patternScale, bg.patternOpacity);
  if (!tile) return null;

  const svgBlob = new Blob([tile.svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = tile.width;
      canvas.height = tile.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, tile.width, tile.height);
      URL.revokeObjectURL(svgUrl);
      const dataUri = canvas.toDataURL("image/png");
      const base64 = dataUri.split(",")[1];
      resolve({ dataUri, base64 });
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      resolve(null);
    };
    img.src = svgUrl;
  });
}

// â”€â”€ Individual block renderers â”€â”€
function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function renderHeader(content: Record<string, string>): string {
  const logoHeight = parseInt(content.logoHeight || "56");

  if (content.floating !== "true") {
    // Non-floating: original table-based block
    const bgColor = content.bgColor || "#ffffff";
    const logo = content.logoUrl
      ? `<img src="${content.logoUrl}" alt="Logo" style="max-height:${logoHeight}px;display:block;margin:0 auto;border:0">`
      : "";
    return `
<table width="100%" cellpadding="0" cellspacing="0" class="email-header-bg" style="background-color:${bgColor};border-bottom:1px solid #e5e7eb">
  <tr><td class="email-padded-cell" style="padding:20px 32px;text-align:center">
    ${logo}
  </td></tr>
</table>`;
  }

  // Floating: absolutely positioned logo that overlaps the next block
  if (!content.logoUrl) return "";

  const floatAlign = content.floatAlign || "left";
  const floatX = parseInt(content.floatX || "16");
  const floatY = parseInt(content.floatY || "16");

  // Build alignment CSS
  let alignCss: string;
  if (floatAlign === "left") {
    alignCss = `left:${floatX}px;`;
  } else if (floatAlign === "right") {
    alignCss = `right:${floatX}px;`;
  } else {
    alignCss = `left:50%;transform:translateX(-50%);`;
  }

  // Use a zero-height div with overflow visible + absolute positioning
  // This works in modern email clients. For Outlook, we use VML fallback.
  return `
<!--[if !mso]><!-->
<div style="height:0;overflow:visible;position:relative;z-index:10">
  <div style="position:absolute;top:${floatY}px;${alignCss}z-index:10">
    <img src="${content.logoUrl}" alt="Logo" style="height:${logoHeight}px;display:block;border:0">
  </div>
</div>
<!--<![endif]-->
<!--[if mso]>
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="${floatAlign}" style="padding:${floatY}px ${floatAlign === "right" ? floatX + "px" : "32px"} 0 ${floatAlign === "left" ? floatX + "px" : "32px"};">
    <img src="${content.logoUrl}" alt="Logo" height="${logoHeight}" style="height:${logoHeight}px;border:0">
  </td></tr>
</table>
<![endif]-->`;
}

function renderHeading(content: Record<string, string>): string {
  const align = content.align || "left";
  const size = parseInt(content.size || "24");
  const color = content.color || "#111827";
  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td class="email-padded-cell" style="padding:24px 32px 8px;text-align:${align}">
    <h1 style="font-size:${size}px;font-weight:700;color:${color};margin:0;line-height:1.3;font-family:${DIN_FONT_FAMILY_STACK}">${content.text || "Your Heading"}</h1>
  </td></tr>
</table>`;
}

function renderBodyText(content: Record<string, string>): string {
  const color = content.color || "#374151";
  const fontSize = parseInt(content.fontSize || "14");
  const align = content.align || "left";
  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td class="email-padded-cell" style="padding:8px 32px 16px;font-family:${DIN_FONT_FAMILY_STACK};font-weight:400;color:${color};font-size:${fontSize}px;text-align:${align}">
    ${markdownToHtml(content.markdown || "", color, fontSize)}
  </td></tr>
</table>`;
}

function renderButton(content: Record<string, string>): string {
  const color = content.color || "#C2703D";
  const textColor = content.textColor || "#ffffff";
  const style = content.style || "filled";
  const size = content.size || "medium";
  const align = content.align || "center";
  const paddings: Record<string, string> = { small: "8px 20px", medium: "12px 32px", large: "16px 48px" };
  const fontSizes: Record<string, number> = { small: 12, medium: 14, large: 16 };
  const pad = paddings[size] || "12px 32px";
  const fs = fontSizes[size] || 14;
  const radius = style === "rounded" ? "50px" : "8px";
  const btnStyle = style === "outline"
    ? `background-color:transparent;color:${color};border:2px solid ${color};border-radius:${radius}`
    : `background-color:${color};color:${textColor};border:none;border-radius:${radius}`;
  const btnText = content.text || "Click Here";
  // Old Outlook (Word/VML engine) ignores width:auto on v:roundrect, so the
  // button collapses. Compute an explicit pixel width from the label length,
  // font size, and the matching horizontal padding used by the HTML anchor.
  const hPad: Record<string, number> = { small: 20, medium: 32, large: 48 };
  const horizontalPadding = hPad[size] ?? 32;
  const vmlHeight = fs + (size === "large" ? 32 : size === "small" ? 16 : 24);
  const vmlWidth = Math.round(btnText.length * fs * 0.6) + horizontalPadding * 2;
  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td class="email-padded-cell" style="padding:16px 32px;text-align:${align}">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${content.url || "#"}" style="height:${vmlHeight}px;v-text-anchor:middle;width:${vmlWidth}px;" arcsize="${style === "rounded" ? "50%" : "13%"}" ${style === "outline" ? `strokecolor="${color}" strokeweight="2px" fillcolor="transparent"` : `stroke="f" fillcolor="${color}"`}>
      <w:anchorlock/>
      <center style="color:${style === "outline" ? color : textColor};font-family:${DIN_FONT_FAMILY_STACK};font-size:${fs}px;font-weight:700;">${btnText}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-->
    <a href="${content.url || "#"}" class="${style === "outline" ? "email-btn-outline" : "email-btn"}" style="display:inline-block;padding:${pad};${btnStyle};font-size:${fs}px;font-weight:700;text-decoration:none;font-family:${DIN_FONT_FAMILY_STACK};letter-spacing:0.01em">${btnText}</a>
    <!--<![endif]-->
  </td></tr>
</table>`;
}

/**
 * Renders a small filled button with a VML fallback for old Outlook
 * (the Word engine ignores vertical padding on inline-block <a>, collapsing
 * the button). Used by Image+Text and Columns blocks.
 */
function msoSafeButton(opts: {
  text: string;
  url: string;
  bgColor: string;
  textColor: string;
  fontSize: number;
  vPad: number;
  hPad: number;
  radius: number;
  marginTop: number;
}): string {
  const { text, url, bgColor, textColor, fontSize, vPad, hPad, radius, marginTop } = opts;
  const height = fontSize + vPad * 2;
  const width = Math.round(text.length * fontSize * 0.6) + hPad * 2;
  // VML arcsize is the corner radius as a fraction of half the shorter side (max 0.5 = full pill).
  const arcsize = Math.min(50, Math.round((radius / (height / 2)) * 100));
  return `<div style="margin-top:${marginTop}px">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:${height}px;v-text-anchor:middle;width:${width}px;" arcsize="${arcsize}%" stroke="f" fillcolor="${bgColor}">
          <w:anchorlock/>
          <center style="color:${textColor};font-family:${DIN_FONT_FAMILY_STACK};font-size:${fontSize}px;font-weight:700;">${text}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${url}" style="display:inline-block;padding:${vPad}px ${hPad}px;background-color:${bgColor};color:${textColor};border-radius:${radius}px;text-decoration:none;font-weight:700;font-size:${fontSize}px;font-family:${DIN_FONT_FAMILY_STACK}">${text}</a>
        <!--<![endif]-->
      </div>`;
}

function renderDivider(content: Record<string, string>): string {
  const thickness = content.thickness || "2";
  const widthPct = content.widthPercent || "100";
  const marginTop = content.marginTop || "16";
  const marginBottom = content.marginBottom || "16";
  const dividerColor = content.color || "#C2703D";
  const dividerStyle = content.style || "solid";
  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td class="email-padded-cell" style="padding:${marginTop}px 32px ${marginBottom}px 32px">
    <div class="email-divider" style="border-top:${thickness}px ${dividerStyle} ${dividerColor};margin:0 auto;width:${widthPct}%;font-size:0;line-height:0;height:0;overflow:hidden">&nbsp;</div>
  </td></tr>
</table>`;
}

function renderImageText(content: Record<string, string>): string {
  const isLeft = content.imagePosition !== "right";

  // Match preview default (center) and map to HTML <td valign> attribute values.
  // HTML valign accepts: top | middle | bottom | baseline.
  const vAlign = content.verticalAlign || "center";
  const valignAttr =
    vAlign === "top" ? "top" : vAlign === "bottom" ? "bottom" : "middle";

  const imgCell = content.imageUrl
    ? `<img src="${content.imageUrl}" alt="" width="240" style="width:100%;max-width:240px;display:block;border-radius:8px;height:auto">`
    : `<div style="width:100%;min-height:120px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px">Image</div>`;
  const btnHtml = content.buttonText
    ? msoSafeButton({
        text: content.buttonText,
        url: content.buttonUrl || "#",
        bgColor: "#C2703D",
        textColor: "#ffffff",
        fontSize: 13,
        vPad: 8,
        hPad: 20,
        radius: 6,
        marginTop: 12,
      })
    : "";
  const imageCol = `<td class="img-text-col" width="45%" valign="${valignAttr}" style="padding-right:${isLeft ? "20px" : "0"};padding-left:${isLeft ? "0" : "20px"};vertical-align:${valignAttr}">${imgCell}</td>`;
  const textCol = `<td class="img-text-col" valign="${valignAttr}" style="padding-top:0;vertical-align:${valignAttr}"><h3 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px;font-family:${DIN_FONT_FAMILY_STACK}">${content.heading || "Feature Title"}</h3><p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0;font-family:${DIN_FONT_FAMILY_STACK};font-weight:400">${content.text || ""}</p>${btnHtml}</td>`;
  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td class="email-padded-cell" style="padding:20px 32px">
    <table class="img-text-table email-img-text" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${isLeft ? imageCol + textCol : textCol + imageCol}
      </tr>
    </table>
  </td></tr>
</table>`;
}

function renderImage(content: Record<string, string>): string {
  const align = content.align || "center";
  const rawWidth = content.width || "";
  const isAutoWidth = !rawWidth || rawWidth === "auto";
  const borderRadius = parseInt(content.borderRadius ?? "0");
  const radiusStyle = borderRadius > 0 ? `border-radius:${borderRadius}px;` : "";
  const tdAlign = align === "center" ? "center" : align === "right" ? "right" : "left";

  // When no explicit width is set, make the image fill the container (matches preview behavior)
  // Do NOT use a fixed HTML width attribute â€” it causes mobile email clients to render
  // the image at that fixed width even when the container is narrower.
  const widthStyle = isAutoWidth ? "width:100%;" : `width:${rawWidth};`;

  // Old Outlook needs a px width attribute. If the width is a percentage, convert
  // it to px relative to the 536px content area (a bare parseInt would treat
  // "50%" as 50px). Otherwise use the px value.
  const isPercentWidth = /%\s*$/.test(rawWidth);
  const htmlWidth = isAutoWidth
    ? "536"
    : isPercentWidth
      ? String(Math.round(536 * ((parseInt(rawWidth) || 100) / 100)))
      : String(parseInt(rawWidth) || 536);

  const imgTag = content.imageUrl
    ? `<img src="${content.imageUrl}" alt="${content.alt || ""}" width="${htmlWidth}" style="${widthStyle}max-width:100%;display:block;border:0;height:auto;${radiusStyle}">`
    : "";
  const linked = content.linkUrl && imgTag
    ? `<a href="${content.linkUrl}" style="display:inline-block;border:0;text-decoration:none;width:100%">${imgTag}</a>`
    : imgTag;
  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td class="email-padded-cell" style="padding:16px 32px;text-align:${tdAlign}">
    ${linked}
  </td></tr>
</table>`;
}

function renderIconGrid(content: Record<string, string>): string {
  let items: IconGridItem[] = [];
  try { items = JSON.parse(content.items || "[]"); } catch { /* ignore */ }
  if (items.length === 0) return "";

  const cells = items.map((item) => {
    // Text-only item
    if (item.label && !item.imageUrl) {
      const textHtml = `<span style="font-size:14px;font-weight:700;color:#424242;text-decoration:underline;font-family:${DIN_FONT_FAMILY_STACK}">${item.label}</span>`;
      const content = item.linkUrl
        ? `<a href="${item.linkUrl}" style="text-decoration:none">${textHtml}</a>`
        : textHtml;
      return `<td style="padding:0 8px;text-align:center;vertical-align:middle">${content}</td>`;
    }
    // Image item
    const borderRadius = item.borderRadius ?? 0;
    const img = item.imageUrl
      ? `<img src="${item.imageUrl}" alt="${item.alt || ""}" width="${item.size}" height="${item.size}" style="display:block;border:0;width:${item.size}px;height:${item.size}px;border-radius:${borderRadius}px">`
      : "";
    const linked = item.linkUrl && img
      ? `<a href="${item.linkUrl}" style="display:inline-block;border:0;text-decoration:none">${img}</a>`
      : img;
    return `<td style="padding:0 8px;text-align:center;vertical-align:middle">${linked}</td>`;
  }).join("");

  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td class="email-padded-cell" style="padding:16px 32px;text-align:center">
    <table cellpadding="0" cellspacing="0" align="center"><tr>${cells}</tr></table>
  </td></tr>
</table>`;
}

function renderColumns(content: Record<string, string>): string {
  const textAlign = content.colTextAlign || "center";
  const headingSize = parseInt(content.colHeadingSize || "15");
  const textSize = parseInt(content.colTextSize || "13");
  const headingColor = content.colHeadingColor || "#111827";
  const textColor = content.colTextColor || "#6b7280";
  const colBgColor = content.colBgColor || "#f9fafb";
  const colBorderColor = content.colBorderColor || "#f3f4f6";

  // When lockLayout is true, columns stay side-by-side on mobile (no stacking).
  // We achieve this by using class names the mobile media query does not target.
  const isLocked = content.lockLayout === "true";
  const tableClass = isLocked ? "cols-table-locked" : "cols-table";
  const cellClass = isLocked ? "col-cell-locked" : "col-cell";

  // Layout presets define row structure (mirrors EmailPreview ColumnsBlock)
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

  const count = parseInt(content.columnCount || "3");
  const rows = (layoutId && PRESETS[layoutId]) ? PRESETS[layoutId] : [Array.from({ length: count }, () => 1)];

  let cellIndex = 0;

  const renderCell = (flex: number, colsInRow: number): string => {
    const i = cellIndex++;
    const heading = content[`col${i + 1}Heading`] || `Column ${i + 1}`;
    const text = (content[`col${i + 1}Text`] || "").replace(/\n/g, "<br>");
    const colImgUrl = content[`col${i + 1}ImageUrl`];
    const colImgLink = content[`col${i + 1}ImageLink`];
    const layout = content[`col${i + 1}Layout`] || "image-first";
    const btnText = content[`col${i + 1}ButtonText`];
    const btnUrl = content[`col${i + 1}ButtonUrl`] || "#";

    let imgHtml = "";
    if (colImgUrl) {
      // Old Outlook ignores max-width and, with no width attribute, renders the
      // image at its intrinsic size (overflowing the column). Provide an explicit
      // px width matching the desktop cell; style width:100% keeps it responsive
      // (and full-width when columns stack on mobile) in CSS-capable clients.
      const outerContent = isLocked ? 580 : 536;
      const gap = isLocked ? 12 : 16;
      const cellPadding = 32; // 16px left + 16px right
      const imgWidth = Math.max(40, Math.floor((outerContent - (colsInRow - 1) * gap) / colsInRow) - cellPadding);
      const imgTag = `<img src="${colImgUrl}" alt="" width="${imgWidth}" style="width:100%;max-width:100%;height:auto;display:block;border-radius:6px;margin:0 auto 8px">`;
      imgHtml = colImgLink
        ? `<a href="${colImgLink}" style="display:block;text-decoration:none">${imgTag}</a>`
        : imgTag;
    }

    const headingHtml = `<h4 style="font-size:${headingSize}px;font-weight:700;color:${headingColor};margin:0 0 6px;font-family:${DIN_FONT_FAMILY_STACK}">${heading}</h4>`;
    const textHtml = `<p style="font-size:${textSize}px;color:${textColor};line-height:1.5;margin:0;font-family:${DIN_FONT_FAMILY_STACK};font-weight:400">${text}</p>`;
    const btnHtml = btnText
      ? msoSafeButton({
          text: btnText,
          url: btnUrl,
          bgColor: "#C2703D",
          textColor: "#ffffff",
          fontSize: 12,
          vPad: 7,
          hPad: 16,
          radius: 6,
          marginTop: 10,
        })
      : "";

    const innerHtml = layout === "text-first"
      ? `${headingHtml}\n      ${textHtml}\n      ${btnHtml}\n      ${imgHtml}`
      : `${imgHtml}\n      ${headingHtml}\n      ${textHtml}\n      ${btnHtml}`;

    const widthPct = Math.floor(100 / colsInRow);
    return `<td class="${cellClass} email-col-card" width="${widthPct}%" valign="top" style="padding:16px;background-color:${colBgColor};border-radius:10px;text-align:${textAlign};border:1px solid ${colBorderColor}">
      ${innerHtml}
    </td>`;
  };

  const rowsHtml = rows.map((row) => {
    const gapTd = isLocked
      ? '<td class="col-gap-locked" width="12" style="width:12px;min-width:12px"></td>'
      : '<td class="col-gap" width="16" style="width:16px;min-width:16px"></td>';
    const cells = row.map((flex) => renderCell(flex, row.length)).join(gapTd);
    return `<table class="${tableClass}" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`;
  }).join('\n    <div style="height:12px;line-height:12px;font-size:1px">&nbsp;</div>\n    ');

  const outerPadding = isLocked ? "padding:12px 10px" : "padding:20px 32px";

  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td${isLocked ? "" : ' class="email-padded-cell"'} style="${outerPadding}">
    ${rowsHtml}
  </td></tr>
</table>`;
}

/** Supported social platforms â€” tiktok and website are intentionally excluded. */
const SUPPORTED_SOCIAL_PLATFORMS = ["facebook", "twitter", "instagram", "linkedin", "youtube"] as const;

/**
 * Fetches the custom social icon PNGs from /social-icons/ and returns
 * platform â†’ dataUri map for use in email export.
 */
export async function renderSocialIconsToPngs(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  await Promise.all(
    SUPPORTED_SOCIAL_PLATFORMS.map(async (platform) => {
      try {
        const response = await fetch(`/social-icons/${platform}.png`);
        if (!response.ok) return;
        const blob = await response.blob();
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            result[platform] = reader.result as string;
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(blob);
        });
      } catch {
        // skip missing icons silently
      }
    })
  );

  return result;
}

function renderSocialLinks(content: Record<string, string>, iconPngs?: Record<string, string>): string {
  // Only render supported platforms; skip tiktok, website, and any unknown platforms
  const links = Object.entries(content).filter(
    ([platform, url]) => url && (SUPPORTED_SOCIAL_PLATFORMS as readonly string[]).includes(platform)
  );
  if (links.length === 0) return "";

  // Each icon is a nested table so we can use HTML align/valign attributes,
  // which are the only reliable way to center content in all email clients
  // (Outlook ignores CSS flexbox and line-height tricks on inline-block).
  // Vertical centering: explicit padding:10px 0 on the TD (10 + 20px image + 10 = 40px),
  // never relying on valign="middle" which has baseline-offset quirks on inline-block children.
  const iconCells = links.map(([platform, url]) => {
    const imgSrc = iconPngs?.[platform];
    if (!imgSrc) return "";
    return `<td style="padding:0 6px">
        <a href="${url}" style="display:inline-block;line-height:0;font-size:0;text-decoration:none;border:0">
          <img src="${imgSrc}" width="20" height="20" alt="${platform}" style="display:block;border:0;outline:0">
        </a>
      </td>`;
  }).join("");

  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td class="email-padded-cell" align="center" style="padding:20px 32px;text-align:center">
      <table cellpadding="0" cellspacing="0" border="0" align="center">
        <tr>${iconCells}</tr>
      </table>
    </td>
  </tr>
</table>`;
}

function renderFooter(content: Record<string, string>): string {
  // Build the 3 configurable hyperlinks with | dividers
  const links: { label: string; url: string }[] = [];
  if (content.link1Label && content.link1Url) links.push({ label: content.link1Label, url: content.link1Url });
  if (content.link2Label && content.link2Url) links.push({ label: content.link2Label, url: content.link2Url });
  if (content.link3Label && content.link3Url) links.push({ label: content.link3Label, url: content.link3Url });

  const linksHtml = links.length > 0
    ? links.map((l, i) =>
        `${i > 0 ? '<span style="margin:0 8px;color:#d1d5db">|</span>' : ''}<a href="${l.url}" style="color:#6b7280;text-decoration:none;font-size:12px;font-family:${DIN_FONT_FAMILY_STACK};font-weight:400">${l.label}</a>`
      ).join("")
    : "";

  return `
<table width="100%" cellpadding="0" cellspacing="0" class="email-footer" style="border-top:1px solid #e5e7eb;background-color:#f9fafb">
  <tr><td class="email-padded-cell" style="padding:24px 32px;text-align:center;font-size:12px;color:#9ca3af;font-family:${DIN_FONT_FAMILY_STACK};font-weight:400">
    ${linksHtml}
  </td></tr>
</table>`;
}

function renderSpacer(content: Record<string, string>): string {
  const height = parseInt(content.height || "40");
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:${height}px;line-height:${height}px;font-size:1px">&nbsp;</td></tr></table>`;
}

function renderVideo(content: Record<string, string>): string {
  // Prefer the pre-baked play-button composite uploaded to Supabase by the
  // video editor; fall back to the raw thumbnail for older saved blocks.
  const compositeThumb = content.thumbnailWithPlayUrl;
  const rawThumb = content.thumbnailUrl;
  const thumb = compositeThumb || rawThumb;
  const rawUrl = content.videoUrl || "";
  const url = rawUrl && !/^https?:\/\//i.test(rawUrl) ? `https://${rawUrl}` : rawUrl || "#";
  const alt = content.alt || "Video";
  const aspectRatio = content.aspectRatio || "16:9";
  const sizeMap: Record<string, { width: number; height: number }> = {
    "16:9": { width: 536, height: 302 },
    "4:3": { width: 536, height: 402 },
    "1:1": { width: 536, height: 536 },
    "9:16": { width: 302, height: 536 },
  };
  const { width, height } = sizeMap[aspectRatio] || sizeMap["16:9"];
  if (!thumb) return "";

  // If the composite (with baked play button) is available, just render a simple linked image.
  if (compositeThumb) {
    return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td class="email-padded-cell" style="padding:16px 32px;text-align:center">
    <a href="${url}" target="_blank" style="display:inline-block;text-decoration:none;border:0;max-width:100%">
      <img src="${compositeThumb}" alt="${alt}" width="${width}" height="${height}" style="display:block;width:100%;max-width:${width}px;height:auto;border-radius:8px;border:0">
    </a>
  </td></tr>
</table>`;
  }

  // Fallback: raw thumbnail without baked play button.
  // The compositor should normally succeed (fixed CORS fetch approach), but if
  // it didn't, render the thumbnail as a plain linked image. Email clients
  // strip data URIs and CSS position:absolute, so a pure-HTML play overlay
  // isn't reliably possible. The thumbnail still links to the video URL.
  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td class="email-padded-cell" style="padding:16px 32px;text-align:center">
    <a href="${url}" target="_blank" style="display:inline-block;text-decoration:none;border:0;max-width:100%">
      <img src="${rawThumb}" alt="${alt}" width="${width}" height="${height}" style="display:block;width:100%;max-width:${width}px;height:auto;border-radius:8px;border:0">
    </a>
  </td></tr>
</table>`;
}

function renderCountdown(content: Record<string, string>): string {
  const bgColor = (content.bgColor || "#C2703D").replace("#", "");
  const textColor = (content.textColor || "#ffffff").replace("#", "");
  const label = content.label || "";
  const target = content.targetDate ? new Date(content.targetDate) : null;

  if (!target) {
    return `
<table width="100%" cellpadding="0" cellspacing="0" class="email-countdown-bg" style="background-color:#${bgColor}">
  <tr><td style="padding:24px 32px;text-align:center;color:#${textColor};font-family:${DIN_FONT_FAMILY_STACK};font-size:14px">
    Set a target date for the countdown
  </td></tr>
</table>`;
  }

  // Snapshot the remaining time at build time and render it as an HTML table.
  // A *ticking* countdown in an inbox needs an animated GIF re-rendered on every
  // open by a publicly reachable image service, and we do not run one: there is
  // no such route on the orchestrator, and its base URL is a loopback address no
  // recipient's mail client could fetch anyway. A frozen-but-correct countdown
  // beats a broken-image box, and this markup draws in every client, Outlook
  // included.
  const diff = Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);

  const labelHtml = label
    ? `<div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#${textColor};font-family:${DIN_FONT_FAMILY_STACK}">${label}</div>`
    : "";

  // Compute a darkened version of bgColor for the unit cell background (Outlook doesn't support rgba)
  const bgR = parseInt(bgColor.substring(0, 2), 16);
  const bgG = parseInt(bgColor.substring(2, 4), 16);
  const bgB = parseInt(bgColor.substring(4, 6), 16);
  const unitBgHex = `#${Math.max(0, Math.round(bgR * 0.85)).toString(16).padStart(2, "0")}${Math.max(0, Math.round(bgG * 0.85)).toString(16).padStart(2, "0")}${Math.max(0, Math.round(bgB * 0.85)).toString(16).padStart(2, "0")}`;

  const unitCell = (val: number, lbl: string) =>
    `<td class="email-countdown-unit" style="padding:12px 16px;background-color:${unitBgHex};border-radius:8px;text-align:center;min-width:64px">
      <div style="font-size:28px;font-weight:800;line-height:1;color:#${textColor};font-family:${DIN_FONT_FAMILY_STACK}">${String(val).padStart(2, "0")}</div>
      <div style="font-size:10px;font-weight:500;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em;color:#${textColor}">${lbl}</div>
    </td>`;

  return `
<table width="100%" cellpadding="0" cellspacing="0" class="email-countdown-bg" style="background-color:#${bgColor}">
  <tr><td class="email-padded-cell" style="padding:24px 32px;text-align:center">
    ${labelHtml}
    <table cellpadding="0" cellspacing="4" align="center"><tr>
      ${unitCell(days, "Days")}${unitCell(hours, "Hours")}${unitCell(mins, "Mins")}
    </tr></table>
  </td></tr>
</table>`;
}

function renderTable(content: Record<string, string>): string {
  let rows: string[][] = [];
  try { rows = JSON.parse(content.rows || "[]"); } catch { /* ignore */ }
  if (rows.length === 0) return "";
  const headerBg = content.headerBgColor || "#C2703D";
  const borderColor = content.borderColor || "#e5e7eb";

  const rowsHtml = rows.map((row, ri) =>
    `<tr>${row.map((cell, ci) => ri === 0
      ? `<th style="padding:10px 12px;background-color:${headerBg};color:#fff;font-weight:700;font-size:13px;text-align:left;border:1px solid ${borderColor};font-family:${DIN_FONT_FAMILY_STACK}">${cell}</th>`
      : `<td style="padding:8px 12px;font-size:13px;border:1px solid ${borderColor};color:#374151;font-family:${DIN_FONT_FAMILY_STACK};font-weight:400">${cell}</td>`
    ).join("")}</tr>`
  ).join("");

  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td class="email-padded-cell" style="padding:16px 32px">
    <div style="overflow-x:auto;max-width:100%">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rowsHtml}</table>
    </div>
  </td></tr>
</table>`;
}

function renderCoupon(content: Record<string, string>): string {
  const bgColor = content.bgColor || "#FFF8F0";
  const textColor = content.textColor || "#C2703D";
  const code = content.code || "CODE";
  const label = content.label || "";

  const labelHtml = label ? `<div class="email-coupon-label" style="font-size:13px;color:#6b7280;margin-bottom:8px;font-family:${DIN_FONT_FAMILY_STACK}">${label}</div>` : "";

  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td class="email-padded-cell" style="padding:24px 32px;text-align:center">
    ${labelHtml}
    <table cellpadding="0" cellspacing="0" align="center" style="border-collapse:separate;border-spacing:0">
      <tr>
        <td class="email-coupon-code" style="padding:16px 40px;border-radius:10px;background-color:${bgColor};border:2px dashed ${textColor};font-size:24px;font-weight:800;letter-spacing:0.15em;color:${textColor};font-family:${DIN_FONT_FAMILY_STACK};text-align:center">${code}</td>
      </tr>
    </table>
  </td></tr>
</table>`;
}

function renderAccordion(content: Record<string, string>): string {
  let items: Array<{ id: string; question: string; answer: string }> = [];
  try { items = JSON.parse(content.items || "[]"); } catch { /* ignore */ }

  const headerBg = content.headerBgColor || "#C2703D";
  const headerText = content.headerTextColor || "#ffffff";
  const bodyBg = content.bodyBgColor || "#FFF8F0";
  const bodyText = content.bodyTextColor || "#374151";
  const radius = parseInt(content.borderRadius || "12");

  if (items.length === 0) return "";

  // Render as stacked cards - works in ALL email clients (Gmail, Outlook, Apple Mail).
  // No interactive expand/collapse since Gmail strips <details>, <input>, etc.
  // Each Q&A pair is a clean card with visual hierarchy.
  const itemsHtml = items.map((item) => {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border-collapse:separate;border-spacing:0">
        <tr>
          <td style="background-color:${headerBg};color:${headerText};padding:14px 18px;font-size:14px;font-weight:600;font-family:${DIN_FONT_FAMILY_STACK};border-radius:${radius}px ${radius}px 0 0;line-height:1.4">
            ${item.question}
          </td>
        </tr>
        <tr>
          <td style="background-color:${bodyBg};color:${bodyText};padding:14px 18px;font-size:13px;line-height:1.65;font-family:${DIN_FONT_FAMILY_STACK};font-weight:400;border-radius:0 0 ${radius}px ${radius}px;border:1px solid ${bodyBg};border-top:none">
            ${item.answer}
          </td>
        </tr>
      </table>`;
  }).join("");

  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td class="email-padded-cell" style="padding:16px 32px">
    ${itemsHtml}
  </td></tr>
</table>`;
}
function buildBlockRenderers(iconPngs?: Record<string, string>): Record<string, (content: Record<string, string>) => string> {
  return {
    header: renderHeader,
    "hero-image": renderImage,
    heading: renderHeading,
    "body-text": renderBodyText,
    button: renderButton,
    image: renderImage,
    gif: renderImage,
    divider: renderDivider,
    "image-text": renderImageText,
    "icon-grid": renderIconGrid,
    columns: renderColumns,
    "social-links": (content) => renderSocialLinks(content, iconPngs),
    footer: renderFooter,
    spacer: renderSpacer,
    video: renderVideo,
    countdown: renderCountdown,
    table: renderTable,
    coupon: renderCoupon,
    accordion: renderAccordion,
    "lang-toggle": () => "", // lang-toggle is handled at the template level, not per-block
  };
}

export function generateEmlFile(
  blocks: EmailBlock[],
  subject: string,
  background?: EmailBackground,
  patternPngBase64?: string,
  socialIconPngs?: Record<string, string>,
): string {
  // â”€â”€ Extract data-URI hero images into MIME attachments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // This prevents stretched/wonky rendering caused by massive inline data URIs
  // in email clients. Each hero PNG gets a cid: reference instead.
  const heroAttachments: Array<{ cid: string; base64: string; mime: string }> = [];
  const processedBlocks = blocks.map((block, idx) => {
    if (block.type !== "hero-image") return block;
    const url = block.content.imageUrl;
    if (!url || !url.startsWith("data:image/")) return block;

    // Parse data URI â†’ base64 + mime type
    const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return block;

    const mime = match[1];
    const base64 = match[2];
    const cid = `hero-img-${idx}`;
    heroAttachments.push({ cid, base64, mime });

    return {
      ...block,
      content: { ...block.content, imageUrl: `cid:${cid}` },
    };
  });

  const hasAttachments = heroAttachments.length > 0 || !!patternPngBase64;
  const patternSrc = patternPngBase64 ? "cid:pattern-tile" : undefined;
  const html = generateEmailHtml(processedBlocks, subject, background, patternSrc, socialIconPngs);

  const plainText = subject
    ? `This email contains HTML content. Please view it in an HTML-capable email client.\n\nSubject: ${subject}`
    : "This email contains HTML content. Please view it in an HTML-capable email client.";

  if (hasAttachments) {
    const outerBoundary = `----=_Outer_${Math.random().toString(36).slice(2, 10)}`;
    const innerBoundary = `----=_Inner_${Math.random().toString(36).slice(2, 10)}`;

    const parts = [
      "MIME-Version: 1.0",
      `Content-Type: multipart/related; boundary="${outerBoundary}"`,
      `Subject: ${subject || "(No Subject)"}`,
      "From: ",
      "To: ",
      "X-Mailer: MiCloud Flow Builder",
      "",
      `--${outerBoundary}`,
      `Content-Type: multipart/alternative; boundary="${innerBoundary}"`,
      "",
      `--${innerBoundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      plainText,
      "",
      `--${innerBoundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      html,
      "",
      `--${innerBoundary}--`,
    ];

    // Attach hero images as MIME parts
    for (const att of heroAttachments) {
      parts.push(
        "",
        `--${outerBoundary}`,
        `Content-Type: ${att.mime}`,
        "Content-Transfer-Encoding: base64",
        `Content-ID: <${att.cid}>`,
        "Content-Disposition: inline",
        "",
        ...chunkBase64(att.base64),
      );
    }

    // Attach pattern tile if present
    if (patternPngBase64) {
      parts.push(
        "",
        `--${outerBoundary}`,
        "Content-Type: image/png",
        "Content-Transfer-Encoding: base64",
        "Content-ID: <pattern-tile>",
        "Content-Disposition: inline",
        "",
        ...chunkBase64(patternPngBase64),
      );
    }

    parts.push("", `--${outerBoundary}--`);
    return parts.join("\r\n");
  }

  const boundary = `----=_Part_${Math.random().toString(36).slice(2, 10)}`;
  return [
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `Subject: ${subject || "(No Subject)"}`,
    "From: ",
    "To: ",
    "X-Mailer: MiCloud Flow Builder",
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    plainText,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    "",
    `--${boundary}--`,
  ].join("\r\n");
}

/** Splits a base64 string into 76-char lines (MIME standard) */
function chunkBase64(b64: string): string[] {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(b64.slice(i, i + 76));
  }
  return lines;
}

/** Replace %%key%% tokens in HTML with the provided variables map. */
function applyVariables(html: string, variables?: Record<string, string>): string {
  if (!variables) return html;
  return html.replace(/%%(\w+)%%/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
  );
}

export function generateEmailHtml(
  blocks: EmailBlock[],
  subject: string,
  background?: EmailBackground,
  patternImageSrc?: string,
  socialIconPngs?: Record<string, string>,
  variables?: Record<string, string>,
  /** Optional: Chinese-translated blocks + subject for in-email language toggle */
  chineseData?: {
    blocks: EmailBlock[];
    subject?: string;
  },
): string {
  const bg = background || DEFAULT_BACKGROUND;
  const bgCss = buildBgCss(bg, patternImageSrc);
  const renderers = buildBlockRenderers(socialIconPngs);

  const shadow = bg.contentShadow
    ? "box-shadow:0 4px 24px rgba(0,0,0,0.10),0 1px 4px rgba(0,0,0,0.06);"
    : "";

  const renderBlocksToHtml = (blockList: EmailBlock[]) =>
    blockList
      .filter((block) => block.content.hidden !== "true")
      .map((block) => {
        const renderer = renderers[block.type];
        if (!renderer) return "";
        let html = renderer(block.content);
        const paddingTop = parseInt(block.content.paddingTop || "0");
        const paddingBottom = parseInt(block.content.paddingBottom || "0");
        const blockBgColor = block.content.blockBgColor || "";
        if (paddingTop || paddingBottom || blockBgColor) {
          const styles = [
            paddingTop ? `padding-top:${paddingTop}px` : "",
            paddingBottom ? `padding-bottom:${paddingBottom}px` : "",
            blockBgColor ? `background-color:${blockBgColor}` : "",
          ].filter(Boolean).join(";");
          html = `<div style="${styles}">${html}</div>`;
        }
        return html;
      })
      .join("\n");

  const bodyHtml = renderBlocksToHtml(blocks);
  const chineseBodyHtml = chineseData ? renderBlocksToHtml(chineseData.blocks) : null;

  // Detect if a lang-toggle block is present — if so, inject the floating toggle
  const langToggleBlock = blocks.find((b) => b.type === "lang-toggle");
  const hasLangToggle = !!langToggleBlock;
  const hasChineseContent = !!chineseBodyHtml;

  const hasPattern = bg.type === "pattern" && bg.pattern !== "none" && patternImageSrc;
  const bgAttr = hasPattern ? ` background="${patternImageSrc}"` : "";

  const fontStack = bg.fontFamily && bg.fontFamily !== "system" ? bg.fontFamily : DIN_FONT_FAMILY_STACK;
  const linkColor = bg.linkColor || "#C2703D";

  // Build VML gradient fallback for Outlook when using gradient backgrounds
  let vmlGradientOpen = "";
  let vmlGradientClose = "";
  if (bg.type === "gradient") {
    const angle = bg.gradientDirection === "to-right" ? "90" : bg.gradientDirection === "to-bottom-right" ? "135" : bg.gradientDirection === "to-top-right" ? "45" : "180";
    vmlGradientOpen = `<!--[if gte mso 9]>
    <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;mso-width-percent:1000;">
      <v:fill type="gradient" color="${bg.primaryColor}" color2="${bg.secondaryColor}" angle="${angle}" />
      <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
    <![endif]-->`;
    vmlGradientClose = `<!--[if gte mso 9]>
      </v:textbox>
    </v:rect>
    <![endif]-->`;
  }

  // â”€â”€ Language toggle (floating pill) â€” only injected when Chinese data is present â”€â”€
  // Uses CSS checkbox hack: works in Apple Mail, iOS Mail, Gmail app (WebKit/Blink).
  // Outlook sees only the English content (no toggle rendered via conditional comments).
  // Language toggle block is a translation tool only - no visible output in exported email.
  const langToggleStyles = "";
  const raw = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${subject || "Email"}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    :root{color-scheme:light dark;supported-color-schemes:light dark}
    ${dinRoundProEmailFontFaceCss()}
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
    body{margin:0!important;padding:0!important;background-color:${bg.primaryColor}}
    a{color:${linkColor}}
    @media only screen and (max-width:600px){
      .email-card{width:100%!important;border-radius:0!important}
      .email-body-cell{padding-left:0!important;padding-right:0!important}
      /* Stack columns vertically */
      .cols-table tr{display:block!important}
      .col-cell{display:block!important;width:100%!important;margin-bottom:8px!important}
      /* Locked columns: reduce cell padding on mobile so content isn't cramped */
      .col-gap-locked{padding:10px 8px!important}
      .col-gap-locked{width:8px!important}
      .col-gap{display:none!important}
      /* Reduce padding on mobile */
      .email-padded-cell{padding-left:12px!important;padding-right:12px!important}
      /* Language toggle: move to bottom-center on mobile */
      .lang-toggle-wrap { bottom:16px!important; right:50%!important; transform:translateX(50%)!important; }
    }
    @media (prefers-color-scheme:dark){
      /* Body & card background â€” unified pure dark to blend with email client chrome */
      body,.email-body-bg{background-color:#1a1a1a!important}
      .email-body-bg td{background-color:#1a1a1a!important}
      .email-card{background-color:#1a1a1a!important}
      /* Text colors */
      h1,h2,h3,h4,h5,h6,p,span,li,div,strong,em,label{color:#e2e8f0!important}
      td{color:#e2e8f0!important}
      /* Links */
      a:not(.email-btn):not(.email-btn-outline){color:#6db3f2!important}
      /* Buttons â€” keep button text/bg visible */
      .email-btn-outline{color:#6db3f2!important;border-color:#6db3f2!important}
      /* Header */
      .email-header-bg{background-color:#1a1a1a!important;border-bottom-color:#2a2a2a!important}
      /* Footer */
      .email-footer{background-color:#1a1a1a!important;border-top-color:#2a2a2a!important}
      .email-footer a,.email-footer span{color:#94a3b8!important}
      /* Columns */
      .email-col-card{background-color:#1e1e1e!important;border-color:#2a2a2a!important}
      /* Coupon */
      .email-coupon-code{background-color:rgba(194,112,61,0.12)!important;border-color:#C2703D!important;color:#D99A6C!important}
      .email-coupon-label{color:#94a3b8!important}
      /* Countdown */
      .email-countdown-bg{background-color:#1e1e1e!important}
      .email-countdown-unit{background-color:#2a2a2a!important}
      /* Table */
      th{background-color:#c2410c!important}
      th,td{border-color:#2a2a2a!important}
      /* Divider */
      .email-divider{border-top-color:#2a2a2a!important}
      /* Image-text */
      .email-img-text h3{color:#e2e8f0!important}
      .email-img-text p{color:#cbd5e1!important}
    }
    ${langToggleStyles}
  </style>
</head>
<body style="margin:0;padding:0;background-color:${bg.primaryColor};font-family:${fontStack};font-weight:400">
  ${vmlGradientOpen}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-body-bg" style="${bgCss}">
    <tr>
      <td class="email-body-cell" align="center"${bgAttr} style="padding:${bg.paddingY}px ${bg.paddingX}px;${bgCss}">
        <table
          role="presentation"
          class="email-card"
          width="600"
          cellpadding="0"
          cellspacing="0"
          style="width:600px;max-width:600px;background-color:${bg.contentBgColor};border-radius:${bg.contentBorderRadius}px;overflow:hidden;${shadow}"
        >
          <tr><td>
${bodyHtml}
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
  ${vmlGradientClose}
</body>
</html>`;
  return applyVariables(raw, variables);
}