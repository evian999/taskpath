"use client";

type Props = { open: boolean; onClose: () => void };

export function CanvasHelpDialog({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="canvas-help-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,32rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="canvas-help-title"
          className="text-base font-semibold text-zinc-100"
        >
          画布模式说明
        </h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-xs leading-relaxed text-zinc-400">
          <li>
            <strong className="text-zinc-300">文件夹竖条</strong>
            ：彩色左边线的区域表示一个文件夹；拖<strong>标题栏</strong>
            可整体移动，拖边角可改变区域大小。中间空白处可点到下层连线。
          </li>
          <li>
            <strong className="text-zinc-300">任务卡片</strong>
            ：矩形节点为单个任务；从左右圆点拖线可连接到其他任务。可拖动卡片调整位置。
            已完成任务默认不显示；若沿连线方向（作为起点）仍能到达未完成任务，则会显示以便查看衔接关系。
          </li>
          <li>
            <strong className="text-zinc-300">任务组（虚线框）</strong>
            ：多选 ≥2 个任务后点工具栏叠层图标建组；拖标题栏移动整组。
          </li>
          <li>
            <strong className="text-zinc-300">连线</strong>
            ：选中后高亮；按 Delete / Backspace 删除。拖线到空白或按 Esc
            取消正在创建的连线。
          </li>
          <li>
            <strong className="text-zinc-300">小地图与缩放</strong>
            ：左下角控件可缩放、平移；小地图用于总览。工具栏「适应任务」会动画缩放视口，框住当前筛选下画布上的全部任务节点。
          </li>
          <li>
            <strong className="text-zinc-300">快捷</strong>
            ：连点空白处快速新建任务；<kbd className="rounded bg-black/40 px-1">Alt+A</kbd>{" "}
            全选当前画布上的任务节点（不与 Ctrl/⌘+A、Ctrl+Shift+A 等冲突；需同时按住 Alt，且不按
            Ctrl/⌘）。
          </li>
        </ul>
        <button
          type="button"
          className="mt-5 w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-[var(--bg-deep)] hover:brightness-110"
          onClick={onClose}
        >
          知道了
        </button>
      </div>
    </div>
  );
}
