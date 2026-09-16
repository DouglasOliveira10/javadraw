import type { CallEdge, Relation, RelationKind } from '../data/types'

/** Position of a card on the canvas; undefined until it has been placed. */
export interface XY {
  x: number
  y: number
}

export interface CanvasNode {
  id: string
  position?: XY
  /** Field names revealed on the card. */
  visibleFields: string[]
  /** Method ids revealed on the card. */
  visibleMethods: string[]
}

export interface CanvasEdge {
  id: string
  kind: RelationKind | 'CALL'
  source: string
  target: string
  /** Method id the arrow starts from, for calls. */
  sourceMember?: string
  /** Method id the arrow points at, for calls. */
  targetMember?: string
  /** Field name for associations. */
  label?: string
  multiplicity?: string
  line?: number
}

export const CANVAS_VERSION = 1

export interface CanvasState {
  version: typeof CANVAS_VERSION
  project: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export type CanvasAction =
  /** First card of an empty canvas, or a card with no relation to what is already there. */
  | { type: 'addType'; typeId: string; position?: XY }
  | { type: 'addRelation'; relation: Relation; position?: XY }
  | { type: 'addCall'; call: CallEdge; position?: XY }
  | { type: 'removeNode'; typeId: string }
  | { type: 'toggleField'; typeId: string; field: string; visible?: boolean }
  | { type: 'toggleMethod'; typeId: string; methodId: string; visible?: boolean }
  | { type: 'moveNode'; typeId: string; position: XY }
  | { type: 'arrange'; positions: Record<string, XY> }
  | { type: 'clear' }
  | { type: 'replace'; state: CanvasState }

export function emptyCanvas(project: string): CanvasState {
  return { version: CANVAS_VERSION, project, nodes: [], edges: [] }
}

export function relationEdgeId(relation: Relation): string {
  return `${relation.kind}:${relation.source}->${relation.target}:${relation.label ?? ''}`
}

export function callEdgeId(call: CallEdge): string {
  return `CALL:${call.source}->${call.target}`
}

export function typeOfMethod(methodId: string): string {
  return methodId.substring(0, methodId.indexOf('#'))
}

export function edgesOf(state: CanvasState, typeId: string): CanvasEdge[] {
  return state.edges.filter((e) => e.source === typeId || e.target === typeId)
}

/** A card can only be removed while it holds the diagram together by at most one relation. */
export function canRemove(state: CanvasState, typeId: string): boolean {
  return edgesOf(state, typeId).length <= 1
}

export function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case 'addType':
      return withNode(state, action.typeId, action.position)

    case 'addRelation': {
      const { relation } = action
      let next = withNode(state, relation.source, action.position)
      next = withNode(next, relation.target, action.position)
      // The field that holds the reference is what the arrow means, so show it right away.
      if (relation.kind === 'ASSOCIATION' && relation.label) {
        next = revealField(next, relation.source, relation.label)
      }
      return withEdge(next, {
        id: relationEdgeId(relation),
        kind: relation.kind,
        source: relation.source,
        target: relation.target,
        label: relation.label,
        multiplicity: relation.multiplicity,
      })
    }

    case 'addCall': {
      const { call } = action
      const source = typeOfMethod(call.source)
      const target = typeOfMethod(call.target)
      let next = withNode(state, source, action.position)
      next = withNode(next, target, action.position)
      next = revealMethod(next, source, call.source)
      next = revealMethod(next, target, call.target)
      return withEdge(next, {
        id: callEdgeId(call),
        kind: 'CALL',
        source,
        target,
        sourceMember: call.source,
        targetMember: call.target,
        line: call.line,
      })
    }

    case 'removeNode': {
      if (!canRemove(state, action.typeId)) return state
      return {
        ...state,
        nodes: state.nodes.filter((n) => n.id !== action.typeId),
        edges: state.edges.filter((e) => e.source !== action.typeId && e.target !== action.typeId),
      }
    }

    case 'toggleField':
      return mapNode(state, action.typeId, (node) => {
        const visibleFields = toggle(node.visibleFields, action.field, action.visible)
        return visibleFields === node.visibleFields ? node : { ...node, visibleFields }
      })

    case 'toggleMethod': {
      const next = mapNode(state, action.typeId, (node) => {
        const visibleMethods = toggle(node.visibleMethods, action.methodId, action.visible)
        return visibleMethods === node.visibleMethods ? node : { ...node, visibleMethods }
      })
      const hidden = !next.nodes.find((n) => n.id === action.typeId)?.visibleMethods.includes(action.methodId)
      // A call arrow anchored on a hidden method would have nothing to point at.
      return hidden ? { ...next, edges: next.edges.filter((e) => !anchoredOn(e, action.methodId)) } : next
    }

    case 'moveNode':
      return mapNode(state, action.typeId, (node) => ({ ...node, position: action.position }))

    case 'arrange':
      return {
        ...state,
        nodes: state.nodes.map((n) => (action.positions[n.id] ? { ...n, position: action.positions[n.id] } : n)),
      }

    case 'clear':
      return emptyCanvas(state.project)

    case 'replace':
      return action.state
  }
}

function withNode(state: CanvasState, typeId: string, position?: XY): CanvasState {
  if (state.nodes.some((n) => n.id === typeId)) return state
  return { ...state, nodes: [...state.nodes, { id: typeId, position, visibleFields: [], visibleMethods: [] }] }
}

function withEdge(state: CanvasState, edge: CanvasEdge): CanvasState {
  if (state.edges.some((e) => e.id === edge.id)) return state
  return { ...state, edges: [...state.edges, edge] }
}

/** Returns the same state object when the node is unchanged, so React can skip the re-render. */
function mapNode(state: CanvasState, typeId: string, map: (node: CanvasNode) => CanvasNode): CanvasState {
  let changed = false
  const nodes = state.nodes.map((n) => {
    if (n.id !== typeId) return n
    const mapped = map(n)
    changed = mapped !== n
    return mapped
  })
  return changed ? { ...state, nodes } : state
}

function revealField(state: CanvasState, typeId: string, field: string): CanvasState {
  return mapNode(state, typeId, (n) => (n.visibleFields.includes(field) ? n : { ...n, visibleFields: [...n.visibleFields, field] }))
}

function revealMethod(state: CanvasState, typeId: string, methodId: string): CanvasState {
  return mapNode(state, typeId, (n) =>
    n.visibleMethods.includes(methodId) ? n : { ...n, visibleMethods: [...n.visibleMethods, methodId] },
  )
}

function anchoredOn(edge: CanvasEdge, methodId: string): boolean {
  return edge.sourceMember === methodId || edge.targetMember === methodId
}

function toggle(values: string[], value: string, visible?: boolean): string[] {
  const has = values.includes(value)
  const next = visible ?? !has
  if (next === has) return values
  return next ? [...values, value] : values.filter((v) => v !== value)
}
