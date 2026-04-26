import type { Node } from "@xyflow/react";
import { create } from "zustand";
import type {
  AppData,
  Folder,
  LayoutState,
  NavFolderId,
  NextStepInput,
  Tag,
  Task,
  TaskGroup,
  TaskPriority,
  TodoEdge,
  Vec2,
} from "./types";
import {
  INBOX_FOLDER_KEY,
  RECENT_DELETED_FOLDER_KEY,
  allCanvasFolderLaneKeys,
  defaultFolderRectForKey,
  defaultInboxRect,
  emptyAppData,
  taskFolderKey,
} from "./types";
import {
  arrangementSphericalAbsolute,
  defaultSphericalPositionInFolder,
  taskHasAnyEdge,
} from "@/lib/canvas-layout";
import {
  LAYOUT_TASK_CARD_GAP,
  LAYOUT_TASK_CARD_H,
  LAYOUT_TASK_CARD_W,
  separateOverlappingAbsolutePositions,
} from "@/lib/canvas-overlap";
import {
  computeGroupRectFromTaskPositions,
  mergeFolderRectsWithTaskBounds,
  packFolderLanesNoOverlapForAllView,
  readFlowNodeSize,
} from "@/lib/folder-fit";
import { visibleTaskIdSet } from "@/lib/flow-build";
import { mergeMentionsFromTitle } from "@/lib/mentions";
import { parseAppData } from "@/lib/validate";
import {
  listUnknownHashTagNamesInDraft,
  paletteColorForTagIndex,
  parseTaskDraft,
} from "@/lib/tag-draft";

const SAVE_MS = 400;

function canvasLayoutVisibleIds(
  tasks: Task[],
  navFolderId: NavFolderId,
  edges: TodoEdge[],
): Set<string> {
  return visibleTaskIdSet(tasks, navFolderId, edges);
}

/** 画布选「全部文件夹」时，在合并包络后再消除文件夹 lane 重叠 */
function mergeFoldersWithMaybePack(
  ctx: {
    navFolderId: NavFolderId;
    folders: Folder[];
    tasks: Task[];
    groups: TaskGroup[];
  },
  folderRects: LayoutState["folderRects"],
  positions: LayoutState["positions"],
  groupRects: LayoutState["groupRects"],
): {
  folderRects: LayoutState["folderRects"];
  positions: LayoutState["positions"];
  groupRects: LayoutState["groupRects"];
} {
  if (ctx.navFolderId !== "all") {
    return { folderRects, positions, groupRects };
  }
  return packFolderLanesNoOverlapForAllView(
    allCanvasFolderLaneKeys(ctx.folders),
    folderRects,
    ctx.tasks,
    ctx.groups,
    positions,
    groupRects,
  );
}

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
  /** 列表侧栏 @提及筛选（小写键，与 mentions 不区分大小写匹配） */
  navMention: string | null;
  /** 列表模式搜索（不入库，仅前端筛选） */
  listSearchQuery: string;
  listSearchOpen: boolean;
  setListSearchQuery: (q: string) => void;
  setListSearchOpen: (open: boolean) => void;
  setMode: (m: "list" | "canvas") => void;
  setNavFolderId: (id: NavFolderId) => void;
  setNavTagId: (id: string | null) => void;
  setNavMention: (key: string | null) => void;
  hydrate: () => Promise<void>;
  scheduleSave: () => void;
  addTask: (
    title: string,
    position?: Vec2,
    opts?: {
      /** 未传则按侧栏导航；传 `null` 表示显式收件箱 */
      folderId?: string | null;
      tagIds?: string[];
      priority?: TaskPriority;
    },
  ) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  restoreTaskFromTrash: (id: string) => void;
  completeTask: (
    id: string,
    result: string,
    nextSteps: NextStepInput[],
  ) => void;
  uncompleteTask: (id: string) => void;
  abandonTask: (id: string, reason: string) => void;
  addEdge: (source: string, target: string, label?: string) => void;
  removeEdge: (id: string) => void;
  updateEdge: (edgeId: string, patch: Partial<TodoEdge>) => void;
  setEdges: (edges: TodoEdge[]) => void;
  setTaskPosition: (taskId: string, pos: Vec2) => void;
  setPositions: (positions: Record<string, Vec2>) => void;
  /** 将选中任务按横向或纵向等距排布（基于当前第一个的锚点位置，间距按卡片尺寸+间隙） */
  arrangeTasksLinear: (
    taskIds: string[],
    direction: "horizontal" | "vertical",
  ) => void;
  /** Fibonacci 球面投影散落（锚点为第一个选中任务的左上角），再互斥推开避免重叠 */
  arrangeTasksSpherical: (taskIds: string[]) => void;
  createGroupFromTaskIds: (taskIds: string[], name?: string) => void;
  removeGroup: (groupId: string) => void;
  updateGroupName: (groupId: string, name: string) => void;
  syncCanvasLayout: (nodes: Node[]) => void;
  /** 批量改任务所属文件夹并立刻按任务包盒重算各栏尺寸（画布拖放栏外/栏间用） */
  assignTaskFoldersAndRefitLanes: (
    updates: { taskId: string; folderId: string | undefined }[],
  ) => void;
  addFolder: (name: string) => void;
  updateFolder: (
    folderId: string,
    patch: { name?: string; color?: string | undefined },
  ) => void;
  deleteFolder: (folderId: string) => void;
  addTag: (name: string) => void;
  updateTag: (
    tagId: string,
    patch: { name?: string; color?: string | undefined },
  ) => void;
  deleteTag: (tagId: string) => void;
  setTaskFolder: (taskId: string, folderId: string | undefined) => void;
  toggleTaskTag: (taskId: string, tagId: string) => void;
  clearSaveError: () => void;
  /** 用备份 JSON 解析结果整体替换本地状态并触发保存 */
  replaceAppData: (data: AppData) => void;
  setTaskHttpApiEnabled: (enabled: boolean) => void;
  regenerateTaskHttpApiToken: () => void;
  /** 最近删除保留天数（1–7），默认 7 */
  setTrashRetentionDays: (days: number) => void;
  /** 按 preferences.trashRetentionDays 永久删除超期回收站任务 */
  purgeExpiredTrash: () => void;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

let hydrateInFlight: Promise<void> | null = null;

function newId() {
  return crypto.randomUUID();
}

function newTaskHttpApiToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const useAppStore = create<AppState>((set, get) => ({
  ...emptyAppData(),
  hydrated: false,
  saveError: null,
  loadError: null,
  mode: "list",
  navFolderId: "all",
  navTagId: null,
  navMention: null,
  listSearchQuery: "",
  listSearchOpen: false,

  setListSearchQuery: (q) => {
    set({ listSearchQuery: q });
  },

  setListSearchOpen: (open) => {
    set({ listSearchOpen: open });
  },

  setMode: (m) =>
    set((s) => ({
      mode: m,
      ...(m === "canvas" ? { listSearchOpen: false } : {}),
    })),

  setNavFolderId: (id) => {
    if (id !== "all") {
      set({ navFolderId: id });
      return;
    }
    set((s) => {
      const vis = canvasLayoutVisibleIds(s.tasks, "all", s.edges);
      const merged = mergeFolderRectsWithTaskBounds(
        s.layout.folderRects,
        s.tasks,
        s.groups,
        s.layout.positions,
        s.layout.groupRects,
        vis,
      );
      const packed = packFolderLanesNoOverlapForAllView(
        allCanvasFolderLaneKeys(s.folders),
        merged,
        s.tasks,
        s.groups,
        s.layout.positions,
        s.layout.groupRects,
      );
      return {
        navFolderId: id,
        layout: {
          ...s.layout,
          folderRects: packed.folderRects,
          positions: packed.positions,
          groupRects: packed.groupRects,
        },
      };
    });
    get().scheduleSave();
  },

  setNavTagId: (id) => set({ navTagId: id }),

  setNavMention: (key) => set({ navMention: key }),

  clearSaveError: () => set({ saveError: null }),

  replaceAppData: (data) => {
    set({
      tasks: data.tasks,
      edges: data.edges,
      groups: data.groups,
      folders: data.folders,
      tags: data.tags,
      layout: data.layout,
      preferences: data.preferences ?? {},
      navFolderId: "all",
      navTagId: null,
      navMention: null,
      listSearchQuery: "",
      listSearchOpen: false,
      saveError: null,
    });
    get().scheduleSave();
  },

  setTaskHttpApiEnabled: (enabled) => {
    set((s) => {
      let token = s.preferences?.taskHttpApi?.token ?? "";
      if (enabled && !token) token = newTaskHttpApiToken();
      return {
        preferences: {
          ...s.preferences,
          taskHttpApi: { enabled, token },
        },
      };
    });
    get().scheduleSave();
  },

  regenerateTaskHttpApiToken: () => {
    set((s) => ({
      preferences: {
        ...s.preferences,
        taskHttpApi: {
          enabled: s.preferences?.taskHttpApi?.enabled ?? false,
          token: newTaskHttpApiToken(),
        },
      },
    }));
    get().scheduleSave();
  },

  setTrashRetentionDays: (days) => {
    const d = Math.min(7, Math.max(1, Math.round(Number(days)) || 7));
    set((s) => ({
      preferences: {
        ...s.preferences,
        trashRetentionDays: d,
      },
    }));
    get().scheduleSave();
    queueMicrotask(() => get().purgeExpiredTrash());
  },

  purgeExpiredTrash: () => {
    const s = get();
    const raw = s.preferences?.trashRetentionDays;
    const days = Math.min(7, Math.max(1, raw ?? 7));
    const cutoff = Date.now() - days * 86400000;
    const expiredIds = s.tasks
      .filter(
        (t) =>
          t.folderId === RECENT_DELETED_FOLDER_KEY &&
          typeof t.trashedAt === "string" &&
          !Number.isNaN(new Date(t.trashedAt).getTime()) &&
          new Date(t.trashedAt).getTime() < cutoff,
      )
      .map((t) => t.id);
    if (expiredIds.length === 0) return;
    const expiredSet = new Set(expiredIds);
    set((st) => {
      const groups = st.groups
        .map((g) => ({
          ...g,
          taskIds: g.taskIds.filter((tid) => !expiredSet.has(tid)),
        }))
        .filter((g) => g.taskIds.length > 0);
      const groupRects = { ...st.layout.groupRects };
      for (const gid of Object.keys(groupRects)) {
        if (!groups.some((g) => g.id === gid)) delete groupRects[gid];
      }
      const positions = { ...st.layout.positions };
      for (const id of expiredSet) delete positions[id];
      return {
        tasks: st.tasks.filter((t) => !expiredSet.has(t.id)),
        edges: st.edges.filter(
          (e) => !expiredSet.has(e.source) && !expiredSet.has(e.target),
        ),
        groups,
        layout: { ...st.layout, positions, groupRects },
      };
    });
    get().scheduleSave();
  },

  hydrate: async () => {
    const cur = get();
    if (cur.hydrated && !cur.loadError) return;
    if (hydrateInFlight) return hydrateInFlight;

    hydrateInFlight = (async () => {
      try {
        const res = await fetch("/api/data", { credentials: "include" });
        if (res.status === 401) {
          if (typeof window !== "undefined") window.location.href = "/login";
          throw new Error("未登录");
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw: unknown = await res.json();
        const data = parseAppData(raw);
        const vis = canvasLayoutVisibleIds(data.tasks, "all", data.edges);
        const merged = mergeFolderRectsWithTaskBounds(
          data.layout.folderRects,
          data.tasks,
          data.groups,
          data.layout.positions,
          data.layout.groupRects,
          vis,
        );
        const packed = packFolderLanesNoOverlapForAllView(
          allCanvasFolderLaneKeys(data.folders),
          merged,
          data.tasks,
          data.groups,
          data.layout.positions,
          data.layout.groupRects,
        );
        set({
          tasks: data.tasks,
          edges: data.edges,
          groups: data.groups,
          folders: data.folders,
          tags: data.tags,
          layout: {
            ...data.layout,
            folderRects: packed.folderRects,
            positions: packed.positions,
            groupRects: packed.groupRects,
          },
          preferences: data.preferences ?? {},
          hydrated: true,
          loadError: null,
        });
        get().purgeExpiredTrash();
      } catch (e) {
        set({
          hydrated: true,
          loadError: e instanceof Error ? e.message : "加载失败",
        });
      } finally {
        hydrateInFlight = null;
      }
    })();

    return hydrateInFlight;
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
        preferences: s.preferences,
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
    let folderId: string | undefined;
    if (
      opts !== undefined &&
      Object.prototype.hasOwnProperty.call(opts, "folderId")
    ) {
      const v = opts.folderId;
      folderId =
        v === null || v === undefined || v === ""
          ? undefined
          : v;
    } else {
      folderId = resolveNavToTaskFolderId(get().navFolderId);
    }
    if (folderId === RECENT_DELETED_FOLDER_KEY) folderId = undefined;

    const rawTagIds = opts?.tagIds?.filter(Boolean) ?? [];
    const tagIds = [...new Set(rawTagIds)];

    const trimmedTitle = title.trim() || "未命名任务";
    const mentions = mergeMentionsFromTitle(trimmedTitle, undefined);
    const t: Task = {
      id: newId(),
      title: trimmedTitle,
      createdAt: new Date().toISOString(),
      ...(folderId ? { folderId } : {}),
      ...(tagIds.length ? { tagIds } : {}),
      ...(opts?.priority ? { priority: opts.priority } : {}),
      ...(mentions ? { mentions } : {}),
    };

    set((s) => {
      const positions = { ...s.layout.positions };
      const fk = taskFolderKey(t);
      const fr = s.layout.folderRects[fk] ?? defaultInboxRect();
      if (position) {
        positions[t.id] = { ...position };
      } else {
        const sameFolder = s.tasks.filter((x) => taskFolderKey(x) === fk);
        const inFolderSorted = [...sameFolder, t].sort((a, b) =>
          a.id.localeCompare(b.id),
        );
        const isolatedSorted = inFolderSorted.filter(
          (x) => !taskHasAnyEdge(x.id, s.edges),
        );
        const connectedSorted = inFolderSorted.filter((x) =>
          taskHasAnyEdge(x.id, s.edges),
        );
        const splitLanes =
          isolatedSorted.length > 0 && connectedSorted.length > 0;
        const slotIndex = Math.max(
          0,
          isolatedSorted.findIndex((x) => x.id === t.id),
        );
        positions[t.id] = defaultSphericalPositionInFolder(
          fr,
          slotIndex,
          isolatedSorted.length,
          splitLanes ? "left" : "full",
        );
      }
      const tasksNext = [t, ...s.tasks];
      const vis = canvasLayoutVisibleIds(tasksNext, s.navFolderId, s.edges);
      const merged = mergeFolderRectsWithTaskBounds(
        s.layout.folderRects,
        tasksNext,
        s.groups,
        positions,
        s.layout.groupRects,
        vis,
      );
      const packed = mergeFoldersWithMaybePack(
        s,
        merged,
        positions,
        s.layout.groupRects,
      );
      return {
        tasks: tasksNext,
        layout: {
          ...s.layout,
          positions: packed.positions,
          folderRects: packed.folderRects,
          groupRects: packed.groupRects,
        },
      };
    });
    get().scheduleSave();
    return t;
  },

  updateTask: (id, patch) => {
    set((s) => ({
      tasks: s.tasks.map((x) => {
        if (x.id !== id) return x;
        if (patch.title === undefined) {
          return { ...x, ...patch };
        }
        const baseMentions =
          patch.mentions !== undefined ? patch.mentions : x.mentions;
        const mentions = mergeMentionsFromTitle(patch.title, baseMentions);
        return {
          ...x,
          ...patch,
          mentions: mentions ?? undefined,
        };
      }),
    }));
    get().scheduleSave();
  },

  deleteTask: (id) => {
    const cur = get().tasks.find((t) => t.id === id);
    if (!cur) return;
    if (cur.folderId === RECENT_DELETED_FOLDER_KEY) {
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
      return;
    }
    const prevFolder = cur.folderId;
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              folderId: RECENT_DELETED_FOLDER_KEY,
              trashRestoreFolderId:
                prevFolder === undefined ? null : prevFolder,
              trashedAt: new Date().toISOString(),
            }
          : t,
      ),
    }));
    get().scheduleSave();
  },

  restoreTaskFromTrash: (id) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        if (t.folderId !== RECENT_DELETED_FOLDER_KEY) return t;
        const fid = t.trashRestoreFolderId;
        const { trashRestoreFolderId: _tr, trashedAt: _ts, ...rest } = t;
        return {
          ...rest,
          folderId: fid == null ? undefined : fid,
        };
      }),
    }));
    get().scheduleSave();
  },

  completeTask: (id, result, nextSteps) => {
    const completedAt = new Date().toISOString();
    const newTasks: Task[] = [];
    const newEdges: TodoEdge[] = [];

    set((s) => {
      const parent = s.tasks.find((x) => x.id === id);
      const inheritFolder =
        parent?.folderId === RECENT_DELETED_FOLDER_KEY
          ? undefined
          : parent?.folderId;
      const inheritTags = parent?.tagIds?.length
        ? [...parent.tagIds]
        : undefined;
      const inheritPriority = parent?.priority;

      const positions = { ...s.layout.positions };
      let cursor = 0;
      const base = positions[id] ?? { x: 120, y: 120 };

      let tagsMut: Tag[] | undefined;

      const ensureTagsFromDraft = (draft: string) => {
        const cur = tagsMut ?? s.tags;
        const unknown = listUnknownHashTagNamesInDraft(draft, cur);
        if (unknown.length === 0) return;
        if (!tagsMut) tagsMut = [...s.tags];
        for (const name of unknown) {
          const idx = tagsMut.length;
          tagsMut.push({
            id: newId(),
            name: name.trim() || "标签",
            color: paletteColorForTagIndex(idx),
          });
        }
      };

      const tagsForParse = () => tagsMut ?? s.tags;

      const updated = s.tasks.map((x) =>
        x.id === id
          ? {
              ...x,
              completedAt,
              result: result.trim() || undefined,
              abandonedAt: undefined,
              abandonReason: undefined,
            }
          : x,
      );

      for (const step of nextSteps) {
        const text = step.text.trim();
        if (step.linkTaskId) {
          if (text) ensureTagsFromDraft(text);
          const { title: linkLabel } = text
            ? parseTaskDraft(text, tagsForParse())
            : { title: "" };
          const edgeLabel =
            linkLabel.trim() || (text ? text : undefined);
          newEdges.push({
            id: newId(),
            source: id,
            target: step.linkTaskId,
            ...(edgeLabel ? { label: edgeLabel } : {}),
          });
        } else if (text) {
          ensureTagsFromDraft(text);
          const { title: stepTitle, tagIds: parsedTags } = parseTaskDraft(
            text,
            tagsForParse(),
          );
          const mergedTagIds = [
            ...new Set([...(inheritTags ?? []), ...parsedTags]),
          ];
          const finalTitle = stepTitle.trim() || "未命名任务";
          const nt: Task = {
            id: newId(),
            title: finalTitle,
            createdAt: new Date().toISOString(),
            ...(inheritFolder ? { folderId: inheritFolder } : {}),
            ...(mergedTagIds.length ? { tagIds: mergedTagIds } : {}),
            ...(inheritPriority ? { priority: inheritPriority } : {}),
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
            label: finalTitle,
          });
        }
      }

      return {
        tasks: [...newTasks, ...updated],
        edges: [...s.edges, ...newEdges],
        layout: { ...s.layout, positions },
        ...(tagsMut ? { tags: tagsMut } : {}),
      };
    });
    get().scheduleSave();
  },

  uncompleteTask: (id) => {
    set((s) => ({
      tasks: s.tasks.map((x) =>
        x.id === id
          ? {
              ...x,
              completedAt: undefined,
              result: undefined,
              abandonedAt: undefined,
              abandonReason: undefined,
            }
          : x,
      ),
    }));
    get().scheduleSave();
  },

  abandonTask: (id, reason) => {
    const abandonedAt = new Date().toISOString();
    set((s) => ({
      tasks: s.tasks.map((x) =>
        x.id === id
          ? {
              ...x,
              abandonedAt,
              abandonReason: reason.trim() || undefined,
              completedAt: undefined,
              result: undefined,
            }
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

  updateEdge: (edgeId, patch) => {
    set((s) => ({
      edges: s.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
    }));
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

  arrangeTasksLinear: (taskIds, direction) => {
    if (taskIds.length === 0) return;
    set((s) => {
      const uniq = [...new Set(taskIds)].filter((id) =>
        s.tasks.some((t) => t.id === id),
      );
      if (uniq.length === 0) return s;

      const positions = { ...s.layout.positions };
      const sorted = [...uniq].sort((a, b) => {
        const pa = positions[a] ?? { x: 0, y: 0 };
        const pb = positions[b] ?? { x: 0, y: 0 };
        if (direction === "horizontal") {
          if (pa.y !== pb.y) return pa.y - pb.y;
          return pa.x - pb.x;
        }
        if (pa.x !== pb.x) return pa.x - pb.x;
        return pa.y - pb.y;
      });

      const firstId = sorted[0]!;
      const anchor = positions[firstId] ?? { x: 120, y: 120 };
      const stepX = LAYOUT_TASK_CARD_W + LAYOUT_TASK_CARD_GAP;
      const stepY = LAYOUT_TASK_CARD_H + LAYOUT_TASK_CARD_GAP;

      for (let i = 0; i < sorted.length; i++) {
        const id = sorted[i]!;
        positions[id] =
          direction === "horizontal"
            ? { x: anchor.x + i * stepX, y: anchor.y }
            : { x: anchor.x, y: anchor.y + i * stepY };
      }

      Object.assign(
        positions,
        separateOverlappingAbsolutePositions(positions, sorted),
      );

      const vis = canvasLayoutVisibleIds(s.tasks, s.navFolderId, s.edges);
      const merged = mergeFolderRectsWithTaskBounds(
        s.layout.folderRects,
        s.tasks,
        s.groups,
        positions,
        s.layout.groupRects,
        vis,
      );
      const packed = mergeFoldersWithMaybePack(
        s,
        merged,
        positions,
        s.layout.groupRects,
      );

      return {
        layout: {
          ...s.layout,
          positions: packed.positions,
          folderRects: packed.folderRects,
          groupRects: packed.groupRects,
        },
      };
    });
    get().scheduleSave();
  },

  arrangeTasksSpherical: (taskIds) => {
    if (taskIds.length === 0) return;
    set((s) => {
      const uniq = [...new Set(taskIds)].filter((id) =>
        s.tasks.some((t) => t.id === id),
      );
      if (uniq.length === 0) return s;

      const positions = { ...s.layout.positions };
      const idSet = new Set(uniq);
      const adj = new Map<string, string[]>();
      for (const id of uniq) adj.set(id, []);
      for (const e of s.edges) {
        if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
        adj.get(e.source)!.push(e.target);
        adj.get(e.target)!.push(e.source);
      }
      const seen = new Set<string>();
      const components: string[][] = [];
      for (const id of uniq) {
        if (seen.has(id)) continue;
        const stack = [id];
        seen.add(id);
        const comp: string[] = [];
        while (stack.length) {
          const u = stack.pop()!;
          comp.push(u);
          for (const v of adj.get(u) ?? []) {
            if (!seen.has(v)) {
              seen.add(v);
              stack.push(v);
            }
          }
        }
        components.push(comp);
      }
      const bboxKey = (ids: string[]) => {
        let minY = Infinity;
        let minX = Infinity;
        for (const i of ids) {
          const p = positions[i] ?? { x: 0, y: 0 };
          minY = Math.min(minY, p.y);
          minX = Math.min(minX, p.x);
        }
        return { minY, minX };
      };
      components.sort((a, b) => {
        const ba = bboxKey(a);
        const bb = bboxKey(b);
        if (ba.minY !== bb.minY) return ba.minY - bb.minY;
        return ba.minX - bb.minX;
      });

      for (const comp of components) {
        const sorted = [...comp].sort((a, b) => {
          const pa = positions[a] ?? { x: 0, y: 0 };
          const pb = positions[b] ?? { x: 0, y: 0 };
          if (pa.y !== pb.y) return pa.y - pb.y;
          return pa.x - pb.x;
        });
        let cx = 0;
        let cy = 0;
        for (const id of sorted) {
          const p = positions[id] ?? { x: 0, y: 0 };
          cx += p.x + LAYOUT_TASK_CARD_W / 2;
          cy += p.y + LAYOUT_TASK_CARD_H / 2;
        }
        cx /= sorted.length;
        cy /= sorted.length;
        const anchor = {
          x: cx - LAYOUT_TASK_CARD_W / 2,
          y: cy - LAYOUT_TASK_CARD_H / 2,
        };
        const n = sorted.length;
        const radius = Math.max(90, 48 * Math.sqrt(n));
        for (let i = 0; i < n; i++) {
          const id = sorted[i]!;
          positions[id] = arrangementSphericalAbsolute(anchor, i, n, radius);
        }
      }

      Object.assign(
        positions,
        separateOverlappingAbsolutePositions(positions, uniq),
      );

      const vis = canvasLayoutVisibleIds(s.tasks, s.navFolderId, s.edges);
      const merged = mergeFolderRectsWithTaskBounds(
        s.layout.folderRects,
        s.tasks,
        s.groups,
        positions,
        s.layout.groupRects,
        vis,
      );
      const packed = mergeFoldersWithMaybePack(
        s,
        merged,
        positions,
        s.layout.groupRects,
      );

      return {
        layout: {
          ...s.layout,
          positions: packed.positions,
          folderRects: packed.folderRects,
          groupRects: packed.groupRects,
        },
      };
    });
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

      const vis = canvasLayoutVisibleIds(tasksNormalized, s.navFolderId, s.edges);
      const fitted = computeGroupRectFromTaskPositions(
        valid,
        s.layout.positions,
        vis,
      );
      if (!fitted) return s;
      const gid = newId();
      groups = [...groups, { id: gid, name: name?.trim() || "任务组", taskIds: valid }];
      groupRects[gid] = fitted;

      const merged = mergeFolderRectsWithTaskBounds(
        s.layout.folderRects,
        tasksNormalized,
        groups,
        s.layout.positions,
        groupRects,
        vis,
      );
      const packed = mergeFoldersWithMaybePack(
        { ...s, tasks: tasksNormalized, groups },
        merged,
        s.layout.positions,
        groupRects,
      );

      return {
        tasks: tasksNormalized,
        groups,
        layout: {
          ...s.layout,
          groupRects: packed.groupRects,
          folderRects: packed.folderRects,
          positions: packed.positions,
        },
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
            const sz = readFlowNodeSize(n);
            folderRects[key] = {
              x: abs.x,
              y: abs.y,
              w: sz?.w ?? r.w,
              h: sz?.h ?? r.h,
            };
          }
        }
      }

      for (const n of nodes) {
        if (n.type === "task") {
          positions[n.id] = absolutePosition(n);
        }
      }

      const vis = canvasLayoutVisibleIds(s.tasks, s.navFolderId, s.edges);
      for (const g of s.groups) {
        const fitted = computeGroupRectFromTaskPositions(
          g.taskIds,
          positions,
          vis,
        );
        if (fitted) groupRects[g.id] = fitted;
      }

      const mergedFolders = mergeFolderRectsWithTaskBounds(
        folderRects,
        s.tasks,
        s.groups,
        positions,
        groupRects,
        vis,
      );
      const packed = mergeFoldersWithMaybePack(
        s,
        mergedFolders,
        positions,
        groupRects,
      );

      return {
        layout: {
          ...s.layout,
          positions: packed.positions,
          groupRects: packed.groupRects,
          folderRects: packed.folderRects,
        },
      };
    });
    get().scheduleSave();
  },

  addFolder: (name) => {
    const trimmed = name.trim() || "新文件夹";
    set((s) => {
      const id = newId();
      const col = s.folders.length + 1;
      const folderRects = { ...s.layout.folderRects };
      folderRects[id] = { x: 40 + col * 420, y: 40, w: 320, h: 420 };
      const f: Folder = { id, name: trimmed };
      return {
        folders: [...s.folders, f],
        layout: { ...s.layout, folderRects },
      };
    });
    get().scheduleSave();
  },

  updateFolder: (folderId, patch) => {
    set((s) => ({
      folders: s.folders.map((f) => {
        if (f.id !== folderId) return f;
        const next = { ...f };
        if (patch.name !== undefined) {
          const n = patch.name.trim();
          if (n) next.name = n;
        }
        if (patch.color !== undefined) {
          if (patch.color === "" || patch.color === undefined)
            delete next.color;
          else next.color = patch.color;
        }
        return next;
      }),
    }));
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
      tags: [
        ...s.tags,
        {
          id: newId(),
          name: trimmed,
          color: paletteColorForTagIndex(s.tags.length),
        },
      ],
    }));
    get().scheduleSave();
  },

  updateTag: (tagId, patch) => {
    set((s) => ({
      tags: s.tags.map((t) => {
        if (t.id !== tagId) return t;
        const next = { ...t };
        if (patch.name !== undefined) {
          const n = patch.name.trim();
          if (n) next.name = n;
        }
        if (patch.color !== undefined) {
          if (patch.color === "" || patch.color === undefined)
            delete next.color;
          else next.color = patch.color;
        }
        return next;
      }),
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
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const fid = folderId ? folderId : undefined;
        if (fid === RECENT_DELETED_FOLDER_KEY) return t;
        return {
          ...t,
          folderId: fid,
          ...(fid !== RECENT_DELETED_FOLDER_KEY
            ? { trashRestoreFolderId: undefined, trashedAt: undefined }
            : {}),
        };
      }),
    }));
    get().scheduleSave();
  },

  assignTaskFoldersAndRefitLanes: (updates) => {
    if (!updates.length) return;
    set((s) => {
      const u = new Map(
        updates.map((x) => [x.taskId, x.folderId] as const),
      );
      const tasks = s.tasks.map((t) => {
        if (!u.has(t.id)) return t;
        const fid = u.get(t.id);
        if (fid === RECENT_DELETED_FOLDER_KEY) return t;
        return {
          ...t,
          ...(fid ? { folderId: fid } : { folderId: undefined }),
          trashRestoreFolderId: undefined,
          trashedAt: undefined,
        };
      });
      const vis = canvasLayoutVisibleIds(tasks, s.navFolderId, s.edges);
      const merged = mergeFolderRectsWithTaskBounds(
        s.layout.folderRects,
        tasks,
        s.groups,
        s.layout.positions,
        s.layout.groupRects,
        vis,
      );
      const packed = mergeFoldersWithMaybePack(
        { ...s, tasks },
        merged,
        s.layout.positions,
        s.layout.groupRects,
      );
      return {
        tasks,
        layout: {
          ...s.layout,
          folderRects: packed.folderRects,
          positions: packed.positions,
          groupRects: packed.groupRects,
        },
      };
    });
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
