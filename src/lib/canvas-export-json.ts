import type { Node } from "@xyflow/react";
import { readFlowNodeSize } from "@/lib/folder-fit";
import type {
  Folder,
  LayoutState,
  NavFolderId,
  Task,
  TaskGroup,
  TodoEdge,
} from "@/lib/types";
import {
  ARCHIVE_FOLDER_KEY,
  INBOX_FOLDER_KEY,
  RECENT_DELETED_FOLDER_KEY,
  taskFolderKey,
} from "@/lib/types";

const FALLBACK_TASK_BOX = { w: 240, h: 92 } as const;

function folderLaneLabel(folderKey: string, folders: Folder[]): string {
  if (folderKey === INBOX_FOLDER_KEY) return "收件箱";
  if (folderKey === ARCHIVE_FOLDER_KEY) return "归档";
  if (folderKey === RECENT_DELETED_FOLDER_KEY) return "最近删除的任务";
  return folders.find((f) => f.id === folderKey)?.name ?? folderKey;
}

function taskBox(
  taskId: string,
  pos: { x: number; y: number } | undefined,
  sizes: Record<string, { w: number; h: number }>,
): {
  x: number;
  y: number;
  w: number;
  h: number;
  sourceAnchor: { x: number; y: number };
  targetAnchor: { x: number; y: number };
} {
  const w = sizes[taskId]?.w ?? FALLBACK_TASK_BOX.w;
  const h = sizes[taskId]?.h ?? FALLBACK_TASK_BOX.h;
  const x = pos?.x ?? 0;
  const y = pos?.y ?? 0;
  return {
    x,
    y,
    w,
    h,
    sourceAnchor: { x: x + w, y: y + h / 2 },
    targetAnchor: { x, y: y + h / 2 },
  };
}

export type FlexOffCanvasExportV1 = {
  format: "flex-off-canvas-v1";
  exportedAt: string;
  navFolderId: NavFolderId;
  folderLanes: Array<{
    key: string;
    name: string;
    rect: { x: number; y: number; w: number; h: number };
  }>;
  groups: Array<{
    id: string;
    name: string;
    taskIds: string[];
    rect: { x: number; y: number; w: number; h: number };
  }>;
  tasks: Array<{
    id: string;
    title: string;
    folderKey: string;
    completed: boolean;
    position: { x: number; y: number } | null;
    size: { w: number; h: number };
    anchors: {
      source: { x: number; y: number };
      target: { x: number; y: number };
    } | null;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    /** 画布绝对坐标下的连线端点（右出 → 左入） */
    endpoints: {
      source: { x: number; y: number };
      target: { x: number; y: number };
    } | null;
  }>;
};

/**
 * 导出当前画布任务流布局（拓扑 + 绝对坐标 + 文件夹区域尺寸）。
 * `flowTaskNodes` 传入时可用 React Flow 实测节点宽高优化连线端点。
 */
export function buildFlexOffCanvasJson(opts: {
  tasks: Task[];
  edges: TodoEdge[];
  groups: TaskGroup[];
  layout: LayoutState;
  folders: Folder[];
  navFolderId: NavFolderId;
  flowTaskNodes?: Node[];
}): FlexOffCanvasExportV1 {
  const sizes: Record<string, { w: number; h: number }> = {};
  for (const n of opts.flowTaskNodes ?? []) {
    if (n.type !== "task") continue;
    const sz = readFlowNodeSize(n);
    if (sz) sizes[n.id] = sz;
  }

  const positions = opts.layout.positions;
  const folderLanes = Object.entries(opts.layout.folderRects).map(
    ([key, rect]) => ({
      key,
      name: folderLaneLabel(key, opts.folders),
      rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    }),
  );

  const groups = opts.groups.map((g) => {
    const r = opts.layout.groupRects[g.id];
    return {
      id: g.id,
      name: g.name,
      taskIds: [...g.taskIds],
      rect: r
        ? { x: r.x, y: r.y, w: r.w, h: r.h }
        : { x: 0, y: 0, w: 0, h: 0 },
    };
  });

  const tasks = opts.tasks.map((t) => {
    const p = positions[t.id];
    const fk = taskFolderKey(t);
    if (!p) {
      return {
        id: t.id,
        title: t.title,
        folderKey: fk,
        completed: Boolean(t.completedAt),
        position: null,
        size: {
          w: sizes[t.id]?.w ?? FALLBACK_TASK_BOX.w,
          h: sizes[t.id]?.h ?? FALLBACK_TASK_BOX.h,
        },
        anchors: null,
      };
    }
    const box = taskBox(t.id, p, sizes);
    return {
      id: t.id,
      title: t.title,
      folderKey: fk,
      completed: Boolean(t.completedAt),
      position: { x: p.x, y: p.y },
      size: { w: box.w, h: box.h },
      anchors: {
        source: box.sourceAnchor,
        target: box.targetAnchor,
      },
    };
  });

  const taskMap = new Map(tasks.map((t) => [t.id, t] as const));

  const edges = opts.edges.map((e) => {
    const src = taskMap.get(e.source);
    const tgt = taskMap.get(e.target);
    const endpoints =
      src?.anchors && tgt?.anchors
        ? { source: src.anchors.source, target: tgt.anchors.target }
        : null;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.label ? { label: e.label } : {}),
      endpoints,
    };
  });

  return {
    format: "flex-off-canvas-v1",
    exportedAt: new Date().toISOString(),
    navFolderId: opts.navFolderId,
    folderLanes,
    groups,
    tasks,
    edges,
  };
}
