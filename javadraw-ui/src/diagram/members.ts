export type Visibility = 'all' | 'none' | 'partial'

/** How much of a section (fields or methods) is revealed on the card. */
export function visibilityOf(visible: string[], all: string[]): Visibility {
  if (all.length === 0) return 'none'
  const shown = all.filter((id) => visible.includes(id)).length
  if (shown === 0) return 'none'
  return shown === all.length ? 'all' : 'partial'
}

/** Clicking the section eye reveals everything unless it is already fully revealed. */
export function nextSectionValue(visibility: Visibility): boolean {
  return visibility !== 'all'
}
