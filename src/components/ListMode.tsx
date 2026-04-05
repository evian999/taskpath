"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { Task, TaskPriority } from "@/lib/types";
import { INBOX_FOLDER_KEY } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { CompleteTaskDialog } from "@/components/CompleteTaskDialog";
import { ListSidebar } from "@/components/ListSidebar";
import { TagBadge } from "@/components/TagBadge";
import { TagHashTextInput } from "@/components/TagHashTextInput";
import { TaskPriorityMenu } from "@/components/TaskPriorityMenu";
import { parseTaskDraft } from "@/lib/tag-draft";
import { listCheckboxStyle } from "@/lib/task-priority-ui";

export function ListMode() {
  const tasks = useAppStore((s) => s.tasks);
  const folders = useAppStore((s) => s.folders);
  const tags = useAppStore((s) => s.tags);
  const navFolderId = useAppStore((s) => s.navFolderId);
  const navTagId = useAppStore((s) => s.navTagId);
  const addTask = useAppStore((s) => s.addTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const uncompleteTask = useAppStore((s) => s.uncompleteTask);
  const setTaskFolder = useAppStore((s) => s.setTaskFolder);
  const toggleTaskTag = useAppStore((s) => s.toggleTaskTag);
  const [draft, setDraft] = useState("");
  const [draftPriority, setDraftPriority] = useState<
    TaskPriority | undefined
  >(undefined);
  const [tagPickerTaskId, setTagPickerTaskId] = useState<string | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Task | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitleDraft, setTaskTitleDraft] = useState("");
  const [completedOpen, setCompletedOpen] = useState(false);

  const newFirst = (a: Task, b: Task) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  const filtered = useMemo(() => {
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
    return list;
  }, [tasks, navFolderId, navTagId]);

  const incompleteTasks = useMemo(
    () => filtered.filter((t) => !t.completedAt).sort(newFirst),
    [filtered],
  );

  const completedTasks = useMemo(
    () => filtered.filter((t) => Boolean(t.completedAt)).sort(newFirst),
    [filtered],
  );

  const submit = () => {
    const { title, tagIds } = parseTaskDraft(draft, tags);
    if (!title && tagIds.length === 0) return;
    addTask(title || "未命名任务", undefined, {
      tagIds: tagIds.length ? tagIds : undefined,
      ...(draftPriority !== undefined ? { priority: draftPriority } : {}),
    });
    setDraft("");
  };

  const taskRow = (task: Task) => (
    <li
      key={task.id}
      className="flex flex-col gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-sm sm:flex-row sm:items-start"
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-2 appearance-none transition-colors"
        style={listCheckboxStyle(Boolean(task.completedAt), task.priority)}
        title={
          task.priority === undefined
            ? "未完成（无优先级）"
            : "未完成时边框颜色表示优先级（红/黄/蓝=高/中/低）"
        }
        checked={Boolean(task.completedAt)}
        onChange={(e) => {
          if (e.target.checked) setCompleteTarget(task);
          else uncompleteTask(task.id);
        }}
      />
      <div className="min-w-0 flex-1">
        {editingTaskId === task.id ? (
          <input
            className="w-full rounded-md border border-[var(--accent)] bg-[var(--bg-deep)] px-2 py-1.5 text-sm text-zinc-100 outline-none"
            value={taskTitleDraft}
            onChange={(e) => setTaskTitleDraft(e.target.value)}
            autoFocus
            onBlur={() => {
              const t = taskTitleDraft.trim();
              if (t) updateTask(task.id, { title: t });
              setEditingTaskId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setEditingTaskId(null);
              }
            }}
          />
        ) : (
          <p
            className={`text-sm font-medium ${
              task.completedAt
                ? "text-zinc-500 line-through"
                : "text-zinc-100"
            }`}
          >
            {task.title}
          </p>
        )}
        <p className="mt-0.5 text-xs text-zinc-600">
          {new Date(task.createdAt).toLocaleString()}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
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
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(task.tagIds ?? [])
            .map((id) => tags.find((t) => t.id === id))
            .filter(Boolean)
            .map((tg) => (
              <TagBadge
                key={tg!.id}
                tag={tg!}
                tagIndex={tags.findIndex((x) => x.id === tg!.id)}
                onRemove={() => toggleTaskTag(task.id, tg!.id)}
              />
            ))}
          {tags.some((t) => !task.tagIds?.includes(t.id)) ? (
            <div className="relative">
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-zinc-600 text-zinc-500 hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
                title="添加标签"
                onClick={() =>
                  setTagPickerTaskId((id) =>
                    id === task.id ? null : task.id,
                  )
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              {tagPickerTaskId === task.id ? (
                <div
                  className="absolute left-0 top-full z-20 mt-1 max-h-40 min-w-[8rem] overflow-y-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] py-1 shadow-lg"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {tags
                    .filter((t) => !task.tagIds?.includes(t.id))
                    .map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="block w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-white/10"
                        onClick={() => {
                          toggleTaskTag(task.id, t.id);
                          setTagPickerTaskId(null);
                        }}
                      >
                        {t.name}
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {task.result ? (
          <p className="mt-2 rounded-md bg-black/25 px-2 py-1.5 text-xs text-zinc-400">
            <span className="text-zinc-500">结果：</span>
            {task.result}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-0.5 self-start sm:flex-row">
        <button
          type="button"
          className="rounded p-2 text-zinc-600 hover:bg-white/5 hover:text-[var(--accent)]"
          title="编辑标题"
          onClick={() => {
            setEditingTaskId(task.id);
            setTaskTitleDraft(task.title);
          }}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded p-2 text-zinc-600 hover:bg-white/5 hover:text-red-400"
          title="删除"
          onClick={() => deleteTask(task.id)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );

  return (
    <div className="flex min-h-0 flex-1">
      <ListSidebar />
      <div className="mx-auto flex min-w-0 max-w-2xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="flex min-w-0 flex-1 items-stretch gap-2">
            {/*
              勿对整块使用 overflow-hidden，否则会裁切优先级下拉与 # 标签建议列表
            */}
            <div className="flex min-w-0 flex-1 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-sm focus-within:border-[var(--accent)]">
              <TaskPriorityMenu
                value={draftPriority}
                onChange={setDraftPriority}
              />
              <TagHashTextInput
                className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                placeholder="请输入任务…（用 # 选择标签，回车或点右侧添加）"
                value={draft}
                onChange={setDraft}
                tags={tags}
                onInputKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-medium text-[var(--bg-deep)] hover:brightness-110"
              onClick={submit}
            >
              添加
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-600">
            当前筛选下暂无任务。可调整左侧文件夹或标签，或新建任务。
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {incompleteTasks.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {incompleteTasks.map(taskRow)}
              </ul>
            ) : null}
            {completedTasks.length > 0 ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setCompletedOpen((o) => !o)}
                  className="flex w-full items-center gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-left text-sm font-medium text-zinc-200 shadow-sm hover:border-[var(--accent)]/40"
                >
                  {completedOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                  )}
                  <span>已完成</span>
                  <span className="text-xs font-normal text-zinc-500">
                    （{completedTasks.length}）
                  </span>
                </button>
                {completedOpen ? (
                  <ul className="flex flex-col gap-2">
                    {completedTasks.map(taskRow)}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <CompleteTaskDialog
          task={completeTarget}
          onClose={() => setCompleteTarget(null)}
        />
      </div>
    </div>
  );
}
