import { describe, expect, it } from 'vitest'
import { nextSectionValue, visibilityOf } from './members'

describe('visibilityOf', () => {
  it('reports how much of a section is revealed', () => {
    expect(visibilityOf([], ['a', 'b'])).toBe('none')
    expect(visibilityOf(['a'], ['a', 'b'])).toBe('partial')
    expect(visibilityOf(['a', 'b'], ['a', 'b'])).toBe('all')
  })

  it('ignores members that are not listed on the card', () => {
    expect(visibilityOf(['gone'], ['a'])).toBe('none')
    expect(visibilityOf(['a', 'gone'], ['a'])).toBe('all')
  })

  it('treats an empty section as nothing to show', () => {
    expect(visibilityOf([], [])).toBe('none')
  })
})

describe('nextSectionValue', () => {
  it('only hides when everything is already visible', () => {
    expect(nextSectionValue('none')).toBe(true)
    expect(nextSectionValue('partial')).toBe(true)
    expect(nextSectionValue('all')).toBe(false)
  })
})
