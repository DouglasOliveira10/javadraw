import { describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, canRedo, canUndo, initialHistory, record, redo, undo } from './history'

const steps = (history: ReturnType<typeof initialHistory<string>>) => ({
  past: history.past,
  present: history.present,
  future: history.future,
})

describe('history', () => {
  it('starts with nowhere to go', () => {
    const history = initialHistory('a')
    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
    expect(undo(history)).toBe(history)
    expect(redo(history)).toBe(history)
  })

  it('walks back and forth through what was done', () => {
    const history = record(record(initialHistory('a'), 'b'), 'c')
    expect(steps(history)).toEqual({ past: ['a', 'b'], present: 'c', future: [] })

    const back = undo(undo(history))
    expect(steps(back)).toEqual({ past: [], present: 'a', future: ['b', 'c'] })

    const forward = redo(back)
    expect(steps(forward)).toEqual({ past: ['a'], present: 'b', future: ['c'] })
  })

  it('drops the undone states once a new edit comes in', () => {
    const history = undo(record(record(initialHistory('a'), 'b'), 'c'))
    expect(canRedo(history)).toBe(true)
    expect(steps(record(history, 'd'))).toEqual({ past: ['a', 'b'], present: 'd', future: [] })
  })

  it('ignores an edit that changed nothing', () => {
    const history = record(initialHistory('a'), 'b')
    expect(record(history, 'b')).toBe(history)
  })

  it('folds a continuing gesture into one entry', () => {
    const typed = record(record(record(initialHistory('a'), 'ab', 'label'), 'abc', 'label'), 'abcd', 'label')
    expect(steps(typed)).toEqual({ past: ['a'], present: 'abcd', future: [] })
    expect(steps(undo(typed))).toEqual({ past: [], present: 'a', future: ['abcd'] })
  })

  it('starts a new entry when the gesture changes', () => {
    const history = record(record(initialHistory('a'), 'b', 'label'), 'c', 'colour')
    expect(history.past).toEqual(['a', 'b'])
  })

  it('forgets the oldest states once it is full', () => {
    let history = initialHistory(0)
    for (let step = 1; step <= HISTORY_LIMIT + 10; step++) history = record(history, step)
    expect(history.past).toHaveLength(HISTORY_LIMIT)
    // 0 to 69 were visited; the ten oldest fell off the back
    expect(history.past[0]).toBe(10)
    expect(history.present).toBe(HISTORY_LIMIT + 10)
  })
})
