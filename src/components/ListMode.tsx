"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore,
  ArrowUpToLine,
  Ban,
  ChevronDown,
  ChevronRight,
  PanelLeftOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { Task, TaskPriority, TodoEdge } from "@/lib/types";
import {
  ARCHIVE_FOLDER_KEY,
  INBOX_FOLDER_KEY,
  RECENT_DELETED_FOLDER_KEY,
  taskFolderKey,
} from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { AbandonTaskDialog } from "@/components/AbandonTaskDialog";
import { CompleteTaskDialog } from "@/components/CompleteTaskDialog";
import { ListSidebar } from "@/components/ListSidebar";
import { TagBadge } from "@/components/TagBadge";
import { TagHashTextInput } from "@/components/TagHashTextInput";
import { TaskPriorityMenu } from "@/components/TaskPriorityMenu";
import {
  listUnknownHashTagNamesInDraft,
  parseTaskDraft,
} from "@/lib/tag-draft";
import { normalizeMentionList } from "@/lib/mentions";
import { listCheckboxStyle } from "@/lib/task-priority-ui";
import { useListUiPrefs } from "@/hooks/useListUiPrefs";

const NEXT_TASK_PREVIEW_MAX = 10;

/** 下一任务按钮展示：最多约 10 个字（按 Unicode 字素），超出加省略号 */
function nextTaskPreviewLabel(title: string): string {
  const raw = title.trim() || "未命名";
  const g = Array.from(raw);
  if (g.length <= NEXT_TASK_PREVIEW_MAX) return g.join("");
  return g.slice(0, NEXT_TASK_PREVIEW_MAX).join("") + "…";
}

function findNextTaskFromEdges(
  task: Task,
  edges: TodoEdge[],
  incompleteTasks: Task[],
  completedTasks: Task[],
): { next: Task; serial: number } | undefined {
  const outs = edges.filter((e) => e.source === task.id);
  for (const e of outs) {
    const incIdx = incompleteTasks.findIndex((t) => t.id === e.target);
    if (incIdx >= 0)
      return { next: incompleteTasks[incIdx]!, serial: incIdx + 1 };
    const compIdx = completedTasks.findIndex((t) => t.id === e.target);
    if (compIdx >= 0)
      return { next: completedTasks[compIdx]!, serial: compIdx + 1 };
  }
  return undefined;
}

export function ListMode() {
  const tasks = useAppStore((s) => s.tasks);
  const edges = useAppStore((s) => s.edges);
  const folders = useAppStore((s) => s.folders);
  const tags = useAppStore((s) => s.tags);
  const navFolderId = useAppStore((s) => s.navFolderId);
  const navTagId = useAppStore((s) => s.navTagId);
  const navMention = useAppStore((s) => s.navMention);
  const listSearchQuery = useAppStore((s) => s.listSearchQuery);
  const addTask = useAppStore((s) => s.addTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const restoreTaskFromTrash = useAppStore((s) => s.restoreTaskFromTrash);
  const updateTask = useAppStore((s) => s.updateTask);
  const uncompleteTask = useAppStore((s) => s.uncompleteTask);
  const setTaskFolder = useAppStore((s) => s.setTaskFolder);
  const toggleTaskTag = useAppStore((s) => s.toggleTaskTag);
  const addTag = useAppStore((s) => s.addTag);
  const addEdge = useAppStore((s) => s.addEdge);
  const [draft, setDraft] = useState("");
  const [draftPriority, setDraftPriority] = useState<
    TaskPriority | undefined
  >(undefined);
  const [tagPickerTaskId, setTagPickerTaskId] = useState<string | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Task | null>(null);
  const [abandonTarget, setAbandonTarget] = useState<Task | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitleDraft, setTaskTitleDraft] = useState("");
  const [completedOpen, setCompletedOpen] = useState(false);
  const [flashTaskId, setFlashTaskId] = useState<string | null>(null);
  const [editingResultTaskId, setEditingResultTaskId] = useState<string | null>(
    null,
  );
  const [resultEditDraft, setResultEditDraft] = useState("");
  const [mentionInputTaskId, setMentionInputTaskId] = useState<string | null>(
    null,
  );
  const [mentionInputValue, setMentionInputValue] = useState("");
  const skipNextTitleBlurSave = useRef(false);
  const taskCardRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [showListScrollTop, setShowListScrollTop] = useState(false);
  const flashClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const { prefs: listUi, patch: patchListUi } = useListUiPrefs();

  const triggerTaskFlash = useCallback((taskId: string) => {
    if (flashClearTimeoutRef.current) {
      clearTimeout(flashClearTimeoutRef.current);
    }
    setFlashTaskId(taskId);
    flashClearTimeoutRef.current = setTimeout(() => {
      setFlashTaskId(null);
      flashClearTimeoutRef.current = null;
    }, 1400);
  }, []);

  const jumpToTask = useCallback(
    (target: Task) => {
      const needOpenCompleted =
        Boolean(target.completedAt || target.abandonedAt) && !completedOpen;
      if (needOpenCompleted) {
        setCompletedOpen(true);
      }
      window.setTimeout(
        () => {
          const el = taskCardRefs.current.get(target.id);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          triggerTaskFlash(target.id);
        },
        needOpenCompleted ? 200 : 0,
      );
    },
    [completedOpen, triggerTaskFlash],
  );

  /** 创建时间倒序：新任务在上；序号与「下一任务」均按当前列表自上而下 */
  const newFirst = (a: Task, b: Task) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (navFolderId === "all") {
      list = list.filter((t) => t.folderId !== RECENT_DELETED_FOLDER_KEY);
    } else if (navFolderId === INBOX_FOLDER_KEY) {
      list = list.filter((t) => !t.folderId);
    } else if (navFolderId === ARCHIVE_FOLDER_KEY) {
      list = list.filter((t) => t.folderId === ARCHIVE_FOLDER_KEY);
    } else if (navFolderId === RECENT_DELETED_FOLDER_KEY) {
      list = list.filter((t) => t.folderId === RECENT_DELETED_FOLDER_KEY);
    } else {
      list = list.filter((t) => t.folderId === navFolderId);
    }
    if (navTagId) {
      list = list.filter((t) => t.tagIds?.includes(navTagId));
    }
    if (navMention) {
      list = list.filter((t) =>
        t.mentions?.some((m) => m.toLowerCase() === navMention),
      );
    }
    const q = listSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        if (t.title.toLowerCase().includes(q)) return true;
        if (t.result?.toLowerCase().includes(q)) return true;
        for (const tid of t.tagIds ?? []) {
          const name = tags.find((x) => x.id === tid)?.name;
          if (name?.toLowerCase().includes(q)) return true;
        }
        for (const m of t.mentions ?? []) {
          if (m.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
    return list;
  }, [tasks, navFolderId, navTagId, navMention, listSearchQuery, tags]);

  const commitMentionInput = (task: Task) => {
    const raw = mentionInputValue.trim().replace(/^@+/, "");
    if (raw) {
      const next = normalizeMentionList([
        ...(task.mentions ?? []),
        raw,
      ]);
      updateTask(task.id, { mentions: next });
    }
    setMentionInputTaskId(null);
    setMentionInputValue("");
  };

  const incompleteTasks = useMemo(
    () =>
      filtered.filter((t) => !t.completedAt && !t.abandonedAt).sort(newFirst),
    [filtered],
  );

  const completedTasks = useMemo(
    () =>
      filtered
        .filter((t) => Boolean(t.completedAt || t.abandonedAt))
        .sort(newFirst),
    [filtered],
  );

  const nextFromEdges = useCallback(
    (task: Task) =>
      findNextTaskFromEdges(task, edges, incompleteTasks, completedTasks),
    [edges, incompleteTasks, completedTasks],
  );

  const inTrashNav = navFolderId === RECENT_DELETED_FOLDER_KEY;

  const submit = () => {
    if (inTrashNav) return;
    for (const name of listUnknownHashTagNamesInDraft(
      draft,
      useAppStore.getState().tags,
    )) {
      addTag(name);
    }
    const { title, tagIds } = parseTaskDraft(
      draft,
      useAppStore.getState().tags,
    );
    if (!title && tagIds.length === 0) return;
    addTask(title || "未命名任务", undefined, {
      tagIds: tagIds.length ? tagIds : undefined,
      ...(draftPriority !== undefined ? { priority: draftPriority } : {}),
    });
    setDraft("");
  };

  const taskRow = (
    task: Task,
    serial: number,
    nextInList?: Task,
    nextSerial?: number,
  ) => (
    <li
      key={task.id}
      id={`list-task-${task.id}`}
      ref={(el) => {
        if (el) taskCardRefs.current.set(task.id, el);
        else taskCardRefs.current.delete(task.id);
      }}
      className={`flex flex-col gap-2 border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)] p-4 md-corner-md sm:flex-row sm:items-start ${
        flashTaskId === task.id ? "list-task-target-flash" : ""
      }`}
      style={{ boxShadow: "var(--md-sys-elevation-shadow-1)" }}
    >
      <span
        className="mt-0.5 w-7 shrink-0 text-right tabular-nums md-type-body-s text-md-on-surface-variant sm:mt-1"
        title="列表序号（自上而下；新任务在上）"
      >
        {serial}.
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-2 appearance-none transition-colors"
        style={listCheckboxStyle(
          Boolean(task.completedAt),
          task.priority,
          Boolean(task.abandonedAt),
        )}
        title={
          task.abandonedAt
            ? "已放弃（×）"
            : task.completedAt
              ? "已完成"
              : task.priority === undefined
                ? "未完成（无优先级）"
                : "未完成时边框颜色表示优先级（红/黄/蓝=高/中/低）"
        }
        checked={Boolean(task.completedAt || task.abandonedAt)}
        onChange={(e) => {
          if (e.target.checked) {
            if (task.folderId === RECENT_DELETED_FOLDER_KEY) return;
            setCompleteTarget(task);
          } else uncompleteTask(task.id);
        }}
      />
      <div className="min-w-0 flex-1">
        {editingTaskId === task.id ? (
          <div className="relative w-full min-w-0">
            <TagHashTextInput
              className="md-field md-focus-ring w-full px-2 py-1.5 md-type-body-m"
              placeholder="标题…（用 # 选择标签，回车结束编辑）"
              value={taskTitleDraft}
              onChange={setTaskTitleDraft}
              tags={tags}
              suggestAbove
              autoFocus
              onInputBlur={() => {
                if (skipNextTitleBlurSave.current) {
                  skipNextTitleBlurSave.current = false;
                  return;
                }
                if (editingTaskId !== task.id) return;
                const { title, tagIds: fromHash } = parseTaskDraft(
                  taskTitleDraft,
                  tags,
                );
                const nextTitle = title.trim() ? title : "未命名任务";
                const mergedIds = [
                  ...new Set([...(task.tagIds ?? []), ...fromHash]),
                ];
                updateTask(task.id, {
                  title: nextTitle,
                  tagIds: mergedIds.length > 0 ? mergedIds : undefined,
                });
                setEditingTaskId(null);
              }}
              onInputKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  skipNextTitleBlurSave.current = true;
                  setEditingTaskId(null);
                }
              }}
            />
          </div>
        ) : (
          <p
            className={`md-type-body-m font-medium ${
              task.completedAt || task.abandonedAt
                ? "text-md-on-surface-variant line-through"
                : "text-md-on-surface"
            }`}
          >
            {task.title}
          </p>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 md-type-body-s text-md-on-surface-variant">
          <span title="创建时间">
            创建 {new Date(task.createdAt).toLocaleString()}
          </span>
          {task.dueAt ? (
            <label className="inline-flex items-center gap-1">
              <span>截止</span>
              <input
                type="datetime-local"
                className="md-field md-focus-ring max-w-[11rem] rounded px-1 py-0.5 md-type-body-s"
                value={
                  task.dueAt.includes("T")
                    ? task.dueAt.slice(0, 16)
                    : task.dueAt.slice(0, 10) + "T00:00"
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    updateTask(task.id, { dueAt: undefined });
                    return;
                  }
                  const iso = new Date(v).toISOString();
                  updateTask(task.id, { dueAt: iso });
                }}
              />
            </label>
          ) : !task.completedAt && !task.abandonedAt ? (
            <button
              type="button"
              className="text-md-primary underline-offset-2 hover:underline md-focus-ring rounded-sm"
              onClick={() =>
                updateTask(task.id, {
                  dueAt: new Date(Date.now() + 86400000).toISOString(),
                })
              }
            >
              + 截止时间
            </button>
          ) : null}
        </div>
        {!task.completedAt && !task.abandonedAt ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 md-type-body-s">
            <label className="inline-flex items-center gap-1.5">
              <span className="text-md-on-surface-variant">进度</span>
              <input
                type="number"
                min={0}
                className="md-field w-14 rounded px-1 py-0.5 text-center"
                value={task.progressCurrent ?? ""}
                placeholder="0"
                onChange={(e) => {
                  const v = e.target.value;
                  updateTask(task.id, {
                    progressCurrent: v === "" ? undefined : Math.max(0, Number(v)),
                  });
                }}
              />
              <span>/</span>
              <input
                type="number"
                min={0}
                className="md-field w-14 rounded px-1 py-0.5 text-center"
                value={task.progressTotal ?? ""}
                placeholder="—"
                onChange={(e) => {
                  const v = e.target.value;
                  updateTask(task.id, {
                    progressTotal: v === "" ? undefined : Math.max(0, Number(v)),
                  });
                }}
              />
            </label>
            {task.progressTotal != null &&
            task.progressTotal > 0 &&
            task.progressCurrent != null ? (
              <div
                className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-[var(--md-sys-color-surface-container-highest)]"
                title="完成进度"
              >
                <div
                  className="h-full bg-md-primary transition-[width]"
                  style={{
                    width: `${Math.min(100, Math.round((task.progressCurrent / task.progressTotal) * 100))}%`,
                  }}
                />
              </div>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-md-primary"
                checked={task.spacedRepetitionEnabled === true}
                onChange={(e) =>
                  updateTask(task.id, {
                    spacedRepetitionEnabled: e.target.checked ? true : undefined,
                  })
                }
              />
              <span className="text-md-on-surface-variant">间隔重复</span>
            </label>
          </div>
        ) : null}
        <div className="mt-2 flex min-w-0 flex-col gap-2 md:flex-row md:flex-nowrap md:items-center md:gap-0">
          {task.folderId === RECENT_DELETED_FOLDER_KEY ? (
            <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 md-type-label-m">
              <span className="text-md-on-surface-variant">最近删除的任务</span>
              <button
                type="button"
                className="md-btn-tonal md-focus-ring inline-flex items-center gap-1 px-2 py-1 md-type-body-s"
                title="恢复到删除前所在文件夹"
                onClick={() => restoreTaskFromTrash(task.id)}
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
                恢复
              </button>
            </div>
          ) : (
            <label className="flex min-w-0 max-w-full shrink-0 items-center gap-1 md-type-label-m">
              文件夹
              <select
                className="md-field md-focus-ring px-2 py-1 md-type-body-s text-md-on-surface md-corner-sm"
                value={task.folderId ?? ""}
                onChange={(e) =>
                  setTaskFolder(
                    task.id,
                    e.target.value ? e.target.value : undefined,
                  )
                }
              >
                <option value="">收件箱</option>
                <option value={ARCHIVE_FOLDER_KEY}>归档</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-1 border-t border-[var(--md-sys-color-outline)] pt-2 md:border-l md:border-t-0 md:pl-3 md:pt-0 md-type-body-s">
            <span className="shrink-0 text-md-on-surface-variant">下一个任务</span>
            {nextInList && nextSerial != null ? (
              <>
                <span
                  className="shrink-0 tabular-nums text-md-on-surface"
                  title="下一任务在列表中的序号"
                >
                  {nextSerial}
                </span>
                <button
                  type="button"
                  className="min-w-0 max-w-[11em] overflow-hidden text-ellipsis whitespace-nowrap text-left text-md-primary underline-offset-2 hover:underline md-focus-ring rounded-sm"
                  title={nextInList.title}
                  onClick={() => jumpToTask(nextInList)}
                >
                  {nextTaskPreviewLabel(nextInList.title)}
                </button>
                {editingTaskId !== nextInList.id ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-sm p-1 text-md-on-surface-variant md-state-hover-subtle hover:text-md-primary md-focus-ring"
                    title="编辑下一任务标题"
                    onClick={() => {
                      skipNextTitleBlurSave.current = false;
                      setEditingTaskId(nextInList.id);
                      setTaskTitleDraft(nextInList.title);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </>
            ) : (
              <span className="shrink-0 text-md-on-surface-variant">—</span>
            )}
          </div>
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
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-[var(--md-sys-color-outline)] text-md-on-surface-variant hover:border-md-primary/50 hover:text-md-primary md-focus-ring"
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
                  className="absolute left-0 top-full z-20 mt-1 max-h-40 min-w-[8rem] overflow-y-auto border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)] py-1 md-corner-md shadow-lg"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {tags
                    .filter((t) => !task.tagIds?.includes(t.id))
                    .map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="block w-full px-3 py-1.5 text-left md-type-body-s text-md-on-surface md-state-hover"
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
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(task.mentions ?? []).map((m) => (
            <span
              key={m}
              className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-[var(--md-sys-color-secondary-container)]/35 px-2 py-0.5 md-type-label-m text-md-on-surface"
            >
              <span className="min-w-0 truncate">@{m}</span>
              <button
                type="button"
                className="shrink-0 rounded-full p-0.5 text-md-on-surface-variant hover:bg-black/10 md-focus-ring"
                title="移除此人"
                onClick={() => {
                  const next = (task.mentions ?? []).filter(
                    (x) => x.toLowerCase() !== m.toLowerCase(),
                  );
                  updateTask(task.id, {
                    mentions: next.length ? next : undefined,
                  });
                }}
              >
                ×
              </button>
            </span>
          ))}
          {mentionInputTaskId === task.id ? (
            <input
              className="md-field md-focus-ring w-28 px-2 py-0.5 md-type-body-s"
              placeholder="@名字"
              value={mentionInputValue}
              autoFocus
              onChange={(e) => setMentionInputValue(e.target.value)}
              onBlur={() => commitMentionInput(task)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitMentionInput(task);
                }
                if (e.key === "Escape") {
                  setMentionInputTaskId(null);
                  setMentionInputValue("");
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="inline-flex h-6 items-center rounded-full border border-dashed border-[var(--md-sys-color-outline)] px-2 md-type-label-m text-md-on-surface-variant hover:border-md-primary/50 hover:text-md-primary md-focus-ring"
              title="添加 @提及"
              onClick={() => {
                setMentionInputTaskId(task.id);
                setMentionInputValue("");
              }}
            >
              + @
            </button>
          )}
        </div>
        {task.abandonedAt ? (
          <div className="mt-2 md-corner-sm border border-amber-800/50 bg-amber-950/25 px-2 py-1.5 md-type-body-s">
            <span className="text-md-on-surface-variant">放弃原因</span>
            <p className="mt-1 whitespace-pre-wrap text-amber-100/90">
              {task.abandonReason?.trim() ? task.abandonReason : "（未填写）"}
            </p>
          </div>
        ) : null}
        {task.completedAt ? (
          <div className="mt-2 md-corner-sm border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-high)] px-2 py-1.5 md-type-body-s">
            <div className="flex items-start justify-between gap-2">
              <span className="shrink-0 text-md-on-surface-variant">
                完成结论
              </span>
              {editingResultTaskId !== task.id ? (
                <button
                  type="button"
                  className="md-corner-sm p-1 text-md-on-surface-variant md-state-hover-subtle hover:text-md-primary md-focus-ring"
                  title="编辑结论"
                  onClick={() => {
                    setEditingResultTaskId(task.id);
                    setResultEditDraft(task.result ?? "");
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            {editingResultTaskId === task.id ? (
              <div className="mt-2 space-y-2">
                <textarea
                  className="md-field md-focus-ring w-full px-2 py-1.5 md-type-body-m"
                  rows={3}
                  value={resultEditDraft}
                  onChange={(e) => setResultEditDraft(e.target.value)}
                  placeholder="记录实验结论、指标、复盘…"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="md-btn-filled md-focus-ring px-3 py-1 md-type-body-s"
                    onClick={() => {
                      const v = resultEditDraft.trim();
                      updateTask(task.id, {
                        result: v || undefined,
                      });
                      setEditingResultTaskId(null);
                    }}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className="md-btn-outlined md-focus-ring px-3 py-1 md-type-body-s"
                    onClick={() => setEditingResultTaskId(null)}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-md-on-surface">
                {task.result?.trim() ? task.result : "（未填写）"}
              </p>
            )}
          </div>
        ) : null}
        {(task.completedAt || task.abandonedAt) &&
        task.folderId !== RECENT_DELETED_FOLDER_KEY ? (
          <div className="mt-2 md-type-body-s">
            <label className="text-md-on-surface-variant">
              添加后续关联（与下一任务连线，同文件夹内）
            </label>
            <select
              className="md-field md-focus-ring mt-1 w-full max-w-md px-2 py-1.5 md-type-body-s"
              defaultValue=""
              onChange={(e) => {
                const tid = e.target.value;
                e.target.value = "";
                if (!tid) return;
                addEdge(task.id, tid);
              }}
            >
              <option value="">选择已有任务…</option>
              {tasks
                .filter((t) => {
                  if (t.id === task.id) return false;
                  if (t.folderId === RECENT_DELETED_FOLDER_KEY) return false;
                  if (taskFolderKey(t) !== taskFolderKey(task)) return false;
                  if (edges.some((e) => e.source === task.id && e.target === t.id))
                    return false;
                  return true;
                })
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
        {!task.completedAt && !task.abandonedAt && task.result ? (
          <p className="mt-2 md-corner-sm bg-[var(--md-sys-color-surface-container-high)] px-2 py-1.5 md-type-body-s">
            <span className="text-md-on-surface-variant">结果：</span>
            {task.result}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-0.5 self-start sm:flex-row">
        <button
          type="button"
          className="md-corner-sm p-2 text-md-on-surface-variant md-state-hover-subtle hover:text-md-primary md-focus-ring"
          title="编辑标题"
          onClick={() => {
            skipNextTitleBlurSave.current = false;
            setEditingTaskId(task.id);
            setTaskTitleDraft(task.title);
          }}
        >
          <Pencil className="h-4 w-4" />
        </button>
        {!task.completedAt &&
        !task.abandonedAt &&
        task.folderId !== RECENT_DELETED_FOLDER_KEY ? (
          <button
            type="button"
            className="md-corner-sm p-2 text-amber-500/90 md-state-hover-subtle hover:text-amber-400 md-focus-ring"
            title="放弃任务"
            onClick={() => setAbandonTarget(task)}
          >
            <Ban className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          className="md-corner-sm p-2 text-md-on-surface-variant md-state-hover-subtle hover:text-red-400 md-focus-ring"
          title={
            task.folderId === RECENT_DELETED_FOLDER_KEY
              ? "永久删除"
              : "删除"
          }
          onClick={() => deleteTask(task.id)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );

  const mainMaxClass =
    "max-w-2xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl";

  return (
    <div className="flex min-h-0 flex-1">
      {listUi.sidebarCollapsed ? (
        <div className="flex w-11 shrink-0 flex-col items-center border-r border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)]/80 py-2 backdrop-blur-sm">
          <button
            type="button"
            title="展开侧栏"
            aria-label="展开侧栏"
            className="md-btn-tonal md-focus-ring p-2"
            onClick={() => patchListUi({ sidebarCollapsed: false })}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <ListSidebar
          onRequestCollapse={() => patchListUi({ sidebarCollapsed: true })}
        />
      )}
      <div
        ref={listScrollRef}
        onScroll={() => {
          const el = listScrollRef.current;
          setShowListScrollTop(Boolean(el && el.scrollTop > 240));
        }}
        className={`relative mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto px-4 pb-6 ${mainMaxClass}`}
      >
        {showListScrollTop ? (
          <button
            type="button"
            title="回到列表顶部"
            aria-label="回到列表顶部"
            className="md-btn-filled md-focus-ring fixed bottom-6 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full shadow-lg md:bottom-8 md:right-8"
            onClick={() =>
              listScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
            }
          >
            <ArrowUpToLine className="h-5 w-5" />
          </button>
        ) : null}
        <div className="sticky top-0 z-20 -mx-4 mb-3 space-y-3 border-b border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface)]/90 px-4 py-3 backdrop-blur-md">
          {inTrashNav ? (
            <p className="md-type-body-s text-md-on-surface-variant">
              最近删除视图中无法新建任务。可使用每条任务旁的「恢复」还原到删除前的文件夹，或使用「永久删除」清空该项。
            </p>
          ) : null}
          <div
            className={`flex flex-col gap-2 sm:flex-row sm:items-stretch ${
              inTrashNav ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <div className="flex min-w-0 flex-1 items-stretch gap-2">
              {/*
              勿对整块使用 overflow-hidden，否则会裁切优先级下拉与 # 标签建议列表
            */}
              <div className="flex min-w-0 flex-1 border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)] md-corner-md focus-within:border-md-primary focus-within:ring-2 focus-within:ring-md-primary/25">
                <TaskPriorityMenu
                  value={draftPriority}
                  onChange={setDraftPriority}
                />
                <TagHashTextInput
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 md-type-body-m text-md-on-surface outline-none placeholder:text-md-on-surface-variant"
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
                className="md-btn-filled md-focus-ring shrink-0 px-5 py-3 md-type-body-m"
                onClick={submit}
              >
                添加
              </button>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-md-on-surface-variant">
            {listSearchQuery.trim()
              ? "没有匹配当前搜索的任务，可换个关键词或清空搜索框。"
              : "当前筛选下暂无任务。可调整左侧文件夹或标签，或新建任务。"}
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {incompleteTasks.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {incompleteTasks.map((task, i) => {
                  const link = nextFromEdges(task);
                  return taskRow(
                    task,
                    i + 1,
                    link?.next,
                    link?.serial,
                  );
                })}
              </ul>
            ) : null}
            {completedTasks.length > 0 ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setCompletedOpen((o) => !o)}
                  className="flex w-full items-center gap-2 border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)] px-3 py-2 text-left md-type-body-m font-medium text-md-on-surface md-corner-md hover:border-md-primary/40 md-focus-ring"
                  style={{ boxShadow: "var(--md-sys-elevation-shadow-1)" }}
                >
                  {completedOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-md-on-surface-variant" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-md-on-surface-variant" />
                  )}
                  <span>已完成</span>
                  <span className="md-type-body-s font-normal text-md-on-surface-variant">
                    （{completedTasks.length}）
                  </span>
                </button>
                {completedOpen ? (
                  <ul className="flex flex-col gap-2">
                    {completedTasks.map((task, i) => {
                      const link = nextFromEdges(task);
                      return taskRow(
                        task,
                        i + 1,
                        link?.next,
                        link?.serial,
                      );
                    })}
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
        <AbandonTaskDialog
          task={abandonTarget}
          onClose={() => setAbandonTarget(null)}
        />
      </div>
    </div>
  );
}
