import type { EdgeMarker } from './canvasState'
import { markerId } from './edgeLook'
import { useEdgeTheme } from './EdgeTheme'

const SHAPES: Exclude<EdgeMarker, 'none'>[] = ['open', 'arrow', 'triangle', 'diamond']

/**
 * SVG marker definitions shared by every edge, rendered once inside the React Flow viewport — one set per
 * colour in use. Colours are attributes rather than CSS classes, otherwise the PNG export loses the heads.
 */
export function EdgeMarkers({ colours }: { colours: string[] }) {
  const palette = useEdgeTheme()
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden>
      <defs>
        {colours.map((colour) => SHAPES.map((shape) => <Marker key={`${shape}-${colour}`} shape={shape} colour={colour} surface={palette.surface} />))}
      </defs>
    </svg>
  )
}

function Marker({ shape, colour, surface }: { shape: Exclude<EdgeMarker, 'none'>; colour: string; surface: string }) {
  const common = {
    id: markerId(shape, colour),
    viewBox: '0 0 20 20',
    refY: 10,
    orient: 'auto-start-reverse',
    markerUnits: 'userSpaceOnUse' as const,
  }

  switch (shape) {
    case 'triangle':
      return (
        <marker {...common} refX={17} markerWidth={16} markerHeight={16}>
          <path d="M 2 2 L 17 10 L 2 18 z" fill={surface} stroke={colour} strokeWidth={1.4} />
        </marker>
      )
    case 'arrow':
      return (
        <marker {...common} refX={16} markerWidth={12} markerHeight={12}>
          <path d="M 2 3 L 17 10 L 2 17 L 6 10 z" fill={colour} />
        </marker>
      )
    case 'diamond':
      return (
        <marker {...common} refX={18} markerWidth={18} markerHeight={18}>
          <path d="M 2 10 L 10 4 L 18 10 L 10 16 z" fill={colour} stroke={colour} strokeWidth={1.2} />
        </marker>
      )
    default:
      return (
        <marker {...common} refX={16} markerWidth={13} markerHeight={13}>
          <path d="M 4 3 L 16 10 L 4 17" fill="none" stroke={colour} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      )
  }
}
