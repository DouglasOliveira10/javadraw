import { memo } from 'react'
import { EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react'
import type { CanvasEdgeData } from './toReactFlow'
import { edgeLook, markerUrl } from './edgeLook'
import { useEdgeTheme } from './EdgeTheme'

function RelationEdgeComponent(props: EdgeProps<Edge<CanvasEdgeData>>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props
  const palette = useEdgeTheme()
  if (!data) return null

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
  })
  const look = edgeLook(data.variant, data.style, palette, !!selected)

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
      {data.label && (
        <EdgeLabelRenderer>
          <div
            className="jd-edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
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

export const RelationEdge = memo(RelationEdgeComponent)
