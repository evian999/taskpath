"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { INBOX_FOLDER_KEY, taskFolderKey } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { TagBadge } from "@/components/TagBadge";
import { priorityCheckboxBorder } from "@/lib/task-priority-ui";

export type TaskNodeData = { task: Task };

export function TaskNode({ data, selected }: NodeProps) {
  const { task } = data as TaskNodeData;
  const done = Boolean(task.completedAt);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const toggleTaskTag = useAppStore((s) => s.toggleTaskTag);
  const folders = useAppStore((s) => s.folders);
  const tags = useAppStore((s) => s.tags);

  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);

  useEffect(() => {
    if (!editing) setTitleDraft(task.title);
  }, [task.title, editing]);

  const fk = taskFolderKey(task);
  const folderName =
    fk === INBOX_FOLDER_KEY
      ? "收件箱"
      : folders.find((f) => f.id === fk)?.name ?? "文件夹";

  const taskTags = (task.tagIds ?? [])
    .map((id) => tags.find((t) => t.id === id))
    .filter(Boolean);

  return (
    <div
      className={`task-node relative z-[1] min-w-[200px] max-w-[280px] rounded-lg border bg-[var(--node-bg)] px-3 py-2 shadow-[0_0_20px_rgba(56,189,248,0.06)] backdrop-blur-sm transition-colors ${
        selected
          ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
          : "border-[var(--node-border)] hover:border-[var(--node-border-hover)]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!z-20 !h-2.5 !w-2.5 !border !border-[var(--accent)] !bg-[var(--bg-deep)]"
      />
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 transition-colors ${
            done
              ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
              : ""
          }`}
          style={
            !done
              ? {
                  backgroundColor: "var(--checkbox-unchecked-fill)",
                  borderColor: priorityCheckboxBorder(task.priority),
                }
              : undefined
          }
          title={
            task.priority === undefined
              ? "未完成（无优先级）"
              : "未完成时边框颜色表示优先级"
          }
        >
          {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] text-zinc-600">{folderName}</p>
          {editing ? (
            <input
              className="nodrag nopan w-full rounded border border-[var(--accent)] bg-[var(--bg-deep)] px-1.5 py-1 text-sm text-zinc-100 outline-none"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              autoFocus
              onBlur={() => {
                const t = titleDraft.trim();
                if (t) updateTask(task.id, { title: t });
                else setTitleDraft(task.title);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setTitleDraft(task.title);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <p
              className={`text-sm font-medium leading-snug ${
                done ? "text-zinc-500 line-through" : "text-zinc-100"
              }`}
            >
              {task.title}
            </p>
          )}
          {taskTags.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {taskTags.map((tg) => (
                <TagBadge
                  key={tg!.id}
                  tag={tg!}
                  tagIndex={tags.findIndex((x) => x.id === tg!.id)}
                  onRemove={() => toggleTaskTag(task.id, tg!.id)}
                />
              ))}
            </div>
          ) : null}
          {task.result ? (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{task.result}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            className="nodrag nopan rounded p-1 text-zinc-600 hover:bg-white/5 hover:text-[var(--accent)]"
            title="编辑标题"
            onClick={(e) => {
              e.stopPropagation();
              setTitleDraft(task.title);
              setEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="nodrag nopan rounded p-1 text-zinc-600 hover:bg-white/5 hover:text-red-400"
            title="删除任务"
            onClick={(e) => {
              e.stopPropagation();
              deleteTask(task.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!z-20 !h-2.5 !w-2.5 !border !border-[var(--accent)] !bg-[var(--bg-deep)]"
      />
    </div>
  );
}
