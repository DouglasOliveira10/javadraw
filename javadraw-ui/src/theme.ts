import type { HttpVerb } from './data/format'
import type { TypeInfo, TypeKind } from './data/types'

/** Colours the user can change; the defaults are what the diagram has always used. */
export const DEFAULT_STEREOTYPE_COLORS: Record<string, string> = {
  application: '#f43f5e',
  controller: '#8b5cf6',
  service: '#3b82f6',
  repository: '#10b981',
  configuration: '#64748b',
  entity: '#f59e0b',
  component: '#06b6d4',
  exception: '#ef4444',
}

export const DEFAULT_KIND_COLORS: Record<TypeKind, string> = {
  CLASS: '#3b82f6',
  INTERFACE: '#22a06b',
  ENUM: '#d97706',
  RECORD: '#7c3aed',
  ANNOTATION: '#db2777',
}

export const NEUTRAL_ACCENT = '#a1a1aa'

export interface Palette {
  kinds: Record<TypeKind, string>
  stereotypes: Record<string, string>
}

export const DEFAULT_PALETTE: Palette = { kinds: DEFAULT_KIND_COLORS, stereotypes: DEFAULT_STEREOTYPE_COLORS }

export function kindColor(kind: TypeKind, palette: Palette = DEFAULT_PALETTE): string {
  return palette.kinds[kind] ?? DEFAULT_KIND_COLORS[kind]
}

export function stereotypeColor(stereotype: string, palette: Palette = DEFAULT_PALETTE): string {
  return palette.stereotypes[stereotype] ?? DEFAULT_STEREOTYPE_COLORS[stereotype] ?? '#64748b'
}

/** A stereotype wins over the kind, so the controller → service → repository reading survives. */
export function accentOf(type: TypeInfo | undefined, palette: Palette = DEFAULT_PALETTE): string {
  if (!type || type.external) return NEUTRAL_ACCENT
  const stereotype = type.stereotypes?.[0]
  return stereotype ? stereotypeColor(stereotype, palette) : kindColor(type.kind, palette)
}

export const VERB_COLORS: Record<HttpVerb, string> = {
  GET: '#10b981',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#a855f7',
  DELETE: '#ef4444',
  OTHER: '#64748b',
}

/**
 * Edge colours as plain values. They must not come from CSS variables: PNG export serializes the SVG
 * without the document stylesheet, so anything styled by class alone comes out invisible.
 */
export interface EdgePalette {
  stroke: string
  muted: string
  accent: string
  surface: string
}

export function edgePalette(dark: boolean): EdgePalette {
  return dark
    ? { stroke: '#7c8494', muted: '#4a5060', accent: '#8b7fff', surface: '#151821' }
    : { stroke: '#8a91a0', muted: '#b7bcc6', accent: '#6d5dfc', surface: '#ffffff' }
}
