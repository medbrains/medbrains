import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { BYPASS_ROLES, useHasPermission, usePermissionStore } from "@medbrains/stores";
import type { CreateSsoProviderRequest, SsoProvider } from "@medbrains/types";
import { P, ROLE_TEMPLATES } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import {
  Alert,
  Badge,
  Button,
  IconButton,
  Input,
  Modal,
  Select,
  Switch,
  Table,
} from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm";

const EMPTY: CreateSsoProviderRequest = {
  code: "",
  name: "",
  protocol: "oidc",
  group_claim: "groups",
  jit_enabled: true,
};

/** The OS's own Kanidm: set up by the OS and pinned by the server, so this page shows it read only. */
const OS_PROVIDER_CODE = "kanidm";

/** Every built-in role except those that bypass permission checks. */
const DEFAULT_ROLE_OPTIONS = Object.entries(ROLE_TEMPLATES)
  .filter(([code]) => code !== "super_admin" && code !== "hospital_admin")
  .map(([value, role]) => ({ value, label: role.label }));

export function SsoSettingsPage() {
  useRequirePermission([P.ADMIN.SETTINGS.GENERAL.MANAGE, P.ADMIN.SSO.PROVIDERS.MANAGE]);
  // Who can sign in, and as what, is an administrator's call: the server requires a bypass role as well.
  const hasPermission = useHasPermission(P.ADMIN.SSO.PROVIDERS.MANAGE);
  const isAdmin = usePermissionStore((s) => s.userRole !== null && BYPASS_ROLES.has(s.userRole));
  const canManage = isAdmin && hasPermission;
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
    onError: (err: Error) =>
      notifications.show({ title: "Could not create", message: err.message, color: "danger" }),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.updateSsoProvider(id, { is_active }),
    onSuccess: invalidate,
    onError: (err: Error) =>
      notifications.show({ title: "Provider not changed", message: err.message, color: "danger" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteSsoProvider(id),
    onSuccess: invalidate,
    onError: (err: Error) =>
      notifications.show({ title: "Provider not deleted", message: err.message, color: "danger" }),
  });

  // Capture the input value in the handler body — reading e.currentTarget inside
  // the setDraft updater crashes (React nulls currentTarget before the updater runs).
  const field = (key: keyof CreateSsoProviderRequest) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setDraft((d) => ({ ...d, [key]: value }) as CreateSsoProviderRequest);
  };

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
      render: (p) =>
        canManage ? (
          <Switch
            checked={p.is_active}
            disabled={p.code === OS_PROVIDER_CODE}
            onChange={(e) => toggleMut.mutate({ id: p.id, is_active: e.currentTarget.checked })}
            aria-label="Active"
          />
        ) : (
          <Badge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "On" : "Off"}</Badge>
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
          {p.code === OS_PROVIDER_CODE ? (
            <Badge tone="neutral">Set up by the OS</Badge>
          ) : (
            canManage && (
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
            )
          )}
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
          canManage ? (
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
          ) : undefined
        }
      />
      {!canManage && <Alert tone="info">Administrators manage sign-in providers.</Alert>}
      <DataTable columns={columns} data={providers} loading={isLoading} rowKey={(p) => p.id} />

      <Modal opened={formOpen} onClose={form.close} title="Add identity provider" fullScreen>
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
          <Input label="Display name" value={draft.name} onChange={field("name")} required />
          <Input
            label="Code"
            description="Stable slug used in the callback URL"
            value={draft.code}
            onChange={field("code")}
            required
          />
          {isOidc ? (
            <Input
              label="Discovery URL"
              placeholder="https://login.microsoftonline.com/<tenant>/v2.0/.well-known/openid-configuration"
              value={draft.discovery_url ?? ""}
              onChange={field("discovery_url")}
            />
          ) : (
            <Input
              label="Metadata URL"
              placeholder="https://idp.example.com/saml/metadata"
              value={draft.metadata_url ?? ""}
              onChange={field("metadata_url")}
            />
          )}
          <Input label="Client ID" value={draft.client_id ?? ""} onChange={field("client_id")} />
          <Input
            label="Client secret"
            type="password"
            description="Stored encrypted; leave blank to keep existing"
            value={draft.client_secret ?? ""}
            onChange={field("client_secret")}
          />
          <Input
            label="Group claim"
            value={draft.group_claim ?? "groups"}
            onChange={field("group_claim")}
          />
          <Select
            label="Default role for new sign-ins"
            description="Given when no directory group mapping matches. Blank gives Staff (dashboard only) until an administrator assigns a role. Administrator roles cannot be a default: map an admin group to them instead."
            data={DEFAULT_ROLE_OPTIONS}
            value={draft.default_role ?? null}
            onChange={(v) => setDraft((d) => ({ ...d, default_role: v ?? undefined }))}
            clearable
            searchable
          />
          <Switch
            label="Just-in-time provisioning"
            checked={draft.jit_enabled ?? true}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              setDraft((d) => ({ ...d, jit_enabled: checked }));
            }}
          />
          <Switch
            label="Link existing accounts by verified email"
            description="Only for a provider you trust to own its addresses. Never links an administrator's account. Otherwise link people in Users."
            checked={draft.link_by_email ?? false}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              setDraft((d) => ({ ...d, link_by_email: checked }));
            }}
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
      </Modal>

      <Modal
        opened={Boolean(mappingsFor)}
        onClose={() => setMappingsFor(null)}
        title={mappingsFor ? `Group mappings — ${mappingsFor.name}` : ""}
        fullScreen
      >
        {mappingsFor && <GroupMappings provider={mappingsFor} canManage={canManage} />}
      </Modal>
    </div>
  );
}

/**
 * A provider's directory-group mappings; adding or removing one is an administrator's alone (the role and the
 * provider-management permission). The server refuses a mapping to an administrator role, with the reason shown
 * here.
 */
function GroupMappings({ provider, canManage }: { provider: SsoProvider; canManage: boolean }) {
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
    onError: (err: Error) =>
      notifications.show({ title: "Mapping not added", message: err.message, color: "danger" }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => api.deleteSsoGroupMapping(id),
    onSuccess: invalidate,
    onError: (err: Error) =>
      notifications.show({ title: "Mapping not removed", message: err.message, color: "danger" }),
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
                {canManage && (
                  <IconButton
                    tone="danger"
                    aria-label="Delete mapping"
                    onClick={() => delMut.mutate(m.id)}
                  >
                    <IconTrash size={14} />
                  </IconButton>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {canManage && (
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
      )}
    </Stack>
  );
}
