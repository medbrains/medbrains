import {
  Accordion,
  ActionIcon,
  Badge,
  Code,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core'
import type { Items, NodeRunData, PortName, RunResult } from '../types'

const STATUS_COLOR = { ok: 'teal', error: 'red', skipped: 'gray' } as const

export function ExecutionPanel({
  result,
  onClose,
}: {
  result: RunResult
  onClose: () => void
}) {
  const ran = result.runs.filter((run) => run.status !== 'skipped')

  return (
    <Paper
      radius={0}
      data-testid="execution-panel"
      style={{
        flex: '0 0 auto',
        height: '34vh',
        borderTop: '1px solid var(--mantine-color-dark-4)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Group
        px="sm"
        py={8}
        gap="xs"
        style={{ borderBottom: '1px solid var(--mantine-color-dark-4)', flex: '0 0 auto' }}
      >
        <Badge variant="light" color={result.status === 'success' ? 'teal' : 'red'}>
          {result.status}
        </Badge>
        <Text size="xs" c="dimmed">
          {ran.length} node{ran.length === 1 ? '' : 's'} ran ·{' '}
          {ran.reduce((total, run) => total + run.ms, 0)}ms total
        </Text>
        {result.error && (
          <Text size="xs" c="red.5" truncate>
            {result.error}
          </Text>
        )}
        <ActionIcon
          variant="subtle"
          color="gray"
          ml="auto"
          onClick={onClose}
          aria-label="Close execution results"
        >
          ✕
        </ActionIcon>
      </Group>

      <ScrollArea style={{ flex: 1 }} p="sm">
        <Accordion variant="separated" multiple defaultValue={[ran.at(-1)?.nodeId ?? '']}>
          {result.runs.map((run) => (
            <RunRow key={run.nodeId} run={run} />
          ))}
        </Accordion>
      </ScrollArea>
    </Paper>
  )
}

function RunRow({ run }: { run: NodeRunData }) {
  const ports = Object.entries(run.output) as [PortName, Items][]

  return (
    <Accordion.Item value={run.nodeId}>
      <Accordion.Control>
        <Group gap="xs" wrap="nowrap">
          <Badge size="xs" variant="light" color={STATUS_COLOR[run.status]}>
            {run.status}
          </Badge>
          <Text size="sm" fw={500}>
            {run.name || run.type}
          </Text>
          <Text size="xs" c="dimmed">
            {run.ms}ms
            {run.tries > 1 && ` · ${run.tries} tries`}
          </Text>
        </Group>
      </Accordion.Control>

      <Accordion.Panel>
        {run.error && (
          <Code block color="red.9" mb="xs">
            {run.error}
          </Code>
        )}

        {ports.length === 0 && !run.error && (
          <Text size="xs" c="dimmed">
            No output.
          </Text>
        )}

        {ports.map(([port, items]) => (
          <Stack gap={4} key={port} mb="xs">
            <Text size="xs" c="dimmed">
              {port === 'main' ? 'output' : port} · {items.length} item
              {items.length === 1 ? '' : 's'}
            </Text>
            <Code block style={{ maxHeight: 260, overflow: 'auto', fontSize: 11.5 }}>
              {JSON.stringify(items, null, 2)}
            </Code>
          </Stack>
        ))}
      </Accordion.Panel>
    </Accordion.Item>
  )
}
