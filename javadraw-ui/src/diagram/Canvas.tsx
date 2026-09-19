import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
  ViewportPortal,
  getNodesBounds,
  getViewportForBounds,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import { toPng } from 'html-to-image'
import { accentOf, edgePalette } from '../theme'
import { usePalette } from '../data/palette'
import type { TypeInfo } from '../data/types'
import type { EdgeAnchor, EdgeEnd, XY } from './canvasState'
import { CanvasCard } from './CanvasCard'
import { RelationEdge } from './RelationEdge'
import { EdgeMarkers } from './EdgeMarkers'
import { markerColours } from './edgeLook'
import { sideOfHandle } from './handles'
import type { CanvasEdgeData } from './toReactFlow'
import { EdgeThemeProvider } from './EdgeTheme'
import { CardActionsProvider } from './CardActions'
import { EdgeActionsProvider } from './EdgeActions'
import type { Size } from './canvasState'

const nodeTypes = { card: CanvasCard }
const edgeTypes = { relation: RelationEdge }

/** Middle and right mouse button drag the canvas; the left button draws a selection box. */
const PAN_BUTTONS = [1, 2]

export interface Selection {
  nodes: string[]
  edges: string[]
}

interface Props {
  nodes: Node[]
  edges: Edge[]
  dark: boolean
  selectedIds: string[]
  selectedEdgeIds: string[]
  showMinimap: boolean
  onSelectionChange: (selection: Selection) => void
  onMove: (positions: Record<string, XY>) => void
  onResize: (typeId: string, size: Size) => void
  onRemoveNodes: (typeIds: string[]) => void
  onRemoveEdges: (edgeIds: string[]) => void
  /** A line pulled from one card to another, with the sides it was drawn between. */
  onConnect: (connection: { source: string; target: string; sourceAnchor?: EdgeAnchor; targetAnchor?: EdgeAnchor }) => void
  /** An end of an existing edge dropped on a card border. */
  onMoveEnd: (edgeId: string, end: EdgeEnd, typeId: string, anchor: EdgeAnchor) => void
  onWaypoints: (edgeId: string, points: XY[]) => void
}

export function Canvas({
  nodes,
  edges,
  dark,
  selectedIds,
  selectedEdgeIds,
  showMinimap,
  onSelectionChange,
  onMove,
  onResize,
  onRemoveNodes,
  onRemoveEdges,
  onConnect,
  onMoveEnd,
  onWaypoints,
}: Props) {
  const [connecting, setConnecting] = useState(false)
  const cardActions = useMemo(() => ({ resize: onResize }), [onResize])
  const edgeActions = useMemo(() => ({ setWaypoints: onWaypoints, moveEnd: onMoveEnd }), [onWaypoints, onMoveEnd])
  const palette = usePalette()
  const edgeColours = useMemo(
    () => markerColours(edges.map((e) => (e.data as CanvasEdgeData | undefined)?.style), edgePalette(dark)),
    [edges, dark],
  )
  const minimapColor = useCallback((node: Node) => accentOf((node.data as { type?: TypeInfo }).type, palette), [palette])
  const { getNode, fitView } = useReactFlow()
  // Mounting already selected avoids React Flow reporting an empty selection back and fighting the canvas state.
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(withSelection(nodes, selectedIds, getNode))
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(withEdgeSelection(edges, selectedEdgeIds))
  const initialized = useNodesInitialized()
  const fitted = useRef(false)
  const panning = useSpacePan()

  // One fit after the first measurement, so a diagram restored from storage opens in view.
  useEffect(() => {
    if (!initialized || fitted.current) return
    fitted.current = true
    fitView({ padding: 0.15, maxZoom: 1.1 })
  }, [initialized, fitView])

  // React Flow keeps its own node array (used by the minimap and while dragging); the canvas state stays
  // the source of truth. Measured sizes are copied back from the store, otherwise the minimap skips the nodes.
  // Returning the previous array when nothing changed is what stops the selection from echoing back and forth.
  useEffect(() => {
    setRfNodes((previous) => {
      const next = withSelection(nodes, selectedIds, getNode)
      return sameNodes(previous, next) ? previous : next
    })
  }, [nodes, selectedIds, initialized, getNode, setRfNodes])

  useEffect(() => {
    setRfEdges((previous) => {
      const next = withEdgeSelection(edges, selectedEdgeIds)
      return sameEdges(previous, next) ? previous : next
    })
  }, [edges, selectedEdgeIds, setRfEdges])

  /** Double click frames the card, so a crowded diagram can be read one card at a time. */
  const onNodeDoubleClick: NodeMouseHandler = (_, node) => {
    void fitView({ nodes: [{ id: node.id }], padding: 0.25, maxZoom: 2, duration: 400 })
  }

  const onNodeClick: NodeMouseHandler = (event, node) => {
    const picked = event.shiftKey || event.metaKey ? toggleId(selectedIds, node.id) : [node.id]
    onSelectionChange({ nodes: picked, edges: [] })
  }

  const handleSelectionChange = useCallback(
    ({ nodes: pickedNodes, edges: pickedEdges }: OnSelectionChangeParams) =>
      onSelectionChange({ nodes: pickedNodes.map((n) => n.id), edges: pickedEdges.map((e) => e.id) }),
    [onSelectionChange],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      setConnecting(false)
      if (!connection.source || !connection.target || connection.source === connection.target) return
      onConnect({
        source: connection.source,
        target: connection.target,
        sourceAnchor: anchorOfHandle(connection.sourceHandle),
        targetAnchor: anchorOfHandle(connection.targetHandle),
      })
    },
    [onConnect],
  )

  const persistPositions = (dragged: Node[]) => {
    const positions: Record<string, XY> = {}
    for (const node of dragged) positions[node.id] = node.position
    onMove(positions)
  }

  return (
    <EdgeThemeProvider dark={dark}>
      <CardActionsProvider value={cardActions}>
      <EdgeActionsProvider value={edgeActions}>
      <div
        className={`h-full w-full ${panning ? 'jd-panning' : ''} ${connecting ? 'jd-connecting' : ''}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <ReactFlow
          nodes={rfNodes}
          onNodesChange={onNodesChange}
          edges={rfEdges}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={dark ? 'dark' : 'light'}
          minZoom={0.1}
          maxZoom={2.5}
          nodesConnectable
          connectionMode={ConnectionMode.Loose}
          connectionRadius={28}
          isValidConnection={(connection) => connection.source !== connection.target}
          onConnectStart={() => setConnecting(true)}
          onConnectEnd={() => setConnecting(false)}
          onConnect={handleConnect}
          edgesReconnectable={false}
          deleteKeyCode={['Delete', 'Backspace']}
          onNodesDelete={(deleted) => onRemoveNodes(deleted.map((n) => n.id))}
          onEdgesDelete={(deleted) => onRemoveEdges(deleted.map((e) => e.id))}
          elevateNodesOnSelect={false}
          proOptions={{ hideAttribution: true }}
          panOnDrag={PAN_BUTTONS}
          panActivationKeyCode="Space"
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          selectionKeyCode={null}
          multiSelectionKeyCode={['Meta', 'Shift']}
          onSelectionChange={handleSelectionChange}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneClick={() => onSelectionChange({ nodes: [], edges: [] })}
          onNodeDragStop={(_, node, dragged) => persistPositions(dragged.length > 0 ? dragged : [node])}
          onSelectionDragStop={(_, dragged) => persistPositions(dragged)}
        >
          <ViewportPortal>
            <EdgeMarkers colours={edgeColours} />
          </ViewportPortal>
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} />
          <Controls showInteractive={false} position="bottom-left" />
          {showMinimap && <MiniMap pannable zoomable position="bottom-right" nodeBorderRadius={6} nodeColor={minimapColor} />}
        </ReactFlow>
      </div>
      </EdgeActionsProvider>
      </CardActionsProvider>
    </EdgeThemeProvider>
  )
}

function withSelection(nodes: Node[], selectedIds: string[], getNode: (id: string) => Node | undefined): Node[] {
  const selection = new Set(selectedIds)
  return nodes.map((node) => {
    const measured = getNode(node.id)?.measured
    return { ...node, selected: selection.has(node.id), ...(measured?.width ? { measured } : {}) }
  })
}

/** A line pulled from a dot starts halfway down that side; dropped on a card body, the side is automatic. */
function anchorOfHandle(handleId: string | null | undefined): EdgeAnchor | undefined {
  const side = sideOfHandle(handleId)
  return side ? { side, offset: 0.5 } : undefined
}

function withEdgeSelection(edges: Edge[], selectedEdgeIds: string[]): Edge[] {
  const selection = new Set(selectedEdgeIds)
  return edges.map((edge) => (edge.selected === selection.has(edge.id) ? edge : { ...edge, selected: selection.has(edge.id) }))
}

function sameEdges(a: Edge[], b: Edge[]): boolean {
  return a.length === b.length && a.every((edge, i) => edge === b[i])
}

function sameNodes(a: Node[], b: Node[]): boolean {
  return (
    a.length === b.length &&
    a.every((node, i) => {
      const other = b[i]
      return (
        node.id === other.id &&
        node.selected === other.selected &&
        node.data === other.data &&
        node.position.x === other.position.x &&
        node.position.y === other.position.y &&
        node.measured?.width === other.measured?.width &&
        node.measured?.height === other.measured?.height
      )
    })
  )
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id]
}

/** True while the space bar is held, so the cursor can show the grabbing hand. */
function useSpacePan(): boolean {
  const [panning, setPanning] = useState(false)
  useEffect(() => {
    const isSpace = (event: KeyboardEvent) => event.code === 'Space' && !isTyping(event.target)
    const down = (event: KeyboardEvent) => {
      if (!isSpace(event)) return
      event.preventDefault() // otherwise the page scrolls
      setPanning(true)
    }
    const up = (event: KeyboardEvent) => isSpace(event) && setPanning(false)
    const blur = () => setPanning(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])
  return panning
}

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable)
}

/** Renders the current canvas to a PNG download; must be used inside the React Flow provider. */
export function useExportPng(fileName: string): { exportPng: () => Promise<void>; busy: boolean } {
  const { getNodes } = useReactFlow()
  const [busy, setBusy] = useState(false)

  const exportPng = async () => {
    const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
    if (!viewport) return
    setBusy(true)
    // The grips of a selected edge live in the viewport too, and they are tools, not drawing.
    viewport.classList.add('jd-exporting')
    try {
      const bounds = getNodesBounds(getNodes())
      const padding = 48
      const width = Math.ceil(bounds.width + padding * 2)
      const height = Math.ceil(bounds.height + padding * 2)
      const transform = getViewportForBounds(bounds, width, height, 1, 1, 0)
      const dataUrl = await toPng(viewport, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        width,
        height,
        pixelRatio: Math.min(2, 16000 / Math.max(width, height)),
        style: { width: `${width}px`, height: `${height}px`, transform: `translate(${transform.x}px, ${transform.y}px) scale(1)` },
      })
      const link = document.createElement('a')
      link.download = `${fileName}.png`
      link.href = dataUrl
      link.click()
    } finally {
      viewport.classList.remove('jd-exporting')
      setBusy(false)
    }
  }

  return { exportPng, busy }
}
