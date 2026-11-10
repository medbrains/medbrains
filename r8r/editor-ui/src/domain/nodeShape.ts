/**
 * How a node presents itself on the canvas.
 *
 * Shape encodes role, so the graph is legible before you read a single label:
 * a trigger is capped like the start of a line, a utility node is a small
 * square, a branch is chamfered where it splits, and everything that does real
 * work is a full card. Size follows from that rather than being decoration.
 */

import type { NodeTypeDescription, WorkflowNode } from '../types'

export type NodeShape = 'trigger' | 'utility' | 'branch' | 'card'

/** Nodes that only pass items along; they need no card. */
const UTILITY_TYPES = new Set(['noOp', 'wait'])

export function shapeOf(node: WorkflowNode, description?: NodeTypeDescription): NodeShape {
  if (description?.group === 'trigger') return 'trigger'
  if (UTILITY_TYPES.has(node.type)) return 'utility'
  if (description?.group === 'flow') return 'branch'
  return 'card'
}

/** Rendered width and height per shape, kept here so CSS and layout agree. */
export const SHAPE_SIZE: Record<NodeShape, { width: number; height: number }> = {
  trigger: { width: 150, height: 60 },
  utility: { width: 60, height: 60 },
  branch: { width: 150, height: 60 },
  card: { width: 210, height: 60 },
}

/**
 * The one line worth reading on the canvas: what this node is actually
 * configured to do. Chosen per node type because "the most important
 * parameter" is not something a generic rule can guess.
 */
export function subtitleOf(node: WorkflowNode, description?: NodeTypeDescription): string {
  const text = (key: string): string => {
    const value = node.parameters[key]
    return typeof value === 'string' ? value : value == null ? '' : String(value)
  }

  switch (node.type) {
    case 'httpRequest':
      return [text('method') || 'GET', hostOf(text('url'))].filter(Boolean).join(' ')
    case 'webhook':
      return `${text('method') || 'POST'} /${text('path').replace(/^\/+/, '')}`
    case 'schedule':
      return text('cron')
    case 'code':
      return text('mode') === 'allItems' ? 'all items' : 'each item'
    case 'set':
      return countFields(node)
    case 'if':
    case 'filter':
      return text('condition')
    case 'splitOut':
    case 'aggregate':
      return text('field')
    case 'wait':
      return `${text('ms') || 0}ms`
    default:
      // Integration nodes describe themselves by resource and operation.
      if (description?.credentials?.length) {
        return [text('resource'), text('operation')].filter(Boolean).join(' · ')
      }
      return ''
  }
}

function countFields(node: WorkflowNode): string {
  if (node.parameters.mode === 'json') return 'raw JSON'
  const fields = node.parameters.fields
  const count =
    fields && typeof fields === 'object' && !Array.isArray(fields)
      ? Object.keys(fields).length
      : 0
  return count === 1 ? '1 field' : `${count} fields`
}

/** A URL is too long for the canvas; its host is the part worth showing. */
function hostOf(url: string): string {
  if (!url) return ''
  const withoutScheme = url.replace(/^https?:\/\//, '')
  const host = withoutScheme.split(/[/?#]/)[0] ?? ''
  return host || withoutScheme
}

/** Everything the hover tooltip should say, in reading order. */
export function tooltipLines(
  node: WorkflowNode,
  description?: NodeTypeDescription,
): { title: string; description: string; detail: string } {
  return {
    title: node.name || node.type,
    description: description?.description ?? node.type,
    detail: subtitleOf(node, description),
  }
}
