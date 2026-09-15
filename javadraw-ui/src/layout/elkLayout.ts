import type { ElkExtendedEdge, ElkNode, LayoutOptions } from 'elkjs/lib/elk-api'
import type { Diagram, EdgeRoute, LayoutResult, Point, Size } from './diagram'

export const GROUP_HEADER = 40
const LABEL_CHAR_WIDTH = 6.5
const LABEL_HEIGHT = 16

function rootOptions(direction: Diagram['direction']): LayoutOptions {
  const flow = direction === 'RIGHT'
  return {
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
    'elk.layered.spacing.nodeNodeBetweenLayers': flow ? '90' : '70',
    'elk.spacing.nodeNode': flow ? '28' : '40',
    'elk.spacing.edgeNode': '24',
    'elk.spacing.edgeEdge': '14',
    'elk.layered.spacing.edgeNodeBetweenLayers': '24',
    'elk.spacing.componentComponent': '60',
    'elk.edgeLabels.placement': 'CENTER',
    'elk.padding': '[top=24,left=24,bottom=24,right=24]',
  }
}

function groupOptions(minWidth = 220): LayoutOptions {
  return {
    'elk.padding': `[top=${GROUP_HEADER + 16},left=20,bottom=20,right=20]`,
    'elk.nodeSize.constraints': 'MINIMUM_SIZE',
    'elk.nodeSize.minimum': `(${Math.round(minWidth)}, 80)`,
  }
}

/** Builds the ELK graph; every edge is declared in the lowest common ancestor of its endpoints. */
export function toElkGraph(diagram: Diagram, sizes: Map<string, Size>): ElkNode {
  const root: ElkNode = { id: 'root', layoutOptions: rootOptions(diagram.direction), children: [], edges: [] }
  const elkNodes = new Map<string, ElkNode>([['root', root]])
  const parentOf = new Map<string, string>()

  for (const node of diagram.nodes) {
    const size = sizes.get(node.id)
    const elkNode: ElkNode = node.group
      ? { id: node.id, layoutOptions: groupOptions(node.minWidth), children: [], edges: [] }
      : { id: node.id, width: size?.width ?? 200, height: size?.height ?? 60 }
    elkNodes.set(node.id, elkNode)
    parentOf.set(node.id, node.parent ?? 'root')
  }
  for (const node of diagram.nodes) {
    const parent = elkNodes.get(parentOf.get(node.id)!) ?? root
    parent.children!.push(elkNodes.get(node.id)!)
  }

  for (const edge of diagram.edges) {
    if (!elkNodes.has(edge.source) || !elkNodes.has(edge.target)) continue
    const container = commonAncestor(edge.source, edge.target, parentOf)
    const elkEdge: ElkExtendedEdge = {
      id: edge.id,
      sources: [edge.reversed ? edge.target : edge.source],
      targets: [edge.reversed ? edge.source : edge.target],
    }
    if (edge.label) {
      elkEdge.labels = [{ text: edge.label, width: edge.label.length * LABEL_CHAR_WIDTH + 8, height: LABEL_HEIGHT }]
    }
    const holder = elkNodes.get(container)!
    ;(holder.edges ??= []).push(elkEdge)
  }
  return root
}

function commonAncestor(a: string, b: string, parentOf: Map<string, string>): string {
  const ancestors = new Set<string>()
  for (let current: string | undefined = parentOf.get(a); current; current = parentOf.get(current)) {
    ancestors.add(current)
    if (current === 'root') break
  }
  for (let current: string | undefined = parentOf.get(b); current; current = parentOf.get(current)) {
    if (ancestors.has(current)) return current
    if (current === 'root') break
  }
  return 'root'
}

/** Converts ELK's output into React Flow positions and absolute edge routes. */
export function fromElkGraph(laidOut: ElkNode, diagram: Diagram): LayoutResult {
  const positions = new Map<string, Point>()
  const absolute = new Map<string, Point>([['root', { x: 0, y: 0 }]])
  const groupSizes = new Map<string, Size>()
  const groupIds = new Set(diagram.nodes.filter((n) => n.group).map((n) => n.id))
  const edges: { edge: ElkExtendedEdge; holder: string }[] = []

  const visit = (node: ElkNode, origin: Point) => {
    for (const edge of node.edges ?? []) edges.push({ edge, holder: node.id })
    for (const child of node.children ?? []) {
      const position = { x: child.x ?? 0, y: child.y ?? 0 }
      const abs = { x: origin.x + position.x, y: origin.y + position.y }
      positions.set(child.id, position)
      absolute.set(child.id, abs)
      if (groupIds.has(child.id)) {
        groupSizes.set(child.id, { width: child.width ?? 0, height: child.height ?? 0 })
      }
      visit(child, abs)
    }
  }
  visit(laidOut, { x: 0, y: 0 })

  const reversed = new Set(diagram.edges.filter((e) => e.reversed).map((e) => e.id))
  const routes = new Map<string, EdgeRoute>()
  for (const { edge, holder } of edges) {
    const containerId = (edge as ElkExtendedEdge & { container?: string }).container ?? holder
    const offset = absolute.get(containerId) ?? { x: 0, y: 0 }
    const section = edge.sections?.[0]
    if (!section) continue
    let points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map((p) => ({
      x: p.x + offset.x,
      y: p.y + offset.y,
    }))
    if (reversed.has(edge.id)) points = points.reverse()
    const label = edge.labels?.[0]
    routes.set(edge.id, {
      points,
      label:
        label && label.x !== undefined && label.y !== undefined
          ? { x: label.x + offset.x + (label.width ?? 0) / 2, y: label.y + offset.y + (label.height ?? 0) / 2 }
          : undefined,
    })
  }
  return { positions, groupSizes, routes }
}
