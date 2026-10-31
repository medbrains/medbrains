import { describe, expect, it, vi } from 'vitest'

import { fakeApi, renderWithProviders, screen, waitFor } from '../test/render'
import type { VersionEntry, WorkflowDiff } from '../types'
import { HistoryPanel } from './HistoryPanel'

function emptyDiff(overrides: Partial<WorkflowDiff> = {}): WorkflowDiff {
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

function entry(version: number, overrides: Partial<VersionEntry> = {}): VersionEntry {
  return {
    id: `v${version}`,
    workflowId: 'wf',
    version,
    name: 'Nightly patient sync',
    createdAt: new Date().toISOString(),
    note: null,
    changes: null,
    summary: 'Created',
    ...overrides,
  }
}

/** Two versions: a timeout that was 30s and is now 1ms. */
function brokenByAnEdit(): VersionEntry[] {
  return [
    entry(2, {
      summary: '1 step edited',
      changes: emptyDiff({
        nodesChanged: [
          {
            id: 'fetch',
            name: 'Fetch patients',
            kind: 'httpRequest',
            fields: [{ path: 'timeoutMs', before: 30000, after: 1 }],
          },
        ],
      }),
    }),
    entry(1),
  ]
}

function render(versions: VersionEntry[], overrides = {}) {
  const api = fakeApi({
    listVersions: vi.fn().mockResolvedValue(versions),
    ...overrides,
  })
  const onRestored = vi.fn()
  const utils = renderWithProviders(
    <HistoryPanel workflowId="wf" onRestored={onRestored} onClose={vi.fn()} />,
    { api },
  )
  return { ...utils, api, onRestored }
}

describe('HistoryPanel', () => {
  it('lists what each save changed, newest first', async () => {
    render(brokenByAnEdit())

    expect(await screen.findByText('v2')).toBeInTheDocument()
    expect(screen.getByText('1 step edited')).toBeInTheDocument()
    expect(screen.getByText('Created')).toBeInTheDocument()
  })

  it('marks the version the workflow is currently at', async () => {
    render(brokenByAnEdit())

    // History is append-only, so the newest is always the current one. Getting
    // this wrong would offer to "restore" the version already in place.
    expect(await screen.findByText('Current')).toBeInTheDocument()
    expect(screen.getAllByText('Current')).toHaveLength(1)
  })

  it('shows the setting that changed when a version is opened', async () => {
    // The whole point of the panel: not "the fetch step changed", but which
    // setting, and what it was before.
    const { user } = render(brokenByAnEdit())

    await user.click(await screen.findByText('v2'))

    expect(screen.getByText('Fetch patients')).toBeInTheDocument()
    expect(screen.getByText('timeoutMs 30000 → 1')).toBeInTheDocument()
  })

  it('offers to restore an older version but not the current one', async () => {
    const { user } = render(brokenByAnEdit())

    await user.click(await screen.findByText('v2'))
    expect(screen.queryByRole('button', { name: /Restore version 2/ })).not.toBeInTheDocument()

    await user.click(screen.getByText('v1'))
    expect(screen.getByRole('button', { name: /Restore version 1/ })).toBeInTheDocument()
  })

  it('reloads the canvas after restoring, so the next save does not undo it', async () => {
    const restoreVersion = vi.fn().mockResolvedValue({})
    const { user, onRestored } = render(brokenByAnEdit(), { restoreVersion })

    await user.click(await screen.findByText('v1'))
    await user.click(screen.getByRole('button', { name: /Restore version 1/ }))

    await waitFor(() => expect(restoreVersion).toHaveBeenCalledWith('wf', 1))
    // The canvas is still holding version 2. Leaving it there would let the
    // next save quietly put the broken version back.
    expect(onRestored).toHaveBeenCalled()
  })

  it('says why a restore failed and leaves the canvas alone', async () => {
    const restoreVersion = vi.fn().mockRejectedValue(new Error('workflow is locked'))
    const { user, onRestored } = render(brokenByAnEdit(), { restoreVersion })

    await user.click(await screen.findByText('v1'))
    await user.click(screen.getByRole('button', { name: /Restore version 1/ }))

    expect(await screen.findByText('workflow is locked')).toBeInTheDocument()
    expect(onRestored).not.toHaveBeenCalled()
  })

  it('says a workflow has no history rather than showing an empty box', async () => {
    render([])

    expect(await screen.findByText(/Every save from here on is recorded/)).toBeInTheDocument()
  })

  it('shows the reason a version exists when it has one', async () => {
    // A restore records why it happened, and that reads better than the diff.
    render([entry(3, { note: 'Restored version 1', summary: '1 step edited' }), entry(2), entry(1)])

    expect(await screen.findByText('Restored version 1')).toBeInTheDocument()
  })
})
