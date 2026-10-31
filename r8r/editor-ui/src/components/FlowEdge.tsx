import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'

export interface FlowEdgeData extends Record<string, unknown> {
  /** How many items travelled this wire in the last run, if any. */
  items?: number
  /** Play the one-shot completion pulse. */
  pulse?: boolean
}

/**
 * A wire between two nodes.
 *
 * After a run it reports what actually flowed along it — the signature device
 * of the canvas. A wire that carried nothing stays neutral, which makes a dead
 * branch obvious at a glance.
 */
export function FlowEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
  selected,
}: EdgeProps & { data?: FlowEdgeData }) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  })

  const items = data?.items
  const carried = items !== undefined && items > 0

  return (
    <>
      <BaseEdge id={id} path={path} className={carried ? 'wire-live' : undefined} />

      {carried && data?.pulse && (
        // Drawn on top of the wire so the dash reads as travelling along it.
        <path d={path} fill="none" className="wire-pulse" />
      )}

      {carried && !selected && (
        <EdgeLabelRenderer>
          <div
            className="wire-badge"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {items}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
