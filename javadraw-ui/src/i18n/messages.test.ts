import { describe, expect, it } from 'vitest'
import { LOCALES, MESSAGES, detectLocale, en, format, ptBR } from './messages'

describe('detectLocale', () => {
  it('follows the first supported language the browser asks for', () => {
    expect(detectLocale(['pt-BR', 'en-US'])).toBe('pt-BR')
    expect(detectLocale(['en-GB', 'pt-BR'])).toBe('en')
  })

  it('accepts any Portuguese variant', () => {
    expect(detectLocale(['pt'])).toBe('pt-BR')
    expect(detectLocale(['PT-pt'])).toBe('pt-BR')
  })

  it('falls back to English for a language we do not have', () => {
    expect(detectLocale(['ja', 'de-DE'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('format', () => {
  it('fills placeholders', () => {
    expect(format('{count} cards selected', { count: 3 })).toBe('3 cards selected')
    expect(format('Colour for {name}', { name: 'service' })).toBe('Colour for service')
  })

  it('leaves an unknown placeholder alone instead of printing undefined', () => {
    expect(format('Hello {name}', { other: 1 })).toBe('Hello {name}')
    expect(format('Hello {name}')).toBe('Hello {name}')
  })
})

describe('dictionaries', () => {
  it('translates every English key', () => {
    const missing = Object.keys(en).filter((key) => !(key in ptBR) || !ptBR[key as keyof typeof en])
    expect(missing).toEqual([])
  })

  it('has no extra key that English does not define', () => {
    expect(Object.keys(ptBR).filter((key) => !(key in en))).toEqual([])
  })

  it('keeps the same placeholders in both languages', () => {
    for (const [key, source] of Object.entries(en)) {
      expect(placeholders(ptBR[key as keyof typeof en]), key).toEqual(placeholders(source))
    }
  })

  it('offers a counted pair for every counted key', () => {
    for (const key of Object.keys(en)) {
      if (key.endsWith('_one')) expect(en).toHaveProperty(key.replace(/_one$/, '_other'))
      if (key.endsWith('_other')) expect(en).toHaveProperty(key.replace(/_other$/, '_one'))
    }
  })

  it('lists every dictionary in the language menu', () => {
    expect(LOCALES.map((locale) => locale.code).sort()).toEqual(Object.keys(MESSAGES).sort())
  })
})

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
}
