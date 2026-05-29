import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { type BedTypeSettingsFormInput, bedTypeSettingsFormSchema } from "@medbrains/schemas";
import type { BedTypeRow } from "@medbrains/types";
import { IconCheck, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { settingsSetupService } from "@/services/settingsSetup.service";

const EMPTY_FORM: BedTypeSettingsFormInput = {
  code: "",
  name: "",
  daily_rate: 0,
  description: "",
};

const QUERY_KEY = ["setup-bed-types"] as const;

// ── Component ───────────────────────────────────────────

export function BedTypesSettings() {
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = useForm<BedTypeSettingsFormInput>({
    resolver: zodResolver(bedTypeSettingsFormSchema),
    defaultValues: EMPTY_FORM,
  });

  // ── Queries ─────────────────────────────────────────────

  const {
    data: bedTypes,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: settingsSetupService.listBedTypes,
  });

  // ── Mutations ───────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: settingsSetupService.createBedType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      closeModal();
      notifications.show({
        title: "Bed type created",
        message: "The new bed type has been added successfully.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
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
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof settingsSetupService.updateBedType>[1];
    }) => settingsSetupService.updateBedType(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      closeModal();
      notifications.show({
        title: "Bed type updated",
        message: "The bed type has been updated successfully.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: settingsSetupService.deleteBedType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setDeleteConfirmId(null);
      notifications.show({
        title: "Bed type deleted",
        message: "The bed type has been removed.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: (err: Error) => {
      setDeleteConfirmId(null);
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  // ── Handlers ────────────────────────────────────────────

  const openCreateModal = () => {
    setEditingId(null);
    reset(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (bedType: BedTypeRow) => {
    setEditingId(bedType.id);
    reset({
      code: bedType.code,
      name: bedType.name,
      daily_rate: bedType.daily_rate,
      description: bedType.description ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    reset(EMPTY_FORM);
  };

  const submitBedType = handleSubmit((form) => {
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      daily_rate: Number(form.daily_rate),
      description: form.description.trim() || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // ── Format currency ─────────────────────────────────────

  const formatRate = (rate: number): string => `\u20B9${rate.toLocaleString("en-IN")}/day`;

  // ── Loading / Error states ──────────────────────────────

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading bed types...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load bed types: {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  // ── Render ──────────────────────────────────────────────

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Bed Types
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
          Add Bed Type
        </Button>
      </Group>

      {bedTypes && bedTypes.length > 0 ? (
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Code</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Daily Rate</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th w={100}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {bedTypes.map((bt) => (
              <Table.Tr key={bt.id}>
                <Table.Td>
                  <Text fw={500} size="sm">
                    {bt.code}
                  </Text>
                </Table.Td>
                <Table.Td>{bt.name}</Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="sm">
                    {formatRate(bt.daily_rate)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {bt.description ?? "--"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={bt.is_active ? "success" : "slate"} variant="light" size="sm">
                    {bt.is_active ? "Active" : "Inactive"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      color="primary"
                      size="sm"
                      onClick={() => openEditModal(bt)}
                      title="Edit bed type"
                      aria-label="Edit"
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      size="sm"
                      onClick={() => setDeleteConfirmId(bt.id)}
                      title="Delete bed type"
                      aria-label="Delete"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          No bed types configured yet. Click "Add Bed Type" to create one.
        </Text>
      )}

      {/* ── Create / Edit Modal ──────────────────────────── */}

      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={editingId ? "Edit Bed Type" : "Add Bed Type"}
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Code"
            placeholder="e.g. GENERAL, SEMI_PVT, ICU"
            {...register("code")}
            error={errors.code?.message}
            required
            disabled={!!editingId}
            data-autofocus
          />
          <TextInput
            label="Name"
            placeholder="e.g. General Ward, Semi-Private, ICU Bed"
            {...register("name")}
            error={errors.name?.message}
            required
          />
          <Controller
            control={control}
            name="daily_rate"
            render={({ field }) => (
              <NumberInput
                label="Daily Rate"
                placeholder="0.00"
                prefix={"\u20B9"}
                min={0}
                decimalScale={2}
                value={field.value}
                onChange={(value) => field.onChange(typeof value === "number" ? value : 0)}
                error={errors.daily_rate?.message}
                required
              />
            )}
          />
          <Textarea
            label="Description"
            placeholder="Optional description for this bed type"
            {...register("description")}
            error={errors.description?.message}
            autosize
            minRows={2}
            maxRows={4}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={() => void submitBedType()} loading={isMutating}>
              {editingId ? "Save Changes" : "Create"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Delete Confirmation Modal ────────────────────── */}

      <Modal
        opened={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Bed Type"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete this bed type? This action cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              color="danger"
              onClick={() => {
                if (deleteConfirmId) {
                  handleDelete(deleteConfirmId);
                }
              }}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
