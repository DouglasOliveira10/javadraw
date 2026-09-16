import type { XY } from './canvasState'

export interface Box extends XY {
  width: number
  height: number
}

/** Where the new card should grow from, relative to the card it was added from. */
export type Direction = 'right' | 'left' | 'up' | 'down'

const GAP = 70
const DEFAULT_SIZE = { width: 240, height: 90 }

/**
 * Places a new card next to its origin, walking outwards until it no longer overlaps an existing card.
 * Manual layout: nothing that is already on the canvas moves.
 */
export function placeNode(
  origin: Box | undefined,
  size: Partial<Box> | undefined,
  taken: Box[],
  direction: Direction = 'right',
): XY {
  const width = size?.width ?? DEFAULT_SIZE.width
  const height = size?.height ?? DEFAULT_SIZE.height
  if (!origin) return firstFree({ width, height }, taken)

  const step = { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } }[direction]
  const horizontal = step.x !== 0
  const base: XY = {
    x: horizontal ? origin.x + step.x * (origin.width + GAP) : origin.x,
    y: horizontal ? origin.y : origin.y + step.y * (origin.height + GAP),
  }

  // Try the spot straight ahead, then fan out sideways, then one lane further away.
  for (let lane = 0; lane < 6; lane++) {
    for (const offset of laneOffsets()) {
      const candidate: XY = horizontal
        ? { x: base.x + step.x * lane * (width + GAP), y: base.y + offset * (height + GAP) }
        : { x: base.x + offset * (width + GAP), y: base.y + step.y * lane * (height + GAP) }
      if (!overlapsAny({ ...candidate, width, height }, taken)) return candidate
    }
  }
  return { x: base.x, y: base.y + taken.length * (height + GAP) }
}

function laneOffsets(): number[] {
  return [0, 1, -1, 2, -2, 3, -3]
}

function firstFree(size: { width: number; height: number }, taken: Box[]): XY {
  for (let row = 0; row < 40; row++) {
    for (let column = 0; column < 6; column++) {
      const candidate = { x: column * (size.width + GAP), y: row * (size.height + GAP) }
      if (!overlapsAny({ ...candidate, ...size }, taken)) return candidate
    }
  }
  return { x: 0, y: 0 }
}

export function overlapsAny(box: Box, taken: Box[]): boolean {
  return taken.some((other) => overlaps(box, other))
}

function overlaps(a: Box, b: Box): boolean {
  const margin = GAP / 2
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin &&
    a.y + a.height + margin > b.y
  )
}

/** Structural relations read top-down in UML; everything else grows sideways. */
export function directionFor(kind: string, outgoing: boolean): Direction {
  if (kind === 'EXTENDS' || kind === 'IMPLEMENTS') return outgoing ? 'up' : 'down'
  return outgoing ? 'right' : 'left'
}
