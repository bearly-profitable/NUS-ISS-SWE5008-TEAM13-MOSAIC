/**
 * Image Folders API client — typed fetch wrappers for gallery folder management.
 */
import { ORCHESTRATOR_BASE } from "@/services/emailApi";

// Same origin as every other call — these routes live on the Orchestrator
// (see backend/app/routers/misc.py). The old localhost:3010 fallback pointed
// at a port nothing has ever listened on, which turned a missing
// VITE_ORCH_API_BASE into a connection error instead of a same-origin 404.
const base: string = ORCHESTRATOR_BASE.replace(/\/+$/, "");

const jsonHeaders: Record<string, string> = {
  "Content-Type": "application/json",
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ImageFolder {
  id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  children: ImageFolder[];
  imageCount: number;
}

export interface ImageAsset {
  id: string;
  folder_id: string | null;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  source: string;
  created_at: string;
}

export interface FolderTreeResponse {
  folders: ImageFolder[];
  totalImages: number;
  unfiledCount: number;
}

// ─── Folder API ─────────────────────────────────────────────────────────────

/** GET /api/image-folders — get full folder tree */
export async function listImageFolders(): Promise<FolderTreeResponse> {
  const r = await fetch(`${base}/api/image-folders`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** POST /api/image-folders — create a new folder */
export async function createImageFolder(body: {
  name: string;
  parentId?: string | null;
  color?: string | null;
}): Promise<{ folder: ImageFolder }> {
  const r = await fetch(`${base}/api/image-folders`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** PATCH /api/image-folders/:id — rename or move a folder */
export async function updateImageFolder(
  id: string,
  body: { name?: string; parentId?: string | null; color?: string | null }
): Promise<{ folder: ImageFolder }> {
  const r = await fetch(`${base}/api/image-folders/${id}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** DELETE /api/image-folders/:id — delete a folder */
export async function deleteImageFolder(id: string): Promise<{ success: boolean }> {
  const r = await fetch(`${base}/api/image-folders/${id}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ─── Asset API ──────────────────────────────────────────────────────────────

/** GET /api/image-assets — list assets, optionally filtered by folder */
export async function listImageAssets(params?: {
  folderId?: string;
  unfiled?: boolean;
}): Promise<{ assets: ImageAsset[] }> {
  const qs = new URLSearchParams();
  if (params?.folderId) qs.set("folderId", params.folderId);
  if (params?.unfiled) qs.set("unfiled", "true");
  const r = await fetch(`${base}/api/image-assets?${qs.toString()}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** POST /api/image-assets/move — bulk move images to a folder */
export async function moveImageAssets(
  assetIds: string[],
  folderId: string | null
): Promise<{ moved: number; folderId: string | null }> {
  const r = await fetch(`${base}/api/image-assets/move`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ assetIds, folderId }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** POST /api/image-assets/register — register a newly uploaded image */
export async function registerImageAsset(body: {
  storagePath: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  folderId?: string | null;
}): Promise<{ asset: ImageAsset }> {
  const r = await fetch(`${base}/api/image-assets/register`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** POST /api/image-assets/sync — sync storage bucket to DB */
export async function syncImageAssets(): Promise<{
  synced: number;
  total: number;
  alreadyRegistered: number;
}> {
  const r = await fetch(`${base}/api/image-assets/sync`, {
    method: "POST",
    headers: jsonHeaders,
    body: "{}",
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** POST /api/image-assets/bulk-delete — bulk delete images */
export async function bulkDeleteImageAssets(
  assetIds: string[]
): Promise<{ deleted: number }> {
  const r = await fetch(`${base}/api/image-assets/bulk-delete`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ assetIds }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
