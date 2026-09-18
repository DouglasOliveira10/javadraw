import { useEdgeTheme } from './EdgeTheme'

/**
 * SVG marker definitions shared by every edge, rendered once inside the React Flow viewport.
 * Colours are attributes rather than CSS classes, otherwise the PNG export loses the arrow heads.
 */
export function EdgeMarkers() {
  const palette = useEdgeTheme()
  const variants: { suffix: string; colour: string }[] = [
    { suffix: '', colour: palette.stroke },
    { suffix: '-active', colour: palette.accent },
    { suffix: '-muted', colour: palette.muted },
  ]

  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden>
      <defs>
        {variants.map(({ suffix, colour }) => (
          <g key={suffix}>
            <marker
              id={`jd-triangle${suffix}`}
              viewBox="0 0 20 20"
              refX="17"
              refY="10"
              markerWidth="16"
              markerHeight="16"
              orient="auto-start-reverse"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 2 2 L 17 10 L 2 18 z" fill={palette.surface} stroke={colour} strokeWidth={1.4} />
            </marker>
            <marker
              id={`jd-arrow${suffix}`}
              viewBox="0 0 20 20"
              refX="16"
              refY="10"
              markerWidth="12"
              markerHeight="12"
              orient="auto-start-reverse"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 2 3 L 17 10 L 2 17 L 6 10 z" fill={colour} />
            </marker>
            <marker
              id={`jd-open${suffix}`}
              viewBox="0 0 20 20"
              refX="16"
              refY="10"
              markerWidth="13"
              markerHeight="13"
              orient="auto-start-reverse"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 4 3 L 16 10 L 4 17" fill="none" stroke={colour} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </g>
        ))}
      </defs>
    </svg>
  )
}
