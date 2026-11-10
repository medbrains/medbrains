import { describe, expect, it } from 'vitest'
import type { FieldChange, VersionEntry, WorkflowDiff } from '../types'
import { changeLines, fieldLine, fieldSummary, isCurrent, show, whenLabel } from './history'

function diff(overrides: Partial<WorkflowDiff> = {}): WorkflowDiff {
  return {
    renamed: null,
    nodesAdded: [],
    nodesRemoved: [],
    nodesChanged: [],
    connectionsAdded: [],
    connectionsRemoved: [],
    settingsChanged: [],
    ...overrides,
  }
}

const changed = (path: string, before: unknown, after: unknown): FieldChange =>
  ({ path, before, after }) as FieldChange

describe('fieldLine', () => {
  it('names the setting and both of its values', () => {
    expect(fieldLine(changed('timeoutMs', 30000, 1))).toBe('timeoutMs 30000 → 1')
  })

  it('keeps quotes so a number and a numeric string look different', () => {
    // Exactly the kind of change somebody reads a history to find.
    expect(fieldLine(changed('limit', 100, '100'))).toBe('limit 100 → "100"')
  })

  it('says a field was set rather than showing nothing before it', () => {
    expect(fieldLine(changed('itemsPath', null, 'data'))).toBe('itemsPath set to "data"')
  })

  it('says a field was removed rather than showing null after it', () => {
    // A field set to null and a field that is gone behave differently at run
    // time, so they read differently here too.
    expect(fieldLine(changed('auth', 'bearer', null))).toBe('auth removed')
  })

  it('cuts a long value short instead of filling the row with it', () => {
    const long = 'x'.repeat(200)
    expect(fieldLine(changed('body', null, long)).length).toBeLessThan(60)
    expect(fieldLine(changed('body', null, long))).toContain('…')
  })
})

describe('show', () => {
  it('renders each kind of value the way it is written in a workflow', () => {
    expect(show('prod')).toBe('"prod"')
    expect(show(42)).toBe('42')
    expect(show(true)).toBe('true')
    expect(show(null)).toBe('nothing')
    expect(show(undefined)).toBe('nothing')
  })
})

describe('fieldSummary', () => {
  it('spells out a handful of changes', () => {
    const summary = fieldSummary([changed('a', 1, 2), changed('b', 1, 2)])
    expect(summary).toBe('a 1 → 2, b 1 → 2')
  })

  it('counts the rest rather than listing all thirty', () => {
    // Naming every one is not more informative than naming four — it is less,
    // because nobody reads to the end of it.
    const fields = Array.from({ length: 30 }, (_, index) => changed(`f${index}`, 1, 2))
    const summary = fieldSummary(fields)

    expect(summary).toContain('f0 1 → 2')
    expect(summary).toContain('and 26 more')
    expect(summary).not.toContain('f29')
  })
})

describe('changeLines', () => {
  it('has nothing to say about the first version', () => {
    expect(changeLines(null)).toEqual([])
  })

  it('names an added step by what it is', () => {
    const lines = changeLines(
      diff({ nodesAdded: [{ id: 'n', name: 'Notify ward', kind: 'slack' }] }),
    )

    expect(lines).toEqual([{ kind: 'added', subject: 'Notify ward', detail: 'slack' }])
  })

  it('reports an edited step with the setting that changed', () => {
    const lines = changeLines(
      diff({
        nodesChanged: [
          {
            id: 'fetch',
            name: 'Fetch patients',
            kind: 'httpRequest',
            fields: [changed('timeoutMs', 30000, 1)],
          },
        ],
      }),
    )

    expect(lines[0]).toEqual({
      kind: 'edited',
      subject: 'Fetch patients',
      detail: 'timeoutMs 30000 → 1',
    })
  })

  it('collects rewiring into one line rather than one per edge', () => {
    const lines = changeLines(
      diff({
        connectionsAdded: [{ from: 'a', to: 'c', port: 'main' }],
        connectionsRemoved: [{ from: 'a', to: 'b', port: 'main' }],
      }),
    )

    expect(lines).toHaveLength(1)
    expect(lines[0]?.kind).toBe('rewired')
    expect(lines[0]?.detail).toBe('+ a → c, − a → b')
  })

  it('reports a rename with both names', () => {
    const lines = changeLines(diff({ renamed: ['Sync', 'Sync (paused)'] }))
    expect(lines[0]).toEqual({
      kind: 'renamed',
      subject: 'Workflow',
      detail: 'Sync → Sync (paused)',
    })
  })

  it('puts the rename first, where somebody scanning will see it', () => {
    const lines = changeLines(
      diff({
        renamed: ['Sync', 'Sync v2'],
        nodesAdded: [{ id: 'n', name: 'Notify', kind: 'slack' }],
      }),
    )

    expect(lines.map((line) => line.kind)).toEqual(['renamed', 'added'])
  })
})

describe('isCurrent', () => {
  const entry = (version: number): VersionEntry => ({ version, id: `v${version}` }) as VersionEntry

  it('marks the newest version, because history is append-only', () => {
    // A restore adds a version rather than moving backwards through them, so
    // the newest is always what the workflow is at now.
    const versions = [entry(3), entry(2), entry(1)]

    expect(isCurrent(versions[0] as VersionEntry, versions)).toBe(true)
    expect(isCurrent(versions[1] as VersionEntry, versions)).toBe(false)
  })

  it('marks nothing when there is no history yet', () => {
    expect(isCurrent(entry(1), [])).toBe(false)
  })
})

describe('whenLabel', () => {
  const now = new Date('2026-08-21T12:00:00Z')

  it('reads as relative time while that is what somebody is asking about', () => {
    // "Was this before or after it broke" is the question, and it is usually
    // about the last few hours.
    expect(whenLabel('2026-08-21T11:59:40Z', now)).toBe('just now')
    expect(whenLabel('2026-08-21T11:30:00Z', now)).toBe('30m ago')
    expect(whenLabel('2026-08-21T09:00:00Z', now)).toBe('3h ago')
  })

  it('falls back to a date once relative time stops meaning anything', () => {
    expect(whenLabel('2026-08-01T09:00:00Z', now)).toMatch(/Aug/)
  })

  it('does not render a broken timestamp as a broken date', () => {
    expect(whenLabel('not a date', now)).toBe('unknown')
  })
})
