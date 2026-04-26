"use client";

import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";

/** 顶栏：列表模式下在主题切换左侧打开搜索面板（不入库） */
export function ListSearchHeaderControl() {
  const listSearchQuery = useAppStore((s) => s.listSearchQuery);
  const setListSearchQuery = useAppStore((s) => s.setListSearchQuery);
  const listSearchOpen = useAppStore((s) => s.listSearchOpen);
  const setListSearchOpen = useAppStore((s) => s.setListSearchOpen);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelBox, setPanelBox] = useState<{
    top: number;
    right: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!listSearchOpen || !wrapRef.current) {
      setPanelBox(null);
      return;
    }
    const update = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPanelBox({
        top: r.bottom + 4,
        right: Math.max(8, window.innerWidth - r.right),
        width: Math.min(window.innerWidth - 16, 22 * 16),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [listSearchOpen]);

  useEffect(() => {
    if (!listSearchOpen) return;
    let onDown: ((e: MouseEvent) => void) | undefined;
    let cancelled = false;
    const timerId = window.setTimeout(() => {
      if (cancelled) return;
      onDown = (e: MouseEvent) => {
        const t = e.target as Node | null;
        const inside =
          Boolean(t && (wrapRef.current?.contains(t) || panelRef.current?.contains(t)));
        if (inside) return;
        setListSearchOpen(false);
      };
      document.addEventListener("mousedown", onDown);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      if (onDown) document.removeEventListener("mousedown", onDown);
    };
  }, [listSearchOpen, setListSearchOpen]);

  useEffect(() => {
    if (!listSearchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setListSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listSearchOpen, setListSearchOpen]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        title="搜索任务"
        aria-label="搜索任务"
        aria-expanded={listSearchOpen}
        aria-haspopup="dialog"
        className={`md-btn-tonal md-focus-ring p-2 ${
          listSearchQuery.trim() ? "ring-2 ring-md-primary/35" : ""
        }`}
        onClick={() => {
          setListSearchOpen(!listSearchOpen);
        }}
      >
        <Search className="h-3.5 w-3.5" />
      </button>
      {listSearchOpen && panelBox && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)] p-2 shadow-lg md-corner-md"
              style={{
                position: "fixed",
                top: panelBox.top,
                right: panelBox.right,
                width: panelBox.width,
                zIndex: 10000,
              }}
              role="dialog"
              aria-label="搜索任务"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-md-on-surface-variant"
                  aria-hidden
                />
                <input
                  type="search"
                  className="md-field md-focus-ring w-full py-2 pl-9 pr-8 md-type-body-m"
                  placeholder="标题、结果、标签名…"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  autoComplete="off"
                  autoFocus
                  aria-label="搜索关键词"
                />
                {listSearchQuery ? (
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-md-on-surface-variant md-state-hover-subtle md-focus-ring"
                    aria-label="清空搜索"
                    onClick={() => setListSearchQuery("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
