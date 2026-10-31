import { useCallback, useEffect, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Menu,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'

import { describeError } from '../api'
import { useApi } from '../ApiProvider'
import type { CredentialSummary, CredentialTypeDescription } from '../types'
import { CredentialModal } from './CredentialModal'

/** Manage saved credentials outside of any particular workflow. */
export function CredentialsPage({
  credentialTypes,
}: {
  credentialTypes: readonly CredentialTypeDescription[]
}) {
  const api = useApi()
  const [credentials, setCredentials] = useState<CredentialSummary[] | null>(null)
  const [editing, setEditing] = useState<{ type: string; id?: string } | null>(null)

  const reload = useCallback(async () => {
    try {
      setCredentials(await api.listCredentials())
    } catch (cause) {
      setCredentials([])
      notifications.show({ color: 'red', message: describeError(cause) })
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const remove = async (credential: CredentialSummary) => {
    if (!confirm(`Delete "${credential.name}"? Nodes using it will stop working.`)) return
    try {
      await api.deleteCredential(credential.id)
      notifications.show({ message: `Deleted ${credential.name}` })
      void reload()
    } catch (cause) {
      notifications.show({ color: 'red', message: describeError(cause) })
    }
  }

  const displayNameOf = (typeName: string) =>
    credentialTypes.find((type) => type.name === typeName)?.displayName ?? typeName

  return (
    <Container size="md" py={40}>
      <Group justify="space-between" align="flex-end" mb="lg">
        <div>
          <Title order={2}>Credentials</Title>
          <Text c="dimmed" size="sm">
            Stored encrypted, and never sent back to the browser.
          </Text>
        </div>

        <Menu>
          <Menu.Target>
            <Button>New credential</Button>
          </Menu.Target>
          <Menu.Dropdown>
            {credentialTypes.map((type) => (
              <Menu.Item key={type.name} onClick={() => setEditing({ type: type.name })}>
                {type.displayName}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>

      {credentials === null && <Loader size="sm" />}

      {credentials?.length === 0 && (
        <Card withBorder padding="xl">
          <Text ta="center" c="dimmed">
            No credentials yet. Add one to use the Slack or GitHub nodes.
          </Text>
        </Card>
      )}

      <Stack gap="xs">
        {credentials?.map((credential) => (
          <Card withBorder padding="md" key={credential.id}>
            <Group wrap="nowrap">
              <div style={{ minWidth: 0 }}>
                <Text fw={600} truncate>
                  {credential.name}
                </Text>
                <Text size="xs" c="dimmed">
                  updated {new Date(credential.updatedAt).toLocaleString()}
                </Text>
              </div>
              <Group ml="auto" gap="xs" wrap="nowrap">
                <Badge variant="light">{displayNameOf(credential.type)}</Badge>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Edit ${credential.name}`}
                  onClick={() => setEditing({ type: credential.type, id: credential.id })}
                >
                  ✎
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Delete ${credential.name}`}
                  onClick={() => void remove(credential)}
                >
                  ✕
                </ActionIcon>
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>

      <CredentialModal
        opened={editing !== null}
        type={credentialTypes.find((type) => type.name === editing?.type)}
        credentialId={editing?.id}
        onClose={() => setEditing(null)}
        onSaved={() => void reload()}
      />
    </Container>
  )
}
