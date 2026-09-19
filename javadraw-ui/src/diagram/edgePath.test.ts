import { describe, expect, it } from 'vitest'
import { routeMidpoint, routePath, segmentMidpoints } from './edgePath'

const at = (x: number, y: number) => ({ x, y })

describe('routePath', () => {
  it('draws a straight line when nothing was bent', () => {
    expect(routePath([at(0, 0), at(100, 0)])).toBe('M 0,0 L 100,0')
  })

  it('rounds the corner around a bend point', () => {
    const path = routePath([at(0, 0), at(100, 0), at(100, 100)], 10)
    expect(path).toBe('M 0,0 L 90,0 Q 100,0 100,10 L 100,100')
  })

  it('shrinks the corner radius so it never overshoots a short segment', () => {
    const path = routePath([at(0, 0), at(10, 0), at(10, 10)], 10)
    expect(path).toBe('M 0,0 L 5,0 Q 10,0 10,5 L 10,10')
  })

  it('skips the curve when two points sit on top of each other', () => {
    expect(routePath([at(0, 0), at(0, 0), at(50, 0)])).toBe('M 0,0 L 0,0 L 50,0')
  })

  it('has nothing to draw without two points', () => {
    expect(routePath([at(0, 0)])).toBe('')
    expect(routePath([])).toBe('')
  })
})

describe('routeMidpoint', () => {
  it('walks along the line, not across the box', () => {
    expect(routeMidpoint([at(0, 0), at(100, 0)])).toEqual(at(50, 0))
    expect(routeMidpoint([at(0, 0), at(100, 0), at(100, 100)])).toEqual(at(100, 0))
  })

  it('survives a degenerate line', () => {
    expect(routeMidpoint([])).toEqual(at(0, 0))
    expect(routeMidpoint([at(7, 7), at(7, 7)])).toEqual(at(7, 7))
  })
})

describe('segmentMidpoints', () => {
  it('offers one grab point per segment', () => {
    expect(segmentMidpoints([at(0, 0), at(100, 0), at(100, 100)])).toEqual([at(50, 0), at(100, 50)])
    expect(segmentMidpoints([at(0, 0)])).toEqual([])
  })
})
