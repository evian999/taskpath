"use client";

import { Flag } from "lucide-react";
import type { TaskPriority } from "@/lib/types";

const FLAGS: {
  p: TaskPriority;
  title: string;
  className: string;
}[] = [
  {
    p: "high",
    title: "高优先级（红旗）",
    className: "text-red-500",
  },
  {
    p: "medium",
    title: "中优先级（黄旗）",
    className: "text-amber-400",
  },
  {
    p: "low",
    title: "低优先级（蓝旗）",
    className: "text-sky-400",
  },
];

type Props = {
  value: TaskPriority | undefined;
  onChange: (p: TaskPriority) => void;
  size?: "sm" | "md";
};

export function TaskPriorityFlags({ value, onChange, size = "md" }: Props) {
  const current = value ?? "medium";
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5" title="优先级">
      {FLAGS.map(({ p, title, className }) => (
        <button
          key={p}
          type="button"
          title={title}
          className={`rounded-md p-1 transition-all ${
            current === p
              ? "bg-white/10 ring-1 ring-white/25"
              : "opacity-40 hover:opacity-100"
          }`}
          onClick={() => onChange(p)}
        >
          <Flag
            className={`${iconClass} ${className}`}
            strokeWidth={2}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}
