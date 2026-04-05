"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Flag } from "lucide-react";
import type { TaskPriority } from "@/lib/types";

const FLAGS: { p: TaskPriority; title: string; className: string }[] = [
  { p: "high", title: "高优先级（红旗）", className: "text-red-500" },
  { p: "medium", title: "中优先级（黄旗）", className: "text-amber-400" },
  { p: "low", title: "低优先级（蓝旗）", className: "text-sky-400" },
];

type Props = {
  value: TaskPriority | undefined;
  onChange: (p: TaskPriority | undefined) => void;
};

/** 新建任务：未选时为灰旗；下拉通过 portal 渲染，避免被列表区域 overflow 裁切 */
export function TaskPriorityMenu({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    const onMove = () => updatePos();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t))
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const menu =
    open && typeof document !== "undefined" ? (
      <ul
        ref={menuRef}
        className="fixed z-[9999] min-w-[11rem] rounded-lg border border-zinc-700/80 bg-[var(--panel-bg)] py-1 shadow-xl"
        style={{ top: pos.top, left: pos.left }}
        role="listbox"
      >
        <li>
          <button
            type="button"
            role="option"
            aria-selected={value === undefined}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            <Flag className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2} />
            无优先级
          </button>
        </li>
        {FLAGS.map(({ p, title, className }) => (
          <li key={p}>
            <button
              type="button"
              role="option"
              aria-selected={p === value}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10"
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
            >
              <Flag className={`h-3.5 w-3.5 ${className}`} strokeWidth={2} />
              {title}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div ref={triggerRef} className="relative shrink-0 self-stretch">
      <button
        type="button"
        title={
          value === undefined
            ? "无优先级，点击选择"
            : "更改新建任务的优先级"
        }
        onClick={() => setOpen((o) => !o)}
        className="flex h-full min-h-[2.75rem] items-center gap-0.5 border-r border-zinc-700/60 bg-black/15 px-2.5 text-zinc-200 hover:bg-white/5"
      >
        <Flag
          className={`h-4 w-4 ${value === undefined ? "text-zinc-500" : FLAGS.find((f) => f.p === value)?.className ?? "text-zinc-500"}`}
          strokeWidth={2}
        />
        <ChevronDown
          className={`h-3.5 w-3.5 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
