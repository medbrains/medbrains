import { useMemo, useState } from 'react'
import { Group, ScrollArea, Stack, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'

import { iconFor } from '../icons'
import type { NodeGroup, NodeTypeDescription } from '../types'

/** Palette order follows the shape of a workflow: start, fetch, change, route, send. */
const GROUP_ORDER: NodeGroup[] = ['trigger', 'input', 'transform', 'flow', 'output']
const GROUP_LABEL: Record<NodeGroup, string> = {
  trigger: 'Start with',
  input: 'Fetch',
  transform: 'Change',
  flow: 'Route',
  output: 'Send to',
}

export function NodePalette({
  nodeTypes,
  onAdd,
}: {
  nodeTypes: readonly NodeTypeDescription[]
  onAdd: (type: NodeTypeDescription) => void
}) {
  const [query, setQuery] = useState('')

  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return nodeTypes
    return nodeTypes.filter((type) =>
      `${type.displayName} ${type.name} ${type.description}`.toLowerCase().includes(needle),
    )
  }, [nodeTypes, query])

  return (
    <Stack gap={0} h="100%">
      <div style={{ padding: 10, borderBottom: '1px solid var(--line)' }}>
        <TextInput
          aria-label="Search nodes"
          placeholder="Search nodes"
          leftSection={<IconSearch size={13} stroke={1.8} />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </div>

      <ScrollArea style={{ flex: 1 }} p={8}>
        {matching.length === 0 && (
          <Text size="xs" c="dimmed" ta="center" py="lg">
            No node matches “{query}”.
          </Text>
        )}

        <Stack gap="md">
          {GROUP_ORDER.map((group) => {
            const inGroup = matching.filter((type) => type.group === group)
            if (inGroup.length === 0) return null

            return (
              <Stack gap={2} key={group}>
                <Text className="eyebrow" px={8} pb={2}>
                  {GROUP_LABEL[group]}
                </Text>

                {inGroup.map((type) => (
                  <PaletteItem key={type.name} type={type} onAdd={onAdd} />
                ))}
              </Stack>
            )
          })}
        </Stack>
      </ScrollArea>
    </Stack>
  )
}

function PaletteItem({
  type,
  onAdd,
}: {
  type: NodeTypeDescription
  onAdd: (type: NodeTypeDescription) => void
}) {
  const Icon = iconFor(type.name)

  return (
    <Tooltip
      label={type.description}
      position="right"
      openDelay={500}
      withArrow
      multiline
      w={220}
    >
      <UnstyledButton className="palette-item" onClick={() => onAdd(type)}>
        <Group gap={9} wrap="nowrap">
          <span
            style={{
              color: type.color,
              display: 'grid',
              placeItems: 'center',
              width: 22,
              height: 22,
              flex: '0 0 auto',
            }}
          >
            <Icon size={16} stroke={1.7} />
          </span>
          <Text size="sm" truncate>
            {type.displayName}
          </Text>
          {type.credentials?.length ? (
            <Text size="10px" c="dimmed" ml="auto" style={{ flex: '0 0 auto' }}>
              auth
            </Text>
          ) : null}
        </Group>
      </UnstyledButton>
    </Tooltip>
  )
}
