import { useEffect, useState } from 'react'
import {
  Alert,
  Anchor,
  Button,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'

import { describeError } from '../api'
import { useApi } from '../ApiProvider'
import { asText } from '../domain/parameters'
import type { CredentialTypeDescription, JsonValue, NodeProperty } from '../types'
import { REDACTED } from '../types'

/**
 * Create or edit one credential. The form is generated from the credential
 * type's declared properties, so a new integration needs no UI work.
 */
export function CredentialModal({
  opened,
  type,
  credentialId,
  onClose,
  onSaved,
}: {
  opened: boolean
  type: CredentialTypeDescription | undefined
  /** Editing an existing credential, or creating a new one when absent. */
  credentialId?: string
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const api = useApi()
  const [name, setName] = useState('')
  const [data, setData] = useState<Record<string, JsonValue>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!opened || !type) return
    setError(null)

    if (!credentialId) {
      setName(`${type.displayName} account`)
      setData(Object.fromEntries(type.properties.map((p) => [p.name, p.default])))
      return
    }

    api
      .getCredential(credentialId)
      .then((stored) => {
        setName(stored.name)
        setData({ ...stored.data })
      })
      .catch((cause: unknown) => setError(describeError(cause)))
  }, [opened, type, credentialId])

  const save = async () => {
    if (!type) return
    setSaving(true)
    setError(null)
    try {
      const saved = credentialId
        ? await api.updateCredential(credentialId, { name, data })
        : await api.createCredential({ name, type: type.name, data })
      onSaved(saved.id)
      onClose()
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={credentialId ? `Edit ${type?.displayName} credential` : `New ${type?.displayName} credential`}
      centered
    >
      <Stack gap="sm">
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <TextInput
          label="Name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          description="How this credential appears when picking it on a node"
        />

        {type?.properties.map((property) => (
          <CredentialField
            key={property.name}
            property={property}
            value={data[property.name] ?? property.default}
            onChange={(value) => setData((current) => ({ ...current, [property.name]: value }))}
          />
        ))}

        {type?.documentationUrl && (
          <Anchor href={type.documentationUrl} target="_blank" rel="noreferrer" size="xs">
            Where do I find this?
          </Anchor>
        )}

        <Text size="xs" c="dimmed">
          Stored encrypted. Secrets are never sent back to this page.
        </Text>

        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function CredentialField({
  property,
  value,
  onChange,
}: {
  property: NodeProperty
  value: JsonValue
  onChange: (value: JsonValue) => void
}) {
  const common = {
    label: property.displayName,
    description: property.description,
    withAsterisk: property.required,
    placeholder: property.placeholder,
  }

  if (property.password) {
    const unchanged = value === REDACTED
    return (
      <PasswordInput
        {...common}
        aria-label={property.displayName}
        // A saved secret shows as blank with a hint; typing replaces it, and
        // leaving it alone keeps whatever the server already has.
        value={unchanged ? '' : asText(value)}
        placeholder={unchanged ? 'unchanged — type to replace' : property.placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={(event) => {
          if (event.currentTarget.value === '') onChange(REDACTED)
        }}
      />
    )
  }

  return (
    <TextInput
      {...common}
      aria-label={property.displayName}
      value={asText(value)}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  )
}
