"use client";

import { NodeResizer, useReactFlow, type NodeProps } from "@xyflow/react";
import { useAppStore } from "@/lib/store";

export type FolderLaneData = {
  folderKey: string;
  name: string;
  color?: string;
};

export function FolderLaneNode({ id, data, selected }: NodeProps) {
  const d = data as FolderLaneData;
  const accent = d.color ?? "rgba(56, 189, 248, 0.35)";
  const { getNodes } = useReactFlow();
  const syncCanvasLayout = useAppStore((s) => s.syncCanvasLayout);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={160}
        maxWidth={5600}
        maxHeight={5600}
        color="var(--accent)"
        lineClassName="nopan !border-[var(--accent)]/45"
        handleClassName="nopan !h-2.5 !w-2.5 !rounded-sm !border !border-[var(--accent)]/80 !bg-[var(--bg-deep)]"
        onResizeEnd={() => {
          queueMicrotask(() => syncCanvasLayout(getNodes()));
        }}
      />
      <div
        className={`folder-lane pointer-events-none flex h-full w-full flex-col md-corner-xl border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)]/40 backdrop-blur-[1px] ${
          selected ? "ring-1 ring-md-primary" : ""
        }`}
        style={{
          borderLeftWidth: 3,
          borderLeftColor: accent,
          boxShadow: `inset 0 0 40px ${accent}12`,
        }}
      >
        <div className="folder-lane-drag pointer-events-auto shrink-0 cursor-grab select-none px-2 py-1.5 active:cursor-grabbing">
          <span className="md-type-label-s">
            {d.name}
          </span>
        </div>
        <div className="relative min-h-0 flex-1 pointer-events-none" />
      </div>
    </>
  );
}
