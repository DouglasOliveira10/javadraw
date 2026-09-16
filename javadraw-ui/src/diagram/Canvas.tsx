import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
  ViewportPortal,
  getNodesBounds,
  getViewportForBounds,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import { toPng } from 'html-to-image'
import { ImageDown, LoaderCircle } from 'lucide-react'
import { accentOf } from '../theme'
import type { TypeInfo } from '../data/types'
import type { XY } from './canvasState'
import { CanvasCard } from './CanvasCard'
import { RelationEdge } from './RelationEdge'
import { EdgeMarkers } from './EdgeMarkers'

const nodeTypes = { card: CanvasCard }
const edgeTypes = { relation: RelationEdge }

/** Middle and right mouse button drag the canvas; the left button draws a selection box. */
const PAN_BUTTONS = [1, 2]

interface Props {
  nodes: Node[]
  edges: Edge[]
  dark: boolean
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onMove: (positions: Record<string, XY>) => void
}

export function Canvas({ nodes, edges, dark, selectedIds, onSelectionChange, onMove }: Props) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes)
  const { getNode, fitView } = useReactFlow()
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
  useEffect(() => {
    const selection = new Set(selectedIds)
    setRfNodes(
      nodes.map((n) => {
        const measured = getNode(n.id)?.measured
        return { ...n, selected: selection.has(n.id), ...(measured?.width ? { measured } : {}) }
      }),
    )
  }, [nodes, selectedIds, initialized, getNode, setRfNodes])

  const onNodeClick: NodeMouseHandler = (event, node) => {
    onSelectionChange(event.shiftKey || event.metaKey ? toggleId(selectedIds, node.id) : [node.id])
  }

  const handleSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => onSelectionChange(selected.map((n) => n.id)),
    [onSelectionChange],
  )

  const persistPositions = (dragged: Node[]) => {
    const positions: Record<string, XY> = {}
    for (const node of dragged) positions[node.id] = node.position
    onMove(positions)
  }

  return (
    <div className={`h-full w-full ${panning ? 'jd-panning' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      <ReactFlow
        nodes={rfNodes}
        onNodesChange={onNodesChange}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={dark ? 'dark' : 'light'}
        minZoom={0.1}
        maxZoom={2.5}
        nodesConnectable={false}
        deleteKeyCode={null}
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
        onPaneClick={() => onSelectionChange([])}
        onNodeDragStop={(_, node, dragged) => persistPositions(dragged.length > 0 ? dragged : [node])}
        onSelectionDragStop={(_, dragged) => persistPositions(dragged)}
      >
        <ViewportPortal>
          <EdgeMarkers />
        </ViewportPortal>
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap pannable zoomable position="bottom-right" nodeBorderRadius={6} nodeColor={minimapColor} />
      </ReactFlow>
    </div>
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

function minimapColor(node: Node): string {
  return accentOf((node.data as { type?: TypeInfo }).type)
}

export function ExportPngButton({ fileName, disabled }: { fileName: string; disabled: boolean }) {
  const { getNodes } = useReactFlow()
  const [busy, setBusy] = useState(false)

  const exportPng = async () => {
    const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
    if (!viewport) return
    setBusy(true)
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
      setBusy(false)
    }
  }

  return (
    <button className="jd-btn" onClick={exportPng} disabled={disabled || busy} title="Export the diagram as PNG">
      {busy ? <LoaderCircle size={14} className="animate-spin" /> : <ImageDown size={14} />}
      PNG
    </button>
  )
}
