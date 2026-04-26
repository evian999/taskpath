"use client";

import { useEffect, useState } from "react";
import type { NextStepInput, Task } from "@/lib/types";
import { RECENT_DELETED_FOLDER_KEY, taskFolderKey } from "@/lib/types";
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
  const [steps, setSteps] = useState<NextStepInput[]>([]);

  useEffect(() => {
    if (task) {
      setResult(task.result ?? "");
      setSteps([]);
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

  const taskFk = taskFolderKey(task);
  const others = tasks.filter(
    (t) =>
      t.id !== task.id &&
      taskFolderKey(t) === taskFk &&
      t.folderId !== RECENT_DELETED_FOLDER_KEY,
  );

  const submit = () => {
    const filtered = steps.filter((s) => s.text.trim() || s.linkTaskId);
    completeTask(task.id, result, filtered);
    onClose();
  };

  return (
    <div
      className="md-scrim fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-dialog-title"
      onClick={onClose}
    >
      <div
        className="min-w-0 w-full max-w-lg border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)] p-5 md-corner-xl"
        style={{ boxShadow: "var(--md-sys-elevation-shadow-dialog)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="complete-dialog-title" className="md-type-title-m">
          完成任务
        </h2>
        <p className="mt-1 md-type-body-s">{task.title}</p>

        <label className="mt-4 block md-type-label-m font-medium">
          完成结果
        </label>
        <textarea
          className="md-field md-focus-ring mt-1.5 w-full px-3 py-2 md-type-body-m"
          rows={4}
          placeholder="记录实验结论、指标、复盘…"
          value={result}
          onChange={(e) => setResult(e.target.value)}
        />

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="md-type-label-m font-medium">下一步目标</span>
            <button
              type="button"
              className="md-btn-text md-focus-ring px-2 py-1 text-xs"
              onClick={() =>
                setSteps((s) => [...s, { text: "", linkTaskId: undefined }])
              }
            >
              + 添加一行
            </button>
          </div>
          <p className="mt-1 text-[0.625rem] leading-4 text-md-on-surface-variant">
            描述新任务时可输入{" "}
            <code className="text-md-on-surface-variant/90">#标签名</code>{" "}
            插入标签（与列表输入一致）。关联已有任务仅列出与当前任务同一文件夹内的项。
          </p>
          {steps.length === 0 ? (
            <p className="mt-2 md-type-body-s text-md-on-surface-variant">
              无需后续步骤时可留空；需要时再点「+ 添加一行」。
            </p>
          ) : null}
          <ul className="mt-2 space-y-2">
            {steps.map((row, i) => (
              <li
                key={i}
                className="flex min-w-0 flex-col gap-2 border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-high)] p-2 md-corner-md sm:flex-row sm:items-center"
              >
                <TagHashTextInput
                  suggestAbove
                  className="md-field md-focus-ring min-w-0 flex-1 px-2 py-1.5 md-type-body-m"
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
                    className="md-field md-focus-ring w-full max-w-full px-2 py-1.5 md-type-body-s text-md-on-surface"
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
            className="md-btn-outlined md-focus-ring px-4 py-2 md-type-body-m"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="md-btn-filled md-focus-ring px-4 py-2 md-type-body-m"
            onClick={submit}
          >
            确认完成
          </button>
        </div>
      </div>
    </div>
  );
}
