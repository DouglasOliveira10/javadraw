import { describe, expect, it } from 'vitest'
import type { MethodInfo } from './types'
import { httpVerb, parameterTypes, splitSignature } from './format'
import { parseEmbeddedGraph } from './loadGraph'

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
