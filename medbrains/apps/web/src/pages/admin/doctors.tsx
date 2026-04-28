/**
 * Admin: list + create doctor profiles, manage signature credentials.
 */
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { IconKey, IconPlus, IconShieldCheck, IconUserCog } from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useRequirePermission } from "../../hooks/useRequirePermission";

export function AdminDoctorsPage() {
  useRequirePermission("admin.doctors.list");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, createHandlers] = useDisclosure(false);
  const [credModalDoctor, setCredModalDoctor] = useState<string | null>(null);

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ["admin-doctors", search],
    queryFn: () => api.adminListDoctors({ search: search || undefined, limit: 200 }),
  });

  const create = useMutation({
    mutationFn: (data: { user_id: string; display_name: string; mci_number?: string }) =>
      api.adminCreateDoctor(data),
    onSuccess: () => {
      notifications.show({ title: "Doctor created", message: "Profile saved.", color: "success" });
      void queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
      createHandlers.close();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Create failed", message: err.message, color: "danger" }),
  });

  return (
    <div>
      <PageHeader
        title="Doctors"
        subtitle="Profiles, credentials, signature management"
        icon={<IconUserCog size={20} stroke={1.5} />}
        actions={
          <Group gap="xs">
            <TextInput
              size="xs"
              placeholder="Search name or MCI…"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ minWidth: 240 }}
            />
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={createHandlers.open}>
              Add doctor
            </Button>
          </Group>
        }
      />

      <Card padding={0} withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Doctor</Table.Th>
              <Table.Th>Qualification</Table.Th>
              <Table.Th>MCI / Council</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Capabilities</Table.Th>
              <Table.Th w={60} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {doctors.map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td>
                  <Text fw={500} size="sm">
                    {d.prefix ? `${d.prefix} ` : ""}{d.display_name}
                  </Text>
                  {!d.is_active && (
                    <Badge size="xs" color="red">Inactive</Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{d.qualification_string ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{d.mci_number ?? d.state_council_number ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {d.is_visiting ? (
                      <Badge size="xs" color="warning">Visiting</Badge>
                    ) : (
                      <Badge size="xs" color="primary">Full-time</Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {d.can_prescribe_schedule_x && <Badge size="xs">Sched X</Badge>}
                    {d.can_perform_surgery && <Badge size="xs">Surgery</Badge>}
                    {d.can_sign_mlc && <Badge size="xs" color="red">MLC</Badge>}
                    {d.can_sign_death_certificate && <Badge size="xs" color="red">Death</Badge>}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Tooltip label="Manage signature credentials">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => setCredModalDoctor(d.user_id)}
                    >
                      <IconKey size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && doctors.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed" ta="center" py="xl">
                    No doctors found.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <CreateDoctorModal
        opened={createOpen}
        onClose={createHandlers.close}
        onSubmit={(data) => create.mutate(data)}
        submitting={create.isPending}
      />

      {credModalDoctor && (
        <CredentialsModal
          doctorUserId={credModalDoctor}
          onClose={() => setCredModalDoctor(null)}
        />
      )}
    </div>
  );
}

function CreateDoctorModal({
  opened,
  onClose,
  onSubmit,
  submitting,
}: {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: { user_id: string; display_name: string; mci_number?: string }) => void;
  submitting: boolean;
}) {
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mciNumber, setMciNumber] = useState("");

  return (
    <Modal opened={opened} onClose={onClose} title="Add doctor" size="md">
      <Stack gap="sm">
        <TextInput
          label="User ID"
          placeholder="UUID of the linked user account"
          value={userId}
          onChange={(e) => setUserId(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Display name"
          placeholder="Dr. Sharma"
          value={displayName}
          onChange={(e) => setDisplayName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="MCI number"
          value={mciNumber}
          onChange={(e) => setMciNumber(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button
            loading={submitting}
            disabled={!userId || !displayName}
            onClick={() =>
              onSubmit({
                user_id: userId,
                display_name: displayName,
                mci_number: mciNumber || undefined,
              })
            }
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function CredentialsModal({
  doctorUserId,
  onClose,
}: {
  doctorUserId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  const { data: creds = [] } = useQuery({
    queryKey: ["sig-credentials", doctorUserId, includeRevoked],
    queryFn: () =>
      api.adminListSignatureCredentials({
        doctor_user_id: doctorUserId,
        include_revoked: includeRevoked,
      }),
  });

  const issue = useMutation({
    mutationFn: () =>
      api.adminIssueSignatureCredential({
        doctor_user_id: doctorUserId,
        display_image_url: imageUrl || null,
        make_default: true,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Credential issued",
        message: "Ed25519 keypair generated and set as default.",
        color: "success",
      });
      setImageUrl("");
      void queryClient.invalidateQueries({ queryKey: ["sig-credentials"] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Issue failed", message: err.message, color: "danger" }),
  });

  const revoke = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.adminRevokeSignatureCredential(id, { reason }),
    onSuccess: () => {
      notifications.show({ title: "Revoked", message: "Credential revoked.", color: "success" });
      void queryClient.invalidateQueries({ queryKey: ["sig-credentials"] });
    },
  });

  return (
    <Modal opened onClose={onClose} title="Signature credentials" size="lg">
      <Stack gap="md">
        <Card withBorder padding="sm">
          <Text size="sm" fw={600} mb="xs">Issue new credential</Text>
          <TextInput
            size="sm"
            label="Display image URL (visual signature stamped on PDFs)"
            placeholder="https://… signature.png"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.currentTarget.value)}
          />
          <Group justify="flex-end" mt="xs">
            <Button
              size="xs"
              loading={issue.isPending}
              leftSection={<IconShieldCheck size={14} />}
              onClick={() => issue.mutate()}
            >
              Generate Ed25519 keypair
            </Button>
          </Group>
        </Card>

        <Divider />

        <Group justify="space-between">
          <Text size="sm" fw={600}>Existing credentials ({creds.length})</Text>
          <Switch
            size="xs"
            label="Include revoked"
            checked={includeRevoked}
            onChange={(e) => setIncludeRevoked(e.currentTarget.checked)}
          />
        </Group>

        <Stack gap="xs">
          {creds.map((c) => (
            <Card key={c.id} withBorder padding="sm">
              <Group justify="space-between">
                <Stack gap={4}>
                  <Group gap="xs">
                    <Badge size="xs">{c.credential_type}</Badge>
                    {c.is_default && <Badge size="xs" color="primary">Default</Badge>}
                    {c.revoked_at && <Badge size="xs" color="red">Revoked</Badge>}
                    {c.algorithm && <Badge size="xs" variant="outline">{c.algorithm}</Badge>}
                  </Group>
                  <Text size="xs" c="dimmed">
                    Issued {new Date(c.created_at).toLocaleString()}
                    {c.revoked_at &&
                      ` · revoked ${new Date(c.revoked_at).toLocaleString()}: ${c.revoked_reason ?? "—"}`}
                  </Text>
                </Stack>
                {!c.revoked_at && (
                  <Button
                    size="xs"
                    color="red"
                    variant="subtle"
                    onClick={() => {
                      const reason = window.prompt("Reason for revocation?");
                      if (reason) revoke.mutate({ id: c.id, reason });
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </Group>
            </Card>
          ))}
          {creds.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No credentials yet. Issue one above.
            </Text>
          )}
        </Stack>
      </Stack>
    </Modal>
  );
}
