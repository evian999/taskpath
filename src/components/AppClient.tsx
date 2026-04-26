"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { LayoutGrid, List, LogOut, Settings } from "lucide-react";
import { ListSearchHeaderControl } from "@/components/ListSearchHeaderControl";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useState } from "react";
import { ListMode } from "@/components/ListMode";
import { useAppStore } from "@/lib/store";

const CanvasView = dynamic(() => import("@/components/CanvasView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-md-on-surface-variant">
      画布加载中…
    </div>
  ),
});

export function AppClient() {
  const hydrated = useAppStore((s) => s.hydrated);
  const loadError = useAppStore((s) => s.loadError);
  const saveError = useAppStore((s) => s.saveError);
  const clearSaveError = useAppStore((s) => s.clearSaveError);
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    void useAppStore.getState().hydrate();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "l" || e.key === "L") setMode("list");
      if (e.key === "c" || e.key === "C") setMode("canvas");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMode]);

  async function logout() {
    setLogoutLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.href = "/login";
    }
  }

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-md-on-surface-variant">
        载入数据…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-red-400">无法加载数据：{loadError}</p>
        <p className="md-type-body-s">请确认已运行 next dev 且 /api/data 可访问。</p>
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)]/95 px-4 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2">
          <span className="md-type-body-m font-semibold tracking-tight text-md-on-surface">
            Flex-Off
          </span>
          <span className="hidden md-type-body-s sm:inline">
            算法工程师任务流
          </span>
        </div>
        <div className="md-segmented shrink-0">
          <button
            type="button"
            onClick={() => setMode("list")}
            className={`md-segment flex items-center gap-1.5 px-3 py-1.5 ${
              mode === "list" ? "md-segment--active" : "md-segment--inactive"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            列表
          </button>
          <button
            type="button"
            onClick={() => setMode("canvas")}
            className={`md-segment flex items-center gap-1.5 px-3 py-1.5 ${
              mode === "canvas" ? "md-segment--active" : "md-segment--inactive"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            画布
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden md-type-label-m lg:inline">
            L 列表 · C 画布
          </span>
          {mode === "list" ? <ListSearchHeaderControl /> : null}
          <ThemeToggle />
          <Link
            href="/settings"
            className="md-btn-outlined md-focus-ring flex items-center gap-1 px-2.5 py-1.5 text-xs hover:border-md-primary/50"
            title="设置与数据备份"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">设置</span>
          </Link>
          <button
            type="button"
            disabled={logoutLoading}
            onClick={() => void logout()}
            className="md-btn-outlined md-focus-ring flex items-center gap-1 px-2.5 py-1.5 text-xs hover:border-red-400/50 hover:text-red-400 disabled:opacity-50"
            title="退出登录"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">退出</span>
          </button>
        </div>
      </header>

      {saveError ? (
        <div className="flex items-center justify-between gap-2 border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-xs text-red-300">
          <span>保存失败：{saveError}</span>
          <button
            type="button"
            className="rounded-sm px-1 py-0.5 text-xs text-md-on-surface-variant underline md-focus-ring md-state-hover"
            onClick={clearSaveError}
          >
            关闭
          </button>
        </div>
      ) : null}

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {mode === "list" ? <ListMode /> : <CanvasView />}
      </main>
    </>
  );
}
