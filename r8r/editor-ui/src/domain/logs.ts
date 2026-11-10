/**
 * The console view of a run.
 *
 * A workflow that only reports itself in the server's terminal is undebuggable
 * once it is deployed somewhere, so the same trail the engine writes to stdout
 * is reconstructed here from the execution record — which means it works for a
 * run that finished last night just as well as one from ten seconds ago.
 */

import type { NodeRunData, RunResult, Workflow } from '../types'
import { formatDuration } from './execution'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogLine {
  /** Milliseconds since the run started, accumulated from node durations. */
  elapsedMs: number
  level: LogLevel
  /** The node this line is about, when it is about one. */
  scope: string
  message: string
  /** Payload shown when the line is expanded. */
  detail?: string
}

export interface RunMeta {
  mode?: string
  startedAt?: string
}

/** How much of an item payload to show before it stops being readable. */
const MAX_DETAIL = 4000

export function logLines(
  workflow: Workflow,
  result: RunResult,
  meta: RunMeta = {},
): LogLine[] {
  const lines: LogLine[] = []
  let elapsed = 0

  lines.push({
    elapsedMs: 0,
    level: 'info',
    scope: 'execution',
    message: `started · ${meta.mode ?? 'manual'} · ${workflow.nodes.length} nodes`,
  })

  for (const run of result.runs) {
    lines.push(...linesFor(run, elapsed))
    elapsed += run.ms
  }

  lines.push(
    result.status === 'error'
      ? {
          elapsedMs: elapsed,
          level: 'error',
          scope: 'execution',
          message: `failed after ${formatDuration(elapsed)}`,
          detail: result.error,
        }
      : {
          elapsedMs: elapsed,
          level: 'info',
          scope: 'execution',
          message: `finished in ${formatDuration(elapsed)} · ${result.last.length} items out`,
        },
  )

  return lines
}

function linesFor(run: NodeRunData, elapsed: number): LogLine[] {
  const scope = run.name || run.type

  if (run.status === 'skipped') {
    return [
      { elapsedMs: elapsed, level: 'debug', scope, message: 'skipped · nothing reached it' },
    ]
  }

  if (run.status === 'error') {
    return [
      {
        elapsedMs: elapsed + run.ms,
        level: 'error',
        scope,
        message: `failed after ${formatDuration(run.ms)}${retries(run)}`,
        detail: run.error,
      },
    ]
  }

  const ports = Object.entries(run.output)
  const items = run.output.main?.length ?? 0

  const lines: LogLine[] = [
    {
      elapsedMs: elapsed + run.ms,
      level: 'info',
      scope,
      message: `ok · ${items} item${items === 1 ? '' : 's'} · ${formatDuration(run.ms)}${retries(run)}`,
    },
  ]

  for (const [port, emitted] of ports) {
    lines.push({
      elapsedMs: elapsed + run.ms,
      level: 'debug',
      scope,
      message: `${port === 'main' ? 'output' : `${port} branch`} · ${emitted.length} items`,
      detail: truncate(JSON.stringify(emitted, null, 2)),
    })
  }

  return lines
}

function retries(run: NodeRunData): string {
  return run.tries > 1 ? ` · ${run.tries} tries` : ''
}

function truncate(text: string): string {
  if (text.length <= MAX_DETAIL) return text
  return `${text.slice(0, MAX_DETAIL)}\n… truncated`
}

/** Keep only the lines a viewer asked for. */
export function filterLines(
  lines: readonly LogLine[],
  { levels, query }: { levels: ReadonlySet<LogLevel>; query: string },
): LogLine[] {
  const needle = query.trim().toLowerCase();
  return lines.filter((line) => {
    if (!levels.has(line.level)) return false
    if (!needle) return true
    return `${line.scope} ${line.message} ${line.detail ?? ''}`.toLowerCase().includes(needle)
  })
}

/** The whole console as text, for pasting into a bug report. */
export function toPlainText(lines: readonly LogLine[]): string {
  return lines
    .map((line) => {
      const stamp = `+${String(line.elapsedMs).padStart(5, ' ')}ms`
      const head = `${stamp} ${line.level.toUpperCase().padEnd(5)} ${line.scope}  ${line.message}`
      return line.detail ? `${head}\n${line.detail}` : head
    })
    .join('\n')
}
