import { describe, expect, it } from 'vitest'

import { applySuggestions, autoMap, destinationFields, fieldPaths, normalizeName } from './mapping'
import { nodeType, workflow, workflowNode } from '../test/fixtures'
import type { SourceField } from './mapping'

const sources = (...paths: string[]): SourceField[] =>
  paths.map((path) => ({ path, sample: '', kind: 'string' }))

describe('fieldPaths', () => {
  it('lists the fields an item actually holds', () => {
    const found = fieldPaths([{ id: 1, name: 'Ada' }])
    expect(found.map((field) => field.path)).toEqual(['id', 'name'])
  })

  it('walks into nested objects and offers both the branch and its leaves', () => {
    const found = fieldPaths([{ customer: { address: { city: 'London' } } }])
    const paths = found.map((field) => field.path)

    expect(paths).toContain('customer')
    expect(paths).toContain('customer.address')
    expect(paths).toContain('customer.address.city')
  })

  it('records the value it found, so the column can preview it', () => {
    const found = fieldPaths([{ name: 'Ada', age: 36, tags: ['a'] }])

    expect(found.find((f) => f.path === 'name')?.sample).toBe('Ada')
    expect(found.find((f) => f.path === 'age')?.kind).toBe('number')
    expect(found.find((f) => f.path === 'tags')?.kind).toBe('list')
  })

  it('picks up fields that only later items carry', () => {
    // An API that omits null fields would otherwise hide half its schema.
    const found = fieldPaths([{ a: 1 }, { a: 1, b: 2 }])
    expect(found.map((f) => f.path)).toEqual(['a', 'b'])
  })

  it('does not list the same path twice', () => {
    const found = fieldPaths([{ a: 1 }, { a: 2 }, { a: 3 }])
    expect(found).toHaveLength(1)
  })

  it('stops descending before a deep payload becomes noise', () => {
    const deep = { l1: { l2: { l3: { l4: { l5: { l6: 'buried' } } } } } }
    const paths = fieldPaths([deep]).map((f) => f.path)

    expect(paths).toContain('l1.l2.l3')
    expect(paths.some((path) => path.includes('l6'))).toBe(false)
  })

  it('returns nothing for no items rather than throwing', () => {
    expect(fieldPaths([])).toEqual([])
  })
})

describe('normalizeName', () => {
  it('makes the same field written three ways compare equal', () => {
    expect(normalizeName('customer_name')).toBe(normalizeName('customerName'))
    expect(normalizeName('Customer Name')).toBe(normalizeName('customer-name'))
  })

  it('compares by the last segment of a path', () => {
    expect(normalizeName('customer.address.city')).toBe(normalizeName('city'))
  })
})

describe('autoMap', () => {
  it('matches fields whose names agree', () => {
    const suggestions = autoMap(['name', 'email'], sources('name', 'email', 'other'))

    expect(suggestions).toEqual([
      { destination: 'name', source: 'name', confidence: 'exact' },
      { destination: 'email', source: 'email', confidence: 'exact' },
    ])
  })

  it('sees through naming conventions', () => {
    const suggestions = autoMap(['customerName'], sources('customer_name'))
    expect(suggestions[0]).toMatchObject({ source: 'customer_name', confidence: 'exact' })
  })

  it('matches a nested source by its leaf name', () => {
    const suggestions = autoMap(['city'], sources('customer.address.city'))
    expect(suggestions[0]?.source).toBe('customer.address.city')
  })

  it('never lets a partial match steal a source an exact match needs', () => {
    // "name" partially matches "fullName", but "fullName" is an exact match
    // for the other destination — and exact matches are claimed first.
    const suggestions = autoMap(['fullName', 'name'], sources('name', 'fullName'))

    expect(suggestions.find((s) => s.destination === 'fullName')?.source).toBe('fullName')
    expect(suggestions.find((s) => s.destination === 'name')?.source).toBe('name')
  })

  it('falls back to a partial match, and says it is less certain', () => {
    const suggestions = autoMap(['email'], sources('customerEmailAddress'))
    expect(suggestions[0]).toMatchObject({ confidence: 'similar' })
  })

  it('uses each source only once', () => {
    const suggestions = autoMap(['name', 'displayName'], sources('name'))
    expect(suggestions).toHaveLength(1)
  })

  it('suggests nothing when nothing matches', () => {
    expect(autoMap(['sku'], sources('firstName', 'lastName'))).toEqual([])
  })

  it('copes with either side being empty', () => {
    expect(autoMap([], sources('a'))).toEqual([])
    expect(autoMap(['a'], [])).toEqual([])
  })
})

describe('applySuggestions', () => {
  it('fills empty rows', () => {
    const merged = applySuggestions({}, [
      { destination: 'name', source: 'full_name', confidence: 'exact' },
    ])
    expect(merged).toEqual({ name: 'full_name' })
  })

  it('never overwrites a mapping somebody set by hand', () => {
    const existing = { name: '{{ item.first + item.last }}' }
    const merged = applySuggestions(existing, [
      { destination: 'name', source: 'full_name', confidence: 'exact' },
    ])
    expect(merged.name).toBe('{{ item.first + item.last }}')
  })

  it('does fill a row that was left blank', () => {
    const merged = applySuggestions({ name: '' }, [
      { destination: 'name', source: 'full_name', confidence: 'exact' },
    ])
    expect(merged.name).toBe('full_name')
  })
})

describe('destinationFields', () => {
  const slackType = nodeType({
    name: 'slack',
    group: 'output',
    properties: [
      { name: 'resource', displayName: 'Resource', type: 'options', default: 'message' },
      { name: 'operation', displayName: 'Operation', type: 'options', default: 'send' },
      { name: 'channel', displayName: 'Channel', type: 'string', default: '' },
      { name: 'text', displayName: 'Text', type: 'string', default: '' },
    ],
  })

  const flow = workflow({
    nodes: [
      workflowNode({ id: 'map', type: 'mapFields' }),
      workflowNode({ id: 'slack', type: 'slack' }),
    ],
    connections: [{ from: 'map', to: 'slack', port: 'main' }],
  })

  it('offers the fields the next node expects', () => {
    expect(destinationFields(flow, 'map', [slackType])).toEqual(['channel', 'text'])
  })

  it('leaves out the fields that pick the endpoint rather than carry data', () => {
    const fields = destinationFields(flow, 'map', [slackType])
    expect(fields).not.toContain('resource')
    expect(fields).not.toContain('operation')
  })

  it('offers nothing when the mapper feeds nothing yet', () => {
    const orphan = workflow({ nodes: [workflowNode({ id: 'map', type: 'mapFields' })] })
    expect(destinationFields(orphan, 'map', [slackType])).toEqual([])
  })

  it('combines the fields of several downstream nodes without repeating any', () => {
    const branching = workflow({
      nodes: [
        workflowNode({ id: 'map', type: 'mapFields' }),
        workflowNode({ id: 'a', type: 'slack' }),
        workflowNode({ id: 'b', type: 'slack' }),
      ],
      connections: [
        { from: 'map', to: 'a', port: 'main' },
        { from: 'map', to: 'b', port: 'main' },
      ],
    })

    expect(destinationFields(branching, 'map', [slackType])).toEqual(['channel', 'text'])
  })
})
