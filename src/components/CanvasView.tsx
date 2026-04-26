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
  ArrowUpToLine,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Hand,
  ListChecks,
  MousePointer2,
  ScanSearch,
  SquareStack,
} from "lucide-react";
import { CanvasHelpDialog } from "@/components/CanvasHelpDialog";
import { FolderLaneNode } from "@/components/flow/FolderLaneNode";
import { GroupFrameNode } from "@/components/flow/GroupFrameNode";
import { HighlightSmoothStepEdge } from "@/components/flow/HighlightSmoothStepEdge";
import { TaskNode } from "@/components/flow/TaskNode";
import { folderKeyContainingFlowPoint } from "@/lib/canvas-folder-hit";
import {
  clampTaskNodesBelowFolderTitle,
  taskHitCenterFlow,
} from "@/lib/canvas-node-absolute";
import { separateOverlappingTaskNodes } from "@/lib/canvas-overlap";
import {
  buildFlowEdges,
  buildFlowNodes,
  filterEdgesForTasks,
  visibleTaskIdSet,
} from "@/lib/flow-build";
import { buildFlexOffCanvasJson } from "@/lib/canvas-export-json";
import {
  TASK_NODE_BOUNDS_H,
  TASK_NODE_BOUNDS_W,
} from "@/lib/folder-fit";
import {
  ARCHIVE_FOLDER_KEY,
  INBOX_FOLDER_KEY,
  RECENT_DELETED_FOLDER_KEY,
  type NavFolderId,
  taskFolderKey,
} from "@/lib/types";
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
  const tags = useAppStore((s) => s.tags);
  const groups = useAppStore((s) => s.groups);
  const layout = useAppStore((s) => s.layout);
  const folders = useAppStore((s) => s.folders);
  const navFolderId = useAppStore((s) => s.navFolderId);
  const setNavFolderId = useAppStore((s) => s.setNavFolderId);
  const storeEdges = useAppStore((s) => s.edges);
  const addEdgeToStore = useAppStore((s) => s.addEdge);
  const removeEdge = useAppStore((s) => s.removeEdge);
  const updateEdge = useAppStore((s) => s.updateEdge);
  const addTask = useAppStore((s) => s.addTask);
  const syncCanvasLayout = useAppStore((s) => s.syncCanvasLayout);
  const createGroupFromTaskIds = useAppStore((s) => s.createGroupFromTaskIds);
  const arrangeTasksLinear = useAppStore((s) => s.arrangeTasksLinear);
  const arrangeTasksSpherical = useAppStore((s) => s.arrangeTasksSpherical);
  const assignTaskFoldersAndRefitLanes = useAppStore(
    (s) => s.assignTaskFoldersAndRefitLanes,
  );
  const storeApi = useStoreApi();
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeLabelDraft, setEdgeLabelDraft] = useState("");
  /** 默认展开，与「将画布工具栏改为默认展开」一致 */
  const [canvasToolbarExpanded, setCanvasToolbarExpanded] = useState(true);
  /** 显示当前导航下全部任务（含已无未完成下游的已完成） */
  const [showCompletedOnCanvas, setShowCompletedOnCanvas] = useState(false);
  /** 重置「排列」下拉的受控 trick */
  const [arrangeMenuKey, setArrangeMenuKey] = useState(0);
  /** 选择：空白处左键拖框选（空格+左键或中键/右键平移）；抓手：左键拖平移 */
  const [canvasTool, setCanvasTool] = useState<"select" | "hand">("select");

  const canvasVisibility = useMemo(
    () =>
      showCompletedOnCanvas
        ? ({ showAllCompletedInNav: true } as const)
        : undefined,
    [showCompletedOnCanvas],
  );

  const visibleIds = useMemo(
    () => visibleTaskIdSet(tasks, navFolderId, storeEdges, canvasVisibility),
    [tasks, navFolderId, storeEdges, canvasVisibility],
  );

  const filteredStoreEdges = useMemo(
    () => filterEdgesForTasks(storeEdges, visibleIds),
    [storeEdges, visibleIds],
  );

  const builtNodes = useMemo(
    () =>
      buildFlowNodes(
        tasks,
        groups,
        layout,
        folders,
        navFolderId,
        storeEdges,
        canvasVisibility,
      ),
    [tasks, groups, layout, folders, navFolderId, storeEdges, canvasVisibility],
  );
  const builtEdges = useMemo(
    () => buildFlowEdges(filteredStoreEdges, tasks, tags),
    [filteredStoreEdges, tasks, tags],
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
    if (!selectedEdgeId) {
      setEdgeLabelDraft("");
      return;
    }
    const e = storeEdges.find((x) => x.id === selectedEdgeId);
    setEdgeLabelDraft(e?.label ?? "");
  }, [selectedEdgeId, storeEdges]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)
        return;
      const st = storeApi.getState();
      const { connection, cancelConnection } = st;
      if (connection.inProgress) {
        e.preventDefault();
        cancelConnection();
        return;
      }
      if (st.userSelectionActive || st.userSelectionRect) {
        e.preventDefault();
        storeApi.setState({
          userSelectionActive: false,
          userSelectionRect: null,
        });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [storeApi]);

  /** 框选拖一半失焦/切窗时 xyflow 可能卡住，清掉后中键/平移会恢复 */
  useEffect(() => {
    const clearStuckSelection = () => {
      const st = storeApi.getState();
      if (st.userSelectionActive || st.userSelectionRect) {
        storeApi.setState({
          userSelectionActive: false,
          userSelectionRect: null,
        });
      }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") clearStuckSelection();
    };
    window.addEventListener("blur", clearStuckSelection);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", clearStuckSelection);
      document.removeEventListener("visibilitychange", onVis);
    };
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

  const { screenToFlowPosition, getNodes, fitView, setViewport, getViewport } =
    useReactFlow();

  const onCanvasScrollTop = useCallback(() => {
    const z = getViewport().zoom;
    void setViewport({ x: 0, y: 0, zoom: z }, { duration: 280 });
  }, [getViewport, setViewport]);

  const onSelectionChange = useCallback(
    ({ edges: selEdges }: { edges: { id: string }[] }) => {
      if (selEdges.length === 1) setSelectedEdgeId(selEdges[0]!.id);
      else setSelectedEdgeId(null);
    },
    [],
  );

  const onExportFlexOffJson = useCallback(() => {
    const { tasks, edges, groups, layout, folders, navFolderId } =
      useAppStore.getState();
    const payload = buildFlexOffCanvasJson({
      tasks,
      edges,
      groups,
      layout,
      folders,
      navFolderId,
      flowTaskNodes: getNodes().filter((n) => n.type === "task"),
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flex-off-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getNodes]);

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

  const skipNavFolderFitOnMount = useRef(true);
  useEffect(() => {
    if (skipNavFolderFitOnMount.current) {
      skipNavFolderFitOnMount.current = false;
      return;
    }
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const taskNodes = getNodes().filter((n) => n.type === "task");
        if (taskNodes.length === 0) return;
        void fitView({
          nodes: taskNodes,
          padding: 0.12,
          duration: 320,
          maxZoom: 1.5,
          minZoom: 0.15,
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [navFolderId, fitView, getNodes]);

  const selectedTaskIds = useMemo(
    () =>
      nodes
        .filter((n) => n.type === "task" && n.selected)
        .map((n) => n.id),
    [nodes],
  );

  const onArrange = useCallback(
    (mode: "horizontal" | "vertical" | "spherical") => {
      const ids =
        getNodes()
          .filter((n) => n.type === "task" && n.selected)
          .map((n) => n.id) ?? [];
      if (ids.length === 0) return;
      if (mode === "spherical") arrangeTasksSpherical(ids);
      else arrangeTasksLinear(ids, mode);
    },
    [arrangeTasksLinear, arrangeTasksSpherical, getNodes],
  );

  const paneClickRef = useRef({ t: 0, x: 0, y: 0 });

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, _node: Node) => {
      const resolved = clampTaskNodesBelowFolderTitle(
        separateOverlappingTaskNodes(getNodes()),
      );
      setNodes(resolved);
      syncCanvasLayout(resolved);

      const byId = new Map(resolved.map((n) => [n.id, n]));
      const { layout: lay, tasks: taskList } = useAppStore.getState();
      const updates: { taskId: string; folderId: string | undefined }[] = [];

      for (const n of resolved) {
        if (n.type !== "task") continue;
        if (n.parentId?.startsWith("grp-")) continue;
        const t = taskList.find((x) => x.id === n.id);
        if (!t) continue;
        const { x: cx, y: cy } = taskHitCenterFlow(n, byId);
        const hitKey = folderKeyContainingFlowPoint(cx, cy, lay.folderRects);
        const newFolderId =
          hitKey === INBOX_FOLDER_KEY ? undefined : hitKey;
        if (taskFolderKey(t) === hitKey) continue;
        updates.push({ taskId: n.id, folderId: newFolderId });
      }

      if (updates.length > 0) assignTaskFoldersAndRefitLanes(updates);
    },
    [
      getNodes,
      setNodes,
      syncCanvasLayout,
      assignTaskFoldersAndRefitLanes,
    ],
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: unknown) => {
      const cs = connectionState as {
        isValid?: boolean;
        fromNode?: Node | null;
        fromHandle?: { type?: string } | null;
      };
      if (cs.isValid) return;
      if (!cs.fromNode?.id || cs.fromHandle?.type !== "source") return;
      const tgt = event.target;
      if (!(tgt instanceof Element)) return;
      if (!tgt.closest(".react-flow__pane")) return;
      const dropOnNode = tgt.closest(".react-flow__node");
      if (dropOnNode) {
        const nid = dropOnNode.getAttribute("data-id");
        if (
          nid &&
          !nid.startsWith("fld-") &&
          !nid.startsWith("grp-")
        ) {
          return;
        }
      }
      let x: number;
      let y: number;
      if ("changedTouches" in event && event.changedTouches[0]) {
        x = event.changedTouches[0].clientX;
        y = event.changedTouches[0].clientY;
      } else {
        x = (event as MouseEvent).clientX;
        y = (event as MouseEvent).clientY;
      }
      const p = screenToFlowPosition({ x, y });
      const { layout: lay, navFolderId: nav } = useAppStore.getState();
      const cx = p.x + TASK_NODE_BOUNDS_W / 2;
      const cy = p.y + TASK_NODE_BOUNDS_H / 2;
      let hitKey = folderKeyContainingFlowPoint(cx, cy, lay.folderRects);
      if (
        nav !== "all" &&
        nav !== INBOX_FOLDER_KEY &&
        hitKey === INBOX_FOLDER_KEY
      ) {
        hitKey = nav;
      }
      const created = addTask("新任务", p, {
        folderId: hitKey === INBOX_FOLDER_KEY ? null : hitKey,
      });
      addEdgeToStore(cs.fromNode.id, created.id);
    },
    [screenToFlowPosition, addTask, addEdgeToStore],
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

  /** 抓手：左键拖=平移。选择：仅画布空白左键拖=框选；平移用中键/右键或按住空格再左键（与 xyflow 一致）。 */
  const panOnDrag = useMemo(
    () => (canvasTool === "hand" ? true : [1, 2]),
    [canvasTool],
  );
  const selectionOnDrag = canvasTool === "select";

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full">
      <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)]">
        <div
          className="flex flex-nowrap items-center gap-2 overflow-x-auto border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)] px-2 py-1.5 md-corner-md shadow-lg [scrollbar-width:thin]"
          role="toolbar"
          aria-label="画布工具栏"
        >
          <select
            className="md-field md-focus-ring max-w-[min(200px,40vw)] shrink-0 px-2 py-1.5 md-type-body-s text-md-on-surface md-corner-sm"
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
            <option value={ARCHIVE_FOLDER_KEY}>归档</option>
            <option value={RECENT_DELETED_FOLDER_KEY}>最近删除的任务</option>
          </select>
          <button
            type="button"
            title="导出任务流布局 JSON（连线端点、任务与组位置、文件夹尺寸）"
            className="md-btn-tonal md-focus-ring inline-flex shrink-0 items-center justify-center px-2 py-1.5 hover:border-md-primary/50 hover:text-md-on-surface"
            onClick={onExportFlexOffJson}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={
              showCompletedOnCanvas
                ? "仅显示与未完成下游相关的已完成（默认）"
                : "显示本文件夹内全部任务（含已无后续步骤的已完成）"
            }
            className={`md-btn-tonal md-focus-ring inline-flex shrink-0 items-center justify-center px-2 py-1.5 hover:border-md-primary/50 hover:text-md-on-surface ${
              showCompletedOnCanvas ? "border-md-primary/50 text-md-primary" : ""
            }`}
            onClick={() => setShowCompletedOnCanvas((v) => !v)}
            aria-pressed={showCompletedOnCanvas}
          >
            <ListChecks className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="视口回到画布坐标原点（左上）"
            className="md-btn-tonal md-focus-ring inline-flex shrink-0 items-center justify-center px-2 py-1.5 hover:border-md-primary/50 hover:text-md-on-surface"
            onClick={onCanvasScrollTop}
          >
            <ArrowUpToLine className="h-3.5 w-3.5" />
          </button>
          <div className="md-segmented shrink-0 shadow-lg">
            <button
              type="button"
              title="选择模式：可拖任务；仅在画布空白处左键斜拖=框选；中键/右键拖或按住空格再左键拖=平移"
              className={`md-segment px-2 py-1.5 ${canvasTool === "select" ? "md-segment--active" : "md-segment--inactive"}`}
              onClick={() => setCanvasTool("select")}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="抓手模式：左键拖=平移画布；任务不可拖动"
              className={`md-segment px-2 py-1.5 ${canvasTool === "hand" ? "md-segment--active" : "md-segment--inactive"}`}
              onClick={() => setCanvasTool("hand")}
            >
              <Hand className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            title={
              canvasToolbarExpanded
                ? "向右收起侧栏工具"
                : "向左展开工具栏"
            }
            className="md-btn-tonal md-focus-ring inline-flex shrink-0 items-center justify-center px-2 py-1.5 hover:border-md-primary/50 hover:text-md-on-surface"
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
              <button
                type="button"
                className="md-btn-tonal md-focus-ring shrink-0 px-2.5 py-1.5 md-type-body-s shadow-lg hover:border-md-primary/50"
                onClick={() => addTask("新任务")}
              >
                + 任务
              </button>
              <button
                type="button"
                disabled={visibleTaskNodeCount === 0}
                className="md-btn-tonal md-focus-ring inline-flex shrink-0 items-center gap-1 px-2 py-1.5 md-type-body-s shadow-lg enabled:hover:border-md-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="inline-flex shrink-0 items-center justify-center rounded-md border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)] px-2 py-1.5 text-zinc-200 shadow-lg enabled:hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                onClick={onCreateGroup}
              >
                <SquareStack className="h-3.5 w-3.5" />
              </button>
              <select
                key={arrangeMenuKey}
                defaultValue="_"
                disabled={selectedTaskIds.length === 0}
                title="按卡片占位与间距排列已选任务"
                className="md-field md-focus-ring max-w-[9rem] shrink-0 px-1.5 py-1.5 md-type-body-s text-md-on-surface shadow-lg disabled:cursor-not-allowed disabled:opacity-40 md-corner-sm"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "horizontal") onArrange("horizontal");
                  if (v === "vertical") onArrange("vertical");
                  if (v === "spherical") onArrange("spherical");
                  setArrangeMenuKey((k) => k + 1);
                }}
              >
                <option value="_">
                  排列…
                </option>
                <option value="horizontal">横向等距</option>
                <option value="vertical">纵向等距</option>
                <option value="spherical">球形排列</option>
              </select>
              <button
                type="button"
                className="md-btn-tonal md-focus-ring inline-flex shrink-0 items-center gap-1 px-2 py-1.5 md-type-body-s shadow-lg hover:border-md-primary/50"
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
      {selectedEdgeId ? (
        <div className="absolute bottom-14 left-3 z-10 flex max-w-[min(100%-1.5rem,20rem)] items-center gap-2 rounded-lg border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)] px-2 py-1.5 shadow-lg">
          <span className="shrink-0 text-[10px] text-md-on-surface-variant">
            连线说明
          </span>
          <input
            className="md-field md-focus-ring min-w-0 flex-1 px-2 py-1 md-type-body-s"
            value={edgeLabelDraft}
            onChange={(e) => setEdgeLabelDraft(e.target.value)}
            onBlur={() => {
              const v = edgeLabelDraft.trim();
              updateEdge(selectedEdgeId, {
                label: v ? v : undefined,
              });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="边上显示的文字"
          />
        </div>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={canvasTool === "select"}
        panOnDrag={panOnDrag}
        selectionOnDrag={selectionOnDrag}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
        minZoom={0.15}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        className={
          canvasTool === "hand"
            ? "!bg-transparent canvas-tool--hand [&_.react-flow__pane]:!cursor-grab [&_.react-flow__pane:active]:!cursor-grabbing"
            : "!bg-transparent canvas-tool--select"
        }
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(148,163,184,0.15)"
        />
        <Controls
          className="!m-3 !border-[var(--md-sys-color-outline)] !bg-[var(--md-sys-color-surface-container)] !shadow-lg [&_button]:!fill-[var(--md-sys-color-on-surface-variant)] [&_button:hover]:!fill-[var(--md-sys-color-on-surface)]"
        />
        <MiniMap
          className="!m-3 !rounded-md !border !border-[var(--md-sys-color-outline)] !bg-[var(--md-sys-color-surface-container-low)]"
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
