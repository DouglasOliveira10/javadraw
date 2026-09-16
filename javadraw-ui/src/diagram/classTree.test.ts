import { describe, expect, it } from 'vitest'
import type { TypeInfo } from '../data/types'
import { buildClassTree } from './classTree'

const type = (id: string, extra: Partial<TypeInfo> = {}): TypeInfo => ({
  id,
  name: id.substring(id.lastIndexOf('.') + 1),
  packageName: id.substring(0, id.lastIndexOf('.')),
  kind: 'CLASS',
  visibility: 'PUBLIC',
  anonymous: false,
  external: false,
  ...extra,
})

const types = [
  type('com.acme.shop.Order'),
  type('com.acme.shop.Cart'),
  type('com.acme.shop.web.OrderController'),
  type('com.acme.billing.Invoice'),
  type('org.springframework.Whatever', { external: true }),
  type('com.acme.shop.Order$1', { anonymous: true }),
]

describe('buildClassTree', () => {
  it('collapses single-child package chains and keeps classes sorted', () => {
    const tree = buildClassTree(types)
    expect(tree).toHaveLength(1)
    expect(tree[0].label).toBe('com.acme')
    expect(tree[0].total).toBe(4)
    expect(tree[0].children.map((c) => [c.label, c.types.map((t) => t.name)])).toEqual([
      ['billing', ['Invoice']],
      ['shop', ['Cart', 'Order']],
    ])
    expect(tree[0].children[1].children[0].label).toBe('web')
  })

  it('leaves out library and anonymous types', () => {
    const names = buildClassTree(types).flatMap(function names(node): string[] {
      return [...node.types.map((t) => t.name), ...node.children.flatMap(names)]
    })
    expect(names).not.toContain('Whatever')
    expect(names).not.toContain('Order$1')
  })
})
