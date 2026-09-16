import { memo } from 'react'
import { EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react'
import type { CanvasEdgeData } from './toReactFlow'

interface Look {
  className: string
  marker: 'triangle' | 'arrow' | 'open'
}

function lookOf(variant: CanvasEdgeData['variant']): Look {
  switch (variant) {
    case 'EXTENDS':
      return { className: '', marker: 'triangle' }
    case 'IMPLEMENTS':
      return { className: 'jd-dashed', marker: 'triangle' }
    case 'ASSOCIATION':
      return { className: '', marker: 'open' }
    case 'DEPENDENCY':
      return { className: 'jd-dashed jd-muted', marker: 'open' }
    default:
      return { className: '', marker: 'arrow' }
  }
}

function RelationEdgeComponent(props: EdgeProps<Edge<CanvasEdgeData>>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props
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
  const look = lookOf(data.variant)
  const markerId = `jd-${look.marker}${selected ? '-active' : look.className.includes('jd-muted') ? '-muted' : ''}`

  return (
    <>
      <path d={path} className="react-flow__edge-interaction" fill="none" strokeWidth={16} stroke="transparent" />
      <path d={path} className={`jd-edge ${look.className} ${selected ? 'jd-active' : ''}`} markerEnd={`url(#${markerId})`} />
      {data.label && (
        <EdgeLabelRenderer>
          <div
            className={`jd-edge-label ${selected ? 'jd-active' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const RelationEdge = memo(RelationEdgeComponent)
