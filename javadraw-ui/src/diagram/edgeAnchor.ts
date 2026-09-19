import type { EdgeAnchor, XY } from './canvasState'
import type { Side } from './handles'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Corners read badly and the arrow head overlaps them, so a point never slides all the way there. */
const MARGIN = 0.08

/** The point an anchor names on the border of a card. */
export function anchorPoint(rect: Rect, anchor: EdgeAnchor): XY {
  const t = clamp(anchor.offset)
  switch (anchor.side) {
    case 'l':
      return { x: rect.x, y: rect.y + rect.height * t }
    case 'r':
      return { x: rect.x + rect.width, y: rect.y + rect.height * t }
    case 't':
      return { x: rect.x + rect.width * t, y: rect.y }
    default:
      return { x: rect.x + rect.width * t, y: rect.y + rect.height }
  }
}

/**
 * Where a point dropped at `at` lands on the border of a card: the closest side, and how far along it.
 * A point inside the card is pushed out to the nearest border.
 */
export function nearestAnchor(rect: Rect, at: XY): EdgeAnchor {
  const distances: { side: Side; distance: number }[] = [
    { side: 'l', distance: Math.abs(at.x - rect.x) },
    { side: 'r', distance: Math.abs(rect.x + rect.width - at.x) },
    { side: 't', distance: Math.abs(at.y - rect.y) },
    { side: 'b', distance: Math.abs(rect.y + rect.height - at.y) },
  ]
  const closest = distances.reduce((best, current) => (current.distance < best.distance ? current : best))
  const along =
    closest.side === 'l' || closest.side === 'r'
      ? rect.height === 0
        ? 0.5
        : (at.y - rect.y) / rect.height
      : rect.width === 0
        ? 0.5
        : (at.x - rect.x) / rect.width
  return { side: closest.side, offset: clamp(along) }
}

/** The card under the pointer, or the closest one within reach — what an end being dragged lands on. */
export function cardAt(rects: Record<string, Rect>, at: XY, reach = 40): string | undefined {
  let best: { id: string; distance: number } | undefined
  for (const [id, rect] of Object.entries(rects)) {
    const dx = Math.max(rect.x - at.x, 0, at.x - (rect.x + rect.width))
    const dy = Math.max(rect.y - at.y, 0, at.y - (rect.y + rect.height))
    const distance = Math.hypot(dx, dy)
    if (distance > reach) continue
    if (!best || distance < best.distance) best = { id, distance }
  }
  return best?.id
}

function clamp(offset: number): number {
  return Math.min(1 - MARGIN, Math.max(MARGIN, offset))
}
