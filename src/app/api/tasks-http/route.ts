import { NextResponse } from "next/server";
import { loadAppDataForUser } from "@/lib/load-user-app-data";
import { findUserIdByTaskHttpToken } from "@/lib/task-http-resolve-user";
import type { AppData, Task } from "@/lib/types";

function buildTasksHttpPayload(data: AppData) {
  const folderById = new Map(data.folders.map((f) => [f.id, f]));
  const tagById = new Map(data.tags.map((tg) => [tg.id, tg]));

  function folderNameForTask(t: Task): string {
    if (!t.folderId) return "收件箱";
    return folderById.get(t.folderId)?.name ?? t.folderId;
  }

  function tagNamesForTask(t: Task): string[] {
    const ids = t.tagIds ?? [];
    return ids.map((id) => tagById.get(id)?.name ?? id);
  }

  const tasks = data.tasks.map((t) => ({
    ...t,
    folderName: folderNameForTask(t),
    tagNames: tagNamesForTask(t),
  }));

  return {
    tasks,
    folders: data.folders,
    tags: data.tags,
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function extractToken(request: Request): string | null {
  const url = new URL(request.url);
  const q = url.searchParams.get("token");
  if (q && q.trim()) return q.trim();
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    return t || null;
  }
  return null;
}

/**
 * 仅读：返回任务 + 文件夹/标签目录，并在每条任务上附带 folderName、tagNames（便于按名称筛选）
 * 调用示例：GET /api/tasks-http?token=xxx
 * 或：Authorization: Bearer xxx
 */
export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "缺少 token（query ?token= 或 Authorization: Bearer）" },
      { status: 401, headers: corsHeaders() },
    );
  }

  try {
    const userId = await findUserIdByTaskHttpToken(token);
    if (!userId) {
      return NextResponse.json(
        { error: "无效 token 或未开启 API" },
        { status: 401, headers: corsHeaders() },
      );
    }

    const data = await loadAppDataForUser(userId);
    const th = data.preferences?.taskHttpApi;
    if (!th?.enabled || th.token !== token) {
      return NextResponse.json(
        { error: "API 已关闭或 token 已轮换" },
        { status: 401, headers: corsHeaders() },
      );
    }

    const payload = buildTasksHttpPayload(data);

    return NextResponse.json(
      {
        ...payload,
        fetchedAt: new Date().toISOString(),
      },
      { headers: corsHeaders() },
    );
  } catch (e) {
    console.error("[api/tasks-http]", e);
    return NextResponse.json(
      { error: "服务器加载数据失败" },
      { status: 503, headers: corsHeaders() },
    );
  }
}
