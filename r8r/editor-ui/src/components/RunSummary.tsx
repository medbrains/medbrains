import { ActionIcon, Button, Group, Text, Tooltip } from '@mantine/core'
import { IconTerminal2, IconX } from '@tabler/icons-react'

import { formatCount, formatDuration, summarize } from '../domain/execution'
import type { RunResult } from '../types'

/**
 * One line under the canvas reporting the last run.
 *
 * The detail lives on the nodes themselves; this is the headline — did it
 * work, how much moved, how long it took.
 */
export function RunSummary({
  result,
  consoleOpen,
  onToggleConsole,
  onClose,
}: {
  result: RunResult
  consoleOpen: boolean
  onToggleConsole: () => void
  onClose: () => void
}) {
  const summary = summarize(result)
  const failed = summary.status === 'error'

  return (
    <Group px="md" py={7} gap="md" wrap="nowrap" className="run-summary" data-testid="run-summary">
      <Group gap={7} wrap="nowrap">
        <span className={`status-dot ${failed ? 'is-error' : 'is-ok'}`} />
        <Text size="xs" fw={600} c={failed ? 'red.5' : 'teal.4'}>
          {failed ? 'Failed' : 'Succeeded'}
        </Text>
      </Group>

      <Text size="xs" c="dimmed">
        {formatCount(summary.ran, 'node')} ran
        {summary.skipped > 0 && ` · ${summary.skipped} not reached`}
      </Text>

      <Tooltip label="Total time across every node that ran">
        <Text size="xs" className="metric" c="signal.4">
          {formatDuration(summary.totalMs)}
        </Text>
      </Tooltip>

      {summary.error && (
        <Text size="xs" c="red.5" truncate style={{ minWidth: 0 }}>
          {summary.error}
        </Text>
      )}

      <Button
        variant={consoleOpen ? 'light' : 'default'}
        size="compact-xs"
        ml="auto"
        leftSection={<IconTerminal2 size={12} stroke={1.8} />}
        onClick={onToggleConsole}
      >
        Console
      </Button>

      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        aria-label="Dismiss run summary"
        onClick={onClose}
      >
        <IconX size={13} stroke={1.8} />
      </ActionIcon>
    </Group>
  )
}
