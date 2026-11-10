import { describe, expect, it } from 'vitest'

import {
  addConnection,
  buildNode,
  canConnect,
  connectionFrom,
  defaultParameters,
  edgeId,
  hasAutomaticTrigger,
  isDirty,
  nextPosition,
  removeNode,
  snapshot,
  uniqueName,
} from './graph'
import { nodeType, webhookNode, workflow, workflowNode } from '../test/fixtures'
import type { Connection } from '../types'

describe('edgeId', () => {
  it('distinguishes two connections that differ only by port', () => {
    const truthy: Connection = { from: 'if', to: 'next', port: 'main' }
    const falsy: Connection = { from: 'if', to: 'next', port: 'false' }
    expect(edgeId(truthy)).not.toBe(edgeId(falsy))
  })

  it('is stable for the same connection', () => {
    const connection: Connection = { from: 'a', to: 'b', port: 'main' }
    expect(edgeId(connection)).toBe(edgeId({ ...connection }))
  })
})

describe('dirty tracking', () => {
  it('treats a freshly loaded workflow as clean', () => {
    const loaded = workflow()
    expect(isDirty(loaded, snapshot(loaded))).toBe(false)
  })

  it('notices a rename, a moved node and a new connection', () => {
    const base = workflow({ nodes: [workflowNode()] })
    const saved = snapshot(base)

    expect(isDirty({ ...base, name: 'Renamed' }, saved)).toBe(true)
    expect(
      isDirty({ ...base, nodes: [{ ...workflowNode(), position: [10, 10] }] }, saved),
    ).toBe(true)
    expect(
      isDirty({ ...base, connections: [{ from: 'n1', to: 'n1', port: 'main' }] }, saved),
    ).toBe(true)
  })

  it('ignores server-managed timestamps so a reload is not an edit', () => {
    const base = workflow()
    const saved = snapshot(base)
    expect(isDirty({ ...base, updatedAt: '2026-01-01T00:00:00Z' }, saved)).toBe(false)
  })

  it('reports a missing workflow as clean rather than throwing', () => {
    expect(isDirty(null, '')).toBe(false)
  })
})

describe('uniqueName', () => {
  it('keeps the plain name when it is free', () => {
    expect(uniqueName('Edit Fields', [])).toBe('Edit Fields')
  })

  it('suffixes until it finds a free name', () => {
    const taken = [
      workflowNode({ id: 'a', name: 'Edit Fields' }),
      workflowNode({ id: 'b', name: 'Edit Fields 1' }),
    ]
    expect(uniqueName('Edit Fields', taken)).toBe('Edit Fields 2')
  })

  it('never returns a name already in use, however many collide', () => {
    const taken = Array.from({ length: 25 }, (_, index) =>
      workflowNode({ id: `n${index}`, name: index === 0 ? 'Code' : `Code ${index}` }),
    )
    const name = uniqueName('Code', taken)
    expect(taken.some((node) => node.name === name)).toBe(false)
  })
})

describe('nextPosition', () => {
  it('places the first node at a fixed origin', () => {
    expect(nextPosition([])).toEqual([80, 160])
  })

  it('places later nodes clear of the rightmost one', () => {
    const nodes = [
      workflowNode({ id: 'a', position: [0, 0] }),
      workflowNode({ id: 'b', position: [500, 300] }),
    ]
    expect(nextPosition(nodes)[0]).toBeGreaterThan(500)
  })
})

describe('defaultParameters', () => {
  it('seeds every declared property from its default', () => {
    const type = nodeType({
      properties: [
        { name: 'method', displayName: 'Method', type: 'options', default: 'GET' },
        { name: 'timeoutMs', displayName: 'Timeout', type: 'number', default: 30000 },
      ],
    })
    expect(defaultParameters(type)).toEqual({ method: 'GET', timeoutMs: 30000 })
  })

  it('produces an empty object for a node with nothing to configure', () => {
    expect(defaultParameters(nodeType({ properties: [] }))).toEqual({})
  })
})

describe('buildNode', () => {
  it('gives a new node a unique name, defaults and a free position', () => {
    const existing = [workflowNode({ id: 'a', name: 'Edit Fields' })]
    const type = nodeType({
      properties: [{ name: 'mode', displayName: 'Mode', type: 'options', default: 'fields' }],
    })

    const created = buildNode(type, existing, 'new-id')

    expect(created.id).toBe('new-id')
    expect(created.name).toBe('Edit Fields 1')
    expect(created.parameters).toEqual({ mode: 'fields' })
    expect(created.position[0]).toBeGreaterThan(0)
  })
})

describe('connections', () => {
  it('refuses to connect a node to itself', () => {
    expect(canConnect('a', 'a')).toBe(false)
  })

  it('refuses a connection with a missing end', () => {
    expect(canConnect(null, 'b')).toBe(false)
    expect(canConnect('a', null)).toBe(false)
  })

  it('accepts a connection between two different nodes', () => {
    expect(canConnect('a', 'b')).toBe(true)
  })

  it('defaults an unnamed handle to the main port', () => {
    expect(connectionFrom('a', 'b', null).port).toBe('main')
  })

  it('keeps the handle name when the node has several outputs', () => {
    expect(connectionFrom('if', 'b', 'false').port).toBe('false')
  })

  it('does not add the same connection twice', () => {
    const first = addConnection([], { from: 'a', to: 'b', port: 'main' })
    const again = addConnection(first, { from: 'a', to: 'b', port: 'main' })
    expect(again).toHaveLength(1)
  })

  it('does allow the same pair on a different port', () => {
    const first = addConnection([], { from: 'if', to: 'b', port: 'main' })
    const second = addConnection(first, { from: 'if', to: 'b', port: 'false' })
    expect(second).toHaveLength(2)
  })
})

describe('removeNode', () => {
  it('deletes the node and every connection that touched it', () => {
    const start = workflow({
      nodes: [
        workflowNode({ id: 'a' }),
        workflowNode({ id: 'b' }),
        workflowNode({ id: 'c' }),
      ],
      connections: [
        { from: 'a', to: 'b', port: 'main' },
        { from: 'b', to: 'c', port: 'main' },
      ],
    })

    const after = removeNode(start, 'b')

    expect(after.nodes.map((node) => node.id)).toEqual(['a', 'c'])
    expect(after.connections).toHaveLength(0)
  })

  it('leaves the workflow untouched when the id is unknown', () => {
    const start = workflow({ nodes: [workflowNode({ id: 'a' })] })
    expect(removeNode(start, 'ghost').nodes).toHaveLength(1)
  })
})

describe('hasAutomaticTrigger', () => {
  it('is false for a manual-only workflow', () => {
    const manual = workflow({ nodes: [workflowNode({ id: 't', type: 'manual' })] })
    expect(hasAutomaticTrigger(manual)).toBe(false)
  })

  it('is true once a webhook trigger exists', () => {
    expect(hasAutomaticTrigger(workflow({ nodes: [webhookNode] }))).toBe(true)
  })

  it('is true for a schedule trigger', () => {
    const scheduled = workflow({ nodes: [workflowNode({ id: 's', type: 'schedule' })] })
    expect(hasAutomaticTrigger(scheduled)).toBe(true)
  })

  it('is false for an empty canvas', () => {
    expect(hasAutomaticTrigger(workflow())).toBe(false)
  })
})
