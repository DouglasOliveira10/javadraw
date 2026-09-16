import { useEffect, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ViewportPortal,
  getNodesBounds,
  getViewportForBounds,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import { toPng } from 'html-to-image'
import { ImageDown, LoaderCircle } from 'lucide-react'
import { accentOf } from '../theme'
import type { TypeInfo } from '../data/types'
import { CanvasCard } from './CanvasCard'
import { RelationEdge } from './RelationEdge'
import { EdgeMarkers } from './EdgeMarkers'

const nodeTypes = { card: CanvasCard }
const edgeTypes = { relation: RelationEdge }

interface Props {
  nodes: Node[]
  edges: Edge[]
  dark: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, position: { x: number; y: number }) => void
}

export function Canvas({ nodes, edges, dark, selectedId, onSelect, onMove }: Props) {
  const onNodeClick: NodeMouseHandler = (_, node) => onSelect(node.id)
  // React Flow keeps its own node array (used by the minimap and while dragging); the canvas state stays
  // the source of truth. Measured sizes are copied back from the store, otherwise the minimap skips the nodes.
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes)
  const { getNode, fitView } = useReactFlow()
  const initialized = useNodesInitialized()
  const fitted = useRef(false)

  // One fit after the first measurement, so a diagram restored from storage opens in view.
  useEffect(() => {
    if (!initialized || fitted.current) return
    fitted.current = true
    fitView({ padding: 0.15, maxZoom: 1.1 })
  }, [initialized, fitView])
  useEffect(() => {
    setRfNodes(
      nodes.map((n) => {
        const measured = getNode(n.id)?.measured
        return { ...n, selected: n.id === selectedId, ...(measured?.width ? { measured } : {}) }
      }),
    )
  }, [nodes, selectedId, initialized, getNode, setRfNodes])

  return (
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
      onNodeClick={onNodeClick}
      onPaneClick={() => onSelect(null)}
      onNodeDragStop={(_, node) => onMove(node.id, node.position)}
    >
      <ViewportPortal>
        <EdgeMarkers />
      </ViewportPortal>
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} />
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap pannable zoomable position="bottom-right" nodeBorderRadius={6} nodeColor={minimapColor} />
    </ReactFlow>
  )
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
