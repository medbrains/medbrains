import { useMemo } from 'react'
import { ActionIcon, Badge, Button, Group, ScrollArea, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconArrowRight, IconWand, IconX } from '@tabler/icons-react'

import { applySuggestions, autoMap, fieldPaths } from '../domain/mapping'
import { asText, fromEntries, toEntries } from '../domain/parameters'
import type { Items, JsonValue } from '../types'

/**
 * The two-sided field mapper.
 *
 * The left column is what actually arrived from the previous node; the right
 * is where it is going. Auto-map fills in every row whose names agree, which
 * is most of them, and leaves the judgement calls to the person.
 */
export function FieldMapper({
  value,
  input,
  destinations,
  onChange,
}: {
  value: JsonValue
  /** Items the previous node produced in the last run. */
  input: Items
  /** Fields the next node expects, when it declares any. */
  destinations: readonly string[]
  onChange: (value: JsonValue) => void
}) {
  const rows = toEntries(value)
  const sources = useMemo(() => fieldPaths(input), [input])

  const replace = (next: [string, JsonValue][]) => onChange(fromEntries(next))

  const suggest = () => {
    // Auto-map against the destinations the next node declares, plus any rows
    // already added by hand — so pressing it twice fills gaps rather than
    // rewriting what is there.
    const wanted = [...new Set([...destinations, ...rows.map(([key]) => key)])]
    onChange(applySuggestions(Object.fromEntries(rows), autoMap(wanted, sources)))
  }

  const unmapped = destinations.filter((field) => !rows.some(([key]) => key === field))

  return (
    <Stack gap={8}>
      <Group gap="xs" wrap="nowrap">
        <Text size="xs" fw={500}>
          Field Mappings
        </Text>
        <Tooltip
          label={
            sources.length === 0
              ? 'Run the workflow first so there are incoming fields to match'
              : 'Fill in every row whose names match'
          }
        >
          <span style={{ marginLeft: 'auto' }}>
            <Button
              variant="default"
              size="compact-xs"
              leftSection={<IconWand size={12} stroke={1.8} />}
              disabled={sources.length === 0}
              onClick={suggest}
            >
              Auto-map
            </Button>
          </span>
        </Tooltip>
      </Group>

      <div className="mapper-head">
        <Text className="eyebrow">Destination</Text>
        <span />
        <Text className="eyebrow">Source</Text>
        <span />
      </div>

      {rows.map(([destination, source], index) => (
        // Rows are positional: a destination may be blank while being typed.
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
        <div className="mapper-row" key={index}>
          <TextInput
            aria-label={`Destination ${index + 1}`}
            placeholder="customer.name"
            value={destination}
            onChange={(event) => {
              const next = [...rows]
              next[index] = [event.currentTarget.value, source]
              replace(next)
            }}
          />
          <IconArrowRight size={13} stroke={1.6} className="mapper-arrow" />
          <TextInput
            aria-label={`Source ${index + 1}`}
            placeholder="full_name or {{ expression }}"
            value={asText(source)}
            onChange={(event) => {
              const next = [...rows]
              next[index] = [destination, event.currentTarget.value]
              replace(next)
            }}
          />
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Remove mapping ${index + 1}`}
            onClick={() => replace(rows.filter((_, position) => position !== index))}
          >
            <IconX size={13} stroke={1.8} />
          </ActionIcon>
        </div>
      ))}

      <Button variant="default" size="compact-xs" onClick={() => replace([...rows, ['', '']])}>
        + Add mapping
      </Button>

      {unmapped.length > 0 && (
        <Stack gap={4}>
          <Text className="eyebrow">Expected by the next node</Text>
          <Group gap={4}>
            {unmapped.map((field) => (
              <Badge
                key={field}
                variant="default"
                size="xs"
                style={{ cursor: 'pointer' }}
                onClick={() => replace([...rows, [field, '']])}
              >
                + {field}
              </Badge>
            ))}
          </Group>
        </Stack>
      )}

      <Stack gap={4}>
        <Text className="eyebrow">Available from the previous node</Text>
        {sources.length === 0 ? (
          <Text size="xs" c="dimmed">
            Run the workflow to see what reaches this node.
          </Text>
        ) : (
          <ScrollArea.Autosize mah={180}>
            <Stack gap={1}>
              {sources.map((field) => (
                <button
                  type="button"
                  key={field.path}
                  className="source-field"
                  onClick={() => replace([...rows, ['', field.path]])}
                >
                  <span className="path">{field.path}</span>
                  <span className="kind">{field.kind}</span>
                  <span className="sample">{preview(field.sample)}</span>
                </button>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Stack>
    </Stack>
  )
}

function preview(value: JsonValue): string {
  const text = asText(value)
  return text.length > 28 ? `${text.slice(0, 28)}…` : text
}
