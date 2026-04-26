import type { CSSProperties } from "react";
import type { TaskPriority } from "./types";

const CHECK_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
);

const X_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>',
);

/** 未完成：仅边框用优先级色；未设置优先级时为中性灰边框 */
export function priorityCheckboxBorder(p: TaskPriority | undefined): string {
  if (p === undefined) return "rgba(161, 161, 170, 0.55)";
  switch (p) {
    case "high":
      return "#f87171";
    case "medium":
      return "#fbbf24";
    case "low":
      return "#38bdf8";
    default:
      return "rgba(161, 161, 170, 0.55)";
  }
}

/** 列表用原生 checkbox：未完成为灰底 + 彩色边框；已完成为主题色 + 勾；已放弃为琥珀色 + 叉 */
export function listCheckboxStyle(
  completed: boolean,
  p: TaskPriority | undefined,
  abandoned?: boolean,
): CSSProperties {
  if (abandoned) {
    return {
      backgroundColor: "rgb(180 83 9)",
      borderColor: "rgb(146 64 14)",
      backgroundImage: `url("data:image/svg+xml,${X_SVG}")`,
      backgroundSize: "10px 10px",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  if (completed) {
    return {
      backgroundColor: "var(--accent)",
      borderColor: "var(--accent)",
      backgroundImage: `url("data:image/svg+xml,${CHECK_SVG}")`,
      backgroundSize: "10px 10px",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  return {
    backgroundColor: "var(--checkbox-unchecked-fill)",
    borderColor: priorityCheckboxBorder(p),
  };
}
