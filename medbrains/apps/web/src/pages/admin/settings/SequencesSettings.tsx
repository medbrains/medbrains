import { useState } from "react";
import {
  ActionIcon,
  Button,
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
import {
  IconCheck,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { SequenceRow } from "@medbrains/types";

// ── Helpers ──────────────────────────────────────────────

function formatPreview(prefix: string, padWidth: number, nextVal: number): string {
  const valStr = String(nextVal);
  const padded = "0".repeat(Math.max(0, padWidth - valStr.length)) + valStr;
  return prefix + padded;
}

// ── Modal form state ─────────────────────────────────────

type ModalMode = "add" | "edit";

type ModalForm = {
  seq_type: string;
  prefix: string;
  pad_width: number;
};

const EMPTY_FORM: ModalForm = {
  seq_type: "",
  prefix: "",
  pad_width: 6,
};

// ── SequencesSettings ────────────────────────────────────

export function SequencesSettings() {
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [form, setForm] = useState<ModalForm>(EMPTY_FORM);

  // ── Query: list sequences ──

  const {
    data: sequences,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["setup-sequences"],
    queryFn: () => api.listSequences(),
  });

  // ── Mutation: create ──

  const createMutation = useMutation({
    mutationFn: (data: { seq_type: string; prefix: string; pad_width: number }) =>
      api.createSequence(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["setup-sequences"] });
      notifications.show({
        title: "Sequence created",
        message: `Sequence "${form.seq_type}" has been added.`,
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
    mutationFn: (data: { seqType: string; prefix: string; pad_width: number }) =>
      api.updateSequence(data.seqType, { prefix: data.prefix, pad_width: data.pad_width }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["setup-sequences"] });
      notifications.show({
        title: "Sequence updated",
        message: `Sequence "${form.seq_type}" has been updated.`,
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
    mutationFn: (seqType: string) => api.deleteSequence(seqType),
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
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (row: SequenceRow) => {
    setModalMode("edit");
    setForm({
      seq_type: row.seq_type,
      prefix: row.prefix,
      pad_width: row.pad_width,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = () => {
    if (modalMode === "add") {
      if (!form.seq_type.trim()) {
        notifications.show({
          title: "Validation error",
          message: "Sequence type is required.",
          color: "orange",
        });
        return;
      }
      createMutation.mutate({
        seq_type: form.seq_type.trim(),
        prefix: form.prefix,
        pad_width: form.pad_width,
      });
    } else {
      updateMutation.mutate({
        seqType: form.seq_type,
        prefix: form.prefix,
        pad_width: form.pad_width,
      });
    }
  };

  const handleDelete = (seqType: string) => {
    if (window.confirm(`Delete sequence "${seqType}"? This cannot be undone.`)) {
      deleteMutation.mutate(seqType);
    }
  };

  const updateField = <K extends keyof ModalForm>(key: K, value: ModalForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
        <Button leftSection={<IconPlus size={16} />} onClick={openAddModal}>
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
            value={form.seq_type}
            onChange={(e) => updateField("seq_type", e.currentTarget.value)}
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
            value={form.prefix}
            onChange={(e) => updateField("prefix", e.currentTarget.value)}
          />
          <NumberInput
            label="Pad Width"
            description="Minimum number of digits (zero-padded)."
            value={form.pad_width}
            onChange={(value) => updateField("pad_width", typeof value === "number" ? value : 6)}
            min={3}
            max={10}
          />

          {form.prefix && (
            <Text size="sm" c="dimmed">
              Preview: <Text span ff="monospace" c="primary">{formatPreview(form.prefix, form.pad_width, 1)}</Text>
            </Text>
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={isMutating}>
              {modalMode === "add" ? "Create" : "Save Changes"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
