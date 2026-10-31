import { useCallback, useEffect, useState } from 'react'
import { ActionIcon, Group, Loader, ScrollArea, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconRefresh, IconX } from '@tabler/icons-react'

import { describeError } from '../api'
import { useApi } from '../ApiProvider'
import { formatDuration } from '../domain/execution'
import type { ExecutionSummary } from '../types'

/**
 * Previous runs of this workflow.
 *
 * Opening one puts its readout back on the canvas, so a failure from last
 * night is inspected exactly the way a run from ten seconds ago is.
 */
export function ExecutionsPanel({
  workflowId,
  selectedId,
  onOpen,
  onClose,
}: {
  workflowId: string
  selectedId?: string
  onOpen: (executionId: string) => void
  onClose: () => void
}) {
  const api = useApi()
  const [executions, setExecutions] = useState<ExecutionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setExecutions(await api.listExecutions(workflowId, 50))
      setError(null)
    } catch (cause) {
      setExecutions([])
      setError(describeError(cause))
    }
  }, [workflowId])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <Stack gap={0} h="100%" className="executions-panel">
      <Group px="sm" py={9} gap="xs" style={{ borderBottom: '1px solid var(--line)' }}>
        <Text className="eyebrow">Previous runs</Text>
        <Tooltip label="Refresh">
          <ActionIcon variant="subtle" color="gray" size="sm" ml="auto" aria-label="Refresh runs" onClick={() => void reload()}>
            <IconRefresh size={13} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Close previous runs" onClick={onClose}>
          <IconX size={13} stroke={1.8} />
        </ActionIcon>
      </Group>

      <ScrollArea style={{ flex: 1 }} p={6}>
        {executions === null && <Loader size="xs" m="sm" />}

        {error && (
          <Text size="xs" c="red.5" p="sm">
            {error}
          </Text>
        )}

        {executions?.length === 0 && !error && (
          <Text size="xs" c="dimmed" p="sm">
            No runs yet. Press Execute, or activate the workflow and let a trigger fire it.
          </Text>
        )}

        <Stack gap={2}>
          {executions?.map((execution) => (
            <UnstyledButton
              key={execution.id}
              className={`execution-row${execution.id === selectedId ? ' is-open' : ''}`}
              onClick={() => onOpen(execution.id)}
            >
              <Group gap={7} wrap="nowrap">
                <span
                  className={`status-dot ${execution.status === 'error' ? 'is-error' : 'is-ok'}`}
                />
                <Text size="xs" fw={500}>
                  {when(execution.startedAt)}
                </Text>
                <Text size="10px" c="dimmed" tt="uppercase">
                  {execution.mode}
                </Text>
                <Text size="xs" className="metric" c="dimmed" ml="auto">
                  {formatDuration(execution.ms)}
                </Text>
              </Group>
              {execution.error && (
                <Text size="10px" c="red.5" truncate mt={2}>
                  {execution.error}
                </Text>
              )}
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea>
    </Stack>
  )
}

/** Recent runs are the ones being debugged, so they read as elapsed time. */
function when(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  return new Date(iso).toLocaleString()
}
