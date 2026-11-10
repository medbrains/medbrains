import { describe, expect, it } from 'vitest'

import {
  formatCount,
  formatDuration,
  indexRuns,
  inputOf,
  itemsOnWire,
  outputOf,
  summarize,
} from './execution'
import { workflow, workflowNode } from '../test/fixtures'
import type { NodeRunData, RunResult } from '../types'

function run(overrides: Partial<NodeRunData> & { nodeId: string }): NodeRunData {
  return {
    name: overrides.nodeId,
    type: 'set',
    status: 'ok',
    ms: 1,
    tries: 1,
    output: {},
    ...overrides,
  }
}

function result(runs: NodeRunData[], overrides: Partial<RunResult> = {}): RunResult {
  return { status: 'success', runs, last: [], ...overrides }
}

describe('reading a run', () => {
  it('reports what a node emitted on its main port', () => {
    const runs = indexRuns(result([run({ nodeId: 'a', output: { main: [{ id: 1 }] } })]))
    expect(outputOf(runs, 'a')).toEqual([{ id: 1 }])
  })

  it('reports what a node emitted on a named port', () => {
    const runs = indexRuns(
      result([run({ nodeId: 'if', output: { main: [{ a: 1 }], false: [{ b: 2 }] } })]),
    )
    expect(outputOf(runs, 'if', 'false')).toEqual([{ b: 2 }])
  })

  it('returns nothing for a node that never ran', () => {
    expect(outputOf(indexRuns(null), 'ghost')).toEqual([])
  })

  it('reconstructs a node’s input by concatenating its incoming wires', () => {
    const flow = workflow({
      nodes: [workflowNode({ id: 'a' }), workflowNode({ id: 'b' }), workflowNode({ id: 'j' })],
      connections: [
        { from: 'a', to: 'j', port: 'main' },
        { from: 'b', to: 'j', port: 'main' },
      ],
    })
    const runs = indexRuns(
      result([
        run({ nodeId: 'a', output: { main: [{ from: 'a' }] } }),
        run({ nodeId: 'b', output: { main: [{ from: 'b' }] } }),
      ]),
    )

    expect(inputOf(flow, runs, 'j')).toEqual([{ from: 'a' }, { from: 'b' }])
  })

  it('gives a trigger no input, because nothing precedes it', () => {
    const flow = workflow({ nodes: [workflowNode({ id: 't', type: 'manual' })] })
    expect(inputOf(flow, indexRuns(null), 't')).toEqual([])
  })
})

describe('items on a wire', () => {
  const connection = { from: 'if', to: 'next', port: 'false' }

  it('counts what travelled', () => {
    const runs = indexRuns(
      result([run({ nodeId: 'if', output: { main: [{}, {}], false: [{}] } })]),
    )
    expect(itemsOnWire(runs, connection)).toBe(1)
  })

  it('distinguishes a dead branch from a wire that was never evaluated', () => {
    const evaluated = indexRuns(result([run({ nodeId: 'if', output: { main: [{}], false: [] } })]))
    expect(itemsOnWire(evaluated, connection)).toBe(0)

    const notReached = indexRuns(result([run({ nodeId: 'if', status: 'skipped' })]))
    expect(itemsOnWire(notReached, connection)).toBeUndefined()

    expect(itemsOnWire(indexRuns(null), connection)).toBeUndefined()
  })
})

describe('summarising a run', () => {
  it('counts what ran, what was skipped and what failed', () => {
    const summary = summarize(
      result(
        [
          run({ nodeId: 'a', ms: 10 }),
          run({ nodeId: 'b', ms: 240, status: 'error', error: 'boom' }),
          run({ nodeId: 'c', status: 'skipped', ms: 0 }),
        ],
        { status: 'error', error: 'b: boom' },
      ),
    )

    expect(summary).toMatchObject({
      status: 'error',
      ran: 2,
      skipped: 1,
      failed: 1,
      totalMs: 250,
      error: 'b: boom',
    })
  })

  it('handles a run where nothing executed', () => {
    expect(summarize(result([]))).toMatchObject({ ran: 0, totalMs: 0 })
  })
})

describe('formatting readings', () => {
  it('keeps sub-second timings in milliseconds, which is the usual case', () => {
    expect(formatDuration(0)).toBe('0ms')
    expect(formatDuration(999)).toBe('999ms')
  })

  it('switches to seconds once milliseconds stop being readable', () => {
    expect(formatDuration(1000)).toBe('1.00s')
    expect(formatDuration(1750)).toBe('1.75s')
    expect(formatDuration(12_400)).toBe('12.4s')
  })

  it('switches to minutes for long runs', () => {
    expect(formatDuration(65_000)).toBe('1m 5s')
    expect(formatDuration(3_600_000)).toBe('60m 0s')
  })

  it('pluralises counts', () => {
    expect(formatCount(1, 'item')).toBe('1 item')
    expect(formatCount(0, 'item')).toBe('0 items')
    expect(formatCount(2, 'node')).toBe('2 nodes')
  })
})
