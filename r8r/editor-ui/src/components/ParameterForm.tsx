import {
  ActionIcon,
  Button,
  Divider,
  Group,
  JsonInput,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'

import {
  asText,
  fromEntries,
  isVisible,
  normalizeParameters,
  toEntries,
  valueOf,
} from '../domain/parameters'
import type {
  CredentialTypeDescription,
  Items,
  JsonValue,
  NodeProperty,
  NodeTypeDescription,
  OnError,
  WorkflowNode,
} from '../types'
import { CredentialSelect } from './CredentialSelect'
import { FieldMapper } from './FieldMapper'

/**
 * The middle column of the node view: every parameter the node declares,
 * rendered from its schema so a new node type needs no frontend work.
 */
export function ParameterForm({
  node,
  description,
  credentialTypes,
  input,
  destinations,
  onPatch,
  onDelete,
}: {
  node: WorkflowNode
  description?: NodeTypeDescription
  credentialTypes: readonly CredentialTypeDescription[]
  /** What reached this node in the last run, for the mapper's source column. */
  input: Items
  /** Fields the next node expects, for the mapper's destination column. */
  destinations: readonly string[]
  onPatch: (patch: Partial<WorkflowNode>) => void
  onDelete: () => void
}) {
  const properties = description?.properties ?? []

  // Changing Resource can invalidate Operation, which can invalidate fields,
  // so every edit is followed by a normalisation pass over the whole schema.
  const setParam = (key: string, value: JsonValue) =>
    onPatch({
      parameters: normalizeParameters(properties, { ...node.parameters, [key]: value }),
    })

  const setCredential = (typeName: string, id: string | undefined) => {
    const next = { ...(node.credentials ?? {}) }
    if (id) {
      next[typeName] = id
    } else {
      delete next[typeName]
    }
    onPatch({ credentials: next })
  }

  return (
    <ScrollArea h="100%" px="md" py="sm">
      <Stack gap="sm">
        {description?.credentials?.map((requirement) => (
          <CredentialSelect
            key={requirement.name}
            requirement={requirement}
            credentialTypes={credentialTypes}
            selectedId={node.credentials?.[requirement.name]}
            onSelect={(id) => setCredential(requirement.name, id)}
          />
        ))}

        {properties.map((property) =>
          isVisible(property, node.parameters) ? (
            <Field
              key={property.name}
              property={property}
              value={valueOf(property, node.parameters)}
              input={input}
              destinations={destinations}
              onChange={(value) => setParam(property.name, value)}
            />
          ) : null,
        )}

        {properties.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="lg">
            This node has nothing to configure.
          </Text>
        )}

        <Divider label="Settings" labelPosition="left" mt="xs" />

        <Select
          label="When this node fails"
          description="A batch of records does not have to succeed or fail as one"
          data={[
            { value: 'stop', label: 'Stop the run' },
            { value: 'continue', label: 'Pass the error on and keep going' },
            { value: 'continueRecord', label: 'Skip the record, keep the rest' },
          ]}
          value={node.onError ?? 'stop'}
          allowDeselect={false}
          onChange={(value) => onPatch({ onError: value === 'stop' ? null : (value as OnError) })}
        />

        {node.onError === 'continueRecord' && (
          <Text size="xs" c="dimmed" mt={-8}>
            Records that fail leave on the error port, each with the record that caused it.
          </Text>
        )}

        <Switch
          label="Retry on failure"
          checked={Boolean(node.retryOnFail)}
          onChange={(event) => onPatch({ retryOnFail: event.currentTarget.checked })}
        />

        {node.retryOnFail && (
          <Group grow gap="xs">
            <NumberInput
              label="Max tries"
              min={1}
              max={10}
              value={node.maxTries ?? 3}
              onChange={(value) => onPatch({ maxTries: Number(value) || 3 })}
            />
            <NumberInput
              label="Wait between (ms)"
              min={0}
              step={500}
              value={node.waitBetweenTriesMs ?? 1000}
              onChange={(value) => onPatch({ waitBetweenTriesMs: Number(value) || 0 })}
            />
          </Group>
        )}

        <Switch
          label="Disabled"
          description="Skip this node without removing it"
          checked={Boolean(node.disabled)}
          onChange={(event) => onPatch({ disabled: event.currentTarget.checked })}
        />

        <Button color="red" variant="light" onClick={onDelete} mt="xs">
          Delete node
        </Button>
      </Stack>
    </ScrollArea>
  )
}

/** One input, chosen by the property's declared kind. */
function Field({
  property,
  value,
  input,
  destinations,
  onChange,
}: {
  property: NodeProperty
  value: JsonValue
  input: Items
  destinations: readonly string[]
  onChange: (value: JsonValue) => void
}) {
  const common = {
    label: property.displayName,
    description: property.description,
    withAsterisk: property.required,
    placeholder: property.placeholder,
  }

  switch (property.type) {
    case 'boolean':
      return (
        <Switch
          label={property.displayName}
          description={property.description}
          checked={Boolean(value)}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
      )

    case 'number':
      return (
        <NumberInput
          {...common}
          value={Number(value ?? 0)}
          onChange={(next) => onChange(Number(next) || 0)}
        />
      )

    case 'options': {
      // An integration's operations carry a one-line description; show the
      // selected one so the node explains itself.
      const chosen = property.options?.find((option) => String(option.value) === String(value))
      return (
        <Select
          {...common}
          description={chosen?.action ?? property.description}
          data={(property.options ?? []).map((option) => ({
            value: String(option.value),
            label: option.name,
          }))}
          value={String(value ?? '')}
          allowDeselect={false}
          onChange={(next) => onChange(next ?? '')}
        />
      )
    }

    case 'json':
      return (
        <JsonInput
          {...common}
          autosize
          minRows={4}
          formatOnBlur
          validationError="Not valid JSON"
          value={asText(value)}
          onChange={onChange}
        />
      )

    case 'code':
      return (
        <Textarea
          {...common}
          autosize
          minRows={6}
          maxRows={18}
          spellCheck={false}
          styles={{
            input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12.5 },
          }}
          value={asText(value)}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )

    case 'multilineString':
      return (
        <Textarea
          {...common}
          autosize
          minRows={3}
          value={asText(value)}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )

    case 'fieldMapper':
      return (
        <FieldMapper value={value} input={input} destinations={destinations} onChange={onChange} />
      )

    case 'keyValue':
      return <KeyValueField property={property} value={value} onChange={onChange} />

    default:
      return (
        <TextInput
          {...common}
          value={asText(value)}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )
  }
}

/** An editable string map — headers, query params, Edit Fields' fields. */
function KeyValueField({
  property,
  value,
  onChange,
}: {
  property: NodeProperty
  value: JsonValue
  onChange: (value: JsonValue) => void
}) {
  const entries = toEntries(value)
  const replace = (next: [string, JsonValue][]) => onChange(fromEntries(next))

  return (
    <Stack gap={6}>
      <Text size="xs" fw={500}>
        {property.displayName}
        {property.required && <span style={{ color: 'var(--mantine-color-red-5)' }}> *</span>}
      </Text>

      {entries.map(([key, entryValue], index) => (
        // Index is the identity here: keys are edited in place and may repeat
        // or be blank while the user is typing.
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
        <Group gap={6} wrap="nowrap" key={index}>
          <TextInput
            aria-label={`${property.displayName} key ${index + 1}`}
            placeholder="key"
            style={{ flex: '0 0 38%' }}
            value={key}
            onChange={(event) => {
              const next = [...entries]
              next[index] = [event.currentTarget.value, entryValue]
              replace(next)
            }}
          />
          <TextInput
            aria-label={`${property.displayName} value ${index + 1}`}
            placeholder="value or {{ expression }}"
            style={{ flex: 1 }}
            value={asText(entryValue)}
            onChange={(event) => {
              const next = [...entries]
              next[index] = [key, event.currentTarget.value]
              replace(next)
            }}
          />
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Remove ${property.displayName} row ${index + 1}`}
            onClick={() => replace(entries.filter((_, position) => position !== index))}
          >
            ✕
          </ActionIcon>
        </Group>
      ))}

      <Button variant="default" size="compact-xs" onClick={() => replace([...entries, ['', '']])}>
        + Add
      </Button>

      {property.description && (
        <Text size="xs" c="dimmed">
          {property.description}
        </Text>
      )}
    </Stack>
  )
}
