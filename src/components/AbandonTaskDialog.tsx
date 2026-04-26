"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { useAppStore } from "@/lib/store";

type Props = {
  task: Task | null;
  onClose: () => void;
};

export function AbandonTaskDialog({ task, onClose }: Props) {
  const abandonTask = useAppStore((s) => s.abandonTask);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (task) setReason("");
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

  return (
    <div
      className="md-scrim fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="abandon-dialog-title"
      onClick={onClose}
    >
      <div
        className="min-w-0 w-full max-w-lg border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)] p-5 md-corner-xl"
        style={{ boxShadow: "var(--md-sys-elevation-shadow-dialog)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="abandon-dialog-title" className="md-type-title-m">
          放弃任务
        </h2>
        <p className="mt-1 md-type-body-s text-md-on-surface-variant">
          {task.title}
        </p>
        <p className="mt-3 md-type-body-s text-amber-200/90">
          放弃后的任务会归入「已完成」折叠区，复选框显示为「×」。请简要说明原因。
        </p>
        <textarea
          className="md-field md-focus-ring mt-3 w-full px-3 py-2 md-type-body-m"
          rows={3}
          placeholder="放弃原因（必填）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
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
            className="md-btn-filled bg-amber-700 px-4 py-2 md-type-body-m hover:bg-amber-600"
            disabled={!reason.trim()}
            onClick={() => {
              abandonTask(task.id, reason);
              onClose();
            }}
          >
            确认放弃
          </button>
        </div>
      </div>
    </div>
  );
}
