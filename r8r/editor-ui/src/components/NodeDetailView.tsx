import { ActionIcon, Box, Group, Modal, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconPlayerPlay, IconX } from '@tabler/icons-react'

import { formatDuration } from '../domain/execution'
import { iconFor } from '../icons'
import { ItemsPreview } from './ItemsPreview'
import { ParameterForm } from './ParameterForm'
import type {
  CredentialTypeDescription,
  Items,
  NodeRunData,
  NodeTypeDescription,
  WorkflowNode,
} from '../types'

/**
 * The node view: what went in, how the node is configured, what came out.
 *
 * Configuring and debugging are the same activity, so they share one screen
 * rather than living in a side panel and a drawer that cannot be read together.
 */
export function NodeDetailView({
  node,
  description,
  credentialTypes,
  input,
  destinations,
  run,
  onPatch,
  onDelete,
  onClose,
  onExecute,
  executing,
}: {
  node: WorkflowNode
  description?: NodeTypeDescription
  credentialTypes: readonly CredentialTypeDescription[]
  input: Items
  /** Fields the next node expects, shown in the mapper's right column. */
  destinations: readonly string[]
  run?: NodeRunData
  onPatch: (patch: Partial<WorkflowNode>) => void
  onDelete: () => void
  onClose: () => void
  onExecute: () => void
  executing: boolean
}) {
  const Icon = iconFor(node.type)
  const output = run?.output.main ?? []
  const branches = Object.entries(run?.output ?? {}).filter(([port]) => port !== 'main')

  return (
    <Modal
      opened
      onClose={onClose}
      size="min(1180px, 94vw)"
      padding={0}
      withCloseButton={false}
      centered
      styles={{ body: { height: 'min(720px, 84vh)', display: 'flex', flexDirection: 'column' } }}
    >
      <Group
        px="md"
        py={10}
        gap="sm"
        wrap="nowrap"
        style={{ borderBottom: '1px solid var(--line)', flex: '0 0 auto' }}
      >
        <span className="flow-node-tile" style={{ color: description?.color, width: 30, height: 30 }}>
          <Icon size={17} stroke={1.7} />
        </span>

        <TextInput
          aria-label="Node name"
          variant="unstyled"
          value={node.name}
          placeholder={description?.displayName}
          onChange={(event) => onPatch({ name: event.currentTarget.value })}
          styles={{ input: { fontSize: 15, fontWeight: 600, height: 24, minHeight: 24 } }}
          w={280}
        />

        <Text size="xs" c="dimmed">
          {description?.displayName ?? node.type}
        </Text>

        <Group gap="xs" ml="auto" wrap="nowrap">
          {run && (
            <Text size="xs" c="dimmed" className="metric">
              {formatDuration(run.ms)}
            </Text>
          )}
          <Tooltip label="Run the workflow">
            <ActionIcon
              variant="default"
              size="md"
              aria-label="Execute node"
              loading={executing}
              onClick={onExecute}
            >
              <IconPlayerPlay size={14} stroke={1.8} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon variant="subtle" color="gray" size="md" aria-label="Close" onClick={onClose}>
            <IconX size={16} stroke={1.8} />
          </ActionIcon>
        </Group>
      </Group>

      <Box className="ndv-panes">
        <Box className="ndv-pane">
          <ItemsPreview
            label="Input"
            items={input}
            empty={
              description?.group === 'trigger'
                ? 'A trigger starts the run, so nothing comes in.'
                : 'Run the workflow to see what reaches this node.'
            }
          />
        </Box>

        <Box className="ndv-pane ndv-pane-form">
          <ParameterForm
            node={node}
            description={description}
            credentialTypes={credentialTypes}
            input={input}
            destinations={destinations}
            onPatch={onPatch}
            onDelete={onDelete}
          />
        </Box>

        <Box className="ndv-pane">
          {run?.status === 'error' ? (
            <Stack gap={6}>
              <Text className="eyebrow">Output</Text>
              <Text size="xs" c="red.5" style={{ wordBreak: 'break-word' }}>
                {run.error}
              </Text>
            </Stack>
          ) : (
            <Stack gap="sm" h="100%" style={{ minHeight: 0 }}>
              <ItemsPreview
                label="Output"
                items={output}
                empty={
                  run ? 'This node produced nothing.' : 'Run the workflow to see the result.'
                }
              />
              {branches.map(([port, items]) => (
                <ItemsPreview
                  key={port}
                  label={`${port} branch`}
                  items={items}
                  empty="Nothing took this branch."
                />
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Modal>
  )
}
