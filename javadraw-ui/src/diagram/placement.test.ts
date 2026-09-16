import { describe, expect, it } from 'vitest'
import { directionFor, overlapsAny, placeNode, type Box } from './placement'

const origin: Box = { x: 0, y: 0, width: 200, height: 100 }
const size = { width: 200, height: 100 }

describe('placeNode', () => {
  it('puts the first card at the origin of an empty canvas', () => {
    expect(placeNode(undefined, size, [])).toEqual({ x: 0, y: 0 })
  })

  it('places a new card beside the card it came from', () => {
    const position = placeNode(origin, size, [origin], 'right')
    expect(position.x).toBeGreaterThan(origin.width)
    expect(position.y).toBe(0)
  })

  it('grows upwards for supertypes and downwards for subtypes', () => {
    expect(placeNode(origin, size, [origin], 'up').y).toBeLessThan(0)
    expect(placeNode(origin, size, [origin], 'down').y).toBeGreaterThan(0)
  })

  it('never overlaps a card that is already placed', () => {
    const taken = [origin]
    for (let i = 0; i < 12; i++) {
      const position = placeNode(origin, size, taken, 'right')
      expect(overlapsAny({ ...position, ...size }, taken)).toBe(false)
      taken.push({ ...position, ...size })
    }
  })

  it('finds a free spot for loose cards too', () => {
    const taken = [origin]
    const position = placeNode(undefined, size, taken)
    expect(overlapsAny({ ...position, ...size }, taken)).toBe(false)
  })
})

describe('directionFor', () => {
  it('reads inheritance top-down and everything else sideways', () => {
    expect(directionFor('EXTENDS', true)).toBe('up')
    expect(directionFor('IMPLEMENTS', false)).toBe('down')
    expect(directionFor('ASSOCIATION', true)).toBe('right')
    expect(directionFor('CALL', false)).toBe('left')
  })
})
