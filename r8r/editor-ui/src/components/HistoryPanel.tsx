import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { IconArrowBackUp, IconRefresh, IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { useApi } from '../ApiProvider'
import { describeError } from '../api'
import type { ChangeKind } from '../domain/history'
import { changeLines, isCurrent, whenLabel } from '../domain/history'
import type { VersionEntry } from '../types'

/**
 * What this workflow looked like before somebody changed it.
 *
 * Read at the point where an active workflow has stopped working and nobody
 * remembers what they edited, so the summary of each save comes first and the
 * detail sits under it — scanning is the common case, reading is not.
 */
export function HistoryPanel({
  workflowId,
  onRestored,
  onClose,
}: {
  workflowId: string
  onRestored: () => void
  onClose: () => void
}) {
  const api = useApi()
  const [versions, setVersions] = useState<VersionEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openVersion, setOpenVersion] = useState<number | null>(null)
  const [restoring, setRestoring] = useState<number | null>(null)

  const reload = useCallback(async () => {
    try {
      setVersions(await api.listVersions(workflowId))
      setError(null)
    } catch (cause) {
      setVersions([])
      setError(describeError(cause))
    }
  }, [api, workflowId])

  useEffect(() => {
    void reload()
  }, [reload])

  const restore = async (version: number) => {
    setRestoring(version)
    try {
      await api.restoreVersion(workflowId, version)
      setError(null)
      onRestored()
      await reload()
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      setRestoring(null)
    }
  }

  const now = new Date()

  return (
    <Stack gap={0} h="100%" className="executions-panel">
      <Group px="sm" py={9} gap="xs" style={{ borderBottom: '1px solid var(--line)' }}>
        <Text className="eyebrow">History</Text>
        <Tooltip label="Refresh">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            ml="auto"
            aria-label="Refresh history"
            onClick={() => void reload()}
          >
            <IconRefresh size={13} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Close history"
          onClick={onClose}
        >
          <IconX size={13} stroke={1.8} />
        </ActionIcon>
      </Group>

      <ScrollArea style={{ flex: 1 }} p={6}>
        {versions === null && <Loader size="xs" m="sm" />}

        {error && (
          <Text size="xs" c="red.5" p="sm">
            {error}
          </Text>
        )}

        {versions?.length === 0 && !error && (
          <Text size="xs" c="dimmed" p="sm">
            Nothing yet. Every save from here on is recorded.
          </Text>
        )}

        <Stack gap={2}>
          {versions?.map((entry) => {
            const current = isCurrent(entry, versions)
            const open = openVersion === entry.version
            return (
              <div key={entry.id}>
                <UnstyledButton
                  className={`execution-row${open ? ' is-open' : ''}`}
                  onClick={() => setOpenVersion(open ? null : entry.version)}
                  aria-expanded={open}
                >
                  <Group gap={7} wrap="nowrap">
                    <Text size="xs" fw={500} className="metric">
                      v{entry.version}
                    </Text>
                    {current && (
                      <Badge size="xs" variant="light" color="gray">
                        Current
                      </Badge>
                    )}
                    <Text size="10px" c="dimmed" ml="auto">
                      {whenLabel(entry.createdAt, now)}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" truncate mt={2}>
                    {entry.note ?? entry.summary}
                  </Text>
                </UnstyledButton>

                {open && (
                  <Stack gap={4} px="sm" py={6}>
                    {changeLines(entry.changes).map((line) => (
                      <Group
                        key={`${line.kind}-${line.subject}-${line.detail}`}
                        gap={6}
                        wrap="nowrap"
                        align="flex-start"
                      >
                        <Badge size="xs" variant="light" color={colorFor(line.kind)}>
                          {line.kind}
                        </Badge>
                        <div style={{ minWidth: 0 }}>
                          <Text size="xs" fw={500}>
                            {line.subject}
                          </Text>
                          {line.detail && (
                            <Text size="10px" c="dimmed" style={{ wordBreak: 'break-word' }}>
                              {line.detail}
                            </Text>
                          )}
                        </div>
                      </Group>
                    ))}

                    {!current && (
                      <Button
                        size="compact-xs"
                        variant="default"
                        leftSection={<IconArrowBackUp size={13} stroke={1.8} />}
                        loading={restoring === entry.version}
                        disabled={restoring !== null}
                        onClick={() => void restore(entry.version)}
                      >
                        Restore version {entry.version}
                      </Button>
                    )}
                  </Stack>
                )}
              </div>
            )
          })}
        </Stack>
      </ScrollArea>
    </Stack>
  )
}

function colorFor(kind: ChangeKind): string {
  switch (kind) {
    case 'added':
      return 'teal'
    case 'removed':
      return 'red'
    case 'rewired':
      return 'violet'
    default:
      return 'blue'
  }
}
