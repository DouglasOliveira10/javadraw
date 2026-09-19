import { memo, useRef, useState, type ComponentProps, type PointerEvent as ReactPointerEvent } from 'react'
import {
  EdgeLabelRenderer,
  Position,
  ViewportPortal,
  getSmoothStepPath,
  useInternalNode,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type InternalNode,
  type Node,
} from '@xyflow/react'
import type { EdgeAnchor, EdgeEnd, XY } from './canvasState'
import type { CanvasEdgeData } from './toReactFlow'
import { anchorPoint, cardAt, nearestAnchor, type Rect } from './edgeAnchor'
import { edgeLook, markerUrl } from './edgeLook'
import { routeMidpoint, routePath, segmentMidpoints } from './edgePath'
import { useEdgeActions } from './EdgeActions'
import { useEdgeTheme } from './EdgeTheme'
import type { Side } from './handles'

/** A bend point being dragged: the whole route, plus which point of it follows the pointer. */
interface BendDrag {
  points: XY[]
  index: number
}

/** An end being dragged: where it is now, and the card and point it would land on. */
interface EndDrag {
  end: EdgeEnd
  at: XY
  typeId?: string
  anchor?: EdgeAnchor
}

const POSITIONS: Record<Side, Position> = {
  l: Position.Left,
  r: Position.Right,
  t: Position.Top,
  b: Position.Bottom,
}

function RelationEdgeComponent(props: EdgeProps<Edge<CanvasEdgeData>>) {
  const { id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props
  const palette = useEdgeTheme()
  const { setWaypoints, moveEnd } = useEdgeActions()
  const { screenToFlowPosition, getNodes } = useReactFlow()
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  const [bend, setBend] = useState<BendDrag | null>(null)
  const [end, setEnd] = useState<EndDrag | null>(null)
  const bendRef = useRef<BendDrag | null>(null)
  const endRef = useRef<EndDrag | null>(null)
  if (!data) return null

  // An end pinned by the user sits where the anchor says, not where its handle happens to be.
  const pinnedSource = endPoint(sourceNode, data.anchors?.source) ?? { x: sourceX, y: sourceY }
  const pinnedTarget = endPoint(targetNode, data.anchors?.target) ?? { x: targetX, y: targetY }
  const from = end?.end === 'source' ? (draggedPoint(end, getRects(getNodes())) ?? end.at) : pinnedSource
  const to = end?.end === 'target' ? (draggedPoint(end, getRects(getNodes())) ?? end.at) : pinnedTarget
  const fromSide = end?.end === 'source' ? end.anchor?.side : data.anchors?.source?.side
  const toSide = end?.end === 'target' ? end.anchor?.side : data.anchors?.target?.side

  const waypoints = bend?.points ?? data.waypoints ?? []
  const bent = waypoints.length > 0
  const route = [from, ...waypoints, to]

  const [automatic, automaticLabelX, automaticLabelY] = getSmoothStepPath({
    sourceX: from.x,
    sourceY: from.y,
    targetX: to.x,
    targetY: to.y,
    sourcePosition: fromSide ? POSITIONS[fromSide] : sourcePosition,
    targetPosition: toSide ? POSITIONS[toSide] : targetPosition,
    borderRadius: 10,
  })
  const path = bent ? routePath(route) : automatic
  const label = bent ? routeMidpoint(route) : { x: automaticLabelX, y: automaticLabelY }
  const look = edgeLook(data.variant, data.style, palette, !!selected)

  // The drag is kept in a ref as well: a fast drag can send its last move before React has re-rendered,
  // and what matters on release is where the pointer actually is.
  const updateBend = (next: BendDrag | null) => {
    bendRef.current = next
    setBend(next)
  }

  const updateEnd = (next: EndDrag | null) => {
    endRef.current = next
    setEnd(next)
  }

  /** Follows the pointer until it is let go, then hands the route over to the canvas state. */
  const startBending = (event: ReactPointerEvent<HTMLDivElement>, points: XY[], index: number) => {
    event.stopPropagation()
    capture(event)
    updateBend({ points, index })
  }

  const bendAt = (event: ReactPointerEvent<HTMLDivElement>): BendDrag | null => {
    const drag = bendRef.current
    if (!drag) return null
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    return { ...drag, points: drag.points.map((current, i) => (i === drag.index ? point : current)) }
  }

  const bendTo = (event: ReactPointerEvent<HTMLDivElement>) => {
    const next = bendAt(event)
    if (next) updateBend(next)
  }

  const dropBend = (event: ReactPointerEvent<HTMLDivElement>) => {
    const next = bendAt(event)
    if (next) setWaypoints(id, next.points)
    updateBend(null)
  }

  const startMovingEnd = (event: ReactPointerEvent<HTMLDivElement>, which: EdgeEnd) => {
    event.stopPropagation()
    capture(event)
    updateEnd({ end: which, at: which === 'source' ? from : to })
  }

  /** While an end is dragged it snaps to the border of whatever card is under the pointer. */
  const endAt = (event: ReactPointerEvent<HTMLDivElement>): EndDrag | null => {
    const drag = endRef.current
    if (!drag) return null
    const at = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const rects = getRects(getNodes())
    const other = drag.end === 'source' ? target : source
    const typeId = cardAt(omit(rects, other), at)
    return { ...drag, at, typeId, anchor: typeId ? nearestAnchor(rects[typeId], at) : undefined }
  }

  const moveEndTo = (event: ReactPointerEvent<HTMLDivElement>) => {
    const next = endAt(event)
    if (next) updateEnd(next)
  }

  const dropEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const next = endAt(event)
    if (next?.typeId && next.anchor) moveEnd(id, next.end, next.typeId, next.anchor)
    updateEnd(null)
  }

  return (
    <>
      <path d={path} className="react-flow__edge-interaction" fill="none" strokeWidth={16} stroke="transparent" />
      {/* Colours are inline, not from a class: the PNG export drops the document stylesheet. */}
      <path
        d={path}
        className="jd-edge"
        fill="none"
        stroke={look.stroke}
        strokeWidth={look.width}
        strokeDasharray={look.dash}
        markerStart={markerUrl(look.startMarker, look.stroke)}
        markerEnd={markerUrl(look.endMarker, look.stroke)}
      />

      {/* The grips ride above the cards: edges are drawn under them, and an end sits on a card border. */}
      {selected && (
        <ViewportPortal>
          <div className="nodrag nopan">
            {/* Halfway down each segment: grabbing one bends the line there. */}
            {segmentMidpoints(route).map((point, segment) => (
              <Grip
                key={`add-${segment}`}
                className="jd-grip jd-grip-new"
                point={point}
                onPointerDown={(event) => startBending(event, insert(waypoints, segment, point), segment)}
                onPointerMove={bendTo}
                onPointerUp={dropBend}
              />
            ))}
            {waypoints.map((point, index) => (
              <Grip
                key={`bend-${index}`}
                className="jd-grip jd-grip-bend"
                point={point}
                onPointerDown={(event) => startBending(event, [...waypoints], index)}
                onPointerMove={bendTo}
                onPointerUp={dropBend}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  setWaypoints(id, waypoints.filter((_, i) => i !== index))
                }}
              />
            ))}
            {/* The two ends: drag one along a border to move it, or onto another card to reconnect. */}
            {(['source', 'target'] as EdgeEnd[]).map((which) => (
              <Grip
                key={which}
                className="jd-grip jd-grip-end"
                point={which === 'source' ? from : to}
                onPointerDown={(event) => startMovingEnd(event, which)}
                onPointerMove={moveEndTo}
                onPointerUp={dropEnd}
              />
            ))}
          </div>
        </ViewportPortal>
      )}

      {data.label && (
        <EdgeLabelRenderer>
          <div
            className="jd-edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)`,
              color: selected ? palette.accent : undefined,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

/** Keeps the moves coming to this dot even when the pointer runs off it. */
function capture(event: ReactPointerEvent<HTMLDivElement>) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId)
  } catch {
    // no active pointer with that id (a synthetic event); the moves still arrive
  }
}

/** One draggable dot, placed in canvas coordinates above the cards. */
function Grip({
  className,
  point,
  ...handlers
}: {
  className: string
  point: XY
} & Pick<ComponentProps<'div'>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onDoubleClick'>) {
  return <div className={className} style={{ left: point.x, top: point.y }} {...handlers} />
}

/** Where the dragged end currently sits: snapped to a card's border, or loose under the pointer. */
function draggedPoint(drag: EndDrag, rects: Record<string, Rect>): XY | undefined {
  if (!drag.typeId || !drag.anchor) return undefined
  const rect = rects[drag.typeId]
  return rect && anchorPoint(rect, drag.anchor)
}

function endPoint(node: InternalNode<Node> | undefined, anchor: EdgeAnchor | undefined): XY | undefined {
  const rect = rectOf(node)
  return rect && anchor ? anchorPoint(rect, anchor) : undefined
}

function rectOf(node: InternalNode<Node> | undefined): Rect | undefined {
  if (!node?.measured?.width || !node.measured.height) return undefined
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width,
    height: node.measured.height,
  }
}

function getRects(nodes: Node[]): Record<string, Rect> {
  const rects: Record<string, Rect> = {}
  for (const node of nodes) {
    if (!node.measured?.width || !node.measured.height) continue
    rects[node.id] = { x: node.position.x, y: node.position.y, width: node.measured.width, height: node.measured.height }
  }
  return rects
}

function omit(rects: Record<string, Rect>, id: string): Record<string, Rect> {
  const { [id]: _, ...rest } = rects
  return rest
}

function insert(points: XY[], index: number, point: XY): XY[] {
  const next = [...points]
  next.splice(index, 0, point)
  return next
}

export const RelationEdge = memo(RelationEdgeComponent)
