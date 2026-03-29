"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { INBOX_FOLDER_KEY, taskFolderKey } from "@/lib/types";
import { useAppStore } from "@/lib/store";

export type TaskNodeData = { task: Task };

export function TaskNode({ data, selected }: NodeProps) {
  const { task } = data as TaskNodeData;
  const done = Boolean(task.completedAt);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const folders = useAppStore((s) => s.folders);
  const tags = useAppStore((s) => s.tags);

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
      className={`task-node min-w-[200px] max-w-[280px] rounded-lg border bg-[var(--node-bg)] px-3 py-2 shadow-[0_0_20px_rgba(56,189,248,0.06)] backdrop-blur-sm transition-colors ${
        selected
          ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
          : "border-[var(--node-border)] hover:border-[var(--node-border-hover)]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border !border-[var(--accent)] !bg-[var(--bg-deep)]"
      />
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-[var(--accent)]" title={done ? "已完成" : "未完成"}>
          {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] text-zinc-600">{folderName}</p>
          <p
            className={`text-sm font-medium leading-snug ${
              done ? "text-zinc-500 line-through" : "text-zinc-100"
            }`}
          >
            {task.title}
          </p>
          {taskTags.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {taskTags.map((tg) => (
                <span
                  key={tg!.id}
                  className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 ring-1 ring-zinc-600/60"
                  style={
                    tg!.color
                      ? {
                          color: tg!.color,
                          borderColor: tg!.color,
                          boxShadow: `inset 0 0 0 1px ${tg!.color}40`,
                        }
                      : undefined
                  }
                >
                  {tg!.name}
                </span>
              ))}
            </div>
          ) : null}
          {task.result ? (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{task.result}</p>
          ) : null}
        </div>
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
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-[var(--accent)] !bg-[var(--bg-deep)]"
      />
    </div>
  );
}
