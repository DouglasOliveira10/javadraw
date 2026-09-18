import type { CSSProperties } from 'react'
import type { TypeKind, Visibility } from '../data/types'
import { VISIBILITY_GLYPH, httpVerb } from '../data/format'
import { VERB_COLORS, kindColor, stereotypeColor } from '../theme'
import { usePalette } from '../data/palette'
import { useI18n } from '../i18n/I18nProvider'

const KIND_LETTER: Record<TypeKind, string> = {
  CLASS: 'C',
  INTERFACE: 'I',
  ENUM: 'E',
  RECORD: 'R',
  ANNOTATION: '@',
}

export function KindBadge({ kind, abstract, size = 20 }: { kind: TypeKind; abstract?: boolean; size?: number }) {
  const color = kindColor(kind, usePalette())
  const { t } = useI18n()
  const name = t(`kind.${kind}`)
  return (
    <span
      title={abstract ? t('kind.abstract', { kind: name }) : name}
      className="inline-grid shrink-0 place-items-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.52,
        color,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: abstract ? `1px dashed ${color}` : undefined,
      }}
    >
      {KIND_LETTER[kind]}
    </span>
  )
}

export function StereotypePill({ stereotype }: { stereotype: string }) {
  const color = stereotypeColor(stereotype, usePalette())
  return (
    <span className="jd-pill" style={{ '--accent': color } as CSSProperties}>
      {stereotype}
    </span>
  )
}

const VISIBILITY_COLOR: Record<Visibility, string> = {
  PUBLIC: '#10b981',
  PROTECTED: '#f59e0b',
  PACKAGE: '#3b82f6',
  PRIVATE: '#ef4444',
}

export function VisibilityGlyph({ visibility }: { visibility: Visibility }) {
  const { t } = useI18n()
  return (
    <span
      title={t(`visibility.${visibility}`)}
      className="inline-block w-2.5 shrink-0 text-center font-bold"
      style={{ color: VISIBILITY_COLOR[visibility] }}
    >
      {VISIBILITY_GLYPH[visibility]}
    </span>
  )
}

export function EndpointBadge({ endpoint, compact }: { endpoint: string; compact?: boolean }) {
  const verb = httpVerb(endpoint)
  if (verb) {
    const [method, ...path] = endpoint.split(' ')
    const color = VERB_COLORS[verb]
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[10.5px]" title={endpoint}>
        <span
          className="rounded px-1 py-px font-bold"
          style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}
        >
          {method}
        </span>
        {!compact && <span className="truncate text-[var(--jd-muted)]">{path.join(' ')}</span>}
      </span>
    )
  }
  return (
    <span
      className="inline-flex min-w-0 items-center truncate rounded px-1 py-px font-mono text-[10.5px] font-semibold"
      style={{ color: '#0ea5e9', background: 'color-mix(in srgb, #0ea5e9 13%, transparent)' }}
      title={endpoint}
    >
      {compact ? endpoint.split(' ')[0] : endpoint}
    </span>
  )
}
