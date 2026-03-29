"use client";

import { ThemeToggle } from "@/components/ThemeToggle";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--bg-base)] comfy-grid">
      <div className="pointer-events-none absolute right-4 top-4 z-20 flex justify-end">
        <div className="pointer-events-auto">
          <ThemeToggle />
        </div>
      </div>
      {children}
    </div>
  );
}
