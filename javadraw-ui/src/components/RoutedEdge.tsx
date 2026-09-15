import { memo, useRef } from 'react'
import { EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react'
import type { Point, EdgeRoute } from '../layout/diagram'
import type { RelationKind, CallKind } from '../data/types'
import { useDiagramActions } from './DiagramContext'

export interface RoutedEdgeProps extends Record<string, unknown> {
  variant: RelationKind | 'CALL'
  kind?: CallKind
  label?: string
  step?: number
  back?: boolean
  route?: EdgeRoute
}

interface Look {
  className: string
  marker: 'triangle' | 'arrow' | 'open' | 'none'
}

function lookOf(data: RoutedEdgeProps): Look {
  switch (data.variant) {
    case 'EXTENDS':
      return { className: '', marker: 'triangle' }
    case 'IMPLEMENTS':
      return { className: 'jd-dashed', marker: 'triangle' }
    case 'ASSOCIATION':
      return { className: '', marker: 'open' }
    case 'DEPENDENCY':
      return { className: 'jd-dashed jd-muted', marker: 'open' }
    default:
      if (data.kind === 'OVERRIDE') return { className: 'jd-dotted', marker: 'triangle' }
      if (data.kind === 'DYNAMIC') return { className: 'jd-dashed', marker: 'arrow' }
      return { className: '', marker: 'arrow' }
  }
}

/** Polyline through the ELK bend points with rounded corners. */
export function roundedPath(points: Point[], radius = 10): string {
  if (points.length === 0) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const next = points[i + 1]
    const r = Math.min(radius, distance(prev, cur) / 2, distance(cur, next) / 2)
    const a = towards(cur, prev, r)
    const b = towards(cur, next, r)
    d += ` L ${a.x} ${a.y} Q ${cur.x} ${cur.y} ${b.x} ${b.y}`
  }
  const last = points[points.length - 1]
  return `${d} L ${last.x} ${last.y}`
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function towards(from: Point, to: Point, length: number): Point {
  const d = distance(from, to) || 1
  return { x: from.x + ((to.x - from.x) / d) * length, y: from.y + ((to.y - from.y) / d) * length }
}

function RoutedEdgeComponent(props: EdgeProps<Edge<RoutedEdgeProps>>) {
  const { source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const { selectedId } = useDiagramActions()
  const origin = useRef({ sourceX, sourceY, targetX, targetY })
  if (!data) return null

  // Keep ELK's route until the user drags one of the endpoints.
  const moved =
    Math.abs(origin.current.sourceX - sourceX) > 1 ||
    Math.abs(origin.current.sourceY - sourceY) > 1 ||
    Math.abs(origin.current.targetX - targetX) > 1 ||
    Math.abs(origin.current.targetY - targetY) > 1

  let path: string
  let labelPoint: Point
  let stepPoint: Point | undefined
  if (data.route && !moved) {
    path = roundedPath(data.route.points)
    const pts = data.route.points
    labelPoint = data.route.label ?? midpoint(pts)
    stepPoint = pts.length > 1 ? towards(pts[0], pts[1], Math.min(22, distance(pts[0], pts[1]) / 2)) : undefined
  } else {
    const [p, lx, ly] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 10 })
    path = p
    labelPoint = { x: lx, y: ly }
    stepPoint = { x: lx, y: ly }
  }

  const active = selectedId !== null && (selectedId === source || selectedId === target)
  const look = lookOf(data)
  const markerId = look.marker === 'none' ? undefined : `jd-${look.marker}${active ? '-active' : look.className.includes('jd-muted') ? '-muted' : ''}`
  const edgeClass = `jd-edge ${look.className} ${active ? 'jd-active' : ''} ${data.back && data.variant === 'CALL' ? 'jd-dashed' : ''}`

  return (
    <>
      <path d={path} className="react-flow__edge-interaction" fill="none" strokeWidth={16} stroke="transparent" />
      <path d={path} className={edgeClass} markerEnd={markerId ? `url(#${markerId})` : undefined} />
      <EdgeLabelRenderer>
        {data.label && (
          <div
            className={`jd-edge-label ${active ? 'jd-active' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelPoint.x}px, ${labelPoint.y}px)` }}
          >
            {data.label}
          </div>
        )}
        {data.step !== undefined && stepPoint && (
          <div
            className={`jd-step ${active ? 'jd-active' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${stepPoint.x}px, ${stepPoint.y}px)` }}
            title={data.kind ? `${data.kind.toLowerCase()} call` : undefined}
          >
            {data.step}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

function midpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  let total = 0
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i])
  let remaining = total / 2
  for (let i = 1; i < points.length; i++) {
    const segment = distance(points[i - 1], points[i])
    if (remaining <= segment) return towards(points[i - 1], points[i], remaining)
    remaining -= segment
  }
  return points[points.length - 1]
}

export const RoutedEdge = memo(RoutedEdgeComponent)

/** SVG marker definitions shared by all edges. */
export function EdgeMarkers() {
  const variants: { suffix: string; className: string }[] = [
    { suffix: '', className: '' },
    { suffix: '-active', className: 'jd-marker-active' },
    { suffix: '-muted', className: 'jd-marker-muted' },
  ]
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden>
      <defs>
        {variants.map(({ suffix, className }) => (
          <g key={suffix} className={className}>
            <marker id={`jd-triangle${suffix}`} viewBox="0 0 20 20" refX="17" refY="10" markerWidth="16" markerHeight="16" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
              <path d="M 2 2 L 17 10 L 2 18 z" className="jd-marker-hollow" />
            </marker>
            <marker id={`jd-arrow${suffix}`} viewBox="0 0 20 20" refX="16" refY="10" markerWidth="12" markerHeight="12" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
              <path d="M 2 3 L 17 10 L 2 17 L 6 10 z" className="jd-marker-fill" />
            </marker>
            <marker id={`jd-open${suffix}`} viewBox="0 0 20 20" refX="16" refY="10" markerWidth="13" markerHeight="13" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
              <path d="M 4 3 L 16 10 L 4 17" className="jd-marker-open" />
            </marker>
          </g>
        ))}
      </defs>
    </svg>
  )
}
