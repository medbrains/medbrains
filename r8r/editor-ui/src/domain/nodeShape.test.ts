import { describe, expect, it } from 'vitest'

import { SHAPE_SIZE, shapeOf, subtitleOf, tooltipLines } from './nodeShape'
import { nodeType, workflowNode } from '../test/fixtures'

describe('shapeOf', () => {
  it('caps a trigger, whatever its type', () => {
    for (const type of ['manual', 'webhook', 'schedule']) {
      const shape = shapeOf(
        workflowNode({ type }),
        nodeType({ name: type, group: 'trigger' }),
      )
      expect(shape).toBe('trigger')
    }
  })

  it('shrinks pass-through nodes to a square', () => {
    expect(shapeOf(workflowNode({ type: 'noOp' }), nodeType({ group: 'flow' }))).toBe('utility')
    expect(shapeOf(workflowNode({ type: 'wait' }), nodeType({ group: 'flow' }))).toBe('utility')
  })

  it('chamfers a branching node', () => {
    expect(shapeOf(workflowNode({ type: 'if' }), nodeType({ group: 'flow' }))).toBe('branch')
  })

  it('gives everything that does real work a full card', () => {
    expect(shapeOf(workflowNode({ type: 'set' }), nodeType({ group: 'transform' }))).toBe('card')
    expect(shapeOf(workflowNode({ type: 'slack' }), nodeType({ group: 'output' }))).toBe('card')
  })

  it('falls back to a card when the type is not in the palette yet', () => {
    expect(shapeOf(workflowNode({ type: 'somethingNew' }), undefined)).toBe('card')
  })

  it('gives every shape a size, so layout never guesses', () => {
    for (const shape of ['trigger', 'utility', 'branch', 'card'] as const) {
      expect(SHAPE_SIZE[shape].width).toBeGreaterThan(0)
      expect(SHAPE_SIZE[shape].height).toBeGreaterThan(0)
    }
  })
})

describe('subtitleOf', () => {
  it('shows the method and host of a request, not the whole URL', () => {
    const node = workflowNode({
      type: 'httpRequest',
      parameters: { method: 'POST', url: 'https://api.example.com/v2/users?page=2' },
    })
    expect(subtitleOf(node)).toBe('POST api.example.com')
  })

  it('defaults an unset method to GET', () => {
    const node = workflowNode({ type: 'httpRequest', parameters: { url: 'https://x.dev/a' } })
    expect(subtitleOf(node)).toBe('GET x.dev')
  })

  it('copes with a URL that is still being typed', () => {
    const node = workflowNode({ type: 'httpRequest', parameters: { url: 'api.exa' } })
    expect(subtitleOf(node)).toBe('GET api.exa')
  })

  it('shows a webhook by the request it answers', () => {
    const node = workflowNode({
      type: 'webhook',
      parameters: { method: 'POST', path: '/greet/' },
    })
    expect(subtitleOf(node)).toBe('POST /greet/')
  })

  it('counts the fields an Edit Fields node sets', () => {
    expect(subtitleOf(workflowNode({ type: 'set', parameters: { fields: { a: 1 } } }))).toBe(
      '1 field',
    )
    expect(
      subtitleOf(workflowNode({ type: 'set', parameters: { fields: { a: 1, b: 2 } } })),
    ).toBe('2 fields')
    expect(subtitleOf(workflowNode({ type: 'set', parameters: {} }))).toBe('0 fields')
  })

  it('names raw JSON mode rather than counting nothing', () => {
    const node = workflowNode({ type: 'set', parameters: { mode: 'json', json: '{}' } })
    expect(subtitleOf(node)).toBe('raw JSON')
  })

  it('shows the condition a branch tests', () => {
    const node = workflowNode({ type: 'if', parameters: { condition: 'item.tier == "vip"' } })
    expect(subtitleOf(node)).toBe('item.tier == "vip"')
  })

  it('describes an integration by resource and operation', () => {
    const node = workflowNode({
      type: 'slack',
      parameters: { resource: 'message', operation: 'send' },
    })
    const description = nodeType({
      name: 'slack',
      group: 'output',
      credentials: [{ name: 'slackApi', required: true }],
    })
    expect(subtitleOf(node, description)).toBe('message · send')
  })

  it('says nothing rather than something wrong for an unknown type', () => {
    expect(subtitleOf(workflowNode({ type: 'mystery' }))).toBe('')
  })
})

describe('tooltipLines', () => {
  it('reads title, purpose, then configuration', () => {
    const node = workflowNode({
      name: 'Fetch users',
      type: 'httpRequest',
      parameters: { method: 'GET', url: 'https://api.example.com/users' },
    })
    const lines = tooltipLines(node, nodeType({ description: 'Call any HTTP API, once per item' }))

    expect(lines.title).toBe('Fetch users')
    expect(lines.description).toBe('Call any HTTP API, once per item')
    expect(lines.detail).toBe('GET api.example.com')
  })

  it('falls back to the node type when it has no name yet', () => {
    expect(tooltipLines(workflowNode({ name: '', type: 'set' })).title).toBe('set')
  })
})
