import type { XY } from './canvasState'
import type { Box } from './placement'

export type Alignment = 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom'
export type Axis = 'horizontal' | 'vertical'

/** Aligns the given cards against the outer edge (or the average center) of the selection. */
export function alignPositions(boxes: Record<string, Box>, alignment: Alignment): Record<string, XY> {
  const entries = Object.entries(boxes)
  if (entries.length < 2) return {}

  const left = Math.min(...entries.map(([, b]) => b.x))
  const right = Math.max(...entries.map(([, b]) => b.x + b.width))
  const top = Math.min(...entries.map(([, b]) => b.y))
  const bottom = Math.max(...entries.map(([, b]) => b.y + b.height))
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2

  const positions: Record<string, XY> = {}
  for (const [id, box] of entries) {
    switch (alignment) {
      case 'left':
        positions[id] = { x: left, y: box.y }
        break
      case 'right':
        positions[id] = { x: right - box.width, y: box.y }
        break
      case 'hcenter':
        positions[id] = { x: centerX - box.width / 2, y: box.y }
        break
      case 'top':
        positions[id] = { x: box.x, y: top }
        break
      case 'bottom':
        positions[id] = { x: box.x, y: bottom - box.height }
        break
      case 'vmiddle':
        positions[id] = { x: box.x, y: centerY - box.height / 2 }
        break
    }
  }
  return positions
}

/**
 * Spreads the cards so the gaps between them are equal, keeping the two outermost ones where they are.
 */
export function distributePositions(boxes: Record<string, Box>, axis: Axis): Record<string, XY> {
  const horizontal = axis === 'horizontal'
  const entries = Object.entries(boxes).sort(([, a], [, b]) => (horizontal ? a.x - b.x : a.y - b.y))
  if (entries.length < 3) return {}

  const size = (box: Box) => (horizontal ? box.width : box.height)
  const start = horizontal ? entries[0][1].x : entries[0][1].y
  const last = entries[entries.length - 1][1]
  const end = (horizontal ? last.x : last.y) + size(last)
  const occupied = entries.reduce((sum, [, box]) => sum + size(box), 0)
  const gap = (end - start - occupied) / (entries.length - 1)

  const positions: Record<string, XY> = {}
  let cursor = start
  for (const [id, box] of entries) {
    positions[id] = horizontal ? { x: cursor, y: box.y } : { x: box.x, y: cursor }
    cursor += size(box) + gap
  }
  return positions
}

/** Keeps a freshly arranged block where the selection already was, instead of jumping to the origin. */
export function keepTopLeft(positions: Record<string, XY>, boxes: Record<string, Box>): Record<string, XY> {
  const ids = Object.keys(positions)
  if (ids.length === 0) return positions
  const before = { x: Math.min(...ids.map((id) => boxes[id]?.x ?? 0)), y: Math.min(...ids.map((id) => boxes[id]?.y ?? 0)) }
  const after = { x: Math.min(...ids.map((id) => positions[id].x)), y: Math.min(...ids.map((id) => positions[id].y)) }
  const dx = before.x - after.x
  const dy = before.y - after.y
  const moved: Record<string, XY> = {}
  for (const id of ids) moved[id] = { x: positions[id].x + dx, y: positions[id].y + dy }
  return moved
}
