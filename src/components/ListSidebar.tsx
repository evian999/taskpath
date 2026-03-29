"use client";

import { useState, type ReactNode } from "react";
import { FolderOpen, Inbox, LayoutGrid, Plus, Tag, Trash2 } from "lucide-react";
import { INBOX_FOLDER_KEY, type NavFolderId } from "@/lib/types";
import { useAppStore } from "@/lib/store";

export function ListSidebar() {
  const folders = useAppStore((s) => s.folders);
  const tags = useAppStore((s) => s.tags);
  const navFolderId = useAppStore((s) => s.navFolderId);
  const navTagId = useAppStore((s) => s.navTagId);
  const setNavFolderId = useAppStore((s) => s.setNavFolderId);
  const setNavTagId = useAppStore((s) => s.setNavTagId);
  const addFolder = useAppStore((s) => s.addFolder);
  const deleteFolder = useAppStore((s) => s.deleteFolder);
  const addTag = useAppStore((s) => s.addTag);
  const deleteTag = useAppStore((s) => s.deleteTag);

  const [folderDraft, setFolderDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");

  const navBtn = (id: NavFolderId, label: string, icon: ReactNode) => (
    <button
      key={String(id)}
      type="button"
      onClick={() => setNavFolderId(id)}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors ${
        navFolderId === id
          ? "bg-[var(--accent)]/20 text-[var(--accent)]"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--panel-border)] bg-[var(--panel-bg)]/80 backdrop-blur-sm">
      <div className="border-b border-[var(--panel-border)] p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <LayoutGrid className="h-3 w-3" />
          文件夹视图
        </p>
        <nav className="flex flex-col gap-0.5">
          {navBtn("all", "全部任务", <LayoutGrid className="h-3.5 w-3.5 shrink-0 opacity-70" />)}
          {navBtn(
            INBOX_FOLDER_KEY,
            "收件箱",
            <Inbox className="h-3.5 w-3.5 shrink-0 opacity-70" />,
          )}
          {folders.map((f) => (
            <div key={f.id} className="group flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setNavFolderId(f.id)}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors ${
                  navFolderId === f.id
                    ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate">{f.name}</span>
              </button>
              <button
                type="button"
                title="删除文件夹"
                className="shrink-0 rounded p-1.5 text-zinc-600 opacity-0 hover:bg-white/5 hover:text-red-400 group-hover:opacity-100"
                onClick={() => deleteFolder(f.id)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </nav>
        <div className="mt-2 flex gap-1">
          <input
            className="min-w-0 flex-1 rounded-md border border-zinc-700/60 bg-[var(--bg-deep)] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-[var(--accent)]"
            placeholder="新文件夹…"
            value={folderDraft}
            onChange={(e) => setFolderDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addFolder(folderDraft);
                setFolderDraft("");
              }
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded-md bg-zinc-800 px-2 py-1.5 text-zinc-300 hover:bg-zinc-700"
            title="添加文件夹"
            onClick={() => {
              addFolder(folderDraft);
              setFolderDraft("");
            }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <Tag className="h-3 w-3" />
          标签筛选
        </p>
        <button
          type="button"
          onClick={() => setNavTagId(null)}
          className={`mb-2 rounded-lg px-2 py-1.5 text-left text-xs ${
            navTagId === null
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-500 hover:bg-white/5"
          }`}
        >
          不限标签
        </button>
        <ul className="flex flex-col gap-1 overflow-y-auto">
          {tags.map((t) => (
            <li key={t.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setNavTagId(navTagId === t.id ? null : t.id)
                }
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                  navTagId === t.id
                    ? "bg-fuchsia-500/15 text-fuchsia-300"
                    : "text-zinc-400 hover:bg-white/5"
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-zinc-500"
                  style={t.color ? { backgroundColor: t.color } : undefined}
                />
                <span className="truncate">{t.name}</span>
              </button>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-zinc-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                title="删除标签"
                onClick={() => deleteTag(t.id)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-1 border-t border-[var(--panel-border)] pt-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-zinc-700/60 bg-[var(--bg-deep)] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-[var(--accent)]"
            placeholder="新标签…"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addTag(tagDraft);
                setTagDraft("");
              }
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded-md bg-zinc-800 px-2 py-1.5 text-zinc-300 hover:bg-zinc-700"
            onClick={() => {
              addTag(tagDraft);
              setTagDraft("");
            }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
