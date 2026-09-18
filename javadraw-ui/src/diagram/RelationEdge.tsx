import { memo } from 'react'
import { EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react'
import type { CanvasEdgeData } from './toReactFlow'
import { useEdgeTheme } from './EdgeTheme'

type Marker = 'triangle' | 'arrow' | 'open'

interface Look {
  marker: Marker
  dash?: string
  muted?: boolean
}

function lookOf(variant: CanvasEdgeData['variant']): Look {
  switch (variant) {
    case 'EXTENDS':
      return { marker: 'triangle' }
    case 'IMPLEMENTS':
      return { marker: 'triangle', dash: '6 4' }
    case 'ASSOCIATION':
      return { marker: 'open' }
    case 'DEPENDENCY':
      return { marker: 'open', dash: '6 4', muted: true }
    default:
      return { marker: 'arrow' }
  }
}

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
  const look = lookOf(data.variant)
  const stroke = selected ? palette.accent : look.muted ? palette.muted : palette.stroke
  const markerId = `jd-${look.marker}${selected ? '-active' : look.muted ? '-muted' : ''}`

  return (
    <>
      <path d={path} className="react-flow__edge-interaction" fill="none" strokeWidth={16} stroke="transparent" />
      {/* Colours are inline, not from a class: the PNG export drops the document stylesheet. */}
      <path
        d={path}
        className="jd-edge"
        fill="none"
        stroke={stroke}
        strokeWidth={selected ? 2 : 1.4}
        strokeDasharray={look.dash}
        markerEnd={`url(#${markerId})`}
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
