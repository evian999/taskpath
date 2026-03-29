import type { Node } from "@xyflow/react";
import { create } from "zustand";
import type {
  AppData,
  Folder,
  LayoutState,
  NavFolderId,
  NextStepInput,
  Task,
  TodoEdge,
  Vec2,
} from "./types";
import {
  INBOX_FOLDER_KEY,
  defaultInboxRect,
  emptyAppData,
  taskFolderKey,
} from "./types";
import { parseAppData } from "@/lib/validate";

const SAVE_MS = 400;

function resolveNavToTaskFolderId(nav: NavFolderId): string | undefined {
  if (nav === "all" || nav === INBOX_FOLDER_KEY) return undefined;
  return nav;
}

type AppState = AppData & {
  hydrated: boolean;
  saveError: string | null;
  loadError: string | null;
  mode: "list" | "canvas";
  navFolderId: NavFolderId;
  navTagId: string | null;
  setMode: (m: "list" | "canvas") => void;
  setNavFolderId: (id: NavFolderId) => void;
  setNavTagId: (id: string | null) => void;
  hydrate: () => Promise<void>;
  scheduleSave: () => void;
  addTask: (title: string, position?: Vec2, opts?: { folderId?: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (
    id: string,
    result: string,
    nextSteps: NextStepInput[],
  ) => void;
  uncompleteTask: (id: string) => void;
  addEdge: (source: string, target: string, label?: string) => void;
  removeEdge: (id: string) => void;
  setEdges: (edges: TodoEdge[]) => void;
  setTaskPosition: (taskId: string, pos: Vec2) => void;
  setPositions: (positions: Record<string, Vec2>) => void;
  createGroupFromTaskIds: (taskIds: string[], name?: string) => void;
  removeGroup: (groupId: string) => void;
  updateGroupName: (groupId: string, name: string) => void;
  syncCanvasLayout: (nodes: Node[]) => void;
  addFolder: (name: string) => void;
  deleteFolder: (folderId: string) => void;
  addTag: (name: string) => void;
  deleteTag: (tagId: string) => void;
  setTaskFolder: (taskId: string, folderId: string | undefined) => void;
  toggleTaskTag: (taskId: string, tagId: string) => void;
  clearSaveError: () => void;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function newId() {
  return crypto.randomUUID();
}

export const useAppStore = create<AppState>((set, get) => ({
  ...emptyAppData(),
  hydrated: false,
  saveError: null,
  loadError: null,
  mode: "list",
  navFolderId: "all",
  navTagId: null,

  setMode: (m) => set({ mode: m }),

  setNavFolderId: (id) => set({ navFolderId: id }),

  setNavTagId: (id) => set({ navTagId: id }),

  clearSaveError: () => set({ saveError: null }),

  hydrate: async () => {
    try {
      const res = await fetch("/api/data", { credentials: "include" });
      if (res.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new Error("未登录");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: unknown = await res.json();
      const data = parseAppData(raw);
      set({
        tasks: data.tasks,
        edges: data.edges,
        groups: data.groups,
        folders: data.folders,
        tags: data.tags,
        layout: data.layout,
        hydrated: true,
        loadError: null,
      });
    } catch (e) {
      set({
        hydrated: true,
        loadError: e instanceof Error ? e.message : "加载失败",
      });
    }
  },

  scheduleSave: () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      const s = get();
      const payload: AppData = {
        tasks: s.tasks,
        edges: s.edges,
        groups: s.groups,
        folders: s.folders,
        tags: s.tags,
        layout: s.layout,
      };
      try {
        const res = await fetch("/api/data", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        if (res.status === 401) {
          if (typeof window !== "undefined") window.location.href = "/login";
          throw new Error("未登录");
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? res.statusText);
        }
        set({ saveError: null });
      } catch (e) {
        set({
          saveError: e instanceof Error ? e.message : "保存失败",
        });
      }
    }, SAVE_MS);
  },

  addTask: (title, position, opts) => {
    const folderFromOpts = opts?.folderId;
    const folderFromNav = resolveNavToTaskFolderId(get().navFolderId);
    const folderId =
      folderFromOpts !== undefined ? folderFromOpts : folderFromNav;

    const t: Task = {
      id: newId(),
      title: title.trim() || "未命名任务",
      createdAt: new Date().toISOString(),
      ...(folderId ? { folderId } : {}),
    };

    set((s) => {
      const positions = { ...s.layout.positions };
      const fk = taskFolderKey(t);
      const fr = s.layout.folderRects[fk] ?? defaultInboxRect();
      if (position) {
        positions[t.id] = { ...position };
      } else {
        const sameFolder = s.tasks.filter((x) => taskFolderKey(x) === fk);
        positions[t.id] = {
          x: fr.x + 40 + (sameFolder.length % 4) * 28,
          y: fr.y + 56 + Math.floor(sameFolder.length / 4) * 88,
        };
      }
      return {
        tasks: [t, ...s.tasks],
        layout: { ...s.layout, positions },
      };
    });
    get().scheduleSave();
    return t;
  },

  updateTask: (id, patch) => {
    set((s) => ({
      tasks: s.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
    get().scheduleSave();
  },

  deleteTask: (id) => {
    set((s) => {
      const groups = s.groups
        .map((g) => ({
          ...g,
          taskIds: g.taskIds.filter((tid) => tid !== id),
        }))
        .filter((g) => g.taskIds.length > 0);
      const groupRects = { ...s.layout.groupRects };
      for (const gid of Object.keys(groupRects)) {
        if (!groups.some((g) => g.id === gid)) delete groupRects[gid];
      }
      const positions = { ...s.layout.positions };
      delete positions[id];
      return {
        tasks: s.tasks.filter((x) => x.id !== id),
        edges: s.edges.filter((e) => e.source !== id && e.target !== id),
        groups,
        layout: { ...s.layout, positions, groupRects },
      };
    });
    get().scheduleSave();
  },

  completeTask: (id, result, nextSteps) => {
    const completedAt = new Date().toISOString();
    const newTasks: Task[] = [];
    const newEdges: TodoEdge[] = [];

    set((s) => {
      const parent = s.tasks.find((x) => x.id === id);
      const inheritFolder = parent?.folderId;
      const inheritTags = parent?.tagIds?.length
        ? [...parent.tagIds]
        : undefined;

      const positions = { ...s.layout.positions };
      let cursor = 0;
      const base = positions[id] ?? { x: 120, y: 120 };

      const updated = s.tasks.map((x) =>
        x.id === id
          ? { ...x, completedAt, result: result.trim() || undefined }
          : x,
      );

      for (const step of nextSteps) {
        const text = step.text.trim();
        if (step.linkTaskId) {
          newEdges.push({
            id: newId(),
            source: id,
            target: step.linkTaskId,
            ...(text ? { label: text } : {}),
          });
        } else if (text) {
          const nt: Task = {
            id: newId(),
            title: text,
            createdAt: new Date().toISOString(),
            ...(inheritFolder ? { folderId: inheritFolder } : {}),
            ...(inheritTags ? { tagIds: inheritTags } : {}),
          };
          newTasks.push(nt);
          positions[nt.id] = {
            x: base.x + 220,
            y: base.y + cursor * 90,
          };
          cursor += 1;
          newEdges.push({
            id: newId(),
            source: id,
            target: nt.id,
            label: text,
          });
        }
      }

      return {
        tasks: [...newTasks, ...updated],
        edges: [...s.edges, ...newEdges],
        layout: { ...s.layout, positions },
      };
    });
    get().scheduleSave();
  },

  uncompleteTask: (id) => {
    set((s) => ({
      tasks: s.tasks.map((x) =>
        x.id === id
          ? { ...x, completedAt: undefined, result: undefined }
          : x,
      ),
    }));
    get().scheduleSave();
  },

  addEdge: (source, target, label) => {
    if (source === target) return;
    set((s) => {
      if (s.edges.some((e) => e.source === source && e.target === target))
        return s;
      const e: TodoEdge = {
        id: newId(),
        source,
        target,
        ...(label ? { label } : {}),
      };
      return { edges: [...s.edges, e] };
    });
    get().scheduleSave();
  },

  removeEdge: (edgeId) => {
    set((s) => ({ edges: s.edges.filter((e) => e.id !== edgeId) }));
    get().scheduleSave();
  },

  setEdges: (edges) => {
    set({ edges });
    get().scheduleSave();
  },

  setTaskPosition: (taskId, pos) => {
    set((s) => ({
      layout: {
        ...s.layout,
        positions: { ...s.layout.positions, [taskId]: { ...pos } },
      },
    }));
    get().scheduleSave();
  },

  setPositions: (positions) => {
    set((s) => ({
      layout: {
        ...s.layout,
        positions: { ...s.layout.positions, ...positions },
      },
    }));
    get().scheduleSave();
  },

  createGroupFromTaskIds: (taskIds, name) => {
    if (taskIds.length < 2) return;
    set((s) => {
      const valid = taskIds.filter((tid) => s.tasks.some((t) => t.id === tid));
      if (valid.length < 2) return s;

      const first = s.tasks.find((t) => t.id === valid[0]);
      const targetFolder = first ? taskFolderKey(first) : INBOX_FOLDER_KEY;
      const tasksNormalized = s.tasks.map((t) =>
        valid.includes(t.id) && taskFolderKey(t) !== targetFolder
          ? {
              ...t,
              folderId:
                targetFolder === INBOX_FOLDER_KEY ? undefined : targetFolder,
            }
          : t,
      );

      let groups = s.groups
        .map((g) => ({
          ...g,
          taskIds: g.taskIds.filter((tid) => !valid.includes(tid)),
        }))
        .filter((g) => g.taskIds.length > 0);

      const groupRects: LayoutState["groupRects"] = {};
      for (const g of groups) {
        const r = s.layout.groupRects[g.id];
        if (r) groupRects[g.id] = r;
      }

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const tid of valid) {
        const p = s.layout.positions[tid] ?? { x: 0, y: 0 };
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + 200);
        maxY = Math.max(maxY, p.y + 72);
      }
      const pad = 24;
      const rect = {
        x: minX - pad,
        y: minY - pad,
        w: maxX - minX + pad * 2,
        h: maxY - minY + pad * 2,
      };
      const gid = newId();
      groups = [...groups, { id: gid, name: name?.trim() || "任务组", taskIds: valid }];
      groupRects[gid] = rect;

      return {
        tasks: tasksNormalized,
        groups,
        layout: { ...s.layout, groupRects },
      };
    });
    get().scheduleSave();
  },

  removeGroup: (groupId) => {
    set((s) => {
      const { [groupId]: _, ...groupRects } = s.layout.groupRects;
      return {
        groups: s.groups.filter((g) => g.id !== groupId),
        layout: { ...s.layout, groupRects },
      };
    });
    get().scheduleSave();
  },

  updateGroupName: (groupId, name) => {
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, name: name.trim() || g.name } : g,
      ),
    }));
    get().scheduleSave();
  },

  syncCanvasLayout: (nodes) => {
    const byId = new Map(nodes.map((n) => [n.id, n]));

    function absolutePosition(n: Node): Vec2 {
      if (!n.parentId) return { x: n.position.x, y: n.position.y };
      const p = byId.get(n.parentId);
      if (!p) return { x: n.position.x, y: n.position.y };
      const po = absolutePosition(p);
      return { x: n.position.x + po.x, y: n.position.y + po.y };
    }

    set((s) => {
      const groupRects = { ...s.layout.groupRects };
      const folderRects = { ...s.layout.folderRects };
      const positions = { ...s.layout.positions };

      for (const n of nodes) {
        if (n.type === "folderLane" && n.data && typeof n.data === "object") {
          const key = (n.data as { folderKey?: string }).folderKey;
          if (key && folderRects[key]) {
            const abs = absolutePosition(n);
            const r = folderRects[key];
            folderRects[key] = { ...r, x: abs.x, y: abs.y };
          }
        }
      }

      for (const n of nodes) {
        if (n.type === "groupFrame" && n.data && typeof n.data === "object") {
          const gid = (n.data as { groupId?: string }).groupId;
          if (gid && groupRects[gid]) {
            const abs = absolutePosition(n);
            const r = groupRects[gid];
            groupRects[gid] = { ...r, x: abs.x, y: abs.y };
          }
        }
      }

      for (const n of nodes) {
        if (n.type === "task") {
          positions[n.id] = absolutePosition(n);
        }
      }

      return { layout: { ...s.layout, positions, groupRects, folderRects } };
    });
    get().scheduleSave();
  },

  addFolder: (name) => {
    const trimmed = name.trim() || "新文件夹";
    set((s) => {
      const id = newId();
      const col = s.folders.length + 1;
      const folderRects = { ...s.layout.folderRects };
      folderRects[id] = { x: 40 + col * 420, y: 40, w: 360, h: 1200 };
      const f: Folder = { id, name: trimmed };
      return {
        folders: [...s.folders, f],
        layout: { ...s.layout, folderRects },
      };
    });
    get().scheduleSave();
  },

  deleteFolder: (folderId) => {
    set((s) => {
      const { [folderId]: _, ...folderRects } = s.layout.folderRects;
      return {
        navFolderId: s.navFolderId === folderId ? "all" : s.navFolderId,
        folders: s.folders.filter((f) => f.id !== folderId),
        tasks: s.tasks.map((t) =>
          t.folderId === folderId ? { ...t, folderId: undefined } : t,
        ),
        layout: { ...s.layout, folderRects },
      };
    });
    get().scheduleSave();
  },

  addTag: (name) => {
    const trimmed = name.trim() || "标签";
    set((s) => ({
      tags: [...s.tags, { id: newId(), name: trimmed }],
    }));
    get().scheduleSave();
  },

  deleteTag: (tagId) => {
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== tagId),
      tasks: s.tasks.map((t) => ({
        ...t,
        tagIds: t.tagIds?.filter((id) => id !== tagId),
      })),
    }));
    get().scheduleSave();
  },

  setTaskFolder: (taskId, folderId) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              ...(folderId ? { folderId } : { folderId: undefined }),
            }
          : t,
      ),
    }));
    get().scheduleSave();
  },

  toggleTaskTag: (taskId, tagId) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const cur = t.tagIds ?? [];
        const has = cur.includes(tagId);
        const next = has ? cur.filter((x) => x !== tagId) : [...cur, tagId];
        const { tagIds: _drop, ...rest } = t;
        return next.length ? { ...rest, tagIds: next } : rest;
      }),
    }));
    get().scheduleSave();
  },
}));
