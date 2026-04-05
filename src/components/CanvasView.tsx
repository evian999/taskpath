"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStoreApi,
  type Connection,
  type EdgeChange,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Hand,
  MousePointer2,
  ScanSearch,
  SquareStack,
} from "lucide-react";
import { CanvasHelpDialog } from "@/components/CanvasHelpDialog";
import { FolderLaneNode } from "@/components/flow/FolderLaneNode";
import { GroupFrameNode } from "@/components/flow/GroupFrameNode";
import { HighlightSmoothStepEdge } from "@/components/flow/HighlightSmoothStepEdge";
import { TaskNode } from "@/components/flow/TaskNode";
import { separateOverlappingTaskNodes } from "@/lib/canvas-overlap";
import {
  buildFlowEdges,
  buildFlowNodes,
  filterEdgesForTasks,
  visibleTaskIdSet,
} from "@/lib/flow-build";
import { INBOX_FOLDER_KEY, type NavFolderId } from "@/lib/types";
import { useAppStore } from "@/lib/store";

const nodeTypes = {
  task: TaskNode,
  groupFrame: GroupFrameNode,
  folderLane: FolderLaneNode,
} as NodeTypes;

const edgeTypes = {
  highlightSmoothstep: HighlightSmoothStepEdge,
};

function CanvasInner() {
  const tasks = useAppStore((s) => s.tasks);
  const groups = useAppStore((s) => s.groups);
  const layout = useAppStore((s) => s.layout);
  const folders = useAppStore((s) => s.folders);
  const navFolderId = useAppStore((s) => s.navFolderId);
  const setNavFolderId = useAppStore((s) => s.setNavFolderId);
  const storeEdges = useAppStore((s) => s.edges);
  const addEdgeToStore = useAppStore((s) => s.addEdge);
  const removeEdge = useAppStore((s) => s.removeEdge);
  const addTask = useAppStore((s) => s.addTask);
  const syncCanvasLayout = useAppStore((s) => s.syncCanvasLayout);
  const createGroupFromTaskIds = useAppStore((s) => s.createGroupFromTaskIds);
  const arrangeTasksLinear = useAppStore((s) => s.arrangeTasksLinear);
  const storeApi = useStoreApi();
  const [helpOpen, setHelpOpen] = useState(false);
  /** 画布顶部工具栏展开/收起 */
  const [canvasToolbarExpanded, setCanvasToolbarExpanded] = useState(true);
  /** 重置「排列」下拉的受控 trick */
  const [arrangeMenuKey, setArrangeMenuKey] = useState(0);
  /** 选择：左键拖可选框/点节点；抓手：左键拖动画布 */
  const [canvasTool, setCanvasTool] = useState<"select" | "hand">("select");

  const visibleIds = useMemo(
    () => visibleTaskIdSet(tasks, navFolderId, storeEdges),
    [tasks, navFolderId, storeEdges],
  );

  const filteredStoreEdges = useMemo(
    () => filterEdgesForTasks(storeEdges, visibleIds),
    [storeEdges, visibleIds],
  );

  const builtNodes = useMemo(
    () =>
      buildFlowNodes(tasks, groups, layout, folders, navFolderId, storeEdges),
    [tasks, groups, layout, folders, navFolderId, storeEdges],
  );
  const builtEdges = useMemo(
    () => buildFlowEdges(filteredStoreEdges),
    [filteredStoreEdges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(builtNodes);
  const [edges, setEdges, onEdgesChangeRf] = useEdgesState(builtEdges);

  useEffect(() => {
    setNodes(builtNodes);
  }, [builtNodes, setNodes]);

  useEffect(() => {
    setEdges(builtEdges);
  }, [builtEdges, setEdges]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)
        return;
      const { connection, cancelConnection } = storeApi.getState();
      if (connection.inProgress) {
        e.preventDefault();
        cancelConnection();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [storeApi]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() !== "a") return;
      if (!e.altKey) return;
      if (e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement
      )
        return;
      if (t instanceof HTMLElement) {
        if (t.isContentEditable) return;
        if (t.closest("input, textarea, select, [contenteditable=true]"))
          return;
      }
      e.preventDefault();
      setNodes((nds) =>
        nds.map((n) =>
          n.type === "task" ? { ...n, selected: true } : { ...n, selected: false },
        ),
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setNodes]);

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChangeRf(changes);
      for (const c of changes) {
        if (c.type === "remove") removeEdge(c.id);
      }
    },
    [onEdgesChangeRf, removeEdge],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      addEdgeToStore(c.source, c.target);
    },
    [addEdgeToStore],
  );

  const { screenToFlowPosition, getNodes, fitView } = useReactFlow();

  const visibleTaskNodeCount = useMemo(
    () => nodes.filter((n) => n.type === "task").length,
    [nodes],
  );

  const onFitVisibleTasks = useCallback(() => {
    const taskNodes = getNodes().filter((n) => n.type === "task");
    if (taskNodes.length === 0) return;
    void fitView({
      nodes: taskNodes,
      padding: 0.12,
      duration: 320,
      maxZoom: 1.5,
      minZoom: 0.15,
    });
  }, [getNodes, fitView]);

  const selectedTaskIds = useMemo(
    () =>
      nodes
        .filter((n) => n.type === "task" && n.selected)
        .map((n) => n.id),
    [nodes],
  );

  const onArrange = useCallback(
    (direction: "horizontal" | "vertical") => {
      const ids =
        getNodes()
          .filter((n) => n.type === "task" && n.selected)
          .map((n) => n.id) ?? [];
      if (ids.length === 0) return;
      arrangeTasksLinear(ids, direction);
    },
    [arrangeTasksLinear, getNodes],
  );

  const paneClickRef = useRef({ t: 0, x: 0, y: 0 });

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, _node: Node) => {
      const resolved = separateOverlappingTaskNodes(getNodes());
      setNodes(resolved);
      syncCanvasLayout(resolved);
    },
    [getNodes, setNodes, syncCanvasLayout],
  );

  const onPaneClick = useCallback(
    (e: React.MouseEvent) => {
      const now = Date.now();
      const prev = paneClickRef.current;
      if (
        now - prev.t < 320 &&
        Math.abs(e.clientX - prev.x) < 8 &&
        Math.abs(e.clientY - prev.y) < 8
      ) {
        paneClickRef.current = { t: 0, x: 0, y: 0 };
        const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        addTask("新任务", p);
      } else {
        paneClickRef.current = { t: now, x: e.clientX, y: e.clientY };
      }
    },
    [addTask, screenToFlowPosition],
  );

  const selectedIds = useMemo(
    () => new Set(nodes.filter((n) => n.selected).map((n) => n.id)),
    [nodes],
  );

  const taskIdsForGroup = useMemo(
    () =>
      [...selectedIds].filter(
        (id) => !id.startsWith("grp-") && !id.startsWith("fld-"),
      ),
    [selectedIds],
  );

  const canGroup = taskIdsForGroup.length >= 2;

  const onCreateGroup = useCallback(() => {
    if (taskIdsForGroup.length < 2) return;
    createGroupFromTaskIds(taskIdsForGroup);
  }, [createGroupFromTaskIds, taskIdsForGroup]);

  const onNavSelect = (v: string) => {
    setNavFolderId(v as NavFolderId);
  };

  const panOnDrag = canvasTool === "hand" ? true : ([1, 2] as [number, number]);
  const selectionOnDrag = canvasTool === "select";

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full">
      <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)]">
        <div
          className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1.5 shadow-lg [scrollbar-width:thin]"
          role="toolbar"
          aria-label="画布工具栏"
        >
          <select
            className="max-w-[min(200px,40vw)] shrink-0 rounded-md border border-[var(--panel-border)] bg-[var(--bg-deep)]/40 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-[var(--accent)]"
            value={navFolderId}
            onChange={(e) => onNavSelect(e.target.value)}
            title="画布按文件夹筛选"
          >
            <option value="all">全部文件夹</option>
            <option value={INBOX_FOLDER_KEY}>收件箱</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            title={
              canvasToolbarExpanded
                ? "向右收起侧栏工具"
                : "向左展开工具栏"
            }
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-[var(--panel-border)] bg-[var(--bg-deep)]/40 px-2 py-1.5 text-zinc-300 hover:border-[var(--accent)] hover:text-zinc-100"
            onClick={() => setCanvasToolbarExpanded((v) => !v)}
            aria-expanded={canvasToolbarExpanded}
          >
            {canvasToolbarExpanded ? (
              <ChevronLeft className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          {canvasToolbarExpanded ? (
            <>
              <div className="flex shrink-0 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-0.5 shadow-lg">
                <button
                  type="button"
                  title="选择模式（左键拖可选区；中键/右键拖动画布）"
                  className={`rounded px-2 py-1.5 ${canvasTool === "select" ? "bg-[var(--accent)]/25 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
                  onClick={() => setCanvasTool("select")}
                >
                  <MousePointer2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="抓手模式（左键拖动画布）"
                  className={`rounded px-2 py-1.5 ${canvasTool === "hand" ? "bg-[var(--accent)]/25 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
                  onClick={() => setCanvasTool("hand")}
                >
                  <Hand className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2.5 py-1.5 text-xs text-zinc-200 shadow-lg hover:border-[var(--accent)]"
                onClick={() => addTask("新任务")}
              >
                + 任务
              </button>
              <button
                type="button"
                disabled={visibleTaskNodeCount === 0}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1.5 text-xs text-zinc-200 shadow-lg enabled:hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                title="缩放并平移视口，框住当前画布上的全部任务（不含文件夹条与组框）"
                onClick={onFitVisibleTasks}
              >
                <ScanSearch className="h-3.5 w-3.5 shrink-0" />
                适应
              </button>
              <button
                type="button"
                disabled={!canGroup}
                title="建组（多选 ≥2 个任务）"
                className="inline-flex shrink-0 items-center justify-center rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1.5 text-zinc-200 shadow-lg enabled:hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                onClick={onCreateGroup}
              >
                <SquareStack className="h-3.5 w-3.5" />
              </button>
              <select
                key={arrangeMenuKey}
                defaultValue="_"
                disabled={selectedTaskIds.length === 0}
                title="等距排列已选任务"
                className="max-w-[7.5rem] shrink-0 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1.5 text-xs text-zinc-200 shadow-lg outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "horizontal") onArrange("horizontal");
                  if (v === "vertical") onArrange("vertical");
                  setArrangeMenuKey((k) => k + 1);
                }}
              >
                <option value="_">
                  排列…
                </option>
                <option value="horizontal">横向等距</option>
                <option value="vertical">纵向等距</option>
              </select>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1.5 text-xs text-zinc-200 shadow-lg hover:border-[var(--accent)]"
                title="画布说明（含快捷键与连线删除方式）"
                onClick={() => setHelpOpen(true)}
              >
                <CircleHelp className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
        </div>
      </div>
      <CanvasHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        panOnDrag={panOnDrag}
        selectionOnDrag={selectionOnDrag}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
        minZoom={0.15}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        className={
          canvasTool === "hand"
            ? "!bg-transparent [&_.react-flow__pane]:!cursor-grab [&_.react-flow__pane:active]:!cursor-grabbing"
            : "!bg-transparent"
        }
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(148,163,184,0.15)"
        />
        <Controls
          className="!m-3 !border-[var(--panel-border)] !bg-[var(--panel-bg)] !shadow-lg [&_button]:!fill-zinc-400 [&_button:hover]:!fill-zinc-100"
        />
        <MiniMap
          className="!m-3 !rounded-md !border !border-[var(--panel-border)] !bg-[var(--bg-deep)]"
          nodeColor={() => "rgba(56,189,248,0.35)"}
          maskColor="rgba(0,0,0,0.45)"
        />
      </ReactFlow>
    </div>
  );
}

export default function CanvasView() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
