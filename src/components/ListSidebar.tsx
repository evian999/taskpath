"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  AtSign,
  FolderOpen,
  Inbox,
  LayoutGrid,
  PanelLeftClose,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import {
  ARCHIVE_FOLDER_KEY,
  INBOX_FOLDER_KEY,
  RECENT_DELETED_FOLDER_KEY,
  type NavFolderId,
} from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { resolveTagColor } from "@/lib/tag-draft";

type ListSidebarProps = {
  onRequestCollapse?: () => void;
};

export function ListSidebar({ onRequestCollapse }: ListSidebarProps) {
  const tasks = useAppStore((s) => s.tasks);
  const folders = useAppStore((s) => s.folders);
  const tags = useAppStore((s) => s.tags);
  const navFolderId = useAppStore((s) => s.navFolderId);
  const navTagId = useAppStore((s) => s.navTagId);
  const navMention = useAppStore((s) => s.navMention);
  const setNavFolderId = useAppStore((s) => s.setNavFolderId);
  const setNavTagId = useAppStore((s) => s.setNavTagId);
  const setNavMention = useAppStore((s) => s.setNavMention);
  const addFolder = useAppStore((s) => s.addFolder);
  const updateFolder = useAppStore((s) => s.updateFolder);
  const deleteFolder = useAppStore((s) => s.deleteFolder);
  const addTag = useAppStore((s) => s.addTag);
  const updateTag = useAppStore((s) => s.updateTag);
  const deleteTag = useAppStore((s) => s.deleteTag);

  const [folderDraft, setFolderDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderEditName, setFolderEditName] = useState("");
  const [folderEditColor, setFolderEditColor] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagEditName, setTagEditName] = useState("");
  const [tagEditColor, setTagEditColor] = useState("");

  const {
    allCount,
    inboxCount,
    archiveCount,
    trashCount,
    folderCounts,
    tagCounts,
    mentionSummaries,
  } = useMemo(() => {
      const folderCounts: Record<string, number> = Object.fromEntries(
        folders.map((f) => [f.id, 0]),
      );
      const tagCounts: Record<string, number> = Object.fromEntries(
        tags.map((t) => [t.id, 0]),
      );
      const mentionMap = new Map<
        string,
        { label: string; count: number }
      >();
      let inboxCount = 0;
      let archiveCount = 0;
      let incompleteAll = 0;
      let trashCount = 0;
      for (const task of tasks) {
        if (task.folderId === RECENT_DELETED_FOLDER_KEY) {
          trashCount += 1;
          continue;
        }
        if (task.completedAt) continue;
        incompleteAll += 1;
        for (const tid of task.tagIds ?? []) {
          if (tagCounts[tid] !== undefined) tagCounts[tid] += 1;
        }
        for (const m of task.mentions ?? []) {
          const key = m.toLowerCase();
          const cur = mentionMap.get(key);
          if (cur) cur.count += 1;
          else mentionMap.set(key, { label: m, count: 1 });
        }
        if (!task.folderId) inboxCount += 1;
        else if (task.folderId === ARCHIVE_FOLDER_KEY) archiveCount += 1;
        else if (folderCounts[task.folderId] !== undefined) {
          folderCounts[task.folderId] += 1;
        }
      }
      const mentionSummaries = [...mentionMap.entries()]
        .map(([key, v]) => ({ key, label: v.label, count: v.count }))
        .sort(
          (a, b) =>
            b.count - a.count || a.label.localeCompare(b.label, "zh-CN"),
        );
      return {
        allCount: incompleteAll,
        inboxCount,
        archiveCount,
        trashCount,
        folderCounts,
        tagCounts,
        mentionSummaries,
      };
    }, [tasks, folders, tags]);

  const countCol =
    "flex h-full min-h-[2.25rem] w-[2.25rem] shrink-0 items-center justify-end tabular-nums text-[0.625rem] leading-none text-md-on-surface-variant";

  const navBtn = (
    id: NavFolderId,
    label: string,
    icon: ReactNode,
    count: number,
  ) => (
    <button
      key={String(id)}
      type="button"
      onClick={() => setNavFolderId(id)}
      className={`md-nav-item grid w-full grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-2 px-2 py-0 text-left ${
        navFolderId === id
          ? "md-nav-item--selected"
          : "md-nav-item--default"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2 py-2">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`${countCol} ${
          navFolderId === id ? "text-md-on-primary-container/80" : ""
        }`}
      >
        {count}
      </span>
    </button>
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)]/80 backdrop-blur-sm sm:w-80">
      <div className="border-b border-[var(--md-sys-color-outline)] p-3">
        <p className="md-type-label-s mb-2 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <LayoutGrid className="h-3 w-3 shrink-0" />
            <span className="truncate">文件夹视图</span>
          </span>
          {onRequestCollapse ? (
            <button
              type="button"
              title="收起侧栏"
              aria-label="收起侧栏"
              className="md-btn-tonal md-focus-ring shrink-0 p-1.5"
              onClick={onRequestCollapse}
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </p>
        <nav className="flex flex-col gap-0.5">
          {navBtn(
            "all",
            "全部任务",
            <LayoutGrid className="h-3.5 w-3.5 shrink-0 opacity-70" />,
            allCount,
          )}
          {navBtn(
            INBOX_FOLDER_KEY,
            "收件箱",
            <Inbox className="h-3.5 w-3.5 shrink-0 opacity-70" />,
            inboxCount,
          )}
          {folders.map((f) => (
            <div key={f.id} className="group flex flex-col gap-1 rounded-lg py-0.5">
              {editingFolderId === f.id ? (
                <div className="flex flex-col gap-1.5 md-corner-md border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-low)] p-2">
                  <input
                    className="md-field md-focus-ring w-full px-2 py-1 md-type-body-s"
                    value={folderEditName}
                    onChange={(e) => setFolderEditName(e.target.value)}
                    placeholder="文件夹名称"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateFolder(f.id, {
                          name: folderEditName,
                          color: folderEditColor,
                        });
                        setEditingFolderId(null);
                      }
                      if (e.key === "Escape") setEditingFolderId(null);
                    }}
                  />
                  <label className="flex items-center gap-2 md-type-label-m">
                    颜色
                    <input
                      type="color"
                      className="h-6 w-10 cursor-pointer md-corner-sm border border-[var(--md-sys-color-outline)] bg-transparent md-focus-ring"
                      value={folderEditColor || "#38bdf8"}
                      onChange={(e) => setFolderEditColor(e.target.value)}
                    />
                    <button
                      type="button"
                      className="md-btn-text md-focus-ring px-1 py-0.5 text-[0.625rem] underline"
                      onClick={() => setFolderEditColor("")}
                    >
                      清除
                    </button>
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="md-btn-filled md-focus-ring flex-1 py-1 text-[0.625rem] font-medium"
                      onClick={() => {
                        updateFolder(f.id, {
                          name: folderEditName,
                          color: folderEditColor,
                        });
                        setEditingFolderId(null);
                      }}
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      className="md-btn-outlined md-focus-ring px-2 py-1 text-[0.625rem]"
                      onClick={() => setEditingFolderId(null)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_2.25rem] items-center gap-x-0.5">
                  <button
                    type="button"
                    onClick={() => setNavFolderId(f.id)}
                    className={`md-nav-item flex min-w-0 items-center gap-2 px-2 py-2 text-left ${
                      navFolderId === f.id
                        ? "md-nav-item--selected"
                        : "md-nav-item--default"
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-zinc-500"
                      style={
                        f.color ? { backgroundColor: f.color } : undefined
                      }
                    />
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="min-w-0 truncate">{f.name}</span>
                  </button>
                  <button
                    type="button"
                    title="编辑"
                    className="shrink-0 md-corner-sm p-1.5 text-md-on-surface-variant opacity-0 md-state-hover-subtle hover:text-md-primary group-hover:opacity-100 md-focus-ring"
                    onClick={() => {
                      setEditingFolderId(f.id);
                      setFolderEditName(f.name);
                      setFolderEditColor(f.color ?? "");
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="删除文件夹"
                    className="shrink-0 md-corner-sm p-1.5 text-md-on-surface-variant opacity-0 md-state-hover-subtle hover:text-red-400 group-hover:opacity-100 md-focus-ring"
                    onClick={() => deleteFolder(f.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <span
                    className={`${countCol} ${
                      navFolderId === f.id ? "text-md-on-primary-container/80" : ""
                    }`}
                  >
                    {folderCounts[f.id] ?? 0}
                  </span>
                </div>
              )}
            </div>
          ))}
          {navBtn(
            ARCHIVE_FOLDER_KEY,
            "归档",
            <Archive className="h-3.5 w-3.5 shrink-0 opacity-70" />,
            archiveCount,
          )}
          {navBtn(
            RECENT_DELETED_FOLDER_KEY,
            "最近删除的任务",
            <ArchiveRestore className="h-3.5 w-3.5 shrink-0 opacity-70" />,
            trashCount,
          )}
        </nav>
        <div className="mt-2 flex gap-1">
          <input
            className="md-field md-focus-ring min-w-0 flex-1 px-2 py-1.5 md-type-body-s"
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
            className="md-btn-tonal md-focus-ring shrink-0 px-2 py-1.5"
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <p className="md-type-label-s mb-2 flex shrink-0 items-center gap-1.5">
          <Tag className="h-3 w-3" />
          标签筛选
        </p>
        <button
          type="button"
          onClick={() => setNavTagId(null)}
          className={`mb-2 shrink-0 md-corner-md px-2 py-1.5 text-left md-type-body-s ${
            navTagId === null
              ? "bg-[var(--md-sys-color-surface-container-highest)] text-md-on-surface"
              : "text-md-on-surface-variant md-state-hover"
          }`}
        >
          不限标签
        </button>
        <ul className="flex shrink-0 flex-col gap-1">
          {tags.map((t, tagIdx) => (
            <li key={t.id} className="group flex flex-col gap-1 py-0.5">
              {editingTagId === t.id ? (
                <div className="flex flex-col gap-1.5 md-corner-md border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-low)] p-2">
                  <input
                    className="md-field md-focus-ring w-full px-2 py-1 md-type-body-s"
                    value={tagEditName}
                    onChange={(e) => setTagEditName(e.target.value)}
                    placeholder="标签名称"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateTag(t.id, {
                          name: tagEditName,
                          color: tagEditColor,
                        });
                        setEditingTagId(null);
                      }
                      if (e.key === "Escape") setEditingTagId(null);
                    }}
                  />
                  <label className="flex items-center gap-2 md-type-label-m">
                    颜色
                    <input
                      type="color"
                      className="h-6 w-10 cursor-pointer md-corner-sm border border-[var(--md-sys-color-outline)] bg-transparent md-focus-ring"
                      value={tagEditColor || "#c026d3"}
                      onChange={(e) => setTagEditColor(e.target.value)}
                    />
                    <button
                      type="button"
                      className="md-btn-text md-focus-ring px-1 py-0.5 text-[0.625rem] underline"
                      onClick={() => setTagEditColor("")}
                    >
                      清除
                    </button>
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="md-btn-filled md-focus-ring flex-1 py-1 text-[0.625rem] font-medium"
                      onClick={() => {
                        updateTag(t.id, {
                          name: tagEditName,
                          color: tagEditColor,
                        });
                        setEditingTagId(null);
                      }}
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      className="md-btn-outlined md-focus-ring px-2 py-1 text-[0.625rem]"
                      onClick={() => setEditingTagId(null)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_2.25rem] items-center gap-x-1">
                  <button
                    type="button"
                    onClick={() =>
                      setNavTagId(navTagId === t.id ? null : t.id)
                    }
                    className={`flex min-w-0 items-center gap-2 md-corner-md px-2 py-2 text-left md-type-body-s ${
                      navTagId === t.id
                        ? "text-md-on-surface"
                        : "text-md-on-surface-variant md-state-hover"
                    }`}
                    style={
                      navTagId === t.id
                        ? {
                            backgroundColor: `${resolveTagColor(t, tagIdx)}28`,
                            boxShadow: `inset 0 0 0 1px ${resolveTagColor(t, tagIdx)}45`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: resolveTagColor(t, tagIdx),
                      }}
                    />
                    <span className="min-w-0 truncate">{t.name}</span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 md-corner-sm p-1 text-md-on-surface-variant opacity-0 md-state-hover-subtle hover:text-md-primary group-hover:opacity-100 md-focus-ring"
                    title="编辑标签"
                    onClick={() => {
                      setEditingTagId(t.id);
                      setTagEditName(t.name);
                      setTagEditColor(t.color ?? "");
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="shrink-0 md-corner-sm p-1 text-md-on-surface-variant opacity-0 md-state-hover-subtle hover:text-red-400 group-hover:opacity-100 md-focus-ring"
                    title="删除标签"
                    onClick={() => deleteTag(t.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <span
                    className={`${countCol} ${
                      navTagId === t.id ? "text-md-on-surface" : ""
                    }`}
                  >
                    {tagCounts[t.id] ?? 0}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex shrink-0 gap-1 border-t border-[var(--md-sys-color-outline)] pt-2">
          <input
            className="md-field md-focus-ring min-w-0 flex-1 px-2 py-1.5 md-type-body-s"
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
            className="md-btn-tonal md-focus-ring shrink-0 px-2 py-1.5"
            onClick={() => {
              addTag(tagDraft);
              setTagDraft("");
            }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 shrink-0 border-t border-[var(--md-sys-color-outline)] pt-3">
        <p className="md-type-label-s mb-2 flex items-center gap-1.5">
          <AtSign className="h-3 w-3" />
          涉及的人
        </p>
        <button
          type="button"
          onClick={() => setNavMention(null)}
          className={`mb-2 md-corner-md px-2 py-1.5 text-left md-type-body-s ${
            navMention === null
              ? "bg-[var(--md-sys-color-surface-container-highest)] text-md-on-surface"
              : "text-md-on-surface-variant md-state-hover"
          }`}
        >
          不限 @提及
        </button>
        <ul className="flex flex-col gap-1 pb-1">
          {mentionSummaries.map((m) => (
            <li key={m.key}>
              <button
                type="button"
                onClick={() =>
                  setNavMention(navMention === m.key ? null : m.key)
                }
                className={`grid w-full grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-2 md-corner-md px-2 py-2 text-left md-type-body-s ${
                  navMention === m.key
                    ? "bg-[var(--md-sys-color-secondary-container)] text-md-on-secondary-container"
                    : "text-md-on-surface-variant md-state-hover"
                }`}
              >
                <span className="min-w-0 truncate">
                  @{m.label}
                </span>
                <span
                  className={`${countCol} ${
                    navMention === m.key
                      ? "text-md-on-secondary-container/80"
                      : ""
                  }`}
                >
                  {m.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
        </div>
        </div>
      </div>
    </aside>
  );
}
