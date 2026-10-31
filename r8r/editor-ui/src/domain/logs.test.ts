import { describe, expect, it } from 'vitest'

import { filterLines, logLines, toPlainText, type LogLevel } from './logs'
import { workflow, workflowNode } from '../test/fixtures'
import type { NodeRunData, RunResult } from '../types'

function run(overrides: Partial<NodeRunData> & { nodeId: string }): NodeRunData {
  return {
    name: overrides.nodeId,
    type: 'set',
    status: 'ok',
    ms: 10,
    tries: 1,
    output: { main: [{ a: 1 }] },
    ...overrides,
  }
}

const flow = workflow({
  nodes: [workflowNode({ id: 'a' }), workflowNode({ id: 'b' })],
})

function result(runs: NodeRunData[], overrides: Partial<RunResult> = {}): RunResult {
  return { status: 'success', runs, last: [{ a: 1 }], ...overrides }
}

describe('logLines', () => {
  it('opens with the run starting and closes with it finishing', () => {
    const lines = logLines(flow, result([run({ nodeId: 'a' })]), { mode: 'webhook' })

    expect(lines[0]).toMatchObject({ scope: 'execution', level: 'info' })
    expect(lines[0]?.message).toContain('started')
    expect(lines[0]?.message).toContain('webhook')
    expect(lines.at(-1)?.message).toContain('finished')
  })

  it('reports each node with its item count and duration', () => {
    const lines = logLines(flow, result([run({ nodeId: 'a', ms: 42 })]))
    const line = lines.find((entry) => entry.scope === 'a' && entry.level === 'info')

    expect(line?.message).toContain('1 item')
    expect(line?.message).toContain('42ms')
  })

  it('accumulates elapsed time across nodes', () => {
    const lines = logLines(
      flow,
      result([run({ nodeId: 'a', ms: 10 }), run({ nodeId: 'b', ms: 25 })]),
    )

    expect(lines.at(-1)?.elapsedMs).toBe(35)
    expect(lines.at(-1)?.message).toContain('35ms')
  })

  it('logs a failure at error level with the reason attached', () => {
    const lines = logLines(
      flow,
      result([run({ nodeId: 'a', status: 'error', error: 'connection refused' })], {
        status: 'error',
        error: 'a: connection refused',
      }),
    )

    const failure = lines.find((line) => line.scope === 'a')
    expect(failure?.level).toBe('error')
    expect(failure?.detail).toBe('connection refused')
    expect(lines.at(-1)?.message).toContain('failed')
  })

  it('logs a skipped node quietly, at debug', () => {
    const lines = logLines(flow, result([run({ nodeId: 'a', status: 'skipped', output: {} })]))
    const line = lines.find((entry) => entry.scope === 'a')

    expect(line?.level).toBe('debug')
    expect(line?.message).toContain('skipped')
  })

  it('mentions retries only when there were any', () => {
    const once = logLines(flow, result([run({ nodeId: 'a' })]))
    expect(once.find((l) => l.scope === 'a')?.message).not.toContain('tries')

    const retried = logLines(flow, result([run({ nodeId: 'a', tries: 3 })]))
    expect(retried.find((l) => l.scope === 'a')?.message).toContain('3 tries')
  })

  it('puts the payload behind a debug line rather than in the headline', () => {
    const lines = logLines(flow, result([run({ nodeId: 'a', output: { main: [{ id: 7 }] } })]))
    const payload = lines.find((line) => line.level === 'debug' && line.scope === 'a')

    expect(payload?.detail).toContain('"id": 7')
  })

  it('names each branch of a node with several outputs', () => {
    const lines = logLines(
      flow,
      result([run({ nodeId: 'a', type: 'if', output: { main: [{}], false: [{}, {}] } })]),
    )

    expect(lines.some((line) => line.message.includes('false branch · 2 items'))).toBe(true)
  })
})

describe('filterLines', () => {
  const lines = logLines(
    flow,
    result([
      run({ nodeId: 'fetch' }),
      run({ nodeId: 'send', status: 'error', error: 'timeout' }),
    ]),
  )
  const all = new Set<LogLevel>(['info', 'warn', 'error', 'debug'])

  it('hides the levels that are switched off', () => {
    const errorsOnly = filterLines(lines, { levels: new Set<LogLevel>(['error']), query: '' })
    expect(errorsOnly.every((line) => line.level === 'error')).toBe(true)
    expect(errorsOnly.length).toBeGreaterThan(0)
  })

  it('searches the scope, the message and the payload', () => {
    expect(filterLines(lines, { levels: all, query: 'fetch' }).length).toBeGreaterThan(0)
    expect(filterLines(lines, { levels: all, query: 'timeout' }).length).toBeGreaterThan(0)
    expect(filterLines(lines, { levels: all, query: 'nothing here' })).toEqual([])
  })

  it('ignores case and surrounding spaces in the query', () => {
    expect(filterLines(lines, { levels: all, query: '  FETCH ' }).length).toBeGreaterThan(0)
  })

  it('returns everything when nothing is being filtered', () => {
    expect(filterLines(lines, { levels: all, query: '' })).toHaveLength(lines.length)
  })
})

describe('toPlainText', () => {
  it('renders lines in a form that pastes into a bug report', () => {
    const text = toPlainText(
      logLines(flow, result([run({ nodeId: 'a', ms: 5 })]), { mode: 'manual' }),
    )

    expect(text).toContain('INFO')
    expect(text).toContain('+    0ms')
    expect(text.split('\n').length).toBeGreaterThan(2)
  })

  it('puts a detail on its own lines beneath its headline', () => {
    const text = toPlainText([
      { elapsedMs: 1, level: 'error', scope: 'send', message: 'failed', detail: 'timeout' },
    ])
    expect(text).toBe('+    1ms ERROR send  failed\ntimeout')
  })
})
