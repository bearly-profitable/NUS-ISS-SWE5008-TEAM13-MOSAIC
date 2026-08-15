import type { BlockType, EmailBlock } from "@/types/email-builder";
import { HeaderBlockEditor } from "./HeaderBlockEditor";
import { HeadingBlockEditor } from "./HeadingBlockEditor";
import { BodyTextBlockEditor } from "./BodyTextBlockEditor";
import { ButtonBlockEditor } from "./ButtonBlockEditor";
import { ImageBlockEditor } from "./ImageBlockEditor";
import { ImageTextBlockEditor } from "./ImageTextBlockEditor";
import { IconGridBlockEditor } from "./IconGridBlockEditor";
import { ColumnsBlockEditor } from "./ColumnsBlockEditor";
import { DividerBlockEditor } from "./DividerBlockEditor";
import { SocialLinksBlockEditor } from "./SocialLinksBlockEditor";
import { FooterBlockEditor } from "./FooterBlockEditor";
import { SpacerBlockEditor } from "./SpacerBlockEditor";
import { VideoBlockEditor } from "./VideoBlockEditor";
import { CountdownBlockEditor } from "./CountdownBlockEditor";
import { TableBlockEditor } from "./TableBlockEditor";
import { CouponBlockEditor } from "./CouponBlockEditor";
import { AccordionBlockEditor } from "./AccordionBlockEditor";
import { LangToggleBlockEditor } from "./LangToggleBlockEditor";

/** Props shared by all "simple" block editors that update one field at a time. */
export interface BlockEditorFieldProps {
  content: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

/** Props for block editors that replace the entire content object (e.g. hero). */
export interface BlockEditorContentProps {
  content: Record<string, string>;
  onUpdate: (content: Record<string, string>) => void;
}

/**
 * Registry mapping block types to their editor components.
 */
export const BLOCK_EDITOR_REGISTRY: Record<
  BlockType,
  React.ComponentType<{ content: Record<string, string>; onUpdate: any }>
> = {
  header: HeaderBlockEditor,
  "hero-image": ImageBlockEditor,
  heading: HeadingBlockEditor,
  "body-text": BodyTextBlockEditor,
  button: ButtonBlockEditor,
  image: ImageBlockEditor,
  gif: ImageBlockEditor,
  "image-text": ImageTextBlockEditor,
  "icon-grid": IconGridBlockEditor,
  columns: ColumnsBlockEditor,
  divider: DividerBlockEditor,
  "social-links": SocialLinksBlockEditor,
  footer: FooterBlockEditor,
  spacer: SpacerBlockEditor,
  video: VideoBlockEditor,
  countdown: CountdownBlockEditor,
  table: TableBlockEditor,
  coupon: CouponBlockEditor,
  accordion: AccordionBlockEditor,
  "lang-toggle": LangToggleBlockEditor,
};

/** Returns true if this block type uses whole-content onUpdate(content) instead of field-level onUpdate(key, value). */
export function isWholeContentEditor(_type: BlockType): boolean {
  return false;
}

export {
  HeaderBlockEditor, HeadingBlockEditor, BodyTextBlockEditor,
  ButtonBlockEditor, ImageBlockEditor, ImageTextBlockEditor, IconGridBlockEditor,
  ColumnsBlockEditor, DividerBlockEditor, SocialLinksBlockEditor, FooterBlockEditor,
  SpacerBlockEditor, VideoBlockEditor, CountdownBlockEditor, TableBlockEditor, CouponBlockEditor,
  AccordionBlockEditor, LangToggleBlockEditor,
};
