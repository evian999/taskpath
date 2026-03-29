import type { AppData, Folder, LayoutState, Rect, Tag } from "./types";
import {
  INBOX_FOLDER_KEY,
  defaultInboxRect,
  emptyAppData,
} from "./types";

function isVec2(v: unknown): v is { x: number; y: number } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.x === "number" && typeof o.y === "number";
}

function isRect(v: unknown): v is { x: number; y: number; w: number; h: number } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.w === "number" &&
    typeof o.h === "number"
  );
}

function ensureFolderRects(
  raw: Record<string, Rect> | undefined,
  folders: Folder[],
): LayoutState["folderRects"] {
  const out: LayoutState["folderRects"] = {
    [INBOX_FOLDER_KEY]: defaultInboxRect(),
    ...raw,
  };
  if (!out[INBOX_FOLDER_KEY]) out[INBOX_FOLDER_KEY] = defaultInboxRect();
  folders.forEach((f, i) => {
    if (!out[f.id]) {
      out[f.id] = { x: 40 + (i + 1) * 420, y: 40, w: 360, h: 1200 };
    }
  });
  return out;
}

export function parseAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== "object") return emptyAppData();
  const o = raw as Record<string, unknown>;
  const tasks = Array.isArray(o.tasks) ? o.tasks : [];
  const edges = Array.isArray(o.edges) ? o.edges : [];
  const groups = Array.isArray(o.groups) ? o.groups : [];
  const foldersRaw = Array.isArray(o.folders) ? o.folders : [];
  const tagsRaw = Array.isArray(o.tags) ? o.tags : [];
  const layout = o.layout && typeof o.layout === "object" ? o.layout : {};

  const out = emptyAppData();

  const folders: Folder[] = [];
  for (const f of foldersRaw) {
    if (!f || typeof f !== "object") continue;
    const x = f as Record<string, unknown>;
    if (typeof x.id !== "string" || typeof x.name !== "string") continue;
    folders.push({
      id: x.id,
      name: x.name,
      ...(typeof x.color === "string" ? { color: x.color } : {}),
    });
  }
  out.folders = folders;

  const tags: Tag[] = [];
  for (const t of tagsRaw) {
    if (!t || typeof t !== "object") continue;
    const x = t as Record<string, unknown>;
    if (typeof x.id !== "string" || typeof x.name !== "string") continue;
    tags.push({
      id: x.id,
      name: x.name,
      ...(typeof x.color === "string" ? { color: x.color } : {}),
    });
  }
  out.tags = tags;

  for (const t of tasks) {
    if (!t || typeof t !== "object") continue;
    const x = t as Record<string, unknown>;
    if (typeof x.id !== "string" || typeof x.title !== "string") continue;
    if (typeof x.createdAt !== "string") continue;
    let tagIds: string[] | undefined;
    if (Array.isArray(x.tagIds)) {
      tagIds = x.tagIds.filter((id): id is string => typeof id === "string");
    }
    let folderId: string | undefined;
    if (typeof x.folderId === "string") folderId = x.folderId;
    out.tasks.push({
      id: x.id,
      title: x.title,
      createdAt: x.createdAt,
      ...(typeof x.completedAt === "string" ? { completedAt: x.completedAt } : {}),
      ...(typeof x.result === "string" ? { result: x.result } : {}),
      ...(folderId ? { folderId } : {}),
      ...(tagIds?.length ? { tagIds } : {}),
    });
  }

  for (const e of edges) {
    if (!e || typeof e !== "object") continue;
    const x = e as Record<string, unknown>;
    if (
      typeof x.id !== "string" ||
      typeof x.source !== "string" ||
      typeof x.target !== "string"
    )
      continue;
    out.edges.push({
      id: x.id,
      source: x.source,
      target: x.target,
      ...(typeof x.label === "string" ? { label: x.label } : {}),
    });
  }

  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const x = g as Record<string, unknown>;
    if (typeof x.id !== "string" || typeof x.name !== "string") continue;
    if (!Array.isArray(x.taskIds)) continue;
    const taskIds = x.taskIds.filter((id): id is string => typeof id === "string");
    out.groups.push({ id: x.id, name: x.name, taskIds });
  }

  const lo = layout as Record<string, unknown>;
  const positions = lo.positions;
  if (positions && typeof positions === "object") {
    for (const [k, v] of Object.entries(positions)) {
      if (isVec2(v)) out.layout.positions[k] = { x: v.x, y: v.y };
    }
  }
  const groupRects = lo.groupRects;
  if (groupRects && typeof groupRects === "object") {
    for (const [k, v] of Object.entries(groupRects)) {
      if (isRect(v)) out.layout.groupRects[k] = { x: v.x, y: v.y, w: v.w, h: v.h };
    }
  }

  const fr: Record<string, Rect> = {};
  const folderRectsRaw = lo.folderRects;
  if (folderRectsRaw && typeof folderRectsRaw === "object") {
    for (const [k, v] of Object.entries(folderRectsRaw)) {
      if (isRect(v)) fr[k] = { x: v.x, y: v.y, w: v.w, h: v.h };
    }
  }
  out.layout.folderRects = ensureFolderRects(fr, folders);

  return out;
}
