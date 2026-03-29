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
  type Connection,
  type EdgeChange,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { FolderLaneNode } from "@/components/flow/FolderLaneNode";
import { GroupFrameNode } from "@/components/flow/GroupFrameNode";
import { TaskNode } from "@/components/flow/TaskNode";
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

  const visibleIds = useMemo(
    () => visibleTaskIdSet(tasks, navFolderId),
    [tasks, navFolderId],
  );

  const filteredStoreEdges = useMemo(
    () => filterEdgesForTasks(storeEdges, visibleIds),
    [storeEdges, visibleIds],
  );

  const builtNodes = useMemo(
    () => buildFlowNodes(tasks, groups, layout, folders, navFolderId),
    [tasks, groups, layout, folders, navFolderId],
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

  const { screenToFlowPosition, getNodes } = useReactFlow();

  const paneClickRef = useRef({ t: 0, x: 0, y: 0 });

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, _node: Node) => {
      syncCanvasLayout(getNodes());
    },
    [getNodes, syncCanvasLayout],
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

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full">
      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2">
        <select
          className="max-w-[200px] rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1.5 text-xs text-zinc-200 shadow-lg outline-none focus:border-[var(--accent)]"
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
          className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-1.5 text-xs text-zinc-200 shadow-lg hover:border-[var(--accent)]"
          onClick={() => addTask("新任务")}
        >
          + 任务
        </button>
        <button
          type="button"
          disabled={!canGroup}
          className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-1.5 text-xs text-zinc-200 shadow-lg enabled:hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onCreateGroup}
        >
          建组（多选 ≥2）
        </button>
        <span className="text-[10px] text-zinc-600">快速连点画布空白添加</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.15}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
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
