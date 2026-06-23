import { Group, Stack, Table, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { CreateSsoProviderRequest, SsoProvider } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, Drawer, IconButton, Input, Select, Switch } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm";

const EMPTY: CreateSsoProviderRequest = {
  code: "",
  name: "",
  protocol: "oidc",
  group_claim: "groups",
  jit_enabled: true,
};

export function SsoSettingsPage() {
  useRequirePermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const qc = useQueryClient();
  const [formOpen, form] = useDisclosure(false);
  const [draft, setDraft] = useState<CreateSsoProviderRequest>(EMPTY);
  const [mappingsFor, setMappingsFor] = useState<SsoProvider | null>(null);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["sso-providers"],
    queryFn: () => api.listSsoProviders(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sso-providers"] });

  const createMut = useMutation({
    mutationFn: (d: CreateSsoProviderRequest) => api.createSsoProvider(d),
    onSuccess: () => {
      invalidate();
      form.close();
      notifications.show({
        title: "Created",
        message: "Identity provider added",
        color: "success",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Could not create", color: "danger" }),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.updateSsoProvider(id, { is_active }),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteSsoProvider(id),
    onSuccess: invalidate,
  });

  const columns: Column<SsoProvider>[] = [
    { key: "name", label: "Provider", render: (p) => <Text fw={500}>{p.name}</Text> },
    {
      key: "protocol",
      label: "Protocol",
      render: (p) => <Badge tone="neutral">{p.protocol.toUpperCase()}</Badge>,
    },
    { key: "code", label: "Code", render: (p) => <Text size="sm">{p.code}</Text> },
    {
      key: "jit",
      label: "JIT",
      render: (p) => (
        <Badge tone={p.jit_enabled ? "success" : "neutral"}>{p.jit_enabled ? "On" : "Off"}</Badge>
      ),
    },
    {
      key: "active",
      label: "Active",
      render: (p) => (
        <Switch
          checked={p.is_active}
          onChange={(e) => toggleMut.mutate({ id: p.id, is_active: e.currentTarget.checked })}
          aria-label="Active"
        />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (p) => (
        <Group gap={4}>
          <Button tone="ghost" size="xs" onClick={() => setMappingsFor(p)}>
            Group mappings
          </Button>
          <IconButton
            tone="danger"
            aria-label="Delete provider"
            onClick={() =>
              confirmDestructive({
                title: "Delete provider",
                message: `Delete "${p.name}"? Users will no longer be able to sign in through it.`,
                onConfirm: () => deleteMut.mutate(p.id),
              })
            }
          >
            <IconTrash size={14} />
          </IconButton>
        </Group>
      ),
    },
  ];

  const isOidc = draft.protocol === "oidc";

  return (
    <div>
      <PageHeader
        title="Single Sign-On"
        subtitle="Federate login to a corporate identity provider and map AD groups to roles & access groups"
        actions={
          <Button
            tone="primary"
            leftSection={<IconPlus size={15} />}
            onClick={() => {
              setDraft(EMPTY);
              form.open();
            }}
          >
            Add provider
          </Button>
        }
      />
      <DataTable columns={columns} data={providers} loading={isLoading} rowKey={(p) => p.id} />

      <Drawer
        opened={formOpen}
        onClose={form.close}
        title="Add identity provider"
        position="right"
        size="lg"
      >
        <Stack gap="sm">
          <Select
            label="Protocol"
            value={draft.protocol}
            onChange={(v) =>
              setDraft((d) => ({ ...d, protocol: (v ?? "oidc") as "oidc" | "saml" }))
            }
            data={[
              { value: "oidc", label: "OpenID Connect (OIDC)" },
              { value: "saml", label: "SAML 2.0" },
            ]}
          />
          <Input
            label="Display name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.currentTarget.value }))}
            required
          />
          <Input
            label="Code"
            description="Stable slug used in the callback URL"
            value={draft.code}
            onChange={(e) => setDraft((d) => ({ ...d, code: e.currentTarget.value }))}
            required
          />
          {isOidc ? (
            <Input
              label="Discovery URL"
              placeholder="https://login.microsoftonline.com/<tenant>/v2.0/.well-known/openid-configuration"
              value={draft.discovery_url ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, discovery_url: e.currentTarget.value }))}
            />
          ) : (
            <Input
              label="Metadata URL"
              placeholder="https://idp.example.com/saml/metadata"
              value={draft.metadata_url ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, metadata_url: e.currentTarget.value }))}
            />
          )}
          <Input
            label="Client ID"
            value={draft.client_id ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, client_id: e.currentTarget.value }))}
          />
          <Input
            label="Client secret"
            type="password"
            description="Stored encrypted; leave blank to keep existing"
            value={draft.client_secret ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, client_secret: e.currentTarget.value }))}
          />
          <Input
            label="Group claim"
            value={draft.group_claim ?? "groups"}
            onChange={(e) => setDraft((d) => ({ ...d, group_claim: e.currentTarget.value }))}
          />
          <Input
            label="Default role"
            description="Assigned when no group mapping matches (blank = no access)"
            value={draft.default_role ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, default_role: e.currentTarget.value }))}
          />
          <Switch
            label="Just-in-time provisioning"
            checked={draft.jit_enabled ?? true}
            onChange={(e) => setDraft((d) => ({ ...d, jit_enabled: e.currentTarget.checked }))}
          />
          <Group justify="flex-end">
            <Button tone="secondary" onClick={form.close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={createMut.isPending}
              disabled={!draft.name.trim() || !draft.code.trim()}
              onClick={() => createMut.mutate(draft)}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Drawer>

      <Drawer
        opened={Boolean(mappingsFor)}
        onClose={() => setMappingsFor(null)}
        title={mappingsFor ? `Group mappings — ${mappingsFor.name}` : ""}
        position="right"
        size="lg"
      >
        {mappingsFor && <GroupMappings provider={mappingsFor} />}
      </Drawer>
    </div>
  );
}

function GroupMappings({ provider }: { provider: SsoProvider }) {
  const qc = useQueryClient();
  const [idpGroup, setIdpGroup] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [accessGroupId, setAccessGroupId] = useState<string | null>(null);

  const { data: mappings = [] } = useQuery({
    queryKey: ["sso-mappings", provider.id],
    queryFn: () => api.listSsoGroupMappings(provider.id),
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["access-groups"],
    queryFn: () => api.listAccessGroups(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sso-mappings", provider.id] });
  const addMut = useMutation({
    mutationFn: () =>
      api.createSsoGroupMapping(provider.id, {
        idp_group: idpGroup,
        role_code: roleCode.trim() || undefined,
        access_group_id: accessGroupId ?? undefined,
      }),
    onSuccess: () => {
      invalidate();
      setIdpGroup("");
      setRoleCode("");
      setAccessGroupId(null);
    },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => api.deleteSsoGroupMapping(id),
    onSuccess: invalidate,
  });

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Map an AD / IdP group to a MedBrains role and/or access group. On login, a user's groups are
        matched here and their access is synced.
      </Text>
      <Table withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>IdP group</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Access group</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {mappings.map((m) => (
            <Table.Tr key={m.id}>
              <Table.Td>{m.idp_group}</Table.Td>
              <Table.Td>{m.role_code ?? "—"}</Table.Td>
              <Table.Td>{groups.find((g) => g.id === m.access_group_id)?.name ?? "—"}</Table.Td>
              <Table.Td>
                <IconButton
                  tone="danger"
                  aria-label="Delete mapping"
                  onClick={() => delMut.mutate(m.id)}
                >
                  <IconTrash size={14} />
                </IconButton>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Stack gap="xs">
        <Input
          label="IdP group"
          value={idpGroup}
          onChange={(e) => setIdpGroup(e.currentTarget.value)}
        />
        <Input
          label="Role code"
          placeholder="e.g. doctor (optional)"
          value={roleCode}
          onChange={(e) => setRoleCode(e.currentTarget.value)}
        />
        <Select
          label="Access group"
          placeholder="(optional)"
          clearable
          value={accessGroupId}
          onChange={setAccessGroupId}
          data={groups.map((g) => ({ value: g.id, label: g.name }))}
        />
        <Group justify="flex-end">
          <Button
            tone="primary"
            loading={addMut.isPending}
            disabled={!idpGroup.trim() || (!roleCode.trim() && !accessGroupId)}
            onClick={() => addMut.mutate()}
          >
            Add mapping
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}
