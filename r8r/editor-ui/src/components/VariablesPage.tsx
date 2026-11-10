import {
  ActionIcon,
  Alert,
  Button,
  Code,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconInfoCircle, IconPlus, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { useApi } from '../ApiProvider'
import { describeError } from '../api'
import { parseValue, showValue, validateKey } from '../domain/variables'
import type { StoredVariable } from '../types'

/**
 * Settings that differ between one deployment and the next.
 *
 * The page exists so promoting a workflow from a test hospital to a live one
 * is a copy rather than an edit of every step that mentions a hostname. It is
 * deliberately not a secret store — everything here is readable by anyone who
 * can edit a workflow, which is what `{{ vars.X }}` means.
 */
export function VariablesPage() {
  const api = useApi()
  const [variables, setVariables] = useState<StoredVariable[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    try {
      setVariables(await api.listVariables())
      setError(null)
    } catch (cause) {
      setVariables([])
      setError(describeError(cause))
    }
  }, [api])

  useEffect(() => {
    void reload()
  }, [reload])

  const keyProblem = newKey === '' ? null : validateKey(newKey)

  const add = async () => {
    setBusy(true)
    try {
      await api.setVariable(newKey, parseValue(newValue))
      setNewKey('')
      setNewValue('')
      setError(null)
      await reload()
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      setBusy(false)
    }
  }

  const save = async (key: string, raw: string) => {
    try {
      await api.setVariable(key, parseValue(raw))
      setError(null)
      await reload()
    } catch (cause) {
      setError(describeError(cause))
    }
  }

  const remove = async (key: string) => {
    try {
      await api.deleteVariable(key)
      setError(null)
      await reload()
    } catch (cause) {
      setError(describeError(cause))
    }
  }

  return (
    <Stack p="lg" gap="md" maw={860}>
      <div>
        <Title order={4}>Variables</Title>
        <Text size="sm" c="dimmed">
          Values that differ between this instance and another. Read them in any field as{' '}
          <Code>{'{{ vars.NAME }}'}</Code>.
        </Text>
      </div>

      <Alert icon={<IconInfoCircle size={16} />} color="gray" variant="light">
        Anyone who can edit a workflow can read these. Put tokens and passwords in Credentials,
        which are encrypted.
      </Alert>

      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      <Group align="flex-start" gap="xs">
        <TextInput
          label="Name"
          placeholder="FHIR_BASE_URL"
          value={newKey}
          error={keyProblem}
          onChange={(event) => setNewKey(event.currentTarget.value)}
          style={{ flex: '0 0 240px' }}
        />
        <TextInput
          label="Value"
          placeholder="https://hims.example.org/api/fhir"
          value={newValue}
          onChange={(event) => setNewValue(event.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Button
          mt={25}
          leftSection={<IconPlus size={14} stroke={1.8} />}
          loading={busy}
          disabled={newKey === '' || keyProblem !== null}
          onClick={() => void add()}
        >
          Add
        </Button>
      </Group>

      {variables === null && <Loader size="sm" />}

      {variables?.length === 0 && (
        <Text size="sm" c="dimmed">
          Nothing set. A workflow that reads a variable it has not been given sees an empty value.
        </Text>
      )}

      {variables !== null && variables.length > 0 && (
        <Table verticalSpacing="xs" horizontalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 240 }}>Name</Table.Th>
              <Table.Th>Value</Table.Th>
              <Table.Th style={{ width: 44 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {variables.map((variable) => (
              <VariableRow key={variable.key} variable={variable} onSave={save} onRemove={remove} />
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}

function VariableRow({
  variable,
  onSave,
  onRemove,
}: {
  variable: StoredVariable
  onSave: (key: string, raw: string) => Promise<void>
  onRemove: (key: string) => Promise<void>
}) {
  const [draft, setDraft] = useState(showValue(variable.value))
  const edited = draft !== showValue(variable.value)

  return (
    <Table.Tr>
      <Table.Td>
        <Code>{variable.key}</Code>
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          value={draft}
          aria-label={`Value of ${variable.key}`}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => {
            if (edited) void onSave(variable.key, draft)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && edited) void onSave(variable.key, draft)
          }}
        />
      </Table.Td>
      <Table.Td>
        <Tooltip label="Delete">
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            aria-label={`Delete ${variable.key}`}
            onClick={() => void onRemove(variable.key)}
          >
            <IconTrash size={14} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  )
}
