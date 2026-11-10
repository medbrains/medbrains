import { Code, Group, ScrollArea, SegmentedControl, Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'

import { formatCount } from '../domain/execution'
import type { Items, JsonValue } from '../types'

/**
 * Items, shown either as a table or as raw JSON.
 *
 * The table is the default because most items are flat records and a table
 * makes twenty of them scannable; JSON is one click away for the nested cases.
 */
export function ItemsPreview({
  items,
  empty,
  label,
}: {
  items: Items
  empty: string
  label: string
}) {
  const [view, setView] = useState<'table' | 'json'>('table')
  const columns = columnsOf(items)
  const canTable = columns.length > 0 && columns.length <= 12

  return (
    <Stack gap={6} h="100%" style={{ minHeight: 0 }}>
      <Group gap="xs" wrap="nowrap">
        <Text className="eyebrow">{label}</Text>
        <Text size="xs" c="dimmed" className="metric">
          {formatCount(items.length, 'item')}
        </Text>
        {canTable && (
          <SegmentedControl
            size="xs"
            ml="auto"
            value={view}
            onChange={(next) => setView(next as 'table' | 'json')}
            data={[
              { value: 'table', label: 'Table' },
              { value: 'json', label: 'JSON' },
            ]}
          />
        )}
      </Group>

      {items.length === 0 ? (
        <Text size="xs" c="dimmed" py="md">
          {empty}
        </Text>
      ) : (
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          {canTable && view === 'table' ? (
            <Table striped withTableBorder highlightOnHover fz="xs" horizontalSpacing={8}>
              <Table.Thead>
                <Table.Tr>
                  {columns.map((column) => (
                    <Table.Th key={column} style={{ whiteSpace: 'nowrap' }}>
                      {column}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.slice(0, 50).map((item, index) => (
                  // Items have no identity of their own; position is the key.
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                  <Table.Tr key={index}>
                    {columns.map((column) => (
                      <Table.Td key={column} className="cell">
                        {cellText(item[column])}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Code block fz={11}>
              {JSON.stringify(items, null, 2)}
            </Code>
          )}

          {items.length > 50 && (
            <Text size="xs" c="dimmed" pt={6}>
              Showing the first 50 of {items.length}.
            </Text>
          )}
        </ScrollArea>
      )}
    </Stack>
  )
}

/** Union of the keys present across the items, in first-seen order. */
function columnsOf(items: Items): string[] {
  const seen = new Set<string>()
  for (const item of items.slice(0, 50)) {
    for (const key of Object.keys(item)) seen.add(key)
  }
  return [...seen]
}

function cellText(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}
