import type { MethodInfo, TypeInfo, Visibility } from './types'

export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OTHER'

export const VISIBILITY_GLYPH: Record<Visibility, string> = {
  PUBLIC: '+',
  PROTECTED: '#',
  PACKAGE: '~',
  PRIVATE: '−',
}

/** {@code place(Order order): Receipt} → name, parameters and return type. */
export function splitSignature(method: MethodInfo): { params: string; returns?: string } {
  const open = method.signature.indexOf('(')
  const close = method.signature.lastIndexOf(')')
  const params = open >= 0 && close > open ? method.signature.substring(open + 1, close) : ''
  const returns = method.isConstructor ? undefined : method.signature.substring(close + 1).replace(/^:\s*/, '') || undefined
  return { params, returns }
}

/** Parameters without names: {@code (Order order, long id)} → {@code Order, long}. */
export function parameterTypes(method: MethodInfo): string {
  const { params } = splitSignature(method)
  if (!params) return ''
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of params) {
    if (ch === '<') depth++
    if (ch === '>') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts
    .map((p) => {
      const trimmed = p.trim()
      const space = trimmed.lastIndexOf(' ')
      // "Map<K, V> name" – only strip a trailing identifier outside generics
      return space > 0 && !trimmed.endsWith('>') && !trimmed.endsWith(']') && /^[\w$]+$/.test(trimmed.substring(space + 1))
        ? trimmed.substring(0, space)
        : trimmed
    })
    .join(', ')
}

export function httpVerb(endpoint: string | undefined): HttpVerb | null {
  if (!endpoint) return null
  const verb = endpoint.split(' ')[0]
  if (verb === 'GET' || verb === 'POST' || verb === 'PUT' || verb === 'PATCH' || verb === 'DELETE') return verb
  return endpoint.startsWith('/') || /^[A-Z]+ \//.test(endpoint) ? 'OTHER' : null
}

export function qualifiedMethodLabel(type: TypeInfo | undefined, method: MethodInfo): string {
  return `${type?.name ?? '?'}.${method.isConstructor ? '<init>' : method.name}`
}
