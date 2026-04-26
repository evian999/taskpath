import type { Edge, Node } from "@xyflow/react";
import {
  defaultGridPositionInFolder,
  defaultSphericalPositionInFolder,
  FOLDER_LANE_HEADER_PX,
  taskHasAnyEdge,
} from "@/lib/canvas-layout";
import { computeGroupRectFromTaskPositions } from "@/lib/folder-fit";
import type {
  Folder,
  LayoutState,
  NavFolderId,
  Tag,
  Task,
  TaskGroup,
  TodoEdge,
  Vec2,
} from "./types";
import {
  ARCHIVE_FOLDER_KEY,
  INBOX_FOLDER_KEY,
  RECENT_DELETED_FOLDER_KEY,
  allCanvasFolderLaneKeys,
  taskFolderKey,
} from "./types";

export const GROUP_PREFIX = "grp-";
export const FOLDER_PREFIX = "fld-";

export function groupNodeId(groupId: string) {
  return `${GROUP_PREFIX}${groupId}`;
}

export function folderLaneNodeId(folderKey: string) {
  return `${FOLDER_PREFIX}${folderKey}`;
}

export function taskParentGroup(
  taskId: string,
  groups: TaskGroup[],
): TaskGroup | undefined {
  return groups.find((g) => g.taskIds.includes(taskId));
}

function folderDisplayName(folderKey: string, folders: Folder[]): string {
  if (folderKey === INBOX_FOLDER_KEY) return "收件箱";
  if (folderKey === ARCHIVE_FOLDER_KEY) return "归档";
  if (folderKey === RECENT_DELETED_FOLDER_KEY) return "最近删除的任务";
  return folders.find((f) => f.id === folderKey)?.name ?? "文件夹";
}

function folderColor(folderKey: string, folders: Folder[]): string | undefined {
  if (
    folderKey === INBOX_FOLDER_KEY ||
    folderKey === ARCHIVE_FOLDER_KEY ||
    folderKey === RECENT_DELETED_FOLDER_KEY
  )
    return undefined;
  return folders.find((f) => f.id === folderKey)?.color;
}

function filterTasksByNav(tasks: Task[], navFolderId: NavFolderId): Task[] {
  if (navFolderId === "all")
    return tasks.filter((t) => t.folderId !== RECENT_DELETED_FOLDER_KEY);
  if (navFolderId === INBOX_FOLDER_KEY)
    return tasks.filter((t) => !t.folderId);
  if (navFolderId === ARCHIVE_FOLDER_KEY)
    return tasks.filter((t) => t.folderId === ARCHIVE_FOLDER_KEY);
  if (navFolderId === RECENT_DELETED_FOLDER_KEY)
    return tasks.filter((t) => t.folderId === RECENT_DELETED_FOLDER_KEY);
  return tasks.filter((t) => t.folderId === navFolderId);
}

/**
 * 画布可见任务（在文件夹筛选范围内，仅统计两端均在 nav 内的连线）：
 * - 未完成：始终显示；
 * - 已完成且无出边（无「下一步」）：不显示；
 * - 已完成且有出边：沿 **source→target** 方向能否到达至少一个**未完成**任务，能则显示，否则不显示。
 */
export type CanvasVisibilityOptions = {
  /** true：当前导航下所有任务都上画布（含已无未完成下游的已完成）；默认 false 沿用「下游有未完成才显示已完成」 */
  showAllCompletedInNav?: boolean;
};

function canvasVisibleTasks(
  tasks: Task[],
  navFolderId: NavFolderId,
  edges: TodoEdge[],
  opts?: CanvasVisibilityOptions,
): Task[] {
  if (opts?.showAllCompletedInNav) {
    return filterTasksByNav(tasks, navFolderId);
  }
  const nav = filterTasksByNav(tasks, navFolderId);
  const navIds = new Set(nav.map((t) => t.id));
  const navById = new Map(nav.map((t) => [t.id, t] as const));

  const outgoing = new Map<string, string[]>();
  for (const t of nav) outgoing.set(t.id, []);
  for (const e of edges) {
    if (!navIds.has(e.source) || !navIds.has(e.target)) continue;
    outgoing.get(e.source)!.push(e.target);
  }

  function hasIncompleteDownstream(startId: string): boolean {
    const stack = [...(outgoing.get(startId) ?? [])];
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const t = navById.get(id);
      if (!t) continue;
      if (!t.completedAt && !t.abandonedAt) return true;
      for (const n of outgoing.get(id) ?? []) stack.push(n);
    }
    return false;
  }

  return nav.filter((t) => {
    if (!t.completedAt && !t.abandonedAt) return true;
    return hasIncompleteDownstream(t.id);
  });
}

function filterGroupsByTasks(groups: TaskGroup[], visibleTaskIds: Set<string>): TaskGroup[] {
  return groups.filter((g) => g.taskIds.some((id) => visibleTaskIds.has(id)));
}

/** 当前画布要展示的文件夹键（收件箱 + 各文件夹，或筛选时仅一个） */
function visibleFolderKeys(
  folders: Folder[],
  navFolderId: NavFolderId,
): string[] {
  if (navFolderId === "all") {
    return allCanvasFolderLaneKeys(folders);
  }
  return [navFolderId];
}

/** 仅包含有画布可见内容（任务或任务组）的文件夹，避免空文件夹占画布 */
function canvasFolderKeysInUse(
  folders: Folder[],
  navFolderId: NavFolderId,
  filteredTasks: Task[],
  filteredGroups: TaskGroup[],
): string[] {
  const needed = new Set<string>();
  for (const t of filteredTasks) needed.add(taskFolderKey(t));
  for (const g of filteredGroups) {
    const firstVisible = g.taskIds
      .map((id) => filteredTasks.find((x) => x.id === id))
      .find((t): t is Task => t !== undefined);
    if (firstVisible) needed.add(taskFolderKey(firstVisible));
  }
  return visibleFolderKeys(folders, navFolderId).filter((k) => needed.has(k));
}

export function buildFlowNodes(
  tasks: Task[],
  groups: TaskGroup[],
  layout: LayoutState,
  folders: Folder[],
  navFolderId: NavFolderId,
  allEdges: TodoEdge[],
  visibility?: CanvasVisibilityOptions,
): Node[] {
  const filteredTasks = canvasVisibleTasks(
    tasks,
    navFolderId,
    allEdges,
    visibility,
  );
  const visibleIds = new Set(filteredTasks.map((t) => t.id));
  const filteredGroups = filterGroupsByTasks(groups, visibleIds);

  const nodes: Node[] = [];
  const folderKeys = canvasFolderKeysInUse(
    folders,
    navFolderId,
    filteredTasks,
    filteredGroups,
  );

  for (const key of folderKeys) {
    const r = layout.folderRects[key];
    if (!r) continue;
    nodes.push({
      id: folderLaneNodeId(key),
      type: "folderLane",
      position: { x: r.x, y: r.y },
      // 勿设 pointerEvents: "none"：会盖住 RF 节点层的 pointer-events，导致 NodeResizer 无法点击
      style: { width: r.w, height: r.h },
      data: {
        folderKey: key,
        name: folderDisplayName(key, folders),
        color: folderColor(key, folders),
      },
      dragHandle: ".folder-lane-drag",
      selectable: true,
      zIndex: -2,
    });
  }

  for (const g of filteredGroups) {
    const r =
      computeGroupRectFromTaskPositions(
        g.taskIds,
        layout.positions,
        visibleIds,
      ) ?? layout.groupRects[g.id];
    if (!r) continue;
    const firstVisibleInGroup = g.taskIds
      .map((id) => filteredTasks.find((t) => t.id === id))
      .find((t): t is Task => t !== undefined);
    const fk = firstVisibleInGroup
      ? taskFolderKey(firstVisibleInGroup)
      : INBOX_FOLDER_KEY;
    const fRect = layout.folderRects[fk];
    if (!fRect) continue;
    nodes.push({
      id: groupNodeId(g.id),
      type: "groupFrame",
      position: { x: r.x - fRect.x, y: r.y - fRect.y },
      style: { width: r.w, height: r.h, pointerEvents: "none" },
      data: { groupId: g.id, name: g.name },
      parentId: folderLaneNodeId(fk),
      extent: "parent",
      dragHandle: ".group-frame-drag",
      selectable: true,
      zIndex: -1,
    });
  }

  const tasksByFolder = new Map<string, Task[]>();
  for (const t of filteredTasks) {
    const fk = taskFolderKey(t);
    const list = tasksByFolder.get(fk) ?? [];
    list.push(t);
    tasksByFolder.set(fk, list);
  }

  for (const t of filteredTasks) {
    const g = taskParentGroup(t.id, filteredGroups);
    const fk = taskFolderKey(t);
    const fRect = layout.folderRects[fk];
    if (!fRect) continue;
    const inFolder = [...(tasksByFolder.get(fk) ?? [t])].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    const isolatedSorted = inFolder.filter(
      (x) => !taskHasAnyEdge(x.id, allEdges),
    );
    const connectedSorted = inFolder.filter((x) =>
      taskHasAnyEdge(x.id, allEdges),
    );
    const splitLanes =
      isolatedSorted.length > 0 && connectedSorted.length > 0;

    let abs: Vec2;
    if (layout.positions[t.id]) {
      abs = layout.positions[t.id]!;
      const minY = fRect.y + FOLDER_LANE_HEADER_PX;
      if (abs.y < minY) abs = { ...abs, y: minY };
    } else {
      abs = taskHasAnyEdge(t.id, allEdges)
        ? defaultGridPositionInFolder(
            fRect,
            Math.max(0, connectedSorted.findIndex((x) => x.id === t.id)),
            splitLanes ? "right" : "full",
          )
        : defaultSphericalPositionInFolder(
            fRect,
            Math.max(0, isolatedSorted.findIndex((x) => x.id === t.id)),
            isolatedSorted.length,
            splitLanes ? "left" : "full",
          );
    }

    let position: { x: number; y: number };
    let parentId: string | undefined;
    let extent: "parent" | undefined;

    if (g) {
      const gr = layout.groupRects[g.id];
      if (gr) {
        position = { x: abs.x - gr.x, y: abs.y - gr.y };
        parentId = groupNodeId(g.id);
        extent = "parent";
      } else {
        position = { x: abs.x - fRect.x, y: abs.y - fRect.y };
        parentId = folderLaneNodeId(fk);
        extent = undefined;
      }
    } else {
      position = { x: abs.x - fRect.x, y: abs.y - fRect.y };
      parentId = folderLaneNodeId(fk);
      /** 仅直接挂在文件夹下时可拖出栏外；组内任务仍限制在组框内 */
      extent = undefined;
    }

    nodes.push({
      id: t.id,
      type: "task",
      position,
      parentId,
      extent,
      data: { task: t },
      selectable: true,
      zIndex: 2,
    });
  }

  return nodes;
}

export function filterEdgesForTasks(
  edges: TodoEdge[],
  visibleTaskIds: Set<string>,
): TodoEdge[] {
  return edges.filter(
    (e) => visibleTaskIds.has(e.source) && visibleTaskIds.has(e.target),
  );
}

function edgeStrokeFromTargetTask(
  target: Task | undefined,
  tags: Tag[],
): string {
  const firstId = target?.tagIds?.[0];
  if (!firstId) return "var(--flow-edge)";
  const tag = tags.find((t) => t.id === firstId);
  const c = tag?.color?.trim();
  if (!c) return "var(--flow-edge)";
  return c;
}

export function buildFlowEdges(
  edges: TodoEdge[],
  tasks: Task[],
  tags: Tag[],
): Edge[] {
  const byId = new Map(tasks.map((t) => [t.id, t] as const));
  return edges.map((e) => {
    const targetTask = byId.get(e.target);
    const stroke = edgeStrokeFromTargetTask(targetTask, tags);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: "highlightSmoothstep",
      animated: false,
      selectable: true,
      deletable: true,
      interactionWidth: 32,
      style: { stroke, strokeWidth: 1.5 },
      labelStyle: { fill: "var(--flow-label)", fontSize: 11 },
      labelBgStyle: { fill: "var(--flow-label-bg)" },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
    };
  });
}

export function visibleTaskIdSet(
  tasks: Task[],
  navFolderId: NavFolderId,
  edges: TodoEdge[],
  visibility?: CanvasVisibilityOptions,
): Set<string> {
  return new Set(
    canvasVisibleTasks(tasks, navFolderId, edges, visibility).map((t) => t.id),
  );
}
