import {
  LAYOUT_TASK_CARD_H,
  LAYOUT_TASK_CARD_W,
} from "@/lib/canvas-overlap";
import type { Rect, TodoEdge, Vec2 } from "./types";

/** 与 TaskNode 宽度、flow-build 默认布局一致的中心参考宽 */
const NODE_W = 240;
const NODE_H = 100;
/** 与 FolderLaneNode 标题区大致对齐；任务相对文件夹顶边的最小 y 须 ≥ 此值，避免遮住标题 */
export const FOLDER_LANE_HEADER_PX = 52;
const FOLDER_HEADER = FOLDER_LANE_HEADER_PX;

export function taskHasAnyEdge(taskId: string, edges: TodoEdge[]): boolean {
  return edges.some((e) => e.source === taskId || e.target === taskId);
}

/** 横条内分区：无连线球形 vs 有连线栅格并排时避免重叠 */
export type FolderPlacementRegion = "full" | "left" | "right";

function innerMetrics(fr: Rect): { innerTop: number; innerH: number; cx: number; cy: number } {
  const innerTop = fr.y + FOLDER_HEADER;
  const innerH = Math.max(fr.h - FOLDER_HEADER, NODE_H + 24);
  const cx = fr.x + fr.w / 2;
  const cy = innerTop + innerH / 2;
  return { innerTop, innerH, cx, cy };
}

function regionCenterX(fr: Rect, region: FolderPlacementRegion): number {
  if (region === "left") return fr.x + fr.w * 0.32;
  if (region === "right") return fr.x + fr.w * 0.68;
  return fr.x + fr.w / 2;
}

/** 单位球面上近似均匀分布（Fibonacci 球面格点），i ∈ [0, n) */
function fibonacciSpherePoint(
  i: number,
  n: number,
): { x: number; y: number; z: number } {
  if (n <= 1) return { x: 0, y: 0.85, z: 0.2 };
  const k = i + 0.5;
  const phi = Math.acos(1 - (2 * k) / n);
  const theta = Math.PI * (1 + Math.sqrt(5)) * k;
  const sinP = Math.sin(phi);
  return {
    x: sinP * Math.cos(theta),
    y: sinP * Math.sin(theta),
    z: Math.cos(phi),
  };
}

function sphereToCanvas(
  p: { x: number; y: number; z: number },
  cx: number,
  cy: number,
  radius: number,
): Vec2 {
  const isoX = (p.x - p.z * 0.48) * 0.92;
  const isoY = -p.y * 0.55 + (p.x + p.z) * 0.34;
  return {
    x: cx + isoX * radius - NODE_W / 2,
    y: cy + isoY * radius - NODE_H / 2,
  };
}

/**
 * 无连线任务：Fibonacci 球面 → 2D，呈球形散落。
 */
export function defaultSphericalPositionInFolder(
  fr: Rect,
  slotIndex: number,
  totalInCohort: number,
  region: FolderPlacementRegion = "full",
): Vec2 {
  const n = Math.max(1, totalInCohort);
  const idx = Math.min(Math.max(0, slotIndex), n - 1);
  const { innerTop, innerH, cy } = innerMetrics(fr);
  const cx = regionCenterX(fr, region);

  const halfW = region === "full" ? fr.w / 2 : fr.w * 0.46;
  const maxR = Math.min(halfW - NODE_W / 2 - 16, innerH / 2 - NODE_H / 2 - 12);
  const radius = Math.max(48, Math.min(maxR * 0.9, region === "full" ? 220 : 180));

  const p = fibonacciSpherePoint(idx, n);
  return sphereToCanvas(p, cx, cy, radius);
}

/**
 * 以首卡左上角为锚，在 Fibonacci 球面投影上排第 slotIndex 张卡片（绝对坐标，卡片尺寸与互斥算法一致）。
 */
export function arrangementSphericalAbsolute(
  anchorTopLeft: Vec2,
  slotIndex: number,
  total: number,
  radius: number,
): Vec2 {
  const w = LAYOUT_TASK_CARD_W;
  const h = LAYOUT_TASK_CARD_H;
  const cx = anchorTopLeft.x + w / 2;
  const cy = anchorTopLeft.y + h / 2;
  const n = Math.max(1, total);
  const idx = Math.min(Math.max(0, slotIndex), n - 1);
  const p = fibonacciSpherePoint(idx, n);
  const isoX = (p.x - p.z * 0.48) * 0.92;
  const isoY = -p.y * 0.55 + (p.x + p.z) * 0.34;
  return {
    x: cx + isoX * radius - w / 2,
    y: cy + isoY * radius - h / 2,
  };
}

/**
 * 有连线任务：中心附近小栅格，便于沿链继续摆。
 */
export function defaultGridPositionInFolder(
  fr: Rect,
  slotIndex: number,
  region: FolderPlacementRegion = "full",
): Vec2 {
  const { innerTop, innerH, cy } = innerMetrics(fr);
  const cx = regionCenterX(fr, region);
  const col = slotIndex % 4;
  const row = Math.floor(slotIndex / 4);
  return {
    x: cx + col * 28 - NODE_W / 2,
    y: innerTop + innerH / 2 - NODE_H / 2 + row * 88,
  };
}

/**
 * @deprecated 请用 defaultSphericalPositionInFolder / defaultGridPositionInFolder；
 * 保留兼容：等同球形 full 区。
 */
export function defaultAbsolutePositionInFolder(
  fr: Rect,
  slotIndex: number,
  totalInFolder?: number,
): Vec2 {
  const n = Math.max(1, totalInFolder ?? slotIndex + 1);
  return defaultSphericalPositionInFolder(fr, slotIndex, n, "full");
}
