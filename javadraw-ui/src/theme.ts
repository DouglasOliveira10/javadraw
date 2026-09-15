import type { HttpVerb } from './data/format'
import type { TypeInfo, TypeKind } from './data/types'

export const STEREOTYPE_COLORS: Record<string, string> = {
  application: '#f43f5e',
  controller: '#8b5cf6',
  service: '#3b82f6',
  repository: '#10b981',
  configuration: '#64748b',
  entity: '#f59e0b',
  component: '#06b6d4',
  exception: '#ef4444',
}

export const NEUTRAL_ACCENT = '#a1a1aa'

export function accentOf(type: TypeInfo | undefined): string {
  if (!type || type.external) return NEUTRAL_ACCENT
  const stereotype = type.stereotypes?.[0]
  return (stereotype && STEREOTYPE_COLORS[stereotype]) || kindColor(type.kind)
}

export function kindColor(kind: TypeKind): string {
  switch (kind) {
    case 'INTERFACE':
      return '#22a06b'
    case 'ENUM':
      return '#d97706'
    case 'RECORD':
      return '#7c3aed'
    case 'ANNOTATION':
      return '#db2777'
    default:
      return '#3b82f6'
  }
}

export const VERB_COLORS: Record<HttpVerb, string> = {
  GET: '#10b981',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#a855f7',
  DELETE: '#ef4444',
  OTHER: '#64748b',
}
