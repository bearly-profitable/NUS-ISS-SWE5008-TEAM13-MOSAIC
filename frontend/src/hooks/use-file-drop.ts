import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

interface FileDropOptions {
  onFile: (file: File) => void;
  /** Rejects anything this returns false for, with `rejectMessage`. */
  accept?: (file: File) => boolean;
  rejectMessage?: string;
  disabled?: boolean;
}

/**
 * Drag-and-drop for a single file, alongside a click-to-browse input.
 *
 * The enter/leave counter is the part worth explaining: `dragleave` fires
 * every time the pointer crosses into a *child* of the drop zone, so tracking
 * a boolean makes the highlight flicker as the cursor moves over the icon or
 * the label inside it. Counting enters against leaves means the zone only
 * un-highlights when the pointer has genuinely left it.
 */
export function useFileDrop({ onFile, accept, rejectMessage, disabled }: FileDropOptions) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const reset = useCallback(() => {
    depth.current = 0;
    setDragging(false);
  }, []);

  const onDragEnter = useCallback(
    (event: React.DragEvent) => {
      if (disabled) return;
      // Ignore text/selection drags — only a real file should light the zone.
      if (!Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    [disabled],
  );

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      if (disabled) return;
      // Without this the browser treats the drop as navigation and opens the
      // file instead of handing it over.
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [disabled],
  );

  const onDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      reset();
      if (disabled) return;

      const files = Array.from(event.dataTransfer.files);
      if (files.length === 0) return;
      if (files.length > 1) toast.info("Dropped several files — using the first one");

      const file = files[0];
      if (accept && !accept(file)) {
        toast.error(rejectMessage ?? `${file.name} isn't a supported file type`);
        return;
      }
      onFile(file);
    },
    [accept, disabled, onFile, rejectMessage, reset],
  );

  return {
    dragging,
    dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}

/** True for the CSV exports the audience upload accepts. */
export function isCsvFile(file: File): boolean {
  return /\.(csv|txt)$/i.test(file.name) || ["text/csv", "text/plain"].includes(file.type);
}

/** True for the image formats email clients render reliably. */
export function isImageFile(file: File): boolean {
  return (
    ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type) ||
    /\.(png|jpe?g|gif|webp)$/i.test(file.name)
  );
}
