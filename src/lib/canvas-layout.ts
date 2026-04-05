import type { Rect, Vec2 } from "./types";

/** 与 TaskNode 宽度、flow-build 默认布局一致的中心参考宽 */
const NODE_W = 240;
const NODE_H = 100;
/** 与 FolderLaneNode 标题区大致对齐 */
const FOLDER_HEADER = 38;

/**
 * 将任务放在文件夹矩形内容区中心；多任务时在中心附近栅格错位，避免完全重叠。
 */
export function defaultAbsolutePositionInFolder(
  fr: Rect,
  slotIndex: number,
): Vec2 {
  const innerTop = fr.y + FOLDER_HEADER;
  const innerH = Math.max(fr.h - FOLDER_HEADER, NODE_H + 24);
  const cx = fr.x + fr.w / 2 - NODE_W / 2;
  const cy = innerTop + innerH / 2 - NODE_H / 2;
  const col = slotIndex % 4;
  const row = Math.floor(slotIndex / 4);
  return {
    x: cx + col * 28,
    y: cy + row * 88,
  };
}
