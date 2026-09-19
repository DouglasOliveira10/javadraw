import type { XY } from './canvasState'

/**
 * The line an edge draws once the user has bent it: a polyline through the bend points, with the corners
 * rounded so it reads like the automatic route. Points are source, bend points, target.
 */
export function routePath(points: XY[], radius = 10): string {
  if (points.length < 2) return ''
  const [first, ...rest] = points
  let path = `M ${round(first.x)},${round(first.y)}`

  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1]
    const corner = points[i]
    const next = points[i + 1]
    const r = Math.min(radius, distance(corner, previous) / 2, distance(corner, next) / 2)
    if (r < 0.5) {
      path += ` L ${round(corner.x)},${round(corner.y)}`
      continue
    }
    const into = along(corner, previous, r)
    const out = along(corner, next, r)
    path += ` L ${round(into.x)},${round(into.y)} Q ${round(corner.x)},${round(corner.y)} ${round(out.x)},${round(out.y)}`
  }

  const last = rest[rest.length - 1]
  return `${path} L ${round(last.x)},${round(last.y)}`
}

/** Where the label sits: the middle of the line measured along it, not the middle of the box. */
export function routeMidpoint(points: XY[]): XY {
  if (points.length === 0) return { x: 0, y: 0 }
  const total = length(points)
  let walked = 0
  for (let i = 0; i < points.length - 1; i++) {
    const segment = distance(points[i], points[i + 1])
    if (walked + segment >= total / 2) {
      const ratio = segment === 0 ? 0 : (total / 2 - walked) / segment
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
      }
    }
    walked += segment
  }
  return points[points.length - 1]
}

/** Middle of every segment: where a new bend point can be grabbed from. */
export function segmentMidpoints(points: XY[]): XY[] {
  const midpoints: XY[] = []
  for (let i = 0; i < points.length - 1; i++) {
    midpoints.push({ x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 })
  }
  return midpoints
}

function length(points: XY[]): number {
  let total = 0
  for (let i = 0; i < points.length - 1; i++) total += distance(points[i], points[i + 1])
  return total
}

function distance(a: XY, b: XY): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** A point `r` away from `from`, on the way to `to`. */
function along(from: XY, to: XY, r: number): XY {
  const d = distance(from, to)
  if (d === 0) return from
  return { x: from.x + ((to.x - from.x) / d) * r, y: from.y + ((to.y - from.y) / d) * r }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
