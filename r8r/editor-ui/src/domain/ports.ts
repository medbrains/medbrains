/**
 * Which output ports a node shows on the canvas.
 *
 * Usually this is whatever the node type declares. A node set to isolate
 * failing records grows one more: the records that failed have to go
 * somewhere the workflow can act on, and a port nobody can connect to is the
 * same as discarding them.
 */

import type { NodeTypeDescription, WorkflowNode } from '../types'
import { ERROR_PORT, MAIN_PORT } from '../types'

export function outputPorts(
  node: Pick<WorkflowNode, 'onError'>,
  description: NodeTypeDescription | undefined,
): readonly string[] {
  const declared = description?.outputs ?? [MAIN_PORT]

  if (node.onError !== 'continueRecord' || declared.includes(ERROR_PORT)) {
    return declared
  }
  return [...declared, ERROR_PORT]
}

/**
 * Connections that no longer have a port to leave from.
 *
 * Turning record isolation off removes the error port, and an edge dangling
 * from a port that is gone would be saved, reloaded, and silently ignored by
 * the engine — a connection the canvas draws but the run does not follow.
 */
export function orphanedConnections(
  nodes: readonly WorkflowNode[],
  connections: readonly { from: string; port: string }[],
  descriptions: ReadonlyMap<string, NodeTypeDescription>,
): readonly { from: string; port: string }[] {
  const portsByNode = new Map(
    nodes.map((node) => [node.id, outputPorts(node, descriptions.get(node.type))]),
  )

  return connections.filter((connection) => {
    const available = portsByNode.get(connection.from)
    return available !== undefined && !available.includes(connection.port)
  })
}
