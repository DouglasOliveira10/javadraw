import type { Edge, Node } from '@xyflow/react'
import type { GraphIndex } from '../data/graphIndex'
import type { FieldInfo, MethodInfo, TypeInfo } from '../data/types'
import type { CanvasEdge, CanvasState, EdgeAnchors, EdgeStyle, XY } from './canvasState'
import { cardHandle, facingSides, fieldHandle, methodHandle, verticalSides } from './handles'

export interface CardData extends Record<string, unknown> {
  type: TypeInfo
  fields: FieldInfo[]
  methods: MethodInfo[]
  /** Members hidden on the card but present on the type, shown as a "+N hidden" hint. */
  hiddenCount: number
  /** Cards shrink to fit: field types, parameters and return types can each be left out. */
  showFieldTypes: boolean
  showParameters: boolean
  showReturnTypes: boolean
  /** The user resized this card, so it no longer sizes itself to its content. */
  sized: boolean
}

export interface CardDisplay {
  showFieldTypes: boolean
  showParameters: boolean
  showReturnTypes: boolean
}

export interface CanvasEdgeData extends Record<string, unknown> {
  variant: CanvasEdge['kind']
  label?: string
  line?: number
  /** What the user changed by hand: stroke, arrow heads, colour, text. */
  style?: EdgeStyle
  waypoints?: XY[]
  /** Points pinned on the card borders; the edge draws itself from these, not from its handles. */
  anchors?: EdgeAnchors
}

const ORIGIN: XY = { x: 0, y: 0 }

export function toReactFlowNodes(state: CanvasState, index: GraphIndex, display: CardDisplay): Node<CardData>[] {
  const nodes: Node<CardData>[] = []
  for (const node of state.nodes) {
    const type = index.types.get(node.id)
    if (!type) continue
    const fields = (type.fields ?? []).filter((f) => node.visibleFields.includes(f.name))
    const methods = (type.methods ?? []).filter((m) => node.visibleMethods.includes(m.id))
    const total = (type.fields?.length ?? 0) + (type.methods?.length ?? 0)
    nodes.push({
      id: node.id,
      type: 'card',
      position: node.position ?? ORIGIN,
      ...(node.size ? { width: node.size.width, height: node.size.height, style: node.size } : {}),
      data: {
        type,
        fields,
        methods,
        hiddenCount: total - fields.length - methods.length,
        showFieldTypes: display.showFieldTypes,
        showParameters: display.showParameters,
        showReturnTypes: display.showReturnTypes,
        sized: !!node.size,
      },
    })
  }
  return nodes
}

export function toReactFlowEdges(state: CanvasState): Edge<CanvasEdgeData>[] {
  const positions = new Map(state.nodes.map((n) => [n.id, n.position ?? ORIGIN]))
  const visible = new Map(state.nodes.map((n) => [n.id, n]))

  return state.edges.map((edge) => {
    const from = positions.get(edge.source) ?? ORIGIN
    const to = positions.get(edge.target) ?? ORIGIN
    const inheritance = edge.kind === 'EXTENDS' || edge.kind === 'IMPLEMENTS'
    const automatic = inheritance ? verticalSides(from, to) : facingSides(from, to)
    // A side the user pinned by dragging an end there wins over the one the positions suggest.
    const sides = {
      source: edge.anchors?.source?.side ?? automatic.source,
      target: edge.anchors?.target?.side ?? automatic.target,
    }

    // Anchor on the member that explains the edge whenever it is revealed on the card.
    const sourceMethod = edge.sourceMember && visible.get(edge.source)?.visibleMethods.includes(edge.sourceMember)
    const targetMethod = edge.targetMember && visible.get(edge.target)?.visibleMethods.includes(edge.targetMember)
    const sourceField =
      !inheritance && edge.label && visible.get(edge.source)?.visibleFields.includes(edge.label) ? edge.label : undefined

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: sourceMethod
        ? methodHandle(edge.sourceMember!, sides.source)
        : sourceField
          ? fieldHandle(sourceField, sides.source)
          : cardHandle(sides.source),
      targetHandle: targetMethod ? methodHandle(edge.targetMember!, sides.target) : cardHandle(sides.target),
      type: 'relation',
      data: {
        variant: edge.kind,
        label: edge.style?.text ?? edgeLabel(edge, !!sourceField),
        line: edge.line,
        style: edge.style,
        waypoints: edge.waypoints,
        anchors: edge.anchors,
      } satisfies CanvasEdgeData,
    }
  })
}

/** The field name is dropped when the arrow already starts on that field's row. */
function edgeLabel(edge: CanvasEdge, anchoredOnField: boolean): string | undefined {
  if (edge.kind === 'CALL') return edge.line ? `L${edge.line}` : undefined
  if (edge.kind !== 'ASSOCIATION') return undefined
  const parts = anchoredOnField ? [edge.multiplicity] : [edge.label, edge.multiplicity]
  return parts.filter(Boolean).join(' ') || undefined
}
