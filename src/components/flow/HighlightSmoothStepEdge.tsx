"use client";

import type { CSSProperties } from "react";
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
  Position,
} from "@xyflow/react";

/** 与默认 smoothstep 一致，选中时加粗并使用主题强调色 */
export function HighlightSmoothStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  markerEnd,
  markerStart,
  interactionWidth,
  selected,
}: EdgeProps) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const s = style as CSSProperties | undefined;
  const baseStroke = (s?.stroke as string) || "var(--flow-edge)";
  const baseW =
    typeof s?.strokeWidth === "number" ? s.strokeWidth : 1.5;

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        ...style,
        stroke: selected ? "var(--accent)" : baseStroke,
        strokeWidth: selected ? 3 : baseW,
      }}
      markerEnd={markerEnd}
      markerStart={markerStart}
      interactionWidth={interactionWidth}
    />
  );
}
