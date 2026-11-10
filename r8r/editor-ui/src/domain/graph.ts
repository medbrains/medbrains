/**
 * Pure graph helpers shared by the canvas and its tests.
 *
 * Nothing here touches React or the network, so the rules that decide what the
 * editor may do — what counts as a change, which workflows can go live, how a
 * connection is identified — are unit-testable on their own.
 */

import { isVisible } from './parameters'
import type { Connection, JsonValue, NodeTypeDescription, Workflow, WorkflowNode } from '../types'
import { MAIN_PORT } from '../types'

/** Stable identity for a connection, used as the React Flow edge id. */
export function edgeId(connection: Connection): string {
  return `${connection.from}|${connection.port}|${connection.to}`
}

/**
 * The parts of a workflow worth saving. Comparing two snapshots is how the
 * editor knows whether the Save button should be enabled — timestamps and
 * server-assigned fields are deliberately excluded so a reload is never
 * mistaken for an edit.
 */
export function snapshot(workflow: Workflow): string {
  return JSON.stringify({
    name: workflow.name,
    active: workflow.active,
    nodes: workflow.nodes,
    connections: workflow.connections,
  })
}

export function isDirty(workflow: Workflow | null, saved: string): boolean {
  return workflow !== null && snapshot(workflow) !== saved
}

/**
 * Seed a new node's parameters from its type's declared defaults.
 *
 * Properties are applied in order and only when visible, because integration
 * nodes declare one `operation` property per resource: seeding all of them
 * blindly would leave the last resource's default in place, and the node would
 * open with an Operation its Resource does not offer.
 */
export function defaultParameters(type: NodeTypeDescription): Record<string, JsonValue> {
  const parameters: Record<string, JsonValue> = {}
  for (const property of type.properties) {
    if (isVisible(property, parameters)) {
      parameters[property.name] = property.default
    }
  }
  return parameters
}

/**
 * Node names address nodes in expressions (`nodes["Fetch users"]`), so two
 * nodes sharing a name would make one of them unreachable. Suffix until unique.
 */
export function uniqueName(base: string, nodes: readonly WorkflowNode[]): string {
  const taken = new Set(nodes.map((node) => node.name))
  if (!taken.has(base)) return base
  let index = 1
  while (taken.has(`${base} ${index}`)) index += 1
  return `${base} ${index}`
}

/** Where a newly added node should land: to the right of everything else. */
export function nextPosition(nodes: readonly WorkflowNode[]): readonly [number, number] {
  if (nodes.length === 0) return [80, 160]
  const rightmost = nodes.reduce((max, node) => Math.max(max, node.position[0]), 0)
  return [rightmost + 260, 160]
}

/**
 * Only a Webhook or Schedule trigger can fire on its own, so a workflow with
 * neither cannot meaningfully be "active" — the server refuses it too.
 */
export function hasAutomaticTrigger(workflow: Workflow): boolean {
  return workflow.nodes.some((node) => node.type === 'webhook' || node.type === 'schedule')
}

/** Add a connection unless the identical one already exists. */
export function addConnection(
  connections: readonly Connection[],
  candidate: Connection,
): Connection[] {
  const id = edgeId(candidate)
  if (connections.some((existing) => edgeId(existing) === id)) return [...connections]
  return [...connections, candidate]
}

/** Reject connections that would not make sense on the canvas. */
export function canConnect(source: string | null, target: string | null): boolean {
  return Boolean(source) && Boolean(target) && source !== target
}

/** Remove a node along with every connection that touched it. */
export function removeNode(workflow: Workflow, nodeId: string): Workflow {
  return {
    ...workflow,
    nodes: workflow.nodes.filter((node) => node.id !== nodeId),
    connections: workflow.connections.filter(
      (connection) => connection.from !== nodeId && connection.to !== nodeId,
    ),
  }
}

export function buildNode(
  type: NodeTypeDescription,
  existing: readonly WorkflowNode[],
  id: string,
): WorkflowNode {
  return {
    id,
    type: type.name,
    name: uniqueName(type.displayName, existing),
    parameters: defaultParameters(type),
    position: nextPosition(existing),
  }
}

export function connectionFrom(
  source: string,
  target: string,
  sourceHandle: string | null,
): Connection {
  return { from: source, to: target, port: sourceHandle ?? MAIN_PORT }
}
