/** 从标题中提取 @提及（不含 # 标签语法）；去重、去空 */
export function parseMentionsFromTitle(title: string): string[] {
  const re = /@([^\s#@]+)/gu;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of title.matchAll(re)) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

/** 标题中的 @ 优先，再合并已有 mentions，去重（大小写不敏感） */
export function mergeMentionsFromTitle(
  title: string,
  existing: string[] | undefined,
): string[] | undefined {
  const combined = [...parseMentionsFromTitle(title), ...(existing ?? [])];
  return normalizeMentionList(combined);
}

export function normalizeMentionList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.length ? out : undefined;
}
