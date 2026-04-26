import type {
  AppData,
  Folder,
  LayoutState,
  Rect,
  Tag,
  Task,
  TaskGroup,
  TodoEdge,
  Vec2,
} from "@/lib/types";
import { normalizeMentionList } from "@/lib/mentions";
import { parseAppData } from "@/lib/validate";
import { getSupabaseAdmin } from "./admin";
import { saveTaskHttpPrefsToSupabase } from "./task-http-prefs";

type FolderRow = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
};
type TagRow = { id: string; user_id: string; name: string; color: string | null };
type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  completed_at: string | null;
  result: string | null;
  folder_id: string | null;
  priority: string | null;
  due_at: string | null;
  progress_current: number | null;
  progress_total: number | null;
  abandoned_at: string | null;
  abandon_reason: string | null;
  spaced_repetition_enabled: boolean | null;
  mentions: unknown;
};
type TaskTagRow = { task_id: string; tag_id: string };
type GroupRow = { id: string; user_id: string; name: string };
type GroupTaskRow = { group_id: string; task_id: string; sort_order: number };
type EdgeRow = {
  id: string;
  user_id: string;
  source_task_id: string;
  target_task_id: string;
  label: string | null;
};
type PosRow = { task_id: string; x: number; y: number };
type GroupRectRow = {
  group_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};
type FolderRectRow = {
  folder_key: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** 从关系表组装为应用使用的 AppData，并走 parseAppData 规范化 */
export async function loadAppDataFromSupabase(
  userId: string,
): Promise<AppData> {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase not configured");

  const { data: folderRows, error: e1 } = await sb
    .from("folders")
    .select("id,user_id,name,color")
    .eq("user_id", userId);
  if (e1) throw e1;

  const { data: tagRows, error: e2 } = await sb
    .from("tags")
    .select("id,user_id,name,color")
    .eq("user_id", userId);
  if (e2) throw e2;

  const { data: taskRows, error: e3 } = await sb
    .from("tasks")
    .select(
      "id,user_id,title,created_at,completed_at,result,folder_id,priority,due_at,progress_current,progress_total,abandoned_at,abandon_reason,spaced_repetition_enabled,mentions",
    )
    .eq("user_id", userId);
  if (e3) throw e3;

  const taskIds = (taskRows as TaskRow[] | null)?.map((t) => t.id) ?? [];
  let taskTagRows: TaskTagRow[] = [];
  if (taskIds.length > 0) {
    const { data: tt, error: e4 } = await sb
      .from("task_tags")
      .select("task_id,tag_id")
      .in("task_id", taskIds);
    if (e4) throw e4;
    taskTagRows = (tt as TaskTagRow[]) ?? [];
  }

  const tagByTask = new Map<string, string[]>();
  for (const r of taskTagRows) {
    const cur = tagByTask.get(r.task_id) ?? [];
    cur.push(r.tag_id);
    tagByTask.set(r.task_id, cur);
  }

  const tasks: Task[] = ((taskRows as TaskRow[]) ?? []).map((r) => {
    const tagIds = tagByTask.get(r.id);
    const pr = r.priority?.trim();
    const priority =
      pr === "high" || pr === "medium" || pr === "low" ? pr : undefined;
    const pc =
      r.progress_current != null && Number.isFinite(r.progress_current)
        ? Math.max(0, Math.round(r.progress_current))
        : undefined;
    const pt =
      r.progress_total != null && Number.isFinite(r.progress_total)
        ? Math.max(0, Math.round(r.progress_total))
        : undefined;
    const mentions = normalizeMentionList(r.mentions);
    return {
      id: r.id,
      title: r.title,
      createdAt: r.created_at,
      ...(r.completed_at ? { completedAt: r.completed_at } : {}),
      ...(r.due_at ? { dueAt: r.due_at } : {}),
      ...(pc !== undefined ? { progressCurrent: pc } : {}),
      ...(pt !== undefined ? { progressTotal: pt } : {}),
      ...(r.abandoned_at ? { abandonedAt: r.abandoned_at } : {}),
      ...(r.abandon_reason ? { abandonReason: r.abandon_reason } : {}),
      ...(r.spaced_repetition_enabled === true
        ? { spacedRepetitionEnabled: true }
        : {}),
      ...(mentions ? { mentions } : {}),
      ...(r.result ? { result: r.result } : {}),
      ...(r.folder_id ? { folderId: r.folder_id } : {}),
      ...(tagIds?.length ? { tagIds } : {}),
      ...(priority ? { priority } : {}),
    };
  });

  const folders: Folder[] = ((folderRows as FolderRow[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    ...(r.color ? { color: r.color } : {}),
  }));

  const tags: Tag[] = ((tagRows as TagRow[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    ...(r.color ? { color: r.color } : {}),
  }));

  const { data: groupRows, error: e5 } = await sb
    .from("task_groups")
    .select("id,user_id,name")
    .eq("user_id", userId);
  if (e5) throw e5;

  const groupIds = (groupRows as GroupRow[] | null)?.map((g) => g.id) ?? [];
  let gtRows: GroupTaskRow[] = [];
  if (groupIds.length > 0) {
    const { data: gt, error: e6 } = await sb
      .from("task_group_tasks")
      .select("group_id,task_id,sort_order")
      .in("group_id", groupIds);
    if (e6) throw e6;
    gtRows = (gt as GroupTaskRow[]) ?? [];
  }

  const byGroup = new Map<string, GroupTaskRow[]>();
  for (const r of gtRows) {
    const arr = byGroup.get(r.group_id) ?? [];
    arr.push(r);
    byGroup.set(r.group_id, arr);
  }
  const taskIdsByGroup = new Map<string, string[]>();
  for (const [gid, arr] of byGroup) {
    arr.sort((a, b) => a.sort_order - b.sort_order);
    taskIdsByGroup.set(
      gid,
      arr.map((x) => x.task_id),
    );
  }

  const groups: TaskGroup[] = ((groupRows as GroupRow[]) ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    taskIds: taskIdsByGroup.get(g.id) ?? [],
  }));

  const { data: edgeRows, error: e7 } = await sb
    .from("task_edges")
    .select("id,user_id,source_task_id,target_task_id,label")
    .eq("user_id", userId);
  if (e7) throw e7;

  const edges: TodoEdge[] = ((edgeRows as EdgeRow[]) ?? []).map((r) => ({
    id: r.id,
    source: r.source_task_id,
    target: r.target_task_id,
    ...(r.label ? { label: r.label } : {}),
  }));

  const { data: posRows, error: e8 } = await sb
    .from("layout_task_positions")
    .select("task_id,x,y")
    .eq("user_id", userId);
  if (e8) throw e8;

  const positions: Record<string, Vec2> = {};
  for (const r of (posRows as PosRow[]) ?? []) {
    positions[r.task_id] = { x: r.x, y: r.y };
  }

  const { data: grRows, error: e9 } = await sb
    .from("layout_group_rects")
    .select("group_id,x,y,w,h")
    .eq("user_id", userId);
  if (e9) throw e9;

  const groupRects: Record<string, Rect> = {};
  for (const r of (grRows as GroupRectRow[]) ?? []) {
    groupRects[r.group_id] = { x: r.x, y: r.y, w: r.w, h: r.h };
  }

  const { data: frRows, error: e10 } = await sb
    .from("layout_folder_rects")
    .select("folder_key,x,y,w,h")
    .eq("user_id", userId);
  if (e10) throw e10;

  const folderRects: Record<string, Rect> = {};
  for (const r of (frRows as FolderRectRow[]) ?? []) {
    folderRects[r.folder_key] = { x: r.x, y: r.y, w: r.w, h: r.h };
  }

  const layout: LayoutState = {
    positions,
    groupRects,
    folderRects,
  };

  const raw = {
    tasks,
    edges,
    groups,
    folders,
    tags,
    layout,
  };

  return parseAppData(raw);
}

export async function saveAppDataToSupabase(
  userId: string,
  data: AppData,
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase not configured");

  const payload = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;

  const { error } = await sb.rpc("replace_user_app_data", {
    p_user_id: userId,
    p_data: payload,
  });

  if (error) throw error;

  try {
    await saveTaskHttpPrefsToSupabase(userId, data.preferences?.taskHttpApi);
  } catch (e) {
    console.error(
      "[saveAppDataToSupabase] task http prefs failed（若未执行 002 迁移可忽略）:",
      e,
    );
  }
}
