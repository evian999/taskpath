"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LogIn, Sparkles } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "登录失败");
        return;
      }
      router.push(from.startsWith("/login") ? "/" : from);
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 shadow-[0_0_40px_rgba(56,189,248,0.15)]">
          <Sparkles className="h-7 w-7 text-[var(--accent)]" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Algo Todo
        </h1>
        <p className="mt-1 text-sm text-zinc-500">算法工程师任务流 · 登录</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/90 p-8 shadow-2xl shadow-cyan-500/[0.07] backdrop-blur-xl">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-zinc-400">用户名</label>
            <input
              className="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-[var(--bg-deep)] px-4 py-3 text-sm text-zinc-100 outline-none transition-colors focus:border-[var(--accent)]"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="evain"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">密码</label>
            <input
              type="password"
              className="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-[var(--bg-deep)] px-4 py-3 text-sm text-zinc-100 outline-none transition-colors focus:border-[var(--accent)]"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-center text-xs text-red-400">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg-deep)] transition-opacity hover:opacity-95 disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-600">
          默认账户{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-[var(--accent)]">
            evain
          </code>{" "}
          /{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-zinc-400">
            990423
          </code>
        </p>

        <p className="mt-4 text-center text-sm text-zinc-500">
          还没有账号？{" "}
          <Link
            href="/register"
            className="font-medium text-[var(--accent)] hover:underline"
          >
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          加载…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
