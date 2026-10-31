/** Builders for the shapes tests need, with sensible defaults. */

import type { NodeTypeDescription, Workflow, WorkflowNode } from '../types'

export function nodeType(overrides: Partial<NodeTypeDescription> = {}): NodeTypeDescription {
  return {
    name: 'set',
    displayName: 'Edit Fields',
    group: 'transform',
    description: 'Set fields on each item',
    icon: '✏️',
    color: '#0ea5e9',
    properties: [],
    outputs: ['main'],
    inputs: ['main'],
    ...overrides,
  }
}

export function workflowNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: 'n1',
    type: 'set',
    name: 'Edit Fields',
    parameters: {},
    position: [0, 0],
    ...overrides,
  }
}

export function workflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 'wf1',
    name: 'Test workflow',
    active: false,
    nodes: [],
    connections: [],
    ...overrides,
  }
}

/** The webhook trigger, the only kind that lets a workflow go live. */
export const webhookNode = workflowNode({
  id: 'hook',
  type: 'webhook',
  name: 'Hook',
  parameters: { path: 'greet', method: 'POST' },
})
