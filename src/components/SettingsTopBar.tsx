"use client";

import { ThemeToggle } from "@/components/ThemeToggle";

export function SettingsTopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--panel-border)] bg-[var(--panel-bg)]/90 px-4 backdrop-blur-md">
      <div>
        <span className="text-sm font-semibold text-zinc-100">Algo Todo</span>
        <span className="ml-2 text-xs text-zinc-600">设置</span>
      </div>
      <ThemeToggle />
    </header>
  );
}
