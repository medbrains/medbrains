import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
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
  type ClinicalMasterSettingsFormInput,
  clinicalMasterSettingsFormSchema,
  type InsuranceProviderSettingsFormInput,
  type InsuranceProviderTypeFormValue,
  insuranceProviderSettingsFormSchema,
  insuranceProviderTypeFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { InsuranceProvider, MasterItem } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBriefcase,
  IconCheck,
  IconHeart,
  IconPencil,
  IconPlus,
  IconShieldCheck,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import {
  type CreateMasterItemInput,
  clinicalMastersService,
  type UpdateMasterItemInput,
} from "@/services/clinicalMasters.service";

// ── Generic Master Item Modal ──────────────────────────────

const EMPTY_MASTER_FORM: ClinicalMasterSettingsFormInput = {
  code: "",
  name: "",
  sort_order: 0,
};

function masterFormFromItem(item: MasterItem): ClinicalMasterSettingsFormInput {
  return {
    code: item.code,
    name: item.name,
    sort_order: item.sort_order,
  };
}

function masterFormToPayload(form: ClinicalMasterSettingsFormInput): CreateMasterItemInput {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    sort_order: Number(form.sort_order),
  };
}

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
  createFn: (data: CreateMasterItemInput) => Promise<MasterItem>;
  updateFn: (id: string, data: UpdateMasterItemInput) => Promise<MasterItem>;
  queryKey: string;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingItem;
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<ClinicalMasterSettingsFormInput>({
    resolver: zodResolver(clinicalMasterSettingsFormSchema),
    defaultValues: EMPTY_MASTER_FORM,
    values: editingItem ? masterFormFromItem(editingItem) : EMPTY_MASTER_FORM,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateMasterItemInput) => createFn(data),
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
    mutationFn: (data: UpdateMasterItemInput) => {
      if (!editingItem) throw new Error(`No ${masterType} selected`);
      return updateFn(editingItem.id, data);
    },
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

  const submitMasterItem = handleSubmit((form) => {
    const payload = masterFormToPayload(form);

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? `Edit ${masterType}` : `Add ${masterType}`}
      size="sm"
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="e.g. HIN"
          error={errors.code?.message}
          {...register("code")}
          required
        />
        <TextInput
          label="Name"
          placeholder={`e.g. ${masterType} name`}
          error={errors.name?.message}
          {...register("name")}
          required
        />
        <Controller
          control={control}
          name="sort_order"
          render={({ field }) => (
            <NumberInput
              label="Sort Order"
              value={field.value}
              onChange={field.onChange}
              error={errors.sort_order?.message}
              min={0}
            />
          )}
        />
        <Group justify="flex-end" mt="md">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            onClick={() => void submitMasterItem()}
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
  createFn: (data: CreateMasterItemInput) => Promise<MasterItem>;
  updateFn: (id: string, data: UpdateMasterItemInput) => Promise<MasterItem>;
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

  const {
    data: items,
    isLoading,
    isError,
    error,
  } = useQuery({
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
          Failed to load: {error instanceof Error ? error.message : "Unknown error"}
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
            tone="primary"
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
                  <Badge tone={item.is_active ? "success" : "danger"} size="sm">
                    {item.is_active ? "Active" : "Inactive"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge tone={item.tenant_id ? "primary" : "neutral"} size="sm">
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
            <Button tone="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              tone="danger"
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
] satisfies Array<{ value: InsuranceProviderTypeFormValue; label: string }>;

const PROVIDER_TYPE_TONES: Record<string, BadgeTone> = {
  private: "primary",
  government: "success",
  tpa: "accent",
};

const EMPTY_INSURANCE_FORM: InsuranceProviderSettingsFormInput = {
  code: "",
  name: "",
  provider_type: "private",
  contact_phone: "",
  contact_email: "",
  website: "",
};

function insuranceFormFromProvider(
  provider: InsuranceProvider,
): InsuranceProviderSettingsFormInput {
  return {
    code: provider.code,
    name: provider.name,
    provider_type: insuranceProviderTypeFormSchema.catch("private").parse(provider.provider_type),
    contact_phone: provider.contact_phone ?? "",
    contact_email: provider.contact_email ?? "",
    website: provider.website ?? "",
  };
}

function insuranceFormToCreatePayload(form: InsuranceProviderSettingsFormInput) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    provider_type: form.provider_type,
    contact_phone: form.contact_phone.trim() || undefined,
    contact_email: form.contact_email?.trim() || undefined,
    website: form.website.trim() || undefined,
  };
}

function insuranceFormToUpdatePayload(form: InsuranceProviderSettingsFormInput) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    provider_type: form.provider_type,
    contact_phone: form.contact_phone.trim() || null,
    contact_email: form.contact_email?.trim() || null,
    website: form.website.trim() || null,
  };
}

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
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<InsuranceProviderSettingsFormInput>({
    resolver: zodResolver(insuranceProviderSettingsFormSchema),
    defaultValues: EMPTY_INSURANCE_FORM,
    values: editingItem ? insuranceFormFromProvider(editingItem) : EMPTY_INSURANCE_FORM,
  });

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof insuranceFormToCreatePayload>) =>
      clinicalMastersService.createInsuranceProvider(data),
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
    mutationFn: (data: ReturnType<typeof insuranceFormToUpdatePayload>) => {
      if (!editingItem) throw new Error("No insurance provider selected");
      return clinicalMastersService.updateInsuranceProvider(editingItem.id, data);
    },
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

  const submitInsuranceProvider = handleSubmit((form) => {
    if (isEdit) {
      updateMutation.mutate(insuranceFormToUpdatePayload(form));
    } else {
      createMutation.mutate(insuranceFormToCreatePayload(form));
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Insurance Provider" : "Add Insurance Provider"}
      size="md"
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="e.g. ICICI-LOMBARD"
          error={errors.code?.message}
          {...register("code")}
          required
        />
        <TextInput
          label="Name"
          placeholder="e.g. ICICI Lombard General Insurance"
          error={errors.name?.message}
          {...register("name")}
          required
        />
        <Controller
          control={control}
          name="provider_type"
          render={({ field }) => (
            <Select
              label="Provider Type"
              data={PROVIDER_TYPE_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "private")}
              error={errors.provider_type?.message}
              allowDeselect={false}
              required
            />
          )}
        />
        <TextInput
          label="Contact Phone"
          placeholder="Optional"
          error={errors.contact_phone?.message}
          {...register("contact_phone")}
        />
        <TextInput
          label="Contact Email"
          placeholder="Optional"
          error={errors.contact_email?.message}
          {...register("contact_email")}
        />
        <TextInput
          label="Website"
          placeholder="Optional"
          error={errors.website?.message}
          {...register("website")}
        />
        <Group justify="flex-end" mt="md">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            onClick={() => void submitInsuranceProvider()}
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

  const {
    data: providers,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin-insurance-providers"],
    queryFn: () => clinicalMastersService.listInsuranceProviders(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clinicalMastersService.deleteInsuranceProvider(id),
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
          Failed to load: {error instanceof Error ? error.message : "Unknown error"}
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
            tone="primary"
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
                  <Badge tone={PROVIDER_TYPE_TONES[provider.provider_type] ?? "neutral"} size="sm">
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
                  <Badge tone={provider.is_active ? "success" : "danger"} size="sm">
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
            <Button tone="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              tone="danger"
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
          listFn={clinicalMastersService.listReligions}
          createFn={clinicalMastersService.createReligion}
          updateFn={clinicalMastersService.updateReligion}
          deleteFn={clinicalMastersService.deleteReligion}
          masterType="Religion"
        />
      </Tabs.Panel>

      <Tabs.Panel value="occupations">
        <MasterTable
          queryKey="admin-occupations"
          listFn={clinicalMastersService.listOccupations}
          createFn={clinicalMastersService.createOccupation}
          updateFn={clinicalMastersService.updateOccupation}
          deleteFn={clinicalMastersService.deleteOccupation}
          masterType="Occupation"
        />
      </Tabs.Panel>

      <Tabs.Panel value="relations">
        <MasterTable
          queryKey="admin-relations"
          listFn={clinicalMastersService.listRelations}
          createFn={clinicalMastersService.createRelation}
          updateFn={clinicalMastersService.updateRelation}
          deleteFn={clinicalMastersService.deleteRelation}
          masterType="Relation"
        />
      </Tabs.Panel>

      <Tabs.Panel value="insurance">
        <InsuranceProvidersTable />
      </Tabs.Panel>
    </Tabs>
  );
}
