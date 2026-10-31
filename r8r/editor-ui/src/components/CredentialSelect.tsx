import { useCallback, useEffect, useState } from 'react'
import { ActionIcon, Group, Select, Stack, Text, Tooltip } from '@mantine/core'

import { describeError } from '../api'
import { useApi } from '../ApiProvider'
import type { CredentialRequirement, CredentialSummary, CredentialTypeDescription } from '../types'
import { CredentialModal } from './CredentialModal'

/**
 * Picks the credential a node authenticates with. Only credentials of the
 * type the node declares are offered, so a GitHub token can never be selected
 * for a Slack node.
 */
export function CredentialSelect({
  requirement,
  credentialTypes,
  selectedId,
  onSelect,
}: {
  requirement: CredentialRequirement
  credentialTypes: readonly CredentialTypeDescription[]
  selectedId: string | undefined
  onSelect: (id: string | undefined) => void
}) {
  const api = useApi()
  const [available, setAvailable] = useState<CredentialSummary[]>([])
  const [editing, setEditing] = useState<'new' | 'existing' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const type = credentialTypes.find((candidate) => candidate.name === requirement.name)

  const reload = useCallback(async () => {
    try {
      const all = await api.listCredentials()
      setAvailable(all.filter((credential) => credential.type === requirement.name))
      setError(null)
    } catch (cause) {
      setError(describeError(cause))
    }
  }, [requirement.name])

  useEffect(() => {
    void reload()
  }, [reload])

  const label = type?.displayName ?? requirement.name

  return (
    <Stack gap={6}>
      <Group gap={6} align="flex-end" wrap="nowrap">
        <Select
          style={{ flex: 1 }}
          label={`${label} credential`}
          withAsterisk={requirement.required}
          placeholder={available.length === 0 ? 'None saved yet' : 'Select…'}
          data={available.map((credential) => ({
            value: credential.id,
            label: credential.name,
          }))}
          value={selectedId ?? null}
          onChange={(value) => onSelect(value ?? undefined)}
          nothingFoundMessage="Create one with +"
        />
        {selectedId && (
          <Tooltip label="Edit this credential">
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Edit credential"
              onClick={() => setEditing('existing')}
            >
              ✎
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label={`New ${label} credential`}>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="New credential"
            onClick={() => setEditing('new')}
          >
            +
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && (
        <Text size="xs" c="red.5">
          {error}
        </Text>
      )}

      <CredentialModal
        opened={editing !== null}
        type={type}
        credentialId={editing === 'existing' ? selectedId : undefined}
        onClose={() => setEditing(null)}
        onSaved={(id) => {
          onSelect(id)
          void reload()
        }}
      />
    </Stack>
  )
}
