/**
 * Reading a finished run.
 *
 * The canvas reports what actually happened — items per wire, milliseconds per
 * node — so these are the functions that turn a `RunResult` into those
 * readings. All pure, so the reporting logic is testable without a canvas.
 */

import type { Connection, Items, NodeRunData, RunResult, Workflow } from '../types'
import { MAIN_PORT } from '../types'

export type RunIndex = ReadonlyMap<string, NodeRunData>

export function indexRuns(result: RunResult | null): RunIndex {
  return new Map((result?.runs ?? []).map((run) => [run.nodeId, run]))
}

/** What a node emitted on one of its ports. */
export function outputOf(runs: RunIndex, nodeId: string, port = MAIN_PORT): Items {
  return runs.get(nodeId)?.output[port] ?? []
}

/**
 * What a node received: everything its incoming wires carried.
 *
 * The engine concatenates a node's inputs before running it, so reconstructing
 * the same concatenation here shows exactly what the node saw.
 */
export function inputOf(workflow: Workflow, runs: RunIndex, nodeId: string): Items {
  return workflow.connections
    .filter((connection) => connection.to === nodeId)
    .flatMap((connection) => outputOf(runs, connection.from, connection.port))
}

/**
 * How many items travelled a wire, or `undefined` when the run never reached
 * it. The difference matters: zero items is a dead branch worth seeing, and no
 * reading at all is a wire that was never evaluated.
 */
export function itemsOnWire(runs: RunIndex, connection: Connection): number | undefined {
  const run = runs.get(connection.from)
  if (!run || run.status === 'skipped') return undefined
  return run.output[connection.port]?.length
}

export interface RunSummary {
  status: RunResult['status']
  ran: number
  skipped: number
  failed: number
  totalMs: number
  error?: string
}

export function summarize(result: RunResult): RunSummary {
  const ran = result.runs.filter((run) => run.status !== 'skipped')
  return {
    status: result.status,
    ran: ran.length,
    skipped: result.runs.length - ran.length,
    failed: result.runs.filter((run) => run.status === 'error').length,
    totalMs: ran.reduce((total, run) => total + run.ms, 0),
    error: result.error,
  }
}

/** Durations rendered the way an engineer reads them. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`
  const minutes = Math.floor(ms / 60_000)
  return `${minutes}m ${Math.round((ms % 60_000) / 1000)}s`
}

export function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
