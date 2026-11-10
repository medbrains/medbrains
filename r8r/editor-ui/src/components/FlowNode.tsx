import { Tooltip } from '@mantine/core'
import { Handle, type NodeProps, Position } from '@xyflow/react'
import { SHAPE_SIZE, shapeOf, subtitleOf, tooltipLines } from '../domain/nodeShape'
import { outputPorts } from '../domain/ports'
import { iconFor } from '../icons'
import type { NodeRunData, NodeTypeDescription, WorkflowNode } from '../types'

export interface FlowNodeData extends Record<string, unknown> {
  node: WorkflowNode
  description?: NodeTypeDescription
  run?: NodeRunData
}

/**
 * A node on the canvas.
 *
 * Its shape says what role the node plays, its name sits below the card the
 * way a component is labelled on a schematic, and the readout underneath
 * appears only once the node has actually run.
 */
export function FlowNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const { node, description, run } = data
  const Icon = iconFor(node.type)
  const shape = shapeOf(node, description)
  const size = SHAPE_SIZE[shape]
  const color = description?.color ?? '#4a5a72'
  const outputs = outputPorts(node, description)
  const hasInput = (description?.inputs ?? ['main']).length > 0
  const subtitle = subtitleOf(node, description)
  const lines = tooltipLines(node, description)

  return (
    <div className="flow-node-wrap" style={{ width: size.width }}>
      <Tooltip
        openDelay={450}
        closeDelay={80}
        withArrow
        position="top"
        label={
          <span className="node-tip">
            <strong>{lines.title}</strong>
            <span>{lines.description}</span>
            {lines.detail && <code>{lines.detail}</code>}
          </span>
        }
      >
        <div
          className={[
            'flow-node',
            `shape-${shape}`,
            selected ? 'selected' : '',
            node.disabled ? 'disabled' : '',
            run ? `status-${run.status}` : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ height: size.height }}
          data-testid={`node-${node.id}`}
        >
          {hasInput && <Handle type="target" position={Position.Left} />}

          <span className="flow-node-tile" style={{ color }}>
            <Icon size={shape === 'utility' ? 20 : 18} stroke={1.7} />
          </span>

          {shape !== 'utility' && subtitle && (
            <span className="flow-node-detail" title={subtitle}>
              {subtitle}
            </span>
          )}

          {outputs.map((port, index) => (
            <Handle
              key={port}
              id={port}
              type="source"
              position={Position.Right}
              style={{ top: `${portOffset(outputs.length, index)}%` }}
            />
          ))}
        </div>
      </Tooltip>

      {outputs.length > 1 &&
        outputs.map((port, index) => (
          <span
            key={port}
            className="port-label"
            style={{ top: `calc(${portOffset(outputs.length, index)}% - 21px)` }}
          >
            {port === 'main' ? 'true' : port}
          </span>
        ))}

      <div className="flow-node-name" title={node.name}>
        {node.name || node.type}
      </div>

      {run && <Readout run={run} />}
    </div>
  )
}

/** Where an output handle sits, as a percentage of the card's height. */
function portOffset(total: number, index: number): number {
  return total === 1 ? 50 : 30 + index * 40
}

/** What the last run measured. The reason the canvas exists after a run. */
function Readout({ run }: { run: NodeRunData }) {
  if (run.status === 'skipped') {
    return <div className="flow-node-readout is-skipped">not reached</div>
  }

  if (run.status === 'error') {
    return (
      <div className="flow-node-readout is-error" title={run.error}>
        {run.error ?? 'failed'}
      </div>
    )
  }

  const items = run.output.main?.length ?? 0
  return (
    <div className="flow-node-readout">
      <span className="metric">{items}</span>
      <span className="muted">{items === 1 ? 'item' : 'items'}</span>
      <span className="muted">·</span>
      <span className="metric">{run.ms}</span>
      <span className="muted">ms</span>
    </div>
  )
}
