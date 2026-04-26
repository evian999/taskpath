"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, inviteCode }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "注册失败");
        return;
      }
      router.push("/login");
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          创建账号
        </h1>
        <p className="mt-1 text-sm text-zinc-500">加入 Flex-Off</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/90 p-8 shadow-2xl backdrop-blur-xl">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-zinc-400">用户名</label>
            <input
              className="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-[var(--bg-deep)] px-4 py-3 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="至少 2 个字符"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">密码</label>
            <input
              type="password"
              className="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-[var(--bg-deep)] px-4 py-3 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">邀请码</label>
            <input
              className="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-[var(--bg-deep)] px-4 py-3 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
              autoComplete="off"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="向已注册用户索取，或站长提供的通用码"
            />
          </div>
          {error ? (
            <p className="text-center text-xs text-red-400">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg-deep)] disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            {loading ? "提交中…" : "注册"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          已有账号？{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--accent)] hover:underline"
          >
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
