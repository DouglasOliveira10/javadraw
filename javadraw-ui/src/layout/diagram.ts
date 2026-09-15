/** View-independent description of what to draw; positions are computed by ELK. */

export type Direction = 'DOWN' | 'RIGHT'

export interface DiagramNode {
  id: string
  /** React Flow node type. */
  type: string
  /** Id of the enclosing group node. */
  parent?: string
  group?: boolean
  /** Minimum width for group nodes, so long titles fit. */
  minWidth?: number
  data: Record<string, unknown>
}

export interface DiagramEdge {
  id: string
  source: string
  target: string
  /** Lay out the edge from target to source (e.g. inheritance, so supertypes sit above subtypes). */
  reversed?: boolean
  label?: string
  data: Record<string, unknown>
}

export interface Diagram {
  direction: Direction
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface EdgeRoute {
  /** Absolute points in drawing order source → target. */
  points: Point[]
  label?: Point
}

export interface LayoutResult {
  /** Positions relative to the parent group (or absolute for top-level nodes). */
  positions: Map<string, Point>
  groupSizes: Map<string, Size>
  routes: Map<string, EdgeRoute>
}
