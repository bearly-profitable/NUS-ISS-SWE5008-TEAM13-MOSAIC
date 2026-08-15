/**
 * Shared hero image gallery with FOLDER organization.
 *
 * Features:
 * - Folder tree sidebar with breadcrumb navigation
 * - Bulk select + move to folder
 * - Bulk delete
 * - Create / rename / delete folders (unlimited nesting)
 * - Filter by type (All / PNG-JPG / GIF)
 * - Single-click select, hover preview
 * - Auto-syncs storage bucket on first load
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  RefreshCw,
  ImageIcon,
  Film,
  Trash2,
  ZoomIn,
  AlertTriangle,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronRight,
  Home,
  MoveRight,
  CheckSquare,
  Square,
  MoreHorizontal,
  Pencil,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase-client";
import {
  listImageFolders,
  createImageFolder,
  updateImageFolder,
  deleteImageFolder,
  listImageAssets,
  moveImageAssets,
  bulkDeleteImageAssets,
  syncImageAssets,
  type ImageFolder,
  type ImageAsset,
} from "@/services/imageFoldersApi";

// ─── Constants ───────────────────────────────────────────────────────────────

const BUCKET = "email-images";
const MAX_IMG_RETRIES = 3;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GalleryImage {
  id: string;
  name: string;
  publicUrl: string;
  storagePath: string;
  isGif: boolean;
  createdAt?: string;
  folderId: string | null;
  source: string;
}

type GalleryFilter = "all" | "static" | "gif";

interface HeroGalleryProps {
  selectedUrl?: string | null;
  onSelect: (url: string) => void;
  onDelete?: (url: string) => void;
  maxHeight?: number;
  columns?: 3 | 4;
  autoLoad?: boolean;
  /** Notifies parent when the user navigates to a different folder */
  onCurrentFolderChange?: (folderId: string | null, folderName: string | null) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isGifName(name: string): boolean {
  return /\.gif$/i.test(name);
}

function retryImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const attempt = Number(img.dataset.retry ?? "0");
  if (attempt >= MAX_IMG_RETRIES) return;
  img.dataset.retry = String(attempt + 1);
  const sep = img.src.includes("?") ? "&" : "?";
  img.src = img.src.replace(/[?&]_rt=\d+/, "") + `${sep}_rt=${Date.now()}`;
}

function formatFileName(name: string): string {
  return name
    .replace(/^(mj-|upload-|hero-merged\/)?(\d{10,13})-[a-z0-9]+\./, "")
    .replace(/^(\d{10,13})-[a-z0-9]+\./, "")
    || name;
}

function getPublicUrl(storagePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

function assetToGalleryImage(asset: ImageAsset): GalleryImage {
  return {
    id: asset.id,
    name: asset.filename,
    publicUrl: getPublicUrl(asset.storage_path),
    storagePath: asset.storage_path,
    isGif: isGifName(asset.filename),
    createdAt: asset.created_at,
    folderId: asset.folder_id,
    source: asset.source,
  };
}

// ─── Folder Tree Sidebar Component ───────────────────────────────────────────

function FolderTreeItem({
  folder,
  depth,
  currentFolderId,
  onNavigate,
  onRename,
  onDelete,
  onCreateChild,
}: {
  folder: ImageFolder;
  depth: number;
  currentFolderId: string | null;
  onNavigate: (id: string | null) => void;
  onRename: (folder: ImageFolder) => void;
  onDelete: (folder: ImageFolder) => void;
  onCreateChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isActive = currentFolderId === folder.id;
  const hasChildren = folder.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer text-[11px] group transition-colors",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted/60 text-muted-foreground hover:text-foreground",
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => onNavigate(folder.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 -ml-1 hover:bg-muted rounded"
          >
            <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        {isActive ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate flex-1">{folder.name}</span>
        {folder.imageCount > 0 && (
          <span className="text-[9px] opacity-50 tabular-nums">{folder.imageCount}</span>
        )}

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => onCreateChild(folder.id)}>
              <FolderPlus className="h-3.5 w-3.5 mr-2" />
              New subfolder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(folder)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(folder)} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              currentFolderId={currentFolderId}
              onNavigate={onNavigate}
              onRename={onRename}
              onDelete={onDelete}
              onCreateChild={onCreateChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function HeroGallery({
  selectedUrl,
  onSelect,
  onDelete,
  maxHeight = 320,
  columns = 3,
  autoLoad = true,
  onCurrentFolderChange,
}: HeroGalleryProps) {
  // ── State ────────────────────────────────────────────────────────────────
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [folders, setFolders] = useState<ImageFolder[]>([]);
  const [unfiledCount, setUnfiledCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string | null; name: string }>>([]);
  const [showFolders, setShowFolders] = useState(true);

  // Bulk selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialogs
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GalleryImage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);

  // Folder dialogs
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderParent, setCreateFolderParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<ImageFolder | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingFolder, setDeletingFolder] = useState<ImageFolder | null>(null);
  const [moveToOpen, setMoveToOpen] = useState(false);

  const loadedRef = useRef(false);

  // ── Load folders ─────────────────────────────────────────────────────────
  const loadFolders = useCallback(async () => {
    try {
      const res = await listImageFolders();
      setFolders(res.folders);
      setUnfiledCount(res.unfiledCount);
    } catch (err) {
      console.warn("[HeroGallery] Failed to load folders:", err);
    }
  }, []);

  // ── Load images for current folder ──────────────────────────────────────
  const loadImages = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      const params = folderId
        ? { folderId }
        : { unfiled: true };
      const res = await listImageAssets(folderId === null ? { unfiled: true } : { folderId });
      const mapped = res.assets.map(assetToGalleryImage);
      setImages(mapped);
    } catch (err) {
      console.warn("[HeroGallery] Failed to load images:", err);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial sync + load ─────────────────────────────────────────────────
  const initialLoad = useCallback(async () => {
    setSyncing(true);
    try {
      await syncImageAssets();
    } catch {
      // Non-critical — images may already be synced
    }
    setSyncing(false);
    await loadFolders();
    await loadImages(null);
  }, [loadFolders, loadImages]);

  useEffect(() => {
    if (autoLoad && !loadedRef.current) {
      loadedRef.current = true;
      initialLoad();
    }
  }, [autoLoad, initialLoad]);

  // ── Navigate to folder ──────────────────────────────────────────────────
  const navigateToFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
    setSelectMode(false);
    loadImages(folderId);

    // Build breadcrumb
    if (folderId === null) {
      setBreadcrumb([]);
      onCurrentFolderChange?.(null, null);
    } else {
      // Find path to this folder
      const path: Array<{ id: string | null; name: string }> = [];
      const findPath = (nodes: ImageFolder[], targetId: string): boolean => {
        for (const node of nodes) {
          if (node.id === targetId) {
            path.push({ id: node.id, name: node.name });
            return true;
          }
          if (node.children.length > 0 && findPath(node.children, targetId)) {
            path.unshift({ id: node.id, name: node.name });
            return true;
          }
        }
        return false;
      };
      findPath(folders, folderId);
      setBreadcrumb(path);
      onCurrentFolderChange?.(folderId, path[path.length - 1]?.name ?? null);
    }
  }, [folders, loadImages, onCurrentFolderChange]);

  // ── Folder CRUD handlers ─────────────────────────────────────────────────
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    try {
      await createImageFolder({ name: newFolderName.trim(), parentId: createFolderParent });
      toast.success("Folder created");
      setCreateFolderOpen(false);
      setNewFolderName("");
      await loadFolders();
    } catch (err: any) {
      toast.error(err.message || "Failed to create folder");
    }
  }, [newFolderName, createFolderParent, loadFolders]);

  const handleRenameFolder = useCallback(async () => {
    if (!renamingFolder || !renameValue.trim()) return;
    try {
      await updateImageFolder(renamingFolder.id, { name: renameValue.trim() });
      toast.success("Folder renamed");
      setRenamingFolder(null);
      await loadFolders();
    } catch (err: any) {
      toast.error(err.message || "Failed to rename folder");
    }
  }, [renamingFolder, renameValue, loadFolders]);

  const handleDeleteFolder = useCallback(async () => {
    if (!deletingFolder) return;
    try {
      await deleteImageFolder(deletingFolder.id);
      toast.success("Folder deleted — images moved to root");
      setDeletingFolder(null);
      if (currentFolderId === deletingFolder.id) {
        navigateToFolder(null);
      }
      await loadFolders();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete folder");
    }
  }, [deletingFolder, currentFolderId, navigateToFolder, loadFolders]);

  // ── Bulk operations ──────────────────────────────────────────────────────
  const handleBulkMove = useCallback(async (targetFolderId: string | null) => {
    if (selectedIds.size === 0) return;
    try {
      await moveImageAssets(Array.from(selectedIds), targetFolderId);
      toast.success(`Moved ${selectedIds.size} image${selectedIds.size > 1 ? "s" : ""}`);
      setSelectedIds(new Set());
      setSelectMode(false);
      setMoveToOpen(false);
      await loadImages(currentFolderId);
      await loadFolders();
    } catch (err: any) {
      toast.error(err.message || "Move failed");
    }
  }, [selectedIds, currentFolderId, loadImages, loadFolders]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      await bulkDeleteImageAssets(Array.from(selectedIds));
      toast.success(`Deleted ${selectedIds.size} image${selectedIds.size > 1 ? "s" : ""}`);
      setSelectedIds(new Set());
      setSelectMode(false);
      await loadImages(currentFolderId);
      await loadFolders();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  }, [selectedIds, currentFolderId, loadImages, loadFolders]);

  // ── Single delete handler ────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bulkDeleteImageAssets([deleteTarget.id]);
      setImages((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      if (selectedUrl === deleteTarget.publicUrl) {
        onDelete?.(deleteTarget.publicUrl);
      }
      toast.success("Image deleted");
      await loadFolders();
    } catch {
      toast.error("Failed to delete image");
    }
    setDeleting(false);
    setDeleteTarget(null);
  }, [deleteTarget, selectedUrl, onDelete, loadFolders]);

  // ── Toggle selection ─────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filtered.map((img) => img.id)));
  }, []);

  // ── Filtering ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === "all") return images;
    if (filter === "gif") return images.filter((img) => img.isGif);
    return images.filter((img) => !img.isGif);
  }, [images, filter]);

  const gifCount = useMemo(() => images.filter((i) => i.isGif).length, [images]);
  const staticCount = useMemo(() => images.filter((i) => !i.isGif).length, [images]);

  // ── Grid columns class ──────────────────────────────────────────────────
  const gridCols = columns === 4 ? "grid-cols-4" : "grid-cols-3";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-2">
        {/* ── Folder sidebar toggle + breadcrumb ── */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={() => setShowFolders(!showFolders)}
          >
            <Folder className="h-3 w-3" />
            {showFolders ? "Hide folders" : "Folders"}
          </Button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground flex-1 min-w-0">
            <button
              type="button"
              onClick={() => navigateToFolder(null)}
              className={cn(
                "hover:text-foreground transition-colors flex items-center gap-0.5",
                currentFolderId === null && "text-foreground font-medium",
              )}
            >
              <Home className="h-3 w-3" />
              All
            </button>
            {breadcrumb.map((crumb) => (
              <span key={crumb.id} className="flex items-center gap-0.5">
                <ChevronRight className="h-2.5 w-2.5 opacity-40" />
                <button
                  type="button"
                  onClick={() => navigateToFolder(crumb.id)}
                  className={cn(
                    "hover:text-foreground transition-colors truncate max-w-[80px]",
                    currentFolderId === crumb.id && "text-foreground font-medium",
                  )}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>

          {/* Bulk mode toggle */}
          <Button
            variant={selectMode ? "default" : "ghost"}
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={() => {
              setSelectMode(!selectMode);
              setSelectedIds(new Set());
            }}
          >
            <CheckSquare className="h-3 w-3" />
            {selectMode ? `${selectedIds.size} selected` : "Select"}
          </Button>
        </div>

        {/* ── Bulk action bar ── */}
        {selectMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/20"
          >
            <span className="text-[10px] text-primary font-medium">
              {selectedIds.size} selected
            </span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={selectAll}
            >
              Select all
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={() => setMoveToOpen(true)}
            >
              <MoveRight className="h-3 w-3" />
              Move to…
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </motion.div>
        )}

        <div className="flex gap-2">
          {/* ── Folder tree sidebar ── */}
          {showFolders && (
            <div className="w-[140px] shrink-0 border border-border/40 rounded-lg bg-muted/5 overflow-y-auto p-1" style={{ maxHeight }}>
              {/* Root / Unfiled */}
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-[11px] transition-colors",
                  currentFolderId === null
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted/60 text-muted-foreground hover:text-foreground",
                )}
                onClick={() => navigateToFolder(null)}
              >
                <Home className="h-3 w-3 shrink-0" />
                <span className="truncate flex-1">Unfiled</span>
                {unfiledCount > 0 && (
                  <span className="text-[9px] opacity-50 tabular-nums">{unfiledCount}</span>
                )}
              </div>

              {/* Folder tree */}
              {folders.map((folder) => (
                <FolderTreeItem
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  currentFolderId={currentFolderId}
                  onNavigate={navigateToFolder}
                  onRename={(f) => { setRenamingFolder(f); setRenameValue(f.name); }}
                  onDelete={(f) => setDeletingFolder(f)}
                  onCreateChild={(parentId) => { setCreateFolderParent(parentId); setNewFolderName(""); setCreateFolderOpen(true); }}
                />
              ))}

              {/* New folder button */}
              <button
                type="button"
                onClick={() => { setCreateFolderParent(currentFolderId); setNewFolderName(""); setCreateFolderOpen(true); }}
                className="flex items-center gap-1.5 px-2 py-1.5 mt-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors w-full"
              >
                <FolderPlus className="h-3 w-3" />
                New folder
              </button>
            </div>
          )}

          {/* ── Main gallery area ── */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Filters + refresh */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {filter === "all"
                  ? `${images.length} image${images.length !== 1 ? "s" : ""}`
                  : `${filtered.length} of ${images.length}`}
              </p>

              <div className="flex items-center gap-1.5">
                <ToggleGroup
                  type="single"
                  value={filter}
                  onValueChange={(v) => { if (v) setFilter(v as GalleryFilter); }}
                  size="sm"
                  variant="outline"
                >
                  <ToggleGroupItem value="all" className="text-[10px] h-6 px-2 gap-1" title="All images">
                    <ImageIcon className="h-3 w-3" />
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem value="static" className="text-[10px] h-6 px-2 gap-1" title="PNG and JPEG only">
                    PNG/JPG
                  </ToggleGroupItem>
                  <ToggleGroupItem value="gif" className="text-[10px] h-6 px-2 gap-1" title="GIF only">
                    <Film className="h-3 w-3" />
                    GIF
                  </ToggleGroupItem>
                </ToggleGroup>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => { loadImages(currentFolderId); loadFolders(); }}
                  disabled={loading}
                  title="Refresh gallery"
                >
                  <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Gallery grid */}
            {loading || syncing ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                {syncing && <span className="ml-2 text-[10px] text-muted-foreground">Syncing images…</span>}
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-8 text-[11px] text-muted-foreground border border-dashed rounded-xl">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                {currentFolderId
                  ? "This folder is empty. Move images here or upload new ones."
                  : "No unfiled images. Upload or generate images first."}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-6 text-[11px] text-muted-foreground border border-dashed rounded-xl">
                {filter === "gif"
                  ? "No GIFs in this folder."
                  : "No PNG or JPEG files match this filter."}
              </div>
            ) : (
              <div
                className="overflow-y-auto rounded-xl border border-border/40 bg-muted/5 p-2"
                style={{ maxHeight: maxHeight - 40 }}
              >
                <div className={cn("grid gap-2", gridCols)}>
                  <AnimatePresence>
                    {filtered.map((img) => {
                      const isSelected = selectedUrl === img.publicUrl;
                      const isHovered = hoveredImage === img.storagePath;
                      const isBulkSelected = selectedIds.has(img.id);

                      return (
                        <motion.div
                          key={img.id}
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ duration: 0.15 }}
                          className="relative"
                          onMouseEnter={() => setHoveredImage(img.storagePath)}
                          onMouseLeave={() => setHoveredImage(null)}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (selectMode) {
                                toggleSelect(img.id);
                              } else {
                                onSelect(img.publicUrl);
                              }
                            }}
                            className={cn(
                              "relative w-full rounded-lg overflow-hidden border-2 transition-all aspect-[4/3] group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                              isBulkSelected
                                ? "border-blue-500 shadow-md shadow-blue-500/20 ring-1 ring-blue-500/30"
                                : isSelected
                                  ? "border-primary shadow-md shadow-primary/20 ring-1 ring-primary/30"
                                  : "border-transparent hover:border-primary/40",
                            )}
                          >
                            <img
                              src={img.publicUrl}
                              alt={img.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={retryImageLoad}
                            />

                            {/* Bulk select checkbox */}
                            {selectMode && (
                              <div className="absolute top-1.5 left-1.5">
                                {isBulkSelected ? (
                                  <CheckSquare className="h-4 w-4 text-blue-500 drop-shadow-md" />
                                ) : (
                                  <Square className="h-4 w-4 text-white/80 drop-shadow-md" />
                                )}
                              </div>
                            )}

                            {/* GIF badge */}
                            {img.isGif && !selectMode && (
                              <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wider bg-black/60 text-white px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                                GIF
                              </span>
                            )}

                            {/* Selected checkmark */}
                            {isSelected && !selectMode && (
                              <div className="absolute top-1.5 right-1.5">
                                <CheckCircle2 className="h-4 w-4 text-primary drop-shadow-md" />
                              </div>
                            )}

                            {/* Hover overlay */}
                            <div
                              className={cn(
                                "absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent transition-opacity flex items-end justify-between p-1.5",
                                isHovered && !selectMode ? "opacity-100" : "opacity-0",
                              )}
                            >
                              <span className="text-[9px] text-white/80 truncate max-w-[70%] font-medium">
                                {formatFileName(img.name)}
                              </span>
                            </div>
                          </button>

                          {/* Action buttons on hover (non-select mode) */}
                          <AnimatePresence>
                            {isHovered && !selectMode && (
                              <motion.div
                                initial={{ opacity: 0, y: 2 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 2 }}
                                transition={{ duration: 0.1 }}
                                className="absolute top-1.5 right-1.5 flex gap-1"
                              >
                                {!isSelected && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setPreviewImage(img); }}
                                    className="h-6 w-6 rounded-md bg-black/60 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
                                    title="Preview"
                                  >
                                    <ZoomIn className="h-3 w-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(img); }}
                                  className="h-6 w-6 rounded-md bg-red-500/70 hover:bg-red-500/90 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Preview dialog ── */}
      <Dialog open={!!previewImage} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
          {previewImage && (
            <>
              <div className="relative bg-black/5 dark:bg-white/5">
                <img
                  src={previewImage.publicUrl}
                  alt={previewImage.name}
                  className="w-full max-h-[70vh] object-contain"
                />
              </div>
              <div className="px-4 py-3 flex items-center justify-between border-t">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{previewImage.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {previewImage.isGif ? "Animated GIF" : "Static image"}
                    {previewImage.source === "ai_generated" && " · AI Generated"}
                    {previewImage.source === "composite" && " · Hero Composite"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => { setPreviewImage(null); setDeleteTarget(previewImage); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      onSelect(previewImage.publicUrl);
                      setPreviewImage(null);
                      toast.success("Image selected");
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Use this image
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete image?
            </DialogTitle>
            <DialogDescription>
              This will permanently remove the image from storage. Any emails using this image will show a broken link.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="rounded-lg overflow-hidden border border-border/60 my-2">
              <img src={deleteTarget.publicUrl} alt={deleteTarget.name} className="w-full h-28 object-cover" />
              <div className="px-3 py-2 bg-muted/30">
                <p className="text-xs font-medium truncate">{deleteTarget.name}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="gap-1.5">
              {deleting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…</>
              ) : (
                <><Trash2 className="h-3.5 w-3.5" /> Delete permanently</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create folder dialog ── */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              New folder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
            />
            {createFolderParent && (
              <p className="text-[11px] text-muted-foreground">
                Creating inside current folder
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateFolderOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rename folder dialog ── */}
      <Dialog open={!!renamingFolder} onOpenChange={(open) => { if (!open) setRenamingFolder(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Rename folder
            </DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="New name"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleRenameFolder(); }}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRenamingFolder(null)}>Cancel</Button>
            <Button size="sm" onClick={handleRenameFolder} disabled={!renameValue.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete folder confirmation ── */}
      <Dialog open={!!deletingFolder} onOpenChange={(open) => { if (!open) setDeletingFolder(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete folder "{deletingFolder?.name}"?
            </DialogTitle>
            <DialogDescription>
              Images inside will be moved to the root (unfiled). Subfolders will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeletingFolder(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteFolder} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Delete folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Move to folder dialog ── */}
      <Dialog open={moveToOpen} onOpenChange={setMoveToOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="h-5 w-5 text-primary" />
              Move {selectedIds.size} image{selectedIds.size > 1 ? "s" : ""} to…
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => handleBulkMove(null)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-muted/60 text-sm transition-colors"
            >
              <Home className="h-4 w-4 text-muted-foreground" />
              Unfiled (root)
            </button>
            {folders.map((folder) => (
              <MoveToFolderItem key={folder.id} folder={folder} depth={0} onMove={handleBulkMove} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Move-to folder picker item ──────────────────────────────────────────────

function MoveToFolderItem({
  folder,
  depth,
  onMove,
}: {
  folder: ImageFolder;
  depth: number;
  onMove: (folderId: string) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onMove(folder.id)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-muted/60 text-sm transition-colors"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">{folder.name}</span>
      </button>
      {folder.children.map((child) => (
        <MoveToFolderItem key={child.id} folder={child} depth={depth + 1} onMove={onMove} />
      ))}
    </>
  );
}

// ─── Legacy export for backward compatibility ────────────────────────────────

/** @deprecated Use the folder-based gallery. This is kept for any code still importing it. */
export async function listAllStorageImages() {
  const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif)$/i;
  const results: Array<{ name: string; publicUrl: string; storagePath: string; isGif: boolean; createdAt?: string }> = [];
  try {
    const { data: rootData } = await supabase.storage.from(BUCKET).list("", {
      limit: 200,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (rootData) {
      for (const f of rootData) {
        if (f.name && IMAGE_EXTENSIONS.test(f.name)) {
          results.push({
            name: f.name,
            publicUrl: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
            storagePath: f.name,
            isGif: isGifName(f.name),
            createdAt: f.created_at,
          });
        }
      }
    }
  } catch { /* silent */ }
  return results;
}
