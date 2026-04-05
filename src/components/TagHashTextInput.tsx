"use client";

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Tag } from "@/lib/types";

function assignRef<T>(
  r: React.Ref<T> | undefined,
  el: T | null,
) {
  if (!r) return;
  if (typeof r === "function") (r as (v: T | null) => void)(el);
  else (r as React.MutableRefObject<T | null>).current = el;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  tags: Tag[];
  placeholder?: string;
  className?: string;
  /** 为 true 时在输入框上方展开建议（用于对话框等） */
  suggestAbove?: boolean;
  /** 内部处理 # 菜单快捷键之后调用（例如回车提交外层表单） */
  onInputKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
};

export const TagHashTextInput = forwardRef<HTMLInputElement, Props>(
  function TagHashTextInput(
    {
      value,
      onChange,
      tags,
      placeholder,
      className,
      suggestAbove,
      onInputKeyDown,
    },
    ref,
  ) {
    const innerRef = useRef<HTMLInputElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const setInputRef = (el: HTMLInputElement | null) => {
      innerRef.current = el;
      assignRef(ref, el);
    };

    const [hashMenu, setHashMenu] = useState<{
      anchor: number;
      query: string;
      highlight: number;
    } | null>(null);

    const [hashMenuPos, setHashMenuPos] = useState({ top: 0, left: 0, width: 0 });

    const suggestMatches = useMemo(() => {
      if (!hashMenu) return [];
      const q = hashMenu.query.toLowerCase();
      return tags.filter((t) => t.name.toLowerCase().startsWith(q));
    }, [tags, hashMenu]);

    const updateHashMenuPos = useCallback(() => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setHashMenuPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }, []);

    useLayoutEffect(() => {
      if (!hashMenu || suggestMatches.length === 0 || suggestAbove) return;
      updateHashMenuPos();
      const onMove = () => updateHashMenuPos();
      window.addEventListener("resize", onMove);
      window.addEventListener("scroll", onMove, true);
      return () => {
        window.removeEventListener("resize", onMove);
        window.removeEventListener("scroll", onMove, true);
      };
    }, [hashMenu, suggestMatches.length, suggestAbove, updateHashMenuPos]);

    const syncHashMenu = (v: string, cursor: number) => {
      const before = v.slice(0, cursor);
      const m = before.match(/#([^#\s]*)$/);
      if (!m) {
        setHashMenu(null);
        return;
      }
      const anchor = before.lastIndexOf("#");
      const query = m[1] ?? "";
      setHashMenu((prev) => ({
        anchor,
        query,
        highlight:
          prev && prev.anchor === anchor && prev.query === query
            ? prev.highlight
            : 0,
      }));
    };

    const applyHashPick = (tagName: string) => {
      const input = innerRef.current;
      if (!input || !hashMenu) return;
      const cursor = input.selectionStart ?? value.length;
      const { anchor } = hashMenu;
      const before = value.slice(0, anchor);
      const after = value.slice(cursor);
      const insert = `#${tagName} `;
      const next = before + insert + after;
      const pos = before.length + insert.length;
      onChange(next);
      setHashMenu(null);
      queueMicrotask(() => {
        input.focus();
        input.setSelectionRange(pos, pos);
      });
    };

    const inputClassName = ["w-full min-w-0", className].filter(Boolean).join(" ");

    const suggestionList =
      hashMenu && suggestMatches.length > 0 ? (
        <>
          {suggestMatches.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === hashMenu.highlight
                    ? "bg-[var(--accent)]/20 text-zinc-100"
                    : "text-zinc-300 hover:bg-white/5"
                }`}
                onMouseEnter={() =>
                  setHashMenu((h) => (h ? { ...h, highlight: i } : h))
                }
                onClick={() => applyHashPick(t.name)}
              >
                #{t.name}
              </button>
            </li>
          ))}
        </>
      ) : null;

    const showSuggestions = Boolean(hashMenu && suggestMatches.length > 0);

    return (
      <div
        ref={wrapRef}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col justify-center"
      >
        <input
          ref={setInputRef}
          className={inputClassName}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            const c = e.target.selectionStart ?? v.length;
            syncHashMenu(v, c);
          }}
          onSelect={(e) => {
            const t = e.target as HTMLInputElement;
            syncHashMenu(t.value, t.selectionStart ?? t.value.length);
          }}
          onKeyDown={(e) => {
            if (hashMenu && suggestMatches.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHashMenu((h) =>
                  h
                    ? {
                        ...h,
                        highlight: Math.min(
                          h.highlight + 1,
                          suggestMatches.length - 1,
                        ),
                      }
                    : h,
                );
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHashMenu((h) =>
                  h ? { ...h, highlight: Math.max(0, h.highlight - 1) } : h,
                );
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                const pick = suggestMatches[hashMenu.highlight];
                if (pick) applyHashPick(pick.name);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setHashMenu(null);
                return;
              }
            }
            onInputKeyDown?.(e);
          }}
          onBlur={() => {
            window.setTimeout(() => setHashMenu(null), 150);
          }}
        />
        {showSuggestions && suggestAbove ? (
          <ul
            className="absolute bottom-full z-40 mb-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] py-1 shadow-xl"
            onMouseDown={(e) => e.preventDefault()}
          >
            {suggestionList}
          </ul>
        ) : null}
        {showSuggestions &&
        !suggestAbove &&
        typeof document !== "undefined" ? (
          createPortal(
            <ul
              className="z-[9998] max-h-48 overflow-y-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] py-1 shadow-xl"
              style={{
                position: "fixed",
                top: hashMenuPos.top,
                left: hashMenuPos.left,
                width: hashMenuPos.width,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {suggestionList}
            </ul>,
            document.body,
          )
        ) : null}
      </div>
    );
  },
);
