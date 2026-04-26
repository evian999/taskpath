"use client";

type Props = { open: boolean; onClose: () => void };

export function CanvasHelpDialog({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="md-scrim fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="canvas-help-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,32rem)] w-full max-w-lg overflow-y-auto border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)] p-5 md-corner-xl"
        style={{ boxShadow: "var(--md-sys-elevation-shadow-dialog)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="canvas-help-title" className="md-type-title-m">
          画布模式说明
        </h2>
        <ul className="mt-4 list-inside list-disc space-y-2 md-type-body-s leading-relaxed">
          <li>
            <strong className="text-md-on-surface">文件夹竖条</strong>
            ：彩色左边线的区域表示一个文件夹；拖<strong>标题栏</strong>
            可整体移动，拖边角可改变区域大小。中间空白处可点到下层连线。
          </li>
          <li>
            <strong className="text-md-on-surface">任务卡片</strong>
            ：矩形节点为单个任务；从左右圆点拖线可连接到其他任务。可拖动卡片调整位置。
            已完成任务默认不显示；若沿连线方向（作为起点）仍能到达未完成任务，则会显示以便查看衔接关系。
          </li>
          <li>
            <strong className="text-md-on-surface">任务组（虚线框）</strong>
            ：多选 ≥2 个任务后点工具栏叠层图标建组；拖标题栏移动整组。
          </li>
          <li>
            <strong className="text-md-on-surface">连线</strong>
            ：选中后高亮，左下角会出现「连线说明」输入框可改边上文字；按 Delete /
            Backspace 删除。拖线到空白或按 Esc 取消正在创建的连线。
          </li>
          <li>
            <strong className="text-md-on-surface">框选与平移（选择模式）</strong>
            ：请在<strong>画布空白</strong>（点状背景、无节点处）左键斜向拖曳框选。文件夹彩色条内请以
            <strong>Ctrl / ⌘ + 点击</strong>
            多选任务（条内拖框易与画布手势冲突）。平移视口请用<strong>鼠标中键或右键</strong>
            拖动，或<strong>按住空格</strong>时再按住左键拖动；也可用小地图与左下角缩放控件。按 Esc
            可取消未结束的框选。
          </li>
          <li>
            <strong className="text-md-on-surface">小地图与缩放</strong>
            ：左下角控件可缩放、平移；小地图用于总览。工具栏「适应任务」会动画缩放视口，框住当前筛选下画布上的全部任务节点。
          </li>
          <li>
            <strong className="text-md-on-surface">快捷</strong>
            ：连点空白处快速新建任务；<kbd className="md-corner-xs bg-[var(--md-sys-color-surface-container-highest)] px-1">
              Alt+A
            </kbd>{" "}
            全选当前画布上的任务节点（不与 Ctrl/⌘+A、Ctrl+Shift+A 等冲突；需同时按住 Alt，且不按
            Ctrl/⌘）。
          </li>
        </ul>
        <button
          type="button"
          className="md-btn-filled md-focus-ring mt-5 w-full py-2 md-type-body-m"
          onClick={onClose}
        >
          知道了
        </button>
      </div>
    </div>
  );
}
