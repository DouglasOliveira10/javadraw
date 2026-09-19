import { memo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { EdgeLabelRenderer, getSmoothStepPath, useReactFlow, type Edge, type EdgeProps } from '@xyflow/react'
import type { XY } from './canvasState'
import type { CanvasEdgeData } from './toReactFlow'
import { edgeLook, markerUrl } from './edgeLook'
import { routeMidpoint, routePath, segmentMidpoints } from './edgePath'
import { useEdgeActions } from './EdgeActions'
import { useEdgeTheme } from './EdgeTheme'

/** A bend point being dragged: the whole route, plus which point of it follows the pointer. */
interface Drag {
  points: XY[]
  index: number
}

function RelationEdgeComponent(props: EdgeProps<Edge<CanvasEdgeData>>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props
  const palette = useEdgeTheme()
  const { setWaypoints } = useEdgeActions()
  const { screenToFlowPosition } = useReactFlow()
  const [drag, setDrag] = useState<Drag | null>(null)
  if (!data) return null

  const source = { x: sourceX, y: sourceY }
  const target = { x: targetX, y: targetY }
  const waypoints = drag?.points ?? data.waypoints ?? []
  const bent = waypoints.length > 0
  const route = [source, ...waypoints, target]

  const [automatic, automaticLabelX, automaticLabelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
  })
  const path = bent ? routePath(route) : automatic
  const label = bent ? routeMidpoint(route) : { x: automaticLabelX, y: automaticLabelY }
  const look = edgeLook(data.variant, data.style, palette, !!selected)

  /** Follows the pointer until it is let go, then hands the route over to the canvas state. */
  const startDragging = (event: ReactPointerEvent<SVGCircleElement>, points: XY[], index: number) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ points, index })
  }

  const dragTo = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!drag) return
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setDrag({ ...drag, points: drag.points.map((current, i) => (i === drag.index ? point : current)) })
  }

  const drop = () => {
    if (!drag) return
    setWaypoints(id, drag.points)
    setDrag(null)
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

      {selected && (
        <g className="nodrag nopan">
          {/* Halfway down each segment: grabbing one bends the line there. */}
          {segmentMidpoints(route).map((point, segment) => (
            <circle
              key={`add-${segment}`}
              className="jd-bend jd-bend-new"
              cx={point.x}
              cy={point.y}
              r={4}
              fill={palette.surface}
              stroke={palette.accent}
              onPointerDown={(event) => startDragging(event, insert(waypoints, segment, point), segment)}
              onPointerMove={dragTo}
              onPointerUp={drop}
            />
          ))}
          {waypoints.map((point, index) => (
            <circle
              key={`bend-${index}`}
              className="jd-bend"
              cx={point.x}
              cy={point.y}
              r={5}
              fill={palette.accent}
              stroke={palette.surface}
              onPointerDown={(event) => startDragging(event, [...waypoints], index)}
              onPointerMove={dragTo}
              onPointerUp={drop}
              onDoubleClick={(event) => {
                event.stopPropagation()
                setWaypoints(id, waypoints.filter((_, i) => i !== index))
              }}
            />
          ))}
        </g>
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

function insert(points: XY[], index: number, point: XY): XY[] {
  const next = [...points]
  next.splice(index, 0, point)
  return next
}

export const RelationEdge = memo(RelationEdgeComponent)
