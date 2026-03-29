"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { INBOX_FOLDER_KEY } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { CompleteTaskDialog } from "@/components/CompleteTaskDialog";
import { ListSidebar } from "@/components/ListSidebar";

export function ListMode() {
  const tasks = useAppStore((s) => s.tasks);
  const folders = useAppStore((s) => s.folders);
  const tags = useAppStore((s) => s.tags);
  const navFolderId = useAppStore((s) => s.navFolderId);
  const navTagId = useAppStore((s) => s.navTagId);
  const addTask = useAppStore((s) => s.addTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const uncompleteTask = useAppStore((s) => s.uncompleteTask);
  const setTaskFolder = useAppStore((s) => s.setTaskFolder);
  const toggleTaskTag = useAppStore((s) => s.toggleTaskTag);
  const [draft, setDraft] = useState("");
  const [completeTarget, setCompleteTarget] = useState<Task | null>(null);

  const sorted = useMemo(() => {
    let list = [...tasks];
    if (navFolderId === "all") {
      /* no folder filter */
    } else if (navFolderId === INBOX_FOLDER_KEY) {
      list = list.filter((t) => !t.folderId);
    } else {
      list = list.filter((t) => t.folderId === navFolderId);
    }
    if (navTagId) {
      list = list.filter((t) => t.tagIds?.includes(navTagId));
    }
    return list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [tasks, navFolderId, navTagId]);

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    addTask(t);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 flex-1">
      <ListSidebar />
      <div className="mx-auto flex min-w-0 max-w-2xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[var(--accent)]"
            placeholder="输入任务，回车或点击添加…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <button
            type="button"
            className="rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-medium text-[var(--bg-deep)] hover:brightness-110"
            onClick={submit}
          >
            添加
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-600">
            当前筛选下暂无任务。可调整左侧文件夹或标签，或新建任务。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((task) => (
              <li
                key={task.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-sm sm:flex-row sm:items-start"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  checked={Boolean(task.completedAt)}
                  onChange={(e) => {
                    if (e.target.checked) setCompleteTarget(task);
                    else uncompleteTask(task.id);
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      task.completedAt
                        ? "text-zinc-500 line-through"
                        : "text-zinc-100"
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-600">
                    {new Date(task.createdAt).toLocaleString()}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                      文件夹
                      <select
                        className="rounded border border-zinc-700/60 bg-[var(--bg-deep)] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-[var(--accent)]"
                        value={task.folderId ?? ""}
                        onChange={(e) =>
                          setTaskFolder(
                            task.id,
                            e.target.value ? e.target.value : undefined,
                          )
                        }
                      >
                        <option value="">收件箱</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="w-full text-[10px] text-zinc-600">
                        标签（点击切换）
                      </span>
                      {tags.map((tg) => {
                        const on = task.tagIds?.includes(tg.id);
                        return (
                          <button
                            key={tg.id}
                            type="button"
                            className={`rounded-full px-2 py-0.5 text-[10px] ring-1 transition-colors ${
                              on
                                ? "bg-fuchsia-500/20 text-fuchsia-200 ring-fuchsia-500/50"
                                : "text-zinc-500 ring-zinc-700 hover:bg-white/5"
                            }`}
                            style={
                              on && tg.color
                                ? {
                                    borderColor: tg.color,
                                    boxShadow: `inset 0 0 0 1px ${tg.color}50`,
                                  }
                                : undefined
                            }
                            onClick={() => toggleTaskTag(task.id, tg.id)}
                          >
                            {tg.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {task.result ? (
                    <p className="mt-2 rounded-md bg-black/25 px-2 py-1.5 text-xs text-zinc-400">
                      <span className="text-zinc-500">结果：</span>
                      {task.result}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 self-start rounded p-2 text-zinc-600 hover:bg-white/5 hover:text-red-400"
                  title="删除"
                  onClick={() => deleteTask(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <CompleteTaskDialog
          task={completeTarget}
          onClose={() => setCompleteTarget(null)}
        />
      </div>
    </div>
  );
}
