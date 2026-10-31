import { describe, expect, it } from 'vitest'
import type { NodeTypeDescription, WorkflowNode } from '../types'
import { orphanedConnections, outputPorts } from './ports'

const httpRequest: NodeTypeDescription = {
  name: 'httpRequest',
  displayName: 'HTTP Request',
  group: 'transform',
  description: '',
  icon: 'world',
  color: '#4c6ef5',
  inputs: ['main'],
  outputs: ['main'],
  properties: [],
}

const ifNode: NodeTypeDescription = { ...httpRequest, name: 'if', outputs: ['true', 'false'] }

function node(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: 'fetch',
    type: 'httpRequest',
    name: 'fetch',
    parameters: {},
    position: [0, 0],
    ...overrides,
  }
}

describe('outputPorts', () => {
  it('shows what the node type declares', () => {
    expect(outputPorts(node(), httpRequest)).toEqual(['main'])
    expect(outputPorts(node({ type: 'if' }), ifNode)).toEqual(['true', 'false'])
  })

  it('adds an error port when the node isolates failing records', () => {
    // The records that failed have to go somewhere the workflow can act on.
    expect(outputPorts(node({ onError: 'continueRecord' }), httpRequest)).toEqual(['main', 'error'])
  })

  it('leaves other failure modes alone', () => {
    // Continuing on failure emits the error downstream on `main`, so there is
    // nothing extra to connect.
    expect(outputPorts(node({ onError: 'continue' }), httpRequest)).toEqual(['main'])
    expect(outputPorts(node({ onError: null }), httpRequest)).toEqual(['main'])
  })

  it('does not add a second error port to a node that already has one', () => {
    const custom = { ...httpRequest, outputs: ['main', 'error'] }
    expect(outputPorts(node({ onError: 'continueRecord' }), custom)).toEqual(['main', 'error'])
  })

  it('assumes a main port for a node type that has not loaded yet', () => {
    expect(outputPorts(node(), undefined)).toEqual(['main'])
  })
})

describe('orphanedConnections', () => {
  const descriptions = new Map([
    ['httpRequest', httpRequest],
    ['if', ifNode],
  ])

  it('finds an edge left behind when isolation is turned off', () => {
    // Otherwise the canvas draws a connection the engine will never follow.
    const nodes = [node(), node({ id: 'review', name: 'review' })]
    const connections = [
      { from: 'fetch', port: 'main' },
      { from: 'fetch', port: 'error' },
    ]

    expect(orphanedConnections(nodes, connections, descriptions)).toEqual([
      { from: 'fetch', port: 'error' },
    ])
  })

  it('finds nothing while isolation is still on', () => {
    const nodes = [node({ onError: 'continueRecord' })]
    const connections = [{ from: 'fetch', port: 'error' }]

    expect(orphanedConnections(nodes, connections, descriptions)).toEqual([])
  })

  it('ignores edges from a node that is no longer there', () => {
    // Removing a node already removes its edges; reporting them twice would
    // have the caller delete connections that are gone.
    const connections = [{ from: 'deleted', port: 'main' }]
    expect(orphanedConnections([], connections, descriptions)).toEqual([])
  })
})
