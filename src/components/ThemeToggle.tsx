"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? "切换深色" : "切换浅色"}
      className={`flex items-center justify-center rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-2 text-zinc-400 hover:border-[var(--accent)]/40 hover:text-[var(--accent)] ${className}`}
      aria-label={isLight ? "切换深色模式" : "切换浅色模式"}
    >
      {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
    </button>
  );
}
