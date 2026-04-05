"use client";

import { useEffect, useState } from "react";
import type { NextStepInput, Task } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { TagHashTextInput } from "@/components/TagHashTextInput";

type Props = {
  task: Task | null;
  onClose: () => void;
};

export function CompleteTaskDialog({ task, onClose }: Props) {
  const tasks = useAppStore((s) => s.tasks);
  const tags = useAppStore((s) => s.tags);
  const completeTask = useAppStore((s) => s.completeTask);
  const [result, setResult] = useState("");
  const [steps, setSteps] = useState<NextStepInput[]>([
    { text: "", linkTaskId: undefined },
  ]);

  useEffect(() => {
    if (task) {
      setResult(task.result ?? "");
      setSteps([{ text: "", linkTaskId: undefined }]);
    }
  }, [task]);

  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [task, onClose]);

  if (!task) return null;

  const others = tasks.filter((t) => t.id !== task.id);

  const submit = () => {
    const filtered = steps.filter((s) => s.text.trim() || s.linkTaskId);
    completeTask(task.id, result, filtered);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-dialog-title"
      onClick={onClose}
    >
      <div
        className="min-w-0 w-full max-w-lg rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 shadow-2xl shadow-cyan-500/5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="complete-dialog-title"
          className="text-base font-semibold text-zinc-100"
        >
          完成任务
        </h2>
        <p className="mt-1 text-xs text-zinc-500">{task.title}</p>

        <label className="mt-4 block text-xs font-medium text-zinc-400">
          完成结果
        </label>
        <textarea
          className="mt-1.5 w-full rounded-lg border border-zinc-700/80 bg-[var(--bg-deep)] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[var(--accent)]"
          rows={4}
          placeholder="记录实验结论、指标、复盘…"
          value={result}
          onChange={(e) => setResult(e.target.value)}
        />

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">下一步目标</span>
            <button
              type="button"
              className="text-xs text-[var(--accent)] hover:underline"
              onClick={() =>
                setSteps((s) => [...s, { text: "", linkTaskId: undefined }])
              }
            >
              + 添加一行
            </button>
          </div>
          <p className="mt-1 text-[10px] text-zinc-600">
            描述新任务时可输入 <code className="text-zinc-500">#标签名</code>{" "}
            插入标签（与列表输入一致）。
          </p>
          <ul className="mt-2 space-y-2">
            {steps.map((row, i) => (
              <li
                key={i}
                className="flex min-w-0 flex-col gap-2 rounded-lg border border-zinc-800/80 bg-black/20 p-2 sm:flex-row sm:items-center"
              >
                <TagHashTextInput
                  suggestAbove
                  className="min-w-0 flex-1 rounded-md border border-zinc-700/60 bg-[var(--bg-deep)] px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-[var(--accent)]"
                  placeholder="描述下一步…（# 选标签）"
                  value={row.text}
                  tags={tags}
                  onChange={(v) => {
                    setSteps((prev) =>
                      prev.map((p, j) => (j === i ? { ...p, text: v } : p)),
                    );
                  }}
                />
                <div className="min-w-0 w-full sm:w-auto sm:max-w-[min(100%,12rem)] sm:shrink-0">
                  <select
                    className="w-full max-w-full rounded-md border border-zinc-700/60 bg-[var(--bg-deep)] px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-[var(--accent)]"
                    title={
                      row.linkTaskId
                        ? others.find((t) => t.id === row.linkTaskId)?.title
                        : undefined
                    }
                    value={row.linkTaskId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value || undefined;
                      setSteps((prev) =>
                        prev.map((p, j) =>
                          j === i ? { ...p, linkTaskId: v } : p,
                        ),
                      );
                    }}
                  >
                    <option value="">（可选）关联已有任务</option>
                    {others.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-deep)] hover:brightness-110"
            onClick={submit}
          >
            确认完成
          </button>
        </div>
      </div>
    </div>
  );
}
