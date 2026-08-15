/**
 * Shared folder destination picker for image uploads.
 * Used by ImageUpload (Content tab) and AIGenerateTab (Generate tab).
 *
 * Shows the currently chosen destination and lets the user pick any folder
 * (or "Unfiled") via a scrollable dropdown that handles 10s of folders.
 */
import { Folder, Home, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ImageFolder } from "@/services/imageFoldersApi";

interface FolderDestPickerProps {
  folders: ImageFolder[];
  destFolderId: string | null;
  destFolderName: string | null;
  onChange: (id: string | null, name: string | null) => void;
  /** Tailwind color class for the active highlight, e.g. "text-primary" or "text-primary" */
  accentClass?: string;
  /** Tailwind background class for the active item, e.g. "bg-primary/10" or "bg-primary/10" */
  accentBgClass?: string;
}

export function FolderDestPicker({
  folders,
  destFolderId,
  destFolderName,
  onChange,
  accentClass = "text-primary",
  accentBgClass = "bg-primary/10",
}: FolderDestPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 text-xs transition-colors"
        >
          {destFolderId ? (
            <Folder className={cn("h-3.5 w-3.5 shrink-0", accentClass)} />
          ) : (
            <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-muted-foreground">Save to:</span>
          <span className="font-medium text-foreground truncate flex-1 text-left">
            {destFolderName ?? "Unfiled"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[260px] p-1" align="start">
        {/* Inner scrollable container — DropdownMenuContent itself is overflow-hidden */}
        <div className="max-h-[280px] overflow-y-auto pr-0.5">
          <DropdownMenuItem
            onClick={() => onChange(null, null)}
            className={cn(
              "gap-2 cursor-pointer",
              destFolderId === null && cn(accentBgClass, accentClass),
            )}
          >
            <Home className="h-3.5 w-3.5" />
            Unfiled (root)
          </DropdownMenuItem>
          {folders.length > 0 && <DropdownMenuSeparator />}
          {folders.map((folder) => (
            <FolderDestItem
              key={folder.id}
              folder={folder}
              depth={0}
              currentId={destFolderId}
              onSelect={onChange}
              accentClass={accentClass}
              accentBgClass={accentBgClass}
            />
          ))}
          {folders.length === 0 && (
            <div className="px-3 py-4 text-[11px] text-muted-foreground text-center">
              No folders yet — create one in the gallery
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FolderDestItem({
  folder,
  depth,
  currentId,
  onSelect,
  accentClass,
  accentBgClass,
}: {
  folder: ImageFolder;
  depth: number;
  currentId: string | null;
  onSelect: (id: string, name: string) => void;
  accentClass: string;
  accentBgClass: string;
}) {
  return (
    <>
      <DropdownMenuItem
        onClick={() => onSelect(folder.id, folder.name)}
        className={cn(
          "gap-2 cursor-pointer",
          currentId === folder.id && cn(accentBgClass, accentClass),
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <Folder className="h-3.5 w-3.5" />
        <span className="truncate">{folder.name}</span>
      </DropdownMenuItem>
      {folder.children.map((child) => (
        <FolderDestItem
          key={child.id}
          folder={child}
          depth={depth + 1}
          currentId={currentId}
          onSelect={onSelect}
          accentClass={accentClass}
          accentBgClass={accentBgClass}
        />
      ))}
    </>
  );
}
