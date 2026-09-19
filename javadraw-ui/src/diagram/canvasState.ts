import type { CallEdge, Relation, RelationKind } from '../data/types'
import type { Side } from './handles'

/** Position of a card on the canvas; undefined until it has been placed. */
export interface XY {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface CanvasNode {
  id: string
  position?: XY
  /** Set once the user resizes the card; otherwise the card sizes itself to its content. */
  size?: Size
  /** Field names revealed on the card. */
  visibleFields: string[]
  /** Method ids revealed on the card. */
  visibleMethods: string[]
}

/** 'MANUAL' is a line the user drew; the others are backed by the analyzed bytecode. */
export type EdgeKind = RelationKind | 'CALL' | 'MANUAL'

export type EdgeLine = 'solid' | 'dashed' | 'dotted'
export type EdgeMarker = 'none' | 'arrow' | 'triangle' | 'diamond'

/** What the user changed by hand; anything left out falls back to the look of the edge kind. */
export interface EdgeStyle {
  line?: EdgeLine
  startMarker?: EdgeMarker
  endMarker?: EdgeMarker
  color?: string
  /** Free text, in place of the label the relation prints by itself. */
  text?: string
}

export interface CanvasEdge {
  id: string
  kind: EdgeKind
  /** A manual edge has no relation behind it, so it survives a re-analysis of the project. */
  origin: 'graph' | 'manual'
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
  /** Sides pinned by the user; without them the sides follow where the cards sit. */
  anchors?: { source?: Side; target?: Side }
  style?: EdgeStyle
  /** Bend points, in canvas coordinates, between source and target. */
  waypoints?: XY[]
}

export const CANVAS_VERSION = 2

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
  /** No UI creates these today (method-to-method edges are disabled); saved diagrams still carry them. */
  | { type: 'addCall'; call: CallEdge; position?: XY }
  | { type: 'removeNode'; typeId: string }
  /** A line the user drew, from any card to any other one, with or without a relation behind it. */
  | { type: 'connect'; source: string; target: string; sourceSide?: Side; targetSide?: Side }
  | { type: 'removeEdges'; edgeIds: string[] }
  /** Merges into the edge style; a property set to undefined goes back to the kind's default. */
  | { type: 'styleEdge'; edgeId: string; style: EdgeStyle }
  | { type: 'reconnectEdge'; edgeId: string; source?: string; target?: string; sourceSide?: Side; targetSide?: Side }
  | { type: 'setWaypoints'; edgeId: string; points: XY[] }
  | { type: 'toggleField'; typeId: string; field: string; visible?: boolean }
  | { type: 'toggleMethod'; typeId: string; methodId: string; visible?: boolean }
  | { type: 'moveNode'; typeId: string; position: XY }
  | { type: 'resizeNode'; typeId: string; size: Size }
  /** Back to sizing itself by content. */
  | { type: 'autoSizeNode'; typeId: string }
  | { type: 'setPositions'; positions: Record<string, XY> }
  | { type: 'removeNodes'; typeIds: string[] }
  /** Replaces the revealed members of several cards at once (empty lists hide everything). */
  | { type: 'setMembers'; members: Record<string, { fields: string[]; methods: string[] }> }
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

/** Ids of hand-drawn edges are numbered, so two lines between the same pair of cards stay apart. */
export function manualEdgeId(state: CanvasState): string {
  const used = state.edges.map((e) => Number(/^M:(\d+)$/.exec(e.id)?.[1] ?? -1))
  return `M:${Math.max(-1, ...used) + 1}`
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
        origin: 'graph',
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
        origin: 'graph',
        source,
        target,
        sourceMember: call.source,
        targetMember: call.target,
        line: call.line,
      })
    }

    case 'connect': {
      if (action.source === action.target) return state
      if (!state.nodes.some((n) => n.id === action.source) || !state.nodes.some((n) => n.id === action.target)) return state
      return withEdge(state, {
        id: manualEdgeId(state),
        kind: 'MANUAL',
        origin: 'manual',
        source: action.source,
        target: action.target,
        anchors: anchorsOf(action.sourceSide, action.targetSide),
      })
    }

    case 'removeEdges': {
      const dropped = new Set(action.edgeIds)
      const edges = state.edges.filter((e) => !dropped.has(e.id))
      return edges.length === state.edges.length ? state : { ...state, edges }
    }

    case 'styleEdge':
      return mapEdge(state, action.edgeId, (edge) => {
        const style = clean({ ...edge.style, ...action.style })
        return { ...edge, style }
      })

    case 'reconnectEdge':
      return mapEdge(state, action.edgeId, (edge) => {
        const source = action.source ?? edge.source
        const target = action.target ?? edge.target
        if (source === target) return edge
        const anchors = anchorsOf(
          action.source || action.sourceSide ? action.sourceSide : edge.anchors?.source,
          action.target || action.targetSide ? action.targetSide : edge.anchors?.target,
        )
        // The member anchors described the old endpoints; a moved end points at the card again.
        return {
          ...edge,
          source,
          target,
          anchors,
          sourceMember: action.source ? undefined : edge.sourceMember,
          targetMember: action.target ? undefined : edge.targetMember,
          waypoints: undefined,
        }
      })

    case 'setWaypoints':
      return mapEdge(state, action.edgeId, (edge) => ({
        ...edge,
        waypoints: action.points.length > 0 ? action.points : undefined,
      }))

    case 'removeNode':
      return removeOne(state, action.typeId)

    case 'removeNodes': {
      const dropped = new Set(action.typeIds)
      const nodes = state.nodes.filter((n) => !dropped.has(n.id))
      if (nodes.length === state.nodes.length) return state
      return { ...state, nodes, edges: state.edges.filter((e) => !dropped.has(e.source) && !dropped.has(e.target)) }
    }

    case 'setMembers': {
      let next = state
      for (const [typeId, members] of Object.entries(action.members)) {
        next = mapNode(next, typeId, (node) => ({ ...node, visibleFields: members.fields, visibleMethods: members.methods }))
      }
      return next
    }

    case 'toggleField':
      return mapNode(state, action.typeId, (node) => {
        const visibleFields = toggle(node.visibleFields, action.field, action.visible)
        return visibleFields === node.visibleFields ? node : { ...node, visibleFields }
      })

    // Hiding a member never drops an edge: an arrow whose method is hidden is re-anchored on the card body.
    case 'toggleMethod':
      return mapNode(state, action.typeId, (node) => {
        const visibleMethods = toggle(node.visibleMethods, action.methodId, action.visible)
        return visibleMethods === node.visibleMethods ? node : { ...node, visibleMethods }
      })

    case 'moveNode':
      return mapNode(state, action.typeId, (node) => ({ ...node, position: action.position }))

    case 'resizeNode':
      return mapNode(state, action.typeId, (node) =>
        node.size?.width === action.size.width && node.size?.height === action.size.height
          ? node
          : { ...node, size: action.size },
      )

    case 'autoSizeNode':
      return mapNode(state, action.typeId, (node) => {
        if (!node.size) return node
        const { size, ...rest } = node
        return rest
      })

    case 'setPositions':
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

function anchorsOf(source?: Side, target?: Side): CanvasEdge['anchors'] {
  return source || target ? { source, target } : undefined
}

/** Drops the properties the user reset, so an empty style object never reaches storage. */
function clean(style: EdgeStyle): EdgeStyle | undefined {
  const entries = Object.entries(style).filter(([, value]) => value !== undefined && value !== '')
  return entries.length > 0 ? (Object.fromEntries(entries) as EdgeStyle) : undefined
}

function removeOne(state: CanvasState, typeId: string): CanvasState {
  return {
    ...state,
    nodes: state.nodes.filter((n) => n.id !== typeId),
    edges: state.edges.filter((e) => e.source !== typeId && e.target !== typeId),
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

function mapEdge(state: CanvasState, edgeId: string, map: (edge: CanvasEdge) => CanvasEdge): CanvasState {
  let changed = false
  const edges = state.edges.map((e) => {
    if (e.id !== edgeId) return e
    const mapped = map(e)
    changed = mapped !== e
    return mapped
  })
  return changed ? { ...state, edges } : state
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

function toggle(values: string[], value: string, visible?: boolean): string[] {
  const has = values.includes(value)
  const next = visible ?? !has
  if (next === has) return values
  return next ? [...values, value] : values.filter((v) => v !== value)
}
