import type { EdgeKind, EdgeLine, EdgeMarker, EdgeStyle } from './canvasState'
import type { EdgePalette } from '../theme'

export const EDGE_LINES: EdgeLine[] = ['solid', 'dashed', 'dotted']
export const EDGE_MARKERS: EdgeMarker[] = ['none', 'open', 'arrow', 'triangle', 'diamond']

const DASH: Record<EdgeLine, string | undefined> = {
  solid: undefined,
  dashed: '6 4',
  dotted: '1.5 4',
}

export interface EdgeLook {
  stroke: string
  dash?: string
  startMarker: EdgeMarker
  endMarker: EdgeMarker
  width: number
}

/** What a relation looks like when the user has not said otherwise. */
function defaultsOf(kind: EdgeKind): { line: EdgeLine; startMarker: EdgeMarker; endMarker: EdgeMarker; muted?: boolean } {
  switch (kind) {
    case 'EXTENDS':
      return { line: 'solid', startMarker: 'none', endMarker: 'triangle' }
    case 'IMPLEMENTS':
      return { line: 'dashed', startMarker: 'none', endMarker: 'triangle' }
    case 'ASSOCIATION':
      return { line: 'solid', startMarker: 'none', endMarker: 'open' }
    case 'DEPENDENCY':
      return { line: 'dashed', startMarker: 'none', endMarker: 'open', muted: true }
    default:
      return { line: 'solid', startMarker: 'none', endMarker: 'arrow' }
  }
}

/** Merges the kind's look with what the user changed by hand; selection always wins on colour. */
export function edgeLook(kind: EdgeKind, style: EdgeStyle | undefined, palette: EdgePalette, selected: boolean): EdgeLook {
  const base = defaultsOf(kind)
  const line = style?.line ?? base.line
  const colour = style?.color ?? (base.muted ? palette.muted : palette.stroke)
  return {
    stroke: selected ? palette.accent : colour,
    dash: DASH[line],
    startMarker: style?.startMarker ?? base.startMarker,
    endMarker: style?.endMarker ?? base.endMarker,
    width: selected ? 2 : 1.4,
  }
}

/** Markers are defined per shape and colour, so an edge painted by hand keeps its arrow head. */
export function markerId(shape: EdgeMarker, colour: string): string | undefined {
  return shape === 'none' ? undefined : `jd-${shape}-${colour.replace('#', '').toLowerCase()}`
}

export function markerUrl(shape: EdgeMarker, colour: string): string | undefined {
  const id = markerId(shape, colour)
  return id && `url(#${id})`
}

/** Every colour an edge may ask a marker for, deduped. */
export function markerColours(styles: (EdgeStyle | undefined)[], palette: EdgePalette): string[] {
  const colours = new Set([palette.stroke, palette.muted, palette.accent])
  for (const style of styles) if (style?.color) colours.add(style.color)
  return [...colours]
}
