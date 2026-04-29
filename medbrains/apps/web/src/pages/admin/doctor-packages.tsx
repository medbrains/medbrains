/**
 * Admin: doctor packages list + create + inclusion management.
 * Sub-Sprint B of SPRINT-doctor-activities.md.
 */
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { CreateInclusionRequest } from "@medbrains/types";
import { IconList, IconPackage, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useRequirePermission } from "../../hooks/useRequirePermission";

export function AdminDoctorPackagesPage() {
  useRequirePermission("admin.doctor_packages.list");
  const queryClient = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [editPackageId, setEditPackageId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: packages = [] } = useQuery({
    queryKey: ["admin-doctor-packages", showInactive],
    queryFn: () =>
      api.adminListDoctorPackages({ is_active: showInactive ? undefined : true }),
  });

  const create = useMutation({
    mutationFn: (data: { code: string; name: string; total_price: string; validity_days: number }) =>
      api.adminCreateDoctorPackage({
        code: data.code,
        name: data.name,
        total_price: data.total_price,
        validity_days: data.validity_days,
      }),
    onSuccess: () => {
      notifications.show({ title: "Package created", message: "Add inclusions next.", color: "success" });
      void queryClient.invalidateQueries({ queryKey: ["admin-doctor-packages"] });
      createHandlers.close();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Create failed", message: err.message, color: "danger" }),
  });

  return (
    <div>
      <PageHeader
        title="Doctor packages"
        subtitle="Bundle pricing — chronic care plans, follow-up bundles"
        icon={<IconPackage size={20} stroke={1.5} />}
        actions={
          <Group gap="xs">
            <Switch
              size="xs"
              label="Show inactive"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.currentTarget.checked)}
            />
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={createHandlers.open}>
              New package
            </Button>
          </Group>
        }
      />

      <Card padding={0} withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Code</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Price</Table.Th>
              <Table.Th>Validity</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th w={60} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {packages.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td>
                  <Text size="sm" fw={500} ff="monospace">{p.code}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{p.name}</Text>
                  {p.description && (
                    <Text size="xs" c="dimmed" lineClamp={1}>{p.description}</Text>
                  )}
                </Table.Td>
                <Table.Td><Text size="sm">₹{p.total_price}</Text></Table.Td>
                <Table.Td><Text size="sm">{p.validity_days}d</Text></Table.Td>
                <Table.Td>
                  <Badge size="sm" color={p.is_active ? "primary" : "gray"}>
                    {p.is_active ? "Active" : "Inactive"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Tooltip label="Manage inclusions">
                    <ActionIcon variant="subtle" onClick={() => setEditPackageId(p.id)}>
                      <IconList size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {packages.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed" ta="center" py="xl">
                    No packages yet.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <CreatePackageDrawer
        opened={createOpen}
        onClose={createHandlers.close}
        onSubmit={create.mutate}
        submitting={create.isPending}
      />

      {editPackageId && (
        <InclusionsDrawer
          packageId={editPackageId}
          onClose={() => setEditPackageId(null)}
        />
      )}
    </div>
  );
}

function CreatePackageDrawer({
  opened,
  onClose,
  onSubmit,
  submitting,
}: {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: { code: string; name: string; total_price: string; validity_days: number }) => void;
  submitting: boolean;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | string>("");
  const [validityDays, setValidityDays] = useState<number | string>(365);

  return (
    <Drawer opened={opened} onClose={onClose} title="New doctor package" position="right" size="md">
      <Stack gap="sm">
        <TextInput label="Code" value={code} onChange={(e) => setCode(e.currentTarget.value)} required />
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
        <NumberInput
          label="Total price (₹)"
          value={price}
          onChange={(v) => setPrice(v)}
          min={0}
          required
        />
        <NumberInput
          label="Validity (days)"
          value={validityDays}
          onChange={(v) => setValidityDays(v)}
          min={1}
          max={365 * 5}
          required
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button
            loading={submitting}
            disabled={!code || !name || price === ""}
            onClick={() =>
              onSubmit({
                code,
                name,
                total_price: String(price),
                validity_days: Number(validityDays),
              })
            }
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

function InclusionsDrawer({ packageId, onClose }: { packageId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<string | null>("consultation");
  const [quantity, setQuantity] = useState<number | string>(1);
  const [notes, setNotes] = useState("");

  const { data: detail } = useQuery({
    queryKey: ["admin-doctor-package-detail", packageId],
    queryFn: () => api.adminGetDoctorPackage(packageId),
  });

  const add = useMutation({
    mutationFn: (data: CreateInclusionRequest) => api.adminAddInclusion(packageId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-doctor-package-detail", packageId] });
      setType("consultation");
      setQuantity(1);
      setNotes("");
    },
  });

  const remove = useMutation({
    mutationFn: (inclusionId: string) => api.adminRemoveInclusion(packageId, inclusionId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["admin-doctor-package-detail", packageId] }),
  });

  return (
    <Drawer
      opened
      onClose={onClose}
      title={detail ? `${detail.name} — inclusions` : "Inclusions"}
      position="right"
      size="lg"
    >
      <Stack gap="md">
        <Card padding="sm" withBorder>
          <Text size="sm" fw={600} mb="xs">Add inclusion</Text>
          <Stack gap="xs">
            <Select
              size="sm"
              label="Type"
              data={[
                { value: "consultation", label: "Consultation" },
                { value: "lab", label: "Lab test" },
                { value: "procedure", label: "Procedure" },
                { value: "service", label: "Service" },
              ]}
              value={type}
              onChange={setType}
            />
            <NumberInput
              size="sm"
              label="Included quantity"
              value={quantity}
              onChange={(v) => setQuantity(v)}
              min={1}
            />
            <Textarea
              size="sm"
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              autosize
              minRows={1}
              maxRows={3}
            />
            <Group justify="flex-end">
              <Button
                size="xs"
                loading={add.isPending}
                onClick={() =>
                  add.mutate({
                    inclusion_type: type as "consultation" | "lab" | "procedure" | "service",
                    included_quantity: Number(quantity),
                    notes: notes || null,
                  })
                }
              >
                Add
              </Button>
            </Group>
          </Stack>
        </Card>

        <Stack gap="xs">
          {detail?.inclusions.map((inc) => (
            <Card key={inc.id} padding="sm" withBorder>
              <Group justify="space-between">
                <Stack gap={2}>
                  <Group gap="xs">
                    <Badge size="xs">{inc.inclusion_type}</Badge>
                    <Text size="sm" fw={500}>× {inc.included_quantity}</Text>
                  </Group>
                  {inc.notes && <Text size="xs" c="dimmed">{inc.notes}</Text>}
                </Stack>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => remove.mutate(inc.id)}
                  loading={remove.isPending}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Card>
          ))}
          {detail && detail.inclusions.length === 0 && (
            <Text size="sm" c="dimmed" ta="center">
              No inclusions yet. Add at least one.
            </Text>
          )}
        </Stack>
      </Stack>
    </Drawer>
  );
}
