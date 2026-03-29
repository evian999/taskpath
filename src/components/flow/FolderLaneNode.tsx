"use client";

import { type NodeProps } from "@xyflow/react";

export type FolderLaneData = {
  folderKey: string;
  name: string;
  color?: string;
};

export function FolderLaneNode({ data, selected }: NodeProps) {
  const d = data as FolderLaneData;
  const accent = d.color ?? "rgba(56, 189, 248, 0.35)";
  return (
    <div
      className={`folder-lane h-full w-full rounded-xl border border-zinc-700/40 bg-black/20 backdrop-blur-[1px] ${
        selected ? "ring-1 ring-[var(--accent)]" : ""
      }`}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: accent,
        boxShadow: `inset 0 0 40px ${accent}12`,
      }}
    >
      <div className="pointer-events-none select-none px-2 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {d.name}
        </span>
      </div>
    </div>
  );
}
