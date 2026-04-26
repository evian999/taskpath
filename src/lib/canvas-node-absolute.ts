import type { Node } from "@xyflow/react";
import { FOLDER_LANE_HEADER_PX } from "@/lib/canvas-layout";
import {
  readFlowNodeSize,
  TASK_NODE_BOUNDS_H,
  TASK_NODE_BOUNDS_W,
} from "@/lib/folder-fit";

/** 与 syncCanvasLayout 一致的节点绝对流坐标 */
export function absoluteFlowPosition(
  n: Node,
  byId: Map<string, Node>,
): { x: number; y: number } {
  if (!n.parentId) return { x: n.position.x, y: n.position.y };
  const p = byId.get(n.parentId);
  if (!p) return { x: n.position.x, y: n.position.y };
  const po = absoluteFlowPosition(p, byId);
  return { x: n.position.x + po.x, y: n.position.y + po.y };
}

/** 任务卡片中心点（流坐标），用于文件夹命中测试 */
export function taskHitCenterFlow(
  n: Node,
  byId: Map<string, Node>,
): { x: number; y: number } {
  const pos = absoluteFlowPosition(n, byId);
  const sz = readFlowNodeSize(n);
  const w = sz?.w ?? TASK_NODE_BOUNDS_W;
  const h = sz?.h ?? TASK_NODE_BOUNDS_H;
  return { x: pos.x + w / 2, y: pos.y + h / 2 };
}

function findFolderLaneAncestor(
  n: Node,
  byId: Map<string, Node>,
): Node | undefined {
  let cur: Node | undefined = n.parentId ? byId.get(n.parentId) : undefined;
  while (cur) {
    if (cur.type === "folderLane") return cur;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return undefined;
}

/** 将任务顶边限制在文件夹标题栏之下（避免画布上遮住文件夹名） */
export function clampTaskNodesBelowFolderTitle(nodes: Node[]): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes.map((n) => {
    if (n.type !== "task") return n;
    const folder = findFolderLaneAncestor(n, byId);
    if (!folder) return n;
    const folderTop = absoluteFlowPosition(folder, byId).y;
    const taskTop = absoluteFlowPosition(n, byId).y;
    const minTop = folderTop + FOLDER_LANE_HEADER_PX;
    if (taskTop >= minTop) return n;
    const delta = minTop - taskTop;
    return { ...n, position: { ...n.position, y: n.position.y + delta } };
  });
}
