import { ActionIcon, Badge, Button, Group, Switch, Text, TextInput, Tooltip } from '@mantine/core'
import { IconArrowLeft, IconHistory, IconPlayerPlay, IconVersions } from '@tabler/icons-react'

import { hasAutomaticTrigger } from '../domain/graph'
import type { EditorBusy } from '../hooks/useWorkflowEditor'
import type { Workflow } from '../types'

export function EditorToolbar({
  workflow,
  dirty,
  busy,
  onBack,
  onRename,
  onSave,
  onRun,
  onSetActive,
  runsOpen,
  onToggleRuns,
  historyOpen,
  onToggleHistory,
}: {
  workflow: Workflow
  dirty: boolean
  busy: EditorBusy
  onBack: () => void
  onRename: (name: string) => void
  onSave: () => void
  onRun: () => void
  onSetActive: (active: boolean) => void
  runsOpen: boolean
  onToggleRuns: () => void
  historyOpen: boolean
  onToggleHistory: () => void
}) {
  const canActivate = hasAutomaticTrigger(workflow)

  return (
    <Group px="sm" py={8} gap="sm" wrap="nowrap" className="toolbar">
      <ActionIcon variant="subtle" color="gray" onClick={onBack} aria-label="Back to workflows">
        <IconArrowLeft size={16} stroke={1.8} />
      </ActionIcon>

      <Group gap={6} wrap="nowrap">
        <Text size="sm" c="dimmed">
          Workflows
        </Text>
        <Text size="sm" c="dimmed">
          /
        </Text>
        <TextInput
          aria-label="Workflow name"
          variant="unstyled"
          value={workflow.name}
          onChange={(event) => onRename(event.currentTarget.value)}
          styles={{ input: { fontSize: 13.5, fontWeight: 600, height: 24, minHeight: 24 } }}
          w={220}
        />
      </Group>

      {dirty && (
        <Badge variant="light" color="yellow" size="xs">
          unsaved
        </Badge>
      )}

      <Group gap="sm" ml="auto" wrap="nowrap">
        <Tooltip label="History">
          <ActionIcon
            variant={historyOpen ? 'light' : 'subtle'}
            color="gray"
            aria-label="History"
            onClick={onToggleHistory}
          >
            <IconVersions size={16} stroke={1.8} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Previous runs">
          <ActionIcon
            variant={runsOpen ? 'light' : 'subtle'}
            color="gray"
            aria-label="Previous runs"
            onClick={onToggleRuns}
          >
            <IconHistory size={16} stroke={1.8} />
          </ActionIcon>
        </Tooltip>

        <Tooltip
          label="Add a Webhook or Schedule trigger to run this without you"
          disabled={canActivate}
        >
          {/* A span keeps the tooltip alive while the switch is disabled. */}
          <span>
            <Switch
              label="Active"
              labelPosition="left"
              checked={workflow.active}
              disabled={!canActivate}
              onChange={(event) => onSetActive(event.currentTarget.checked)}
            />
          </span>
        </Tooltip>

        <Button variant="default" onClick={onSave} loading={busy === 'saving'} disabled={!dirty}>
          Save
        </Button>

        <Button
          onClick={onRun}
          loading={busy === 'running'}
          leftSection={<IconPlayerPlay size={13} stroke={2} />}
        >
          Execute
        </Button>
      </Group>
    </Group>
  )
}
