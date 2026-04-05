import type { Tag } from "./types";

export const TAG_COLOR_PALETTE = [
  "#22d3ee",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#38bdf8",
  "#c084fc",
  "#4ade80",
  "#facc15",
  "#2dd4bf",
  "#818cf8",
] as const;

export function paletteColorForTagIndex(index: number): string {
  return TAG_COLOR_PALETTE[index % TAG_COLOR_PALETTE.length]!;
}

/** 展示用颜色：优先用户自定义，否则按标签在列表中的序号取调色板 */
export function resolveTagColor(tag: Tag, indexInAllTags: number): string {
  if (tag.color?.trim()) return tag.color.trim();
  return paletteColorForTagIndex(indexInAllTags);
}

/**
 * 从输入框文案中解析 `#标签名`（需与已有标签名称匹配，忽略大小写），
 * 返回标题（已去掉匹配到的标签片段）与 tag id 列表。
 */
export function parseTaskDraft(
  draft: string,
  allTags: Tag[],
): { title: string; tagIds: string[] } {
  const byNameLower = new Map<string, string>();
  for (const t of allTags) {
    byNameLower.set(t.name.toLowerCase(), t.id);
  }
  const seen = new Set<string>();
  const tagIds: string[] = [];
  const title = draft.replace(/#([^\s#]+)(\s*)/g, (full, raw: string, sp: string) => {
    const id = byNameLower.get(String(raw).toLowerCase());
    if (id && !seen.has(id)) {
      seen.add(id);
      tagIds.push(id);
      return sp;
    }
    return full;
  });
  return { title: title.replace(/\s+/g, " ").trim(), tagIds };
}
