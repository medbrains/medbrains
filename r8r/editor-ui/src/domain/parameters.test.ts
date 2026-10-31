import { describe, expect, it } from 'vitest'

import {
  asText,
  fromEntries,
  isVisible,
  normalizeParameters,
  toEntries,
  valueOf,
} from './parameters'
import type { NodeProperty } from '../types'

const bodyField: NodeProperty = {
  name: 'body',
  displayName: 'Body',
  type: 'json',
  default: '{}',
  displayOptions: { show: { bodyType: ['json'] } },
}

const alwaysField: NodeProperty = {
  name: 'url',
  displayName: 'URL',
  type: 'string',
  default: '',
}

describe('isVisible', () => {
  it('shows a field with no condition', () => {
    expect(isVisible(alwaysField, {})).toBe(true)
  })

  it('hides a conditional field until its trigger value is chosen', () => {
    expect(isVisible(bodyField, { bodyType: 'none' })).toBe(false)
    expect(isVisible(bodyField, { bodyType: 'json' })).toBe(true)
  })

  it('hides a conditional field when the trigger is not set at all', () => {
    expect(isVisible(bodyField, {})).toBe(false)
  })

  it('supports a field revealed by several values', () => {
    const field: NodeProperty = { ...bodyField, displayOptions: { show: { mode: ['a', 'b'] } } }
    expect(isVisible(field, { mode: 'a' })).toBe(true)
    expect(isVisible(field, { mode: 'b' })).toBe(true)
    expect(isVisible(field, { mode: 'c' })).toBe(false)
  })

  it('treats an empty rule set as unconditional', () => {
    expect(isVisible({ ...alwaysField, displayOptions: {} }, {})).toBe(true)
  })

  it('requires every show condition to hold, which is what drives cascades', () => {
    // An integration field belongs to one resource *and* one operation.
    const field: NodeProperty = {
      ...alwaysField,
      displayOptions: { show: { resource: ['message'], operation: ['send'] } },
    }

    expect(isVisible(field, { resource: 'message' })).toBe(false)
    expect(isVisible(field, { resource: 'message', operation: 'update' })).toBe(false)
    expect(isVisible(field, { resource: 'message', operation: 'send' })).toBe(true)
  })

  it('lets a hide rule win over a show rule', () => {
    const field: NodeProperty = {
      ...alwaysField,
      displayOptions: { show: { resource: ['message'] }, hide: { mode: ['simple'] } },
    }

    expect(isVisible(field, { resource: 'message', mode: 'simple' })).toBe(false)
    expect(isVisible(field, { resource: 'message', mode: 'advanced' })).toBe(true)
  })

  it('compares by value, so "1" does not match 1', () => {
    const field: NodeProperty = { ...alwaysField, displayOptions: { show: { count: [1] } } }

    expect(isVisible(field, { count: 1 })).toBe(true)
    expect(isVisible(field, { count: '1' })).toBe(false)
  })

  it('matches a field explicitly set to null', () => {
    const field: NodeProperty = { ...alwaysField, displayOptions: { show: { mode: [null] } } }

    expect(isVisible(field, { mode: null })).toBe(true)
    expect(isVisible(field, {})).toBe(false)
  })
})

describe('valueOf', () => {
  it('uses the stored value when present', () => {
    expect(valueOf(alwaysField, { url: 'https://x' })).toBe('https://x')
  })

  it('falls back to the declared default when absent', () => {
    expect(valueOf({ ...alwaysField, default: 'fallback' }, {})).toBe('fallback')
  })

  it('keeps a stored empty string rather than replacing it with the default', () => {
    // Clearing a field must not silently restore its default.
    expect(valueOf({ ...alwaysField, default: 'fallback' }, { url: '' })).toBe('')
  })

  it('keeps a stored false rather than treating it as absent', () => {
    const flag: NodeProperty = {
      name: 'neverError',
      displayName: 'Never error',
      type: 'boolean',
      default: true,
    }
    expect(valueOf(flag, { neverError: false })).toBe(false)
  })
})

describe('asText', () => {
  it('passes strings through unchanged', () => {
    expect(asText('hello {{ item.name }}')).toBe('hello {{ item.name }}')
  })

  it('renders null as empty rather than the word "null"', () => {
    expect(asText(null)).toBe('')
  })

  it('serialises structured values so they stay editable', () => {
    expect(asText({ a: 1 })).toBe('{"a":1}')
    expect(asText([1, 2])).toBe('[1,2]')
  })

  it('renders numbers and booleans readably', () => {
    expect(asText(30000)).toBe('30000')
    expect(asText(true)).toBe('true')
  })
})

describe('key/value conversion', () => {
  it('round-trips an object through the entry list the editor uses', () => {
    const original = { 'x-tenant': 'acme', accept: 'application/json' }
    expect(fromEntries(toEntries(original))).toEqual(original)
  })

  it('yields no rows for values that are not maps', () => {
    expect(toEntries(null)).toEqual([])
    expect(toEntries('a string')).toEqual([])
    expect(toEntries([1, 2])).toEqual([])
    expect(toEntries(42)).toEqual([])
  })

  it('preserves the order rows were entered in', () => {
    const entries: [string, string][] = [['b', '2'], ['a', '1']]
    expect(Object.keys(fromEntries(entries) as object)).toEqual(['b', 'a'])
  })
})

describe('normalizeParameters', () => {
  // A cut-down Slack node: `operation` is declared once per resource, which is
  // what makes normalisation necessary in the first place.
  const properties: NodeProperty[] = [
    {
      name: 'resource',
      displayName: 'Resource',
      type: 'options',
      default: 'message',
      options: [
        { name: 'Message', value: 'message' },
        { name: 'Channel', value: 'channel' },
      ],
    },
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'send',
      options: [
        { name: 'Send', value: 'send' },
        { name: 'Update', value: 'update' },
      ],
      displayOptions: { show: { resource: ['message'] } },
    },
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'list',
      options: [
        { name: 'List', value: 'list' },
        { name: 'Create', value: 'create' },
      ],
      displayOptions: { show: { resource: ['channel'] } },
    },
    {
      name: 'channel',
      displayName: 'Channel',
      type: 'string',
      default: '',
      displayOptions: { show: { resource: ['message'], operation: ['send', 'update'] } },
    },
  ]

  it('fills in the operation belonging to the chosen resource', () => {
    const normalized = normalizeParameters(properties, { resource: 'message' })
    expect(normalized.operation).toBe('send')
  })

  it('picks the other resource’s operation when the resource is switched', () => {
    const normalized = normalizeParameters(properties, { resource: 'channel' })
    expect(normalized.operation).toBe('list')
  })

  it('replaces an operation the current resource does not offer', () => {
    // Switching Resource to Channel leaves `send` behind; the server would
    // reject it, so the panel must correct it.
    const normalized = normalizeParameters(properties, {
      resource: 'channel',
      operation: 'send',
    })
    expect(normalized.operation).toBe('list')
  })

  it('leaves a valid selection untouched', () => {
    const parameters = { resource: 'message', operation: 'update', channel: '#general' }
    expect(normalizeParameters(properties, parameters)).toBe(parameters)
  })

  it('does not seed fields that are still hidden', () => {
    const normalized = normalizeParameters(properties, { resource: 'channel' })
    expect(normalized).not.toHaveProperty('channel')
  })

  it('seeds a field once its resource and operation both match', () => {
    const normalized = normalizeParameters(properties, {
      resource: 'message',
      operation: 'send',
    })
    expect(normalized.channel).toBe('')
  })

  it('keeps a free-text value even when it is empty', () => {
    const normalized = normalizeParameters(properties, {
      resource: 'message',
      operation: 'send',
      channel: '',
    })
    expect(normalized.channel).toBe('')
  })

  it('handles a node with no properties at all', () => {
    const parameters = {}
    expect(normalizeParameters([], parameters)).toBe(parameters)
  })
})
