/** Handle ids shared by the card component and the edge builder. */

export type Side = 'l' | 'r' | 't' | 'b'

/** The whole card as one drop target, used while a line is being drawn. */
export const BODY_HANDLE = 'card-body'

export function cardHandle(side: Side): string {
  return `card-${side}`
}

export function fieldHandle(field: string, side: Side): string {
  return `f:${field}-${side}`
}

export function methodHandle(methodId: string, side: Side): string {
  return `m:${methodId}-${side}`
}

/** Reads back the side a handle sits on, for a line the user just drew. */
export function sideOfHandle(handleId: string | null | undefined): Side | undefined {
  if (!handleId || handleId === BODY_HANDLE) return undefined
  const side = handleId.slice(-1)
  return side === 'l' || side === 'r' || side === 't' || side === 'b' ? side : undefined
}

/**
 * Picks the sides that make the arrow travel the shortest way between two cards: sideways normally, but
 * top/bottom for cards stacked almost vertically, so the line does not loop around them.
 */
export function facingSides(from: { x: number; y: number }, to: { x: number; y: number }): { source: Side; target: Side } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dy) > Math.abs(dx) * 1.5) {
    return dy >= 0 ? { source: 'b', target: 't' } : { source: 't', target: 'b' }
  }
  return dx >= 0 ? { source: 'r', target: 'l' } : { source: 'l', target: 'r' }
}

/** Inheritance is drawn vertically, but flips when the supertype was dragged below the subtype. */
export function verticalSides(child: { y: number }, parent: { y: number }): { source: Side; target: Side } {
  return child.y >= parent.y ? { source: 't', target: 'b' } : { source: 'b', target: 't' }
}
