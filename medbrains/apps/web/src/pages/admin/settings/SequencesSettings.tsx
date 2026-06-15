import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Group,
  Loader,
  Modal,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { type SequenceSettingsFormInput, sequenceSettingsFormSchema } from "@medbrains/schemas";
import type { SequenceRow } from "@medbrains/types";
import { IconCheck, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui";
import { settingsSetupService } from "@/services/settingsSetup.service";

// ── Helpers ──────────────────────────────────────────────

function formatPreview(prefix: string, padWidth: number, nextVal: number): string {
  const valStr = String(nextVal);
  const padded = "0".repeat(Math.max(0, padWidth - valStr.length)) + valStr;
  return prefix + padded;
}

// ── Modal form state ─────────────────────────────────────

type ModalMode = "add" | "edit";

const EMPTY_FORM: SequenceSettingsFormInput = {
  seq_type: "",
  prefix: "",
  pad_width: 6,
};

function sequenceFormFromRow(row: SequenceRow): SequenceSettingsFormInput {
  return {
    seq_type: row.seq_type,
    prefix: row.prefix,
    pad_width: row.pad_width,
  };
}

function sequenceFormToCreatePayload(form: SequenceSettingsFormInput) {
  return {
    seq_type: form.seq_type.trim(),
    prefix: form.prefix.trim(),
    pad_width: Number(form.pad_width),
  };
}

function sequenceFormToUpdatePayload(form: SequenceSettingsFormInput) {
  return {
    prefix: form.prefix.trim(),
    pad_width: Number(form.pad_width),
  };
}

// ── SequencesSettings ────────────────────────────────────

export function SequencesSettings() {
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch,
  } = useForm<SequenceSettingsFormInput>({
    resolver: zodResolver(sequenceSettingsFormSchema),
    defaultValues: EMPTY_FORM,
  });

  // ── Query: list sequences ──

  const {
    data: sequences,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["setup-sequences"],
    queryFn: () => settingsSetupService.listSequences(),
  });

  // ── Mutation: create ──

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof sequenceFormToCreatePayload>) =>
      settingsSetupService.createSequence(data),
    onSuccess: (_row, data) => {
      void queryClient.invalidateQueries({ queryKey: ["setup-sequences"] });
      notifications.show({
        title: "Sequence created",
        message: `Sequence "${data.seq_type}" has been added.`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      closeModal();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Create failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  // ── Mutation: update ──

  const updateMutation = useMutation({
    mutationFn: (data: {
      seqType: string;
      values: ReturnType<typeof sequenceFormToUpdatePayload>;
    }) => settingsSetupService.updateSequence(data.seqType, data.values),
    onSuccess: (_row, data) => {
      void queryClient.invalidateQueries({ queryKey: ["setup-sequences"] });
      notifications.show({
        title: "Sequence updated",
        message: `Sequence "${data.seqType}" has been updated.`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      closeModal();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  // ── Mutation: delete ──

  const deleteMutation = useMutation({
    mutationFn: (seqType: string) => settingsSetupService.deleteSequence(seqType),
    onSuccess: (_data, seqType) => {
      void queryClient.invalidateQueries({ queryKey: ["setup-sequences"] });
      notifications.show({
        title: "Sequence deleted",
        message: `Sequence "${seqType}" has been removed.`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  // ── Modal handlers ──

  const openAddModal = () => {
    setModalMode("add");
    reset(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (row: SequenceRow) => {
    setModalMode("edit");
    reset(sequenceFormFromRow(row));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    reset(EMPTY_FORM);
  };

  const submitSequence = handleSubmit((form) => {
    if (modalMode === "add") {
      createMutation.mutate(sequenceFormToCreatePayload(form));
    } else {
      updateMutation.mutate({
        seqType: form.seq_type,
        values: sequenceFormToUpdatePayload(form),
      });
    }
  });

  const handleDelete = (seqType: string) => {
    if (window.confirm(`Delete sequence "${seqType}"? This cannot be undone.`)) {
      deleteMutation.mutate(seqType);
    }
  };

  // ── Loading / Error states ──

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading sequences...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load sequences: {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  const rows = sequences ?? [];
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const previewPrefix = watch("prefix");
  const previewPadWidth = Number(watch("pad_width"));

  // ── Render ──

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Text fw={600} size="lg">
            Sequences
          </Text>
          <Text size="sm" c="dimmed">
            Manage auto-increment sequences for UHID, invoices, lab orders, and more.
          </Text>
        </div>
        <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openAddModal}>
          Add Sequence
        </Button>
      </Group>

      {rows.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No sequences configured. Click "Add Sequence" to create one.
        </Text>
      ) : (
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Prefix</Table.Th>
              <Table.Th>Pad Width</Table.Th>
              <Table.Th>Next Value</Table.Th>
              <Table.Th>Preview</Table.Th>
              <Table.Th w={100}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row: SequenceRow) => (
              <Table.Tr key={row.seq_type}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {row.seq_type}
                  </Text>
                </Table.Td>
                <Table.Td>{row.prefix}</Table.Td>
                <Table.Td>{row.pad_width}</Table.Td>
                <Table.Td>{row.current_val}</Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace" c="primary">
                    {formatPreview(row.prefix, row.pad_width, row.current_val)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      color="primary"
                      onClick={() => openEditModal(row)}
                      title="Edit sequence"
                      aria-label="Edit"
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      onClick={() => handleDelete(row.seq_type)}
                      loading={deleteMutation.isPending}
                      title="Delete sequence"
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
      )}

      {/* ── Add / Edit Modal ── */}
      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={modalMode === "add" ? "Add Sequence" : "Edit Sequence"}
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Sequence Type"
            placeholder="e.g. uhid, invoice, lab_order"
            error={errors.seq_type?.message}
            {...register("seq_type")}
            readOnly={modalMode === "edit"}
            variant={modalMode === "edit" ? "filled" : "default"}
            description={
              modalMode === "edit" ? "Type cannot be changed after creation." : undefined
            }
            required
          />
          <TextInput
            label="Prefix"
            placeholder="e.g. MED-, INV-, LAB-"
            error={errors.prefix?.message}
            {...register("prefix")}
          />
          <Controller
            control={control}
            name="pad_width"
            render={({ field }) => (
              <NumberInput
                label="Pad Width"
                description="Minimum number of digits (zero-padded)."
                value={field.value}
                onChange={field.onChange}
                error={errors.pad_width?.message}
                min={3}
                max={10}
              />
            )}
          />

          {previewPrefix && Number.isFinite(previewPadWidth) && (
            <Text size="sm" c="dimmed">
              Preview:{" "}
              <Text span ff="monospace" c="primary">
                {formatPreview(previewPrefix, previewPadWidth, 1)}
              </Text>
            </Text>
          )}

          <Group justify="flex-end" mt="sm">
            <Button tone="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button tone="primary" onClick={() => void submitSequence()} loading={isMutating}>
              {modalMode === "add" ? "Create" : "Save Changes"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
