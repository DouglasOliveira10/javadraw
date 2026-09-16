/** SVG marker definitions shared by every edge; rendered once inside the React Flow viewport. */
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
              <path d="M 2 2 L 17 10 L 2 18 z" className="jd-marker-hollow" />
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
              <path d="M 2 3 L 17 10 L 2 17 L 6 10 z" className="jd-marker-fill" />
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
              <path d="M 4 3 L 16 10 L 4 17" className="jd-marker-open" />
            </marker>
          </g>
        ))}
      </defs>
    </svg>
  )
}
