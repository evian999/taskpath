import type { Edge, Node } from "@xyflow/react";
import type { Folder, LayoutState, NavFolderId, Task, TaskGroup, TodoEdge } from "./types";
import { INBOX_FOLDER_KEY, taskFolderKey } from "./types";

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
  return folders.find((f) => f.id === folderKey)?.name ?? "文件夹";
}

function folderColor(folderKey: string, folders: Folder[]): string | undefined {
  if (folderKey === INBOX_FOLDER_KEY) return undefined;
  return folders.find((f) => f.id === folderKey)?.color;
}

function filterTasksByNav(tasks: Task[], navFolderId: NavFolderId): Task[] {
  if (navFolderId === "all") return tasks;
  if (navFolderId === INBOX_FOLDER_KEY)
    return tasks.filter((t) => !t.folderId);
  return tasks.filter((t) => t.folderId === navFolderId);
}

function filterGroupsByTasks(groups: TaskGroup[], visibleTaskIds: Set<string>): TaskGroup[] {
  return groups.filter((g) => g.taskIds.every((id) => visibleTaskIds.has(id)));
}

/** 当前画布要展示的文件夹键（收件箱 + 各文件夹，或筛选时仅一个） */
function visibleFolderKeys(
  folders: Folder[],
  navFolderId: NavFolderId,
): string[] {
  if (navFolderId === "all") {
    return [INBOX_FOLDER_KEY, ...folders.map((f) => f.id)];
  }
  return [navFolderId];
}

export function buildFlowNodes(
  tasks: Task[],
  groups: TaskGroup[],
  layout: LayoutState,
  folders: Folder[],
  navFolderId: NavFolderId,
): Node[] {
  const filteredTasks = filterTasksByNav(tasks, navFolderId);
  const visibleIds = new Set(filteredTasks.map((t) => t.id));
  const filteredGroups = filterGroupsByTasks(groups, visibleIds);

  const nodes: Node[] = [];
  const folderKeys = visibleFolderKeys(folders, navFolderId);

  for (const key of folderKeys) {
    const r = layout.folderRects[key];
    if (!r) continue;
    nodes.push({
      id: folderLaneNodeId(key),
      type: "folderLane",
      position: { x: r.x, y: r.y },
      style: { width: r.w, height: r.h },
      data: {
        folderKey: key,
        name: folderDisplayName(key, folders),
        color: folderColor(key, folders),
      },
      draggable: true,
      selectable: true,
      zIndex: -2,
    });
  }

  for (const g of filteredGroups) {
    const r = layout.groupRects[g.id];
    if (!r) continue;
    const firstTask = filteredTasks.find((t) => t.id === g.taskIds[0]);
    const fk = firstTask ? taskFolderKey(firstTask) : INBOX_FOLDER_KEY;
    const fRect = layout.folderRects[fk];
    if (!fRect) continue;
    nodes.push({
      id: groupNodeId(g.id),
      type: "groupFrame",
      position: { x: r.x - fRect.x, y: r.y - fRect.y },
      style: { width: r.w, height: r.h },
      data: { groupId: g.id, name: g.name },
      parentId: folderLaneNodeId(fk),
      extent: "parent",
      draggable: true,
      selectable: true,
      zIndex: -1,
    });
  }

  for (const t of filteredTasks) {
    const g = taskParentGroup(t.id, filteredGroups);
    const fk = taskFolderKey(t);
    const fRect = layout.folderRects[fk];
    if (!fRect) continue;
    const abs = layout.positions[t.id] ?? { x: fRect.x + 24, y: fRect.y + 56 };

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
        extent = "parent";
      }
    } else {
      position = { x: abs.x - fRect.x, y: abs.y - fRect.y };
      parentId = folderLaneNodeId(fk);
      extent = "parent";
    }

    nodes.push({
      id: t.id,
      type: "task",
      position,
      parentId,
      extent,
      data: { task: t },
      draggable: true,
      selectable: true,
      zIndex: 0,
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

export function buildFlowEdges(edges: TodoEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: "smoothstep",
    animated: false,
    style: { stroke: "var(--flow-edge)", strokeWidth: 1.5 },
    labelStyle: { fill: "var(--flow-label)", fontSize: 11 },
    labelBgStyle: { fill: "var(--flow-label-bg)" },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
  }));
}

export function visibleTaskIdSet(
  tasks: Task[],
  navFolderId: NavFolderId,
): Set<string> {
  return new Set(filterTasksByNav(tasks, navFolderId).map((t) => t.id));
}
