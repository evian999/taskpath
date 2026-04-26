/**
 * 从已登录会话拉取完整 AppData，筛选文件夹 algo-todo-list 且带 feat 标签的任务，
 * 批量规范化 createdAt 为 ISO 字符串，再 PATCH 回 /api/data。
 *
 * 用法（PowerShell）：
 *   $env:FLEX_OFF_COOKIE = "flex-off-token=...."   # 从浏览器 DevTools → Application → Cookies 复制
 *   $env:FLEX_OFF_BASE = "https://flex-off-official.vercel.app"   # 可选，默认值即此
 *   node scripts/patch-algo-feat-tasks.mjs --dry-run    # 只看会改几条
 *   node scripts/patch-algo-feat-tasks.mjs              # 实际写入
 *
 * 说明：/api/tasks-http 的 token 只读，不能写库；写操作必须用会话 Cookie 调 /api/data。
 */

const base = (process.env.FLEX_OFF_BASE ?? "https://flex-off-official.vercel.app").replace(
  /\/$/,
  "",
);
const cookie = process.env.FLEX_OFF_COOKIE?.trim();
const dryRun = process.argv.includes("--dry-run");

if (!cookie) {
  console.error(
    "请设置环境变量 FLEX_OFF_COOKIE（例如 flex-off-token=... 整段 Cookie 值）。\n" +
      "tasks-http 的 token 无法用于 PATCH /api/data。",
  );
  process.exit(1);
}

function normalizeCreatedAt(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

async function main() {
  const getRes = await fetch(`${base}/api/data`, {
    headers: { Cookie: cookie },
    credentials: "include",
  });
  if (!getRes.ok) {
    console.error("GET /api/data failed:", getRes.status, await getRes.text());
    process.exit(1);
  }

  const data = await getRes.json();
  const algoFolder = data.folders?.find((f) => f.name === "algo-todo-list");
  const featTag = data.tags?.find((t) => t.name === "feat");
  if (!algoFolder || !featTag) {
    console.error("未找到 algo-todo-list 文件夹或 feat 标签。");
    process.exit(1);
  }

  const folderId = algoFolder.id;
  const featId = featTag.id;
  const tasks = data.tasks ?? [];
  let touched = 0;

  for (const task of tasks) {
    if (task.folderId !== folderId) continue;
    if (!Array.isArray(task.tagIds) || !task.tagIds.includes(featId)) continue;

    const next = normalizeCreatedAt(task.createdAt);
    if (next && task.createdAt !== next) {
      task.createdAt = next;
      touched += 1;
    }
  }

  console.log(
    `algo-todo-list + feat：共检查，规范化 createdAt 有变化：${touched} 条（dry-run=${dryRun}）`,
  );

  if (touched === 0) {
    console.log("无需写入。");
    return;
  }

  if (dryRun) {
    console.log("已跳过 PATCH（--dry-run）。");
    return;
  }

  const patchRes = await fetch(`${base}/api/data`, {
    method: "PATCH",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!patchRes.ok) {
    console.error("PATCH /api/data failed:", patchRes.status, await patchRes.text());
    process.exit(1);
  }
  console.log("PATCH 成功。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
