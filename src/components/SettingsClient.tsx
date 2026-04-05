"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Download,
  FileJson,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { parseAppData } from "@/lib/validate";

type ParsedPreview = { data: AppData };

function buildExportPayload(s: {
  tasks: AppData["tasks"];
  edges: AppData["edges"];
  groups: AppData["groups"];
  folders: AppData["folders"];
  tags: AppData["tags"];
  layout: AppData["layout"];
  preferences: AppData["preferences"];
}) {
  return {
    _algoTodoBackup: 1,
    exportedAt: new Date().toISOString(),
    folders: s.folders,
    tags: s.tags,
    tasks: s.tasks,
    edges: s.edges,
    groups: s.groups,
    layout: s.layout,
    ...(s.preferences && Object.keys(s.preferences).length > 0
      ? { preferences: s.preferences }
      : {}),
  };
}

export function SettingsClient() {
  const hydrated = useAppStore((s) => s.hydrated);
  const loadError = useAppStore((s) => s.loadError);
  const hydrate = useAppStore((s) => s.hydrate);
  const tasks = useAppStore((s) => s.tasks);
  const edges = useAppStore((s) => s.edges);
  const groups = useAppStore((s) => s.groups);
  const folders = useAppStore((s) => s.folders);
  const tags = useAppStore((s) => s.tags);
  const layout = useAppStore((s) => s.layout);
  const preferences = useAppStore((s) => s.preferences);
  const setTaskHttpApiEnabled = useAppStore((s) => s.setTaskHttpApiEnabled);
  const regenerateTaskHttpApiToken = useAppStore(
    (s) => s.regenerateTaskHttpApiToken,
  );
  const replaceAppData = useAppStore((s) => s.replaceAppData);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [importDone, setImportDone] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const taskHttp = preferences?.taskHttpApi;
  const taskHttpEnabled = taskHttp?.enabled === true;
  const taskHttpToken = taskHttp?.token ?? "";

  const exampleUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/tasks-http?token=${taskHttpToken || "<token>"}`
      : "/api/tasks-http?token=<token>";

  const onDownload = useCallback(() => {
    const payload = buildExportPayload({
      tasks,
      edges,
      groups,
      folders,
      tags,
      layout,
      preferences,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const a = document.createElement("a");
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    a.href = URL.createObjectURL(blob);
    a.download = `algo-todo-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [tasks, edges, groups, folders, tags, layout, preferences]);

  const processFile = useCallback((file: File) => {
    setParseError(null);
    setPreview(null);
    setImportDone(null);
    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      setParseError("请使用 .json 文件");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const raw: unknown = JSON.parse(text);
        if (!raw || typeof raw !== "object") {
          setParseError("JSON 根节点必须是对象");
          return;
        }
        const keys = Object.keys(raw as object);
        const data = parseAppData(raw);
        const hasAny =
          data.tasks.length > 0 ||
          data.folders.length > 0 ||
          data.tags.length > 0 ||
          data.edges.length > 0 ||
          data.groups.length > 0 ||
          Object.keys(data.layout.positions).length > 0;
        if (!hasAny && keys.length > 0) {
          setParseError("未识别到任务、文件夹或标签等有效字段，请检查文件是否为 Algo Todo 导出格式");
          return;
        }
        setPreview({ data });
      } catch {
        setParseError("无法解析 JSON，请检查文件内容");
      }
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) processFile(f);
    },
    [processFile],
  );

  const onConfirmImport = useCallback(() => {
    if (!preview) return;
    replaceAppData(preview.data);
    setPreview(null);
    setImportDone("已用备份替换当前数据并触发保存，可返回主页查看。");
  }, [preview, replaceAppData]);

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-zinc-500">
        载入数据…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center text-sm text-red-400">
        无法加载数据：{loadError}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 p-6">
      <div>
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-[var(--accent)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回应用
        </Link>
        <h1 className="text-xl font-semibold text-zinc-100">设置 · 数据备份</h1>
        <p className="mt-1 text-sm text-zinc-500">
          将文件夹、标签、任务及画布连线、分组与布局导出为 JSON；也可拖入此前导出的文件恢复数据（会覆盖当前账号下的全部待办数据）。
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/90 p-6 shadow-xl backdrop-blur-xl">
        <div className="mb-3 text-sm font-medium text-zinc-300">
          任务 HTTP API（只读）
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          开启后可通过 URL 携带 token 或{" "}
          <code className="rounded bg-black/30 px-1 text-[10px]">
            Authorization: Bearer
          </code>{" "}
          拉取当前账号下的任务 JSON（含{" "}
          <code className="text-[10px]">folders</code>、
          <code className="text-[10px]">tags</code>，且每条任务带{" "}
          <code className="text-[10px]">folderName</code>、
          <code className="text-[10px]">tagNames</code>
          ）。关闭后即使泄露 token 也无法访问。请勿把 token 提交到公开仓库。
          使用 Supabase 部署时需在数据库执行{" "}
          <code className="text-[10px] text-zinc-400">002_user_preferences_task_api.sql</code>
          ，否则 token 无法用于反查用户。
        </p>
        <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={taskHttpEnabled}
            onChange={(e) => setTaskHttpApiEnabled(e.target.checked)}
          />
          开启任务 HTTP API
        </label>
        {taskHttpEnabled ? (
          <div className="space-y-3 rounded-xl border border-zinc-700/50 bg-black/25 p-4">
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                密钥 token
              </p>
              <code className="block break-all rounded-md bg-black/40 px-2 py-2 text-[11px] text-zinc-400">
                {taskHttpToken || "（保存后生成）"}
              </code>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!taskHttpToken}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={async () => {
                  if (!taskHttpToken) return;
                  await navigator.clipboard.writeText(taskHttpToken);
                  setCopyHint("已复制 token");
                  setTimeout(() => setCopyHint(null), 2000);
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                复制 token
              </button>
              <button
                type="button"
                disabled={!taskHttpToken}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={async () => {
                  await navigator.clipboard.writeText(exampleUrl);
                  setCopyHint("已复制示例 URL");
                  setTimeout(() => setCopyHint(null), 2000);
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                复制请求 URL
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-700/50 px-3 py-1.5 text-xs text-amber-200/90 hover:bg-amber-950/30"
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    !window.confirm("轮换后旧 token 立即失效，确定？")
                  )
                    return;
                  regenerateTaskHttpApiToken();
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                轮换 token
              </button>
            </div>
            {copyHint ? (
              <p className="text-xs text-emerald-400/90">{copyHint}</p>
            ) : null}
            <p className="text-[10px] leading-relaxed text-zinc-600">
              示例：<code className="break-all text-zinc-500">{exampleUrl}</code>
            </p>
            <p className="text-[10px] text-zinc-600">
              curl：{" "}
              <code className="break-all text-zinc-500">
                curl -H &quot;Authorization: Bearer {taskHttpToken || "TOKEN"}&quot;{" "}
                {typeof window !== "undefined" ? window.location.origin : ""}
                /api/tasks-http
              </code>
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/90 p-6 shadow-xl backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Download className="h-4 w-4 text-[var(--accent)]" />
          导出 JSON
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          当前：文件夹 {folders.length} · 标签 {tags.length} · 任务 {tasks.length} · 连线{" "}
          {edges.length} · 任务组 {groups.length}
        </p>
        <button
          type="button"
          onClick={onDownload}
          className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--bg-deep)] hover:opacity-95"
        >
          <FileJson className="h-4 w-4" />
          下载备份文件
        </button>
      </section>

      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/90 p-6 shadow-xl backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Upload className="h-4 w-4 text-[var(--accent)]" />
          从 JSON 恢复
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          将备份 .json 拖到下方区域，或点击选择文件。确认后<strong className="text-zinc-400">完全替换</strong>
          当前列表与画布数据。
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
            e.target.value = "";
          }}
        />

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
          onClick={() => fileRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDrop={onDrop}
          className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragOver
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-zinc-600/50 bg-black/20 hover:border-zinc-500"
          }`}
        >
          <div className="pointer-events-none flex flex-col items-center">
            <FileJson className="mb-2 h-8 w-8 text-zinc-600" />
            <span className="text-sm text-zinc-400">拖放 .json 到此处</span>
            <span className="mt-1 text-xs text-zinc-600">或点击选择文件</span>
          </div>
        </div>

        {parseError ? (
          <p className="mt-3 text-xs text-red-400">{parseError}</p>
        ) : null}

        {importDone ? (
          <p className="mt-3 text-xs text-emerald-400/90">{importDone}</p>
        ) : null}

        {preview ? (
          <div className="mt-4 rounded-xl border border-zinc-700/50 bg-black/25 p-4">
            <p className="text-xs font-medium text-zinc-400">已解析，将写入：</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-500">
              <li>文件夹 {preview.data.folders.length}</li>
              <li>标签 {preview.data.tags.length}</li>
              <li>任务 {preview.data.tasks.length}</li>
              <li>连线 {preview.data.edges.length}</li>
              <li>任务组 {preview.data.groups.length}</li>
              <li>画布坐标与分组框（layout）</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onConfirmImport}
                className="rounded-lg bg-amber-600/90 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
              >
                确认覆盖当前数据
              </button>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-400 hover:bg-white/5"
              >
                取消
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
