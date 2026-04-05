"use client";

import { X } from "lucide-react";
import type { Tag } from "@/lib/types";
import { resolveTagColor } from "@/lib/tag-draft";

type TagBadgeProps = {
  tag: Tag;
  tagIndex: number;
  onRemove?: () => void;
  title?: string;
};

export function TagBadge({ tag, tagIndex, onRemove, title }: TagBadgeProps) {
  const c = resolveTagColor(tag, tagIndex);
  const style = {
    color: c,
    backgroundColor: `${c}22`,
    boxShadow: `inset 0 0 0 1px ${c}55`,
  } as const;
  const baseClass =
    "inline-block max-w-full truncate rounded-full py-0.5 pl-2 text-[10px] font-medium";

  if (onRemove) {
    return (
      <span className="group/tag relative inline-flex max-w-full items-start align-middle">
        <span
          className={`${baseClass} pr-5`}
          style={style}
          title={title ?? `标签：${tag.name}`}
        >
          {tag.name}
        </span>
        <button
          type="button"
          className="absolute -right-1 -top-1 z-[1] flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-zinc-200 opacity-0 shadow-sm transition-opacity hover:bg-red-500/90 hover:text-white group-hover/tag:opacity-100"
          title="移除标签"
          aria-label={`移除标签 ${tag.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-2.5 w-2.5" strokeWidth={2.5} />
        </button>
      </span>
    );
  }

  return (
    <span className={`${baseClass} px-2`} style={style} title={title}>
      {tag.name}
    </span>
  );
}
