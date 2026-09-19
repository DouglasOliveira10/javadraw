import { describe, expect, it } from 'vitest'
import { edgePalette } from '../theme'
import { edgeLook, markerColours, markerId, markerUrl } from './edgeLook'

const palette = edgePalette(false)

describe('edgeLook', () => {
  it('dresses each relation the way UML expects', () => {
    expect(edgeLook('EXTENDS', undefined, palette, false)).toMatchObject({ endMarker: 'triangle', dash: undefined })
    expect(edgeLook('IMPLEMENTS', undefined, palette, false)).toMatchObject({ endMarker: 'triangle', dash: '6 4' })
    expect(edgeLook('ASSOCIATION', undefined, palette, false)).toMatchObject({ endMarker: 'open', stroke: palette.stroke })
    expect(edgeLook('DEPENDENCY', undefined, palette, false)).toMatchObject({ endMarker: 'open', stroke: palette.muted })
    expect(edgeLook('MANUAL', undefined, palette, false)).toMatchObject({ endMarker: 'arrow', startMarker: 'none' })
  })

  it('lets the user override every part of it', () => {
    const look = edgeLook(
      'EXTENDS',
      { line: 'dotted', startMarker: 'diamond', endMarker: 'none', color: '#ff8800' },
      palette,
      false,
    )
    expect(look).toMatchObject({ dash: '1.5 4', startMarker: 'diamond', endMarker: 'none', stroke: '#ff8800' })
  })

  it('paints a selected edge with the accent, whatever colour it was given', () => {
    const look = edgeLook('MANUAL', { color: '#ff8800' }, palette, true)
    expect(look.stroke).toBe(palette.accent)
    expect(look.width).toBeGreaterThan(edgeLook('MANUAL', undefined, palette, false).width)
  })
})

describe('markers', () => {
  it('names one marker per shape and colour', () => {
    expect(markerId('triangle', '#FF8800')).toBe('jd-triangle-ff8800')
    expect(markerUrl('arrow', '#000000')).toBe('url(#jd-arrow-000000)')
  })

  it('has no marker to point at when the end is bare', () => {
    expect(markerId('none', '#ff8800')).toBeUndefined()
    expect(markerUrl('none', '#ff8800')).toBeUndefined()
  })

  it('collects the theme colours plus the ones painted by hand, once each', () => {
    const colours = markerColours([{ color: '#ff8800' }, { color: '#ff8800' }, undefined, {}], palette)
    expect(colours).toEqual([palette.stroke, palette.muted, palette.accent, '#ff8800'])
  })
})
