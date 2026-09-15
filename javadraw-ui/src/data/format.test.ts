import { describe, expect, it } from 'vitest'
import type { MethodInfo } from './types'
import { httpVerb, parameterTypes, splitSignature } from './format'
import { parseEmbeddedGraph } from './loadGraph'
import { buildPackageTree } from '../structure/packageTree'

const method = (signature: string, isConstructor = false) => ({ signature, isConstructor }) as MethodInfo

describe('format', () => {
  it('splits signatures', () => {
    expect(splitSignature(method('place(Order order): Receipt'))).toEqual({ params: 'Order order', returns: 'Receipt' })
    expect(splitSignature(method('Order(long id)', true))).toEqual({ params: 'long id', returns: undefined })
  })

  it('strips parameter names but keeps generics', () => {
    expect(parameterTypes(method('put(Map<String, List<Order>> byId, int[] slots, T value): void'))).toBe(
      'Map<String, List<Order>>, int[], T',
    )
    expect(parameterTypes(method('put(Map<String, Order>, int): void'))).toBe('Map<String, Order>, int')
  })

  it('recognizes HTTP verbs', () => {
    expect(httpVerb('GET /orders')).toBe('GET')
    expect(httpVerb('ANY /orders')).toBe('OTHER')
    expect(httpVerb('@KafkaListener orders')).toBeNull()
  })

  it('ignores the unfilled template placeholder', () => {
    expect(parseEmbeddedGraph('__JAVADRAW_DATA__')).toBeNull()
    expect(parseEmbeddedGraph('{"meta":{"name":"x"},"types":[]}')?.meta.name).toBe('x')
  })
})

describe('buildPackageTree', () => {
  it('compresses single-child chains', () => {
    const tree = buildPackageTree(
      new Map([
        ['com.acme.shop', 2],
        ['com.acme.shop.web', 1],
        ['com.acme.billing', 3],
      ]),
    )
    expect(tree).toHaveLength(1)
    expect(tree[0].label).toBe('com.acme')
    expect(tree[0].total).toBe(6)
    expect(tree[0].children.map((c) => [c.label, c.total])).toEqual([
      ['billing', 3],
      ['shop', 3],
    ])
    expect(tree[0].children[1].packages).toEqual(['com.acme.shop', 'com.acme.shop.web'])
  })
})
