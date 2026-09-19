import { describe, expect, it } from 'vitest'
import { anchorPoint, cardAt, nearestAnchor, type Rect } from './edgeAnchor'

const card: Rect = { x: 100, y: 100, width: 200, height: 100 }

describe('anchorPoint', () => {
  it('slides along the side it was pinned to', () => {
    expect(anchorPoint(card, { side: 'b', offset: 0.5 })).toEqual({ x: 200, y: 200 })
    expect(anchorPoint(card, { side: 'b', offset: 0.25 })).toEqual({ x: 150, y: 200 })
    expect(anchorPoint(card, { side: 'l', offset: 0.5 })).toEqual({ x: 100, y: 150 })
    expect(anchorPoint(card, { side: 'r', offset: 0.5 })).toEqual({ x: 300, y: 150 })
    expect(anchorPoint(card, { side: 't', offset: 0.5 })).toEqual({ x: 200, y: 100 })
  })

  it('keeps away from the corners', () => {
    expect(anchorPoint(card, { side: 't', offset: 0 }).x).toBeGreaterThan(card.x)
    expect(anchorPoint(card, { side: 't', offset: 1 }).x).toBeLessThan(card.x + card.width)
  })
})

describe('nearestAnchor', () => {
  it('picks the side the pointer is closest to', () => {
    expect(nearestAnchor(card, { x: 150, y: 205 })).toMatchObject({ side: 'b' })
    expect(nearestAnchor(card, { x: 95, y: 150 })).toMatchObject({ side: 'l' })
    expect(nearestAnchor(card, { x: 305, y: 150 })).toMatchObject({ side: 'r' })
    expect(nearestAnchor(card, { x: 200, y: 95 })).toMatchObject({ side: 't' })
  })

  it('reads how far along that side the pointer is', () => {
    expect(nearestAnchor(card, { x: 150, y: 210 })).toEqual({ side: 'b', offset: 0.25 })
    expect(nearestAnchor(card, { x: 100, y: 175 })).toEqual({ side: 'l', offset: 0.75 })
  })

  it('pushes a point inside the card out to the closest border', () => {
    expect(nearestAnchor(card, { x: 280, y: 150 })).toMatchObject({ side: 'r' })
    expect(nearestAnchor(card, { x: 120, y: 150 })).toMatchObject({ side: 'l' })
  })
})

describe('cardAt', () => {
  const rects = { a: card, b: { x: 500, y: 100, width: 200, height: 100 } }

  it('finds the card under the pointer', () => {
    expect(cardAt(rects, { x: 150, y: 150 })).toBe('a')
    expect(cardAt(rects, { x: 550, y: 150 })).toBe('b')
  })

  it('reaches a little beyond the border, but not across the canvas', () => {
    expect(cardAt(rects, { x: 320, y: 150 })).toBe('a')
    expect(cardAt(rects, { x: 400, y: 150 })).toBeUndefined()
  })

  it('prefers the closest card when two are within reach', () => {
    expect(cardAt({ ...rects, c: { x: 310, y: 100, width: 50, height: 100 } }, { x: 330, y: 150 })).toBe('c')
  })
})
