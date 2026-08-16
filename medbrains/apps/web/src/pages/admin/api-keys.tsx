/**
 * Machine credentials.
 *
 * The list answers the two questions somebody actually comes here with: which
 * of these is still being used, and who is responsible for it. Both are
 * columns rather than something you open a row to find, because the reason to
 * visit this page is usually "what can we safely turn off".
 */

import { Group, Menu, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { ApiKeySummary, ApiKeyUsageRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconBan, IconDots, IconHistory, IconKey, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { Badge, Button, Drawer, IconButton, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm";
import { IssueApiKeyDrawer } from "./IssueApiKeyDrawer";

/** Never a bare date — "unused" and "used an hour ago" are different decisions. */
function relative(value: string | null): string {
  if (!value) return "never";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function statusOf(key: ApiKeySummary): {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
} {
  if (key.revoked_at) return { label: "Revoked", tone: "danger" };
  if (new Date(key.expires_at) < new Date()) return { label: "Expired", tone: "neutral" };
  // Surfaced as its own state: a key nobody has called is either not yet
  // deployed or forgotten, and both are worth noticing before it expires
  // quietly a year from now.
  if (!key.last_used_at) return { label: "Never used", tone: "warning" };
  return { label: "Active", tone: "success" };
}

export function ApiKeysPage() {
  useRequirePermission(P.ADMIN.API_KEYS.LIST);
  const canCreate = useHasPermission(P.ADMIN.API_KEYS.CREATE);
  const canRevoke = useHasPermission(P.ADMIN.API_KEYS.REVOKE);
  const canViewUsage = useHasPermission(P.ADMIN.API_KEYS.VIEW_USAGE);

  const queryClient = useQueryClient();
  const [issueOpened, issueHandlers] = useDisclosure(false);
  const [usageFor, setUsageFor] = useState<ApiKeySummary | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.listApiKeys(),
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ["api-key-usage", usageFor?.id],
    queryFn: () => api.getApiKeyUsage(usageFor?.id ?? ""),
    enabled: usageFor !== null && canViewUsage,
  });

  const revoke = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.revokeApiKey(id, reason),
    onSuccess: () => {
      notifications.show({ title: "Key revoked", message: "It stops working immediately." });
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (error: Error) =>
      notifications.show({ color: "red", title: "Could not revoke", message: error.message }),
  });

  const onRevoke = (key: ApiKeySummary) =>
    confirmDestructive({
      title: `Revoke “${key.name}”?`,
      message:
        "Anything using this key stops working at once, and it cannot be un-revoked. Issue a new key first if the integration must keep running.",
      confirmLabel: "Revoke key",
      onConfirm: () => revoke.mutate({ id: key.id, reason: "Revoked from the admin console" }),
    });

  return (
    <Stack gap={0}>
      <PageHeader
        title="API keys"
        subtitle="Machine credentials. Each carries an explicit permission list, never a role."
      />

      {canCreate && (
        <Group justify="flex-end" mb="md">
          <Button tone="primary" leftSection={<IconPlus size={14} />} onClick={issueHandlers.open}>
            Issue key
          </Button>
        </Group>
      )}

      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Prefix</Table.Th>
            <Table.Th>Permissions</Table.Th>
            <Table.Th>Issued by</Table.Th>
            <Table.Th>Last used</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th w={80}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading && (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text c="dimmed" size="sm" ta="center">
                  Loading…
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
          {!isLoading && (keys ?? []).length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Stack align="center" gap="xs" py="lg">
                  <IconKey size={20} />
                  <Text c="dimmed" size="sm">
                    No API keys yet. Integrations currently have to borrow a person&rsquo;s login.
                  </Text>
                </Stack>
              </Table.Td>
            </Table.Tr>
          )}
          {(keys ?? []).map((key: ApiKeySummary) => {
            const status = statusOf(key);
            const permissions = Array.isArray(key.permissions) ? key.permissions : [];
            return (
              <Table.Tr key={key.id}>
                <Table.Td>
                  <Stack gap={0}>
                    <Text size="sm">{key.name}</Text>
                    {key.description && (
                      <Text size="xs" c="dimmed">
                        {key.description}
                      </Text>
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ff="var(--mb-font-mono)">
                    {key.key_prefix}…
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge tone="neutral">{permissions.length}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{key.created_by_name ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{relative(key.last_used_at)}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </Table.Td>
                <Table.Td>
                  <Menu position="bottom-end">
                    <Menu.Target>
                      <IconButton aria-label={`Actions for ${key.name}`} tone="default">
                        <IconDots size={16} />
                      </IconButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {canViewUsage && (
                        <Menu.Item
                          leftSection={<IconHistory size={14} />}
                          onClick={() => setUsageFor(key)}
                        >
                          View usage
                        </Menu.Item>
                      )}
                      {canRevoke && !key.revoked_at && (
                        <Menu.Item
                          color="red"
                          leftSection={<IconBan size={14} />}
                          onClick={() => onRevoke(key)}
                        >
                          Revoke
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      {canCreate && <IssueApiKeyDrawer opened={issueOpened} onClose={issueHandlers.close} />}

      <Drawer
        opened={usageFor !== null}
        onClose={() => setUsageFor(null)}
        position="right"
        size="lg"
        title={usageFor ? `Usage — ${usageFor.name}` : "Usage"}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            The 500 most recent requests. This is what answers &ldquo;what did it touch&rdquo; after
            a key leaks — the status column matters as much as the path.
          </Text>
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>When</Table.Th>
                <Table.Th>Method</Table.Th>
                <Table.Th>Path</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {usageLoading && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text c="dimmed" size="sm" ta="center">
                      Loading…
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {!usageLoading && (usage ?? []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text c="dimmed" size="sm" ta="center">
                      This key has not been used.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {(usage ?? []).map((row: ApiKeyUsageRow) => (
                <Table.Tr key={`${row.occurred_at}-${row.path}-${row.method}`}>
                  <Table.Td>
                    <Text size="xs" ff="var(--mb-font-mono)">
                      {new Date(row.occurred_at).toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="var(--mb-font-mono)">
                      {row.method}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="var(--mb-font-mono)">
                      {row.path}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge tone={row.status_code >= 400 ? "danger" : "success"}>
                      {row.status_code}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Drawer>
    </Stack>
  );
}
