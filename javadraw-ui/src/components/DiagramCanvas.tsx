import { useCallback, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  applyNodeChanges,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import { toPng } from 'html-to-image'
import { ImageDown, LoaderCircle, Maximize2, TriangleAlert } from 'lucide-react'
import type { Diagram } from '../layout/diagram'
import { useAutoLayout } from '../layout/useAutoLayout'
import { TypeNode } from '../structure/TypeNode'
import { PackageNode } from '../structure/PackageNode'
import { MethodNode } from '../flow/MethodNode'
import { ClassGroupNode } from '../flow/ClassGroupNode'
import { EdgeMarkers, RoutedEdge } from './RoutedEdge'
import { accentOf } from '../theme'
import type { TypeInfo } from '../data/types'

const nodeTypes = { type: TypeNode, package: PackageNode, method: MethodNode, classGroup: ClassGroupNode }
const edgeTypes = { routed: RoutedEdge }

interface CanvasProps {
  diagram: Diagram
  dark: boolean
  fileName: string
  onSelect: (id: string | null) => void
}

const keys = new WeakMap<Diagram, number>()
let nextKey = 0

/** Every diagram gets a fresh React Flow instance so measurement and layout start from scratch. */
export function DiagramCanvas(props: CanvasProps) {
  let key = keys.get(props.diagram)
  if (key === undefined) {
    key = nextKey++
    keys.set(props.diagram, key)
  }
  return (
    <ReactFlowProvider key={key}>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}

function Canvas({ diagram, dark, fileName, onSelect }: CanvasProps) {
  const { nodes, edges, setNodes, status, error } = useAutoLayout(diagram)
  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), [setNodes])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      colorMode={dark ? 'dark' : 'light'}
      minZoom={0.05}
      maxZoom={2.5}
      nodesConnectable={false}
      elevateNodesOnSelect={false}
      onlyRenderVisibleElements={status === 'ready' && nodes.length > 250}
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, node) => onSelect(node.selectable === false ? null : node.id)}
      onPaneClick={() => onSelect(null)}
    >
      <ViewportPortal>
        <EdgeMarkers />
      </ViewportPortal>
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} />
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap
        pannable
        zoomable
        position="bottom-right"
        nodeBorderRadius={6}
        nodeColor={(n: Node) => (n.type === 'package' || n.type === 'classGroup' ? 'transparent' : minimapColor(n))}
        nodeStrokeColor={(n: Node) => (n.type === 'package' || n.type === 'classGroup' ? 'var(--jd-border-strong)' : 'transparent')}
      />
      <Panel position="top-right" className="flex gap-2">
        <FitButton />
        <ExportButton fileName={fileName} disabled={status !== 'ready' || nodes.length === 0} />
      </Panel>
      {status !== 'ready' && status !== 'error' && (
        <Panel position="top-center">
          <div className="jd-panel flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] text-[var(--jd-muted)] shadow">
            <LoaderCircle size={14} className="animate-spin" />
            {status === 'measuring' ? 'Measuring…' : `Laying out ${diagram.nodes.length} nodes…`}
          </div>
        </Panel>
      )}
      {status === 'error' && (
        <Panel position="top-center">
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            <TriangleAlert size={14} /> Layout failed: {error}
          </div>
        </Panel>
      )}
    </ReactFlow>
  )
}

function minimapColor(node: Node): string {
  const data = node.data as { type?: TypeInfo; owner?: TypeInfo }
  return accentOf(data.type ?? data.owner)
}

function FitButton() {
  const { fitView } = useReactFlow()
  return (
    <button className="jd-btn shadow-sm" title="Fit to screen" onClick={() => fitView({ padding: 0.1, duration: 300 })}>
      <Maximize2 size={14} />
    </button>
  )
}

function ExportButton({ fileName, disabled }: { fileName: string; disabled: boolean }) {
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
    <button className="jd-btn shadow-sm" onClick={exportPng} disabled={disabled || busy} title="Export as PNG">
      {busy ? <LoaderCircle size={14} className="animate-spin" /> : <ImageDown size={14} />}
      PNG
    </button>
  )
}
