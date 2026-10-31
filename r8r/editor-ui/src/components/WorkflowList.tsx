import { useEffect, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { describeError } from '../api'
import { useApi } from '../ApiProvider'
import type { Workflow } from '../types'

export function WorkflowList({ onOpen }: { onOpen: (id: string) => void }) {
  const api = useApi()
  const [workflows, setWorkflows] = useState<Workflow[] | null>(null)

  const reload = () =>
    api
      .listWorkflows()
      .then(setWorkflows)
      .catch((cause: unknown) => {
        setWorkflows([])
        notifications.show({ color: 'red', message: describeError(cause) })
      })

  useEffect(() => {
    void reload()
  }, [])

  const create = async () => {
    try {
      const created = await api.createWorkflow({
        name: 'My workflow',
        nodes: [
          {
            id: crypto.randomUUID(),
            type: 'manual',
            name: 'When clicking Execute',
            parameters: {},
            position: [80, 160],
          },
        ],
        connections: [],
      })
      onOpen(created.id)
    } catch (error) {
      notifications.show({ color: 'red', message: describeError(error) })
    }
  }

  const remove = async (event: React.MouseEvent, workflow: Workflow) => {
    event.stopPropagation()
    if (!confirm(`Delete "${workflow.name}" and its execution history?`)) return
    try {
      await api.deleteWorkflow(workflow.id)
      notifications.show({ message: `Deleted ${workflow.name}` })
      void reload()
    } catch (error) {
      notifications.show({ color: 'red', message: describeError(error) })
    }
  }

  return (
    <Container size="md" py={40}>
      <Group justify="space-between" align="flex-end" mb="lg">
        <div>
          <Title order={2}>Workflows</Title>
          <Text c="dimmed" size="sm">
            Build a graph, wire a trigger, activate it.
          </Text>
        </div>
        <Button onClick={create}>New workflow</Button>
      </Group>

      {workflows === null && <Loader size="sm" />}

      {workflows?.length === 0 && (
        <Card withBorder padding="xl">
          <Text ta="center" c="dimmed">
            Nothing here yet. Create your first workflow.
          </Text>
        </Card>
      )}

      <Stack gap="xs">
        {workflows?.map((workflow) => (
          <Card
            withBorder
            padding="md"
            key={workflow.id}
            onClick={() => onOpen(workflow.id)}
            style={{ cursor: 'pointer' }}
          >
            <Group wrap="nowrap">
              <div style={{ minWidth: 0 }}>
                <Text fw={600} truncate>
                  {workflow.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {workflow.nodes.length} node{workflow.nodes.length === 1 ? '' : 's'} · updated{' '}
                  {formatWhen(workflow.updatedAt)}
                </Text>
              </div>
              <Group ml="auto" gap="xs" wrap="nowrap">
                <Badge variant="light" color={workflow.active ? 'teal' : 'gray'}>
                  {workflow.active ? 'active' : 'inactive'}
                </Badge>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label="Delete"
                  onClick={(event) => remove(event, workflow)}
                >
                  ✕
                </ActionIcon>
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>
    </Container>
  )
}

function formatWhen(iso?: string): string {
  if (!iso) return 'never'
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}
