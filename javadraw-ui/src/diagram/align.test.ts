import { describe, expect, it } from 'vitest'
import type { Box } from './placement'
import { alignPositions, distributePositions, keepTopLeft } from './align'

const boxes: Record<string, Box> = {
  a: { x: 0, y: 0, width: 100, height: 40 },
  b: { x: 50, y: 100, width: 200, height: 60 },
  c: { x: 300, y: 300, width: 100, height: 100 },
}

describe('alignPositions', () => {
  it('aligns against the outer edges of the selection', () => {
    expect(alignPositions(boxes, 'left')).toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 100 }, c: { x: 0, y: 300 } })
    expect(alignPositions(boxes, 'right')).toEqual({ a: { x: 300, y: 0 }, b: { x: 200, y: 100 }, c: { x: 300, y: 300 } })
    expect(alignPositions(boxes, 'top')).toEqual({ a: { x: 0, y: 0 }, b: { x: 50, y: 0 }, c: { x: 300, y: 0 } })
    expect(alignPositions(boxes, 'bottom')).toEqual({ a: { x: 0, y: 360 }, b: { x: 50, y: 340 }, c: { x: 300, y: 300 } })
  })

  it('centers the cards on the middle of the selection', () => {
    const centered = alignPositions(boxes, 'hcenter')
    const centerOf = (id: string) => centered[id].x + boxes[id].width / 2
    expect(centerOf('a')).toBeCloseTo(centerOf('b'))
    expect(centerOf('b')).toBeCloseTo(centerOf('c'))
    expect(centered.a.y).toBe(0)
  })

  it('does nothing with a single card', () => {
    expect(alignPositions({ a: boxes.a }, 'left')).toEqual({})
  })
})

describe('distributePositions', () => {
  it('leaves equal gaps and keeps the outer cards in place', () => {
    const spread = distributePositions(boxes, 'horizontal')
    expect(spread.a.x).toBe(0)
    expect(spread.c.x).toBe(300)
    const gap1 = spread.b.x - (spread.a.x + boxes.a.width)
    const gap2 = spread.c.x - (spread.b.x + boxes.b.width)
    expect(gap1).toBeCloseTo(gap2)
    expect(spread.b.y).toBe(boxes.b.y)
  })

  it('needs at least three cards', () => {
    expect(distributePositions({ a: boxes.a, b: boxes.b }, 'vertical')).toEqual({})
  })
})

describe('keepTopLeft', () => {
  it('shifts a fresh layout back onto the old corner of the selection', () => {
    const arranged = { a: { x: 0, y: 0 }, b: { x: 120, y: 0 } }
    const moved = keepTopLeft(arranged, { a: boxes.b, b: boxes.c })
    expect(moved.a).toEqual({ x: 50, y: 100 })
    expect(moved.b).toEqual({ x: 170, y: 100 })
  })
})
