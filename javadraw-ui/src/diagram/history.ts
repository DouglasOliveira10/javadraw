/**
 * Undo/redo as a wrapper around any state: the states already visited, the one on screen, and the ones
 * undone. Edits that come in a stream — typing a label, dragging a colour around the picker — carry a tag
 * and fold into the previous entry, so one gesture costs one undo.
 */
export interface History<T> {
  past: T[]
  present: T
  future: T[]
  /** What produced the current entry, when it is the kind that can absorb the next edit. */
  tag?: string
}

/** Older entries are dropped; a diagram is small, but not small enough to keep forever. */
export const HISTORY_LIMIT = 60

export function initialHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

export function record<T>(history: History<T>, present: T, tag?: string): History<T> {
  if (present === history.present) return history
  // The same gesture carrying on: replace what is on screen, do not stack another entry.
  if (tag && tag === history.tag) return { ...history, present, future: [] }
  const past = [...history.past, history.present].slice(-HISTORY_LIMIT)
  return { past, present, future: [], tag }
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history
  const past = [...history.past]
  const present = past.pop()!
  return { past, present, future: [history.present, ...history.future] }
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history
  const [present, ...future] = history.future
  return { past: [...history.past, history.present], present, future }
}
