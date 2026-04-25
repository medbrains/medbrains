import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconHeart,
  IconBriefcase,
  IconUsers,
  IconShieldCheck,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import type { MasterItem, InsuranceProvider } from "@medbrains/types";

// ── Generic Master Item Modal ──────────────────────────────

type MasterFormState = {
  code: string;
  name: string;
  sort_order: number;
};

const EMPTY_MASTER_FORM: MasterFormState = {
  code: "",
  name: "",
  sort_order: 0,
};

function MasterItemModal({
  opened,
  onClose,
  editingItem,
  masterType,
  createFn,
  updateFn,
  queryKey,
}: {
  opened: boolean;
  onClose: () => void;
  editingItem: MasterItem | null;
  masterType: string;
  createFn: (data: { code: string; name: string; sort_order?: number }) => Promise<MasterItem>;
  updateFn: (id: string, data: { code?: string; name?: string; sort_order?: number; is_active?: boolean }) => Promise<MasterItem>;
  queryKey: string;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingItem;
  const [form, setForm] = useState<MasterFormState>(EMPTY_MASTER_FORM);

  const handleOpen = () => {
    if (editingItem) {
      setForm({
        code: editingItem.code,
        name: editingItem.name,
        sort_order: editingItem.sort_order,
      });
    } else {
      setForm(EMPTY_MASTER_FORM);
    }
  };

  const updateField = <K extends keyof MasterFormState>(
    key: K,
    value: MasterFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const createMutation = useMutation({
    mutationFn: (data: { code: string; name: string; sort_order?: number }) =>
      createFn(data),
    onSuccess: () => {
      notifications.show({
        title: `${masterType} created`,
        message: `New ${masterType.toLowerCase()} has been added.`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: [queryKey] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Create failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { code?: string; name?: string; sort_order?: number }) =>
      updateFn(editingItem!.id, data),
    onSuccess: () => {
      notifications.show({
        title: `${masterType} updated`,
        message: `${masterType} has been updated.`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: [queryKey] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleSubmit = () => {
    if (!form.code.trim() || !form.name.trim()) {
      notifications.show({
        title: "Validation error",
        message: "Code and Name are required.",
        color: "danger",
      });
      return;
    }

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      sort_order: form.sort_order,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? `Edit ${masterType}` : `Add ${masterType}`}
      size="sm"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="e.g. HIN"
          value={form.code}
          onChange={(e) => updateField("code", e.currentTarget.value)}
          required
        />
        <TextInput
          label="Name"
          placeholder={`e.g. ${masterType} name`}
          value={form.name}
          onChange={(e) => updateField("name", e.currentTarget.value)}
          required
        />
        <NumberInput
          label="Sort Order"
          value={form.sort_order}
          onChange={(value) =>
            updateField("sort_order", typeof value === "number" ? value : 0)
          }
          min={0}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Generic Master Table ───────────────────────────────────

function MasterTable({
  queryKey,
  listFn,
  createFn,
  updateFn,
  deleteFn,
  masterType,
}: {
  queryKey: string;
  listFn: () => Promise<MasterItem[]>;
  createFn: (data: { code: string; name: string; sort_order?: number }) => Promise<MasterItem>;
  updateFn: (id: string, data: { code?: string; name?: string; sort_order?: number; is_active?: boolean }) => Promise<MasterItem>;
  deleteFn: (id: string) => Promise<{ status: string }>;
  masterType: string;
}) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.ADMIN.SETTINGS.CLINICAL_MASTERS.CREATE);
  const canUpdate = useHasPermission(P.ADMIN.SETTINGS.CLINICAL_MASTERS.UPDATE);
  const canDelete = useHasPermission(P.ADMIN.SETTINGS.CLINICAL_MASTERS.DELETE);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MasterItem | null>(null);

  const { data: items, isLoading, isError, error } = useQuery({
    queryKey: [queryKey],
    queryFn: listFn,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn(id),
    onSuccess: () => {
      notifications.show({
        title: `${masterType} deleted`,
        message: `${masterType} has been removed.`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: [queryKey] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const openCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEdit = (item: MasterItem) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading {masterType.toLowerCase()}s...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text fw={600}>{masterType}s</Text>
        {canCreate && (
          <Button
            size="sm"
            leftSection={<IconPlus size={14} />}
            onClick={openCreate}
          >
            Add {masterType}
          </Button>
        )}
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Order</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Source</Table.Th>
            {(canUpdate || canDelete) && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items && items.length > 0 ? (
            items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {item.code}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{item.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{item.sort_order}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={item.is_active ? "success" : "danger"}
                    variant="light"
                    size="sm"
                  >
                    {item.is_active ? "Active" : "Inactive"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={item.tenant_id ? "primary" : "slate"}
                    variant="light"
                    size="sm"
                  >
                    {item.tenant_id ? "Custom" : "Global"}
                  </Badge>
                </Table.Td>
                {(canUpdate || canDelete) && (
                  <Table.Td>
                    {item.tenant_id ? (
                      <Group gap="xs" wrap="nowrap">
                        {canUpdate && (
                          <ActionIcon
                            variant="subtle"
                            color="primary"
                            onClick={() => openEdit(item)}
                            aria-label="Edit"
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        )}
                        {canDelete && (
                          <ActionIcon
                            variant="subtle"
                            color="danger"
                            onClick={() => setDeleteTarget(item)}
                            aria-label="Delete"
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Read-only
                      </Text>
                    )}
                  </Table.Td>
                )}
              </Table.Tr>
            ))
          ) : (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" ta="center" py="lg">
                  No {masterType.toLowerCase()}s configured yet.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <MasterItemModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingItem={editingItem}
        masterType={masterType}
        createFn={createFn}
        updateFn={updateFn}
        queryKey={queryKey}
      />

      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${masterType}`}
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete{" "}
            <Text span fw={600}>
              {deleteTarget?.name}
            </Text>{" "}
            ({deleteTarget?.code})?
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              color="danger"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

// ── Insurance Provider Section ─────────────────────────────

const PROVIDER_TYPE_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "government", label: "Government" },
  { value: "tpa", label: "TPA" },
];

const PROVIDER_TYPE_COLORS: Record<string, string> = {
  private: "primary",
  government: "success",
  tpa: "violet",
};

type InsuranceFormState = {
  code: string;
  name: string;
  provider_type: string;
  contact_phone: string;
  contact_email: string;
  website: string;
};

const EMPTY_INSURANCE_FORM: InsuranceFormState = {
  code: "",
  name: "",
  provider_type: "private",
  contact_phone: "",
  contact_email: "",
  website: "",
};

function InsuranceProviderModal({
  opened,
  onClose,
  editingItem,
}: {
  opened: boolean;
  onClose: () => void;
  editingItem: InsuranceProvider | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingItem;
  const [form, setForm] = useState<InsuranceFormState>(EMPTY_INSURANCE_FORM);

  const handleOpen = () => {
    if (editingItem) {
      setForm({
        code: editingItem.code,
        name: editingItem.name,
        provider_type: editingItem.provider_type,
        contact_phone: editingItem.contact_phone ?? "",
        contact_email: editingItem.contact_email ?? "",
        website: editingItem.website ?? "",
      });
    } else {
      setForm(EMPTY_INSURANCE_FORM);
    }
  };

  const updateField = <K extends keyof InsuranceFormState>(
    key: K,
    value: InsuranceFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.adminCreateInsuranceProvider({
        code: form.code.trim(),
        name: form.name.trim(),
        provider_type: form.provider_type,
        contact_phone: form.contact_phone.trim() || undefined,
        contact_email: form.contact_email.trim() || undefined,
        website: form.website.trim() || undefined,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Provider created",
        message: "New insurance provider has been added.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-insurance-providers"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Create failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.adminUpdateInsuranceProvider(editingItem!.id, {
        code: form.code.trim(),
        name: form.name.trim(),
        provider_type: form.provider_type,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        website: form.website.trim() || null,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Provider updated",
        message: "Insurance provider has been updated.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-insurance-providers"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleSubmit = () => {
    if (!form.code.trim() || !form.name.trim()) {
      notifications.show({
        title: "Validation error",
        message: "Code and Name are required.",
        color: "danger",
      });
      return;
    }

    if (isEdit) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Insurance Provider" : "Add Insurance Provider"}
      size="md"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="e.g. ICICI-LOMBARD"
          value={form.code}
          onChange={(e) => updateField("code", e.currentTarget.value)}
          required
        />
        <TextInput
          label="Name"
          placeholder="e.g. ICICI Lombard General Insurance"
          value={form.name}
          onChange={(e) => updateField("name", e.currentTarget.value)}
          required
        />
        <Select
          label="Provider Type"
          data={PROVIDER_TYPE_OPTIONS}
          value={form.provider_type}
          onChange={(value) => updateField("provider_type", value ?? "private")}
          allowDeselect={false}
          required
        />
        <TextInput
          label="Contact Phone"
          placeholder="Optional"
          value={form.contact_phone}
          onChange={(e) => updateField("contact_phone", e.currentTarget.value)}
        />
        <TextInput
          label="Contact Email"
          placeholder="Optional"
          value={form.contact_email}
          onChange={(e) => updateField("contact_email", e.currentTarget.value)}
        />
        <TextInput
          label="Website"
          placeholder="Optional"
          value={form.website}
          onChange={(e) => updateField("website", e.currentTarget.value)}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function InsuranceProvidersTable() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.ADMIN.SETTINGS.CLINICAL_MASTERS.CREATE);
  const canUpdate = useHasPermission(P.ADMIN.SETTINGS.CLINICAL_MASTERS.UPDATE);
  const canDelete = useHasPermission(P.ADMIN.SETTINGS.CLINICAL_MASTERS.DELETE);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InsuranceProvider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InsuranceProvider | null>(null);

  const { data: providers, isLoading, isError, error } = useQuery({
    queryKey: ["admin-insurance-providers"],
    queryFn: () => api.adminListInsuranceProviders(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.adminDeleteInsuranceProvider(id),
    onSuccess: () => {
      notifications.show({
        title: "Provider deleted",
        message: "Insurance provider has been removed.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-insurance-providers"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading insurance providers...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text fw={600}>Insurance Providers</Text>
        {canCreate && (
          <Button
            size="sm"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setEditingItem(null);
              setModalOpen(true);
            }}
          >
            Add Provider
          </Button>
        )}
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Phone</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Status</Table.Th>
            {(canUpdate || canDelete) && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {providers && providers.length > 0 ? (
            providers.map((provider) => (
              <Table.Tr key={provider.id}>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {provider.code}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{provider.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={PROVIDER_TYPE_COLORS[provider.provider_type] ?? "slate"}
                    variant="light"
                    size="sm"
                  >
                    {provider.provider_type}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={provider.contact_phone ? undefined : "dimmed"}>
                    {provider.contact_phone ?? "-"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={provider.contact_email ? undefined : "dimmed"}>
                    {provider.contact_email ?? "-"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={provider.is_active ? "success" : "danger"}
                    variant="light"
                    size="sm"
                  >
                    {provider.is_active ? "Active" : "Inactive"}
                  </Badge>
                </Table.Td>
                {(canUpdate || canDelete) && (
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {canUpdate && (
                        <ActionIcon
                          variant="subtle"
                          color="primary"
                          onClick={() => {
                            setEditingItem(provider);
                            setModalOpen(true);
                          }}
                          aria-label="Edit"
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      )}
                      {canDelete && (
                        <ActionIcon
                          variant="subtle"
                          color="danger"
                          onClick={() => setDeleteTarget(provider)}
                          aria-label="Delete"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))
          ) : (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text c="dimmed" ta="center" py="lg">
                  No insurance providers configured yet.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <InsuranceProviderModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingItem={editingItem}
      />

      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Insurance Provider"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete{" "}
            <Text span fw={600}>
              {deleteTarget?.name}
            </Text>{" "}
            ({deleteTarget?.code})?
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              color="danger"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

// ── Main Component ─────────────────────────────────────────

export function ClinicalMastersSettings() {
  return (
    <Tabs defaultValue="religions" variant="outline">
      <Tabs.List mb="md">
        <Tabs.Tab value="religions" leftSection={<IconHeart size={14} />}>
          Religions
        </Tabs.Tab>
        <Tabs.Tab value="occupations" leftSection={<IconBriefcase size={14} />}>
          Occupations
        </Tabs.Tab>
        <Tabs.Tab value="relations" leftSection={<IconUsers size={14} />}>
          Relations
        </Tabs.Tab>
        <Tabs.Tab value="insurance" leftSection={<IconShieldCheck size={14} />}>
          Insurance Providers
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="religions">
        <MasterTable
          queryKey="admin-religions"
          listFn={() => api.adminListReligions()}
          createFn={(data) => api.adminCreateReligion(data)}
          updateFn={(id, data) => api.adminUpdateReligion(id, data)}
          deleteFn={(id) => api.adminDeleteReligion(id)}
          masterType="Religion"
        />
      </Tabs.Panel>

      <Tabs.Panel value="occupations">
        <MasterTable
          queryKey="admin-occupations"
          listFn={() => api.adminListOccupations()}
          createFn={(data) => api.adminCreateOccupation(data)}
          updateFn={(id, data) => api.adminUpdateOccupation(id, data)}
          deleteFn={(id) => api.adminDeleteOccupation(id)}
          masterType="Occupation"
        />
      </Tabs.Panel>

      <Tabs.Panel value="relations">
        <MasterTable
          queryKey="admin-relations"
          listFn={() => api.adminListRelations()}
          createFn={(data) => api.adminCreateRelation(data)}
          updateFn={(id, data) => api.adminUpdateRelation(id, data)}
          deleteFn={(id) => api.adminDeleteRelation(id)}
          masterType="Relation"
        />
      </Tabs.Panel>

      <Tabs.Panel value="insurance">
        <InsuranceProvidersTable />
      </Tabs.Panel>
    </Tabs>
  );
}
