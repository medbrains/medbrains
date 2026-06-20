import { Group, Loader, Modal, Select, Stack, Switch, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type {
  CreatePaymentTerminalRequest,
  PaymentProviderInfo,
  PaymentTerminal,
  UpdatePaymentTerminalRequest,
} from "@medbrains/types";
import { IconCheck, IconDeviceMobile, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge, Button, IconButton, Table } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";

const PROVIDERS_KEY = ["payment-providers"] as const;
const TERMINALS_KEY = ["payment-terminals"] as const;

const KIND_OPTIONS = [
  { value: "pos", label: "POS card machine" },
  { value: "qr", label: "Dynamic QR / soundbox" },
  { value: "online", label: "Online checkout" },
] as const;

const MODE_OPTIONS = [
  { value: "sandbox", label: "Sandbox (test)" },
  { value: "live", label: "Live" },
] as const;

interface TerminalForm {
  provider: string;
  kind: string;
  label: string;
  terminal_code: string;
  acquiring_bank: string;
  counter_id: string;
  mode: string;
}

const EMPTY_FORM: TerminalForm = {
  provider: "razorpay",
  kind: "pos",
  label: "",
  terminal_code: "",
  acquiring_bank: "",
  counter_id: "",
  mode: "sandbox",
};

function kindLabel(kind: string): string {
  return KIND_OPTIONS.find((k) => k.value === kind)?.label ?? kind;
}

export function PaymentTerminalsSettings() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState<TerminalForm>(EMPTY_FORM);

  const { data: providersResp } = useQuery({
    queryKey: PROVIDERS_KEY,
    queryFn: paymentsService.listPaymentProviders,
  });

  const {
    data: terminals,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: TERMINALS_KEY,
    queryFn: () => paymentsService.listPaymentTerminals(),
  });

  const providerOptions = useMemo(
    () =>
      (providersResp?.providers ?? []).map((p: PaymentProviderInfo) => ({
        value: p.provider,
        label: p.label,
      })),
    [providersResp],
  );

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (t: PaymentTerminal) => {
    setEditingId(t.id);
    setForm({
      provider: t.provider,
      kind: t.kind,
      label: t.label,
      terminal_code: t.terminal_code ?? "",
      acquiring_bank: t.acquiring_bank ?? "",
      counter_id: t.counter_id ?? "",
      mode: t.mode,
    });
    setModalOpen(true);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: TERMINALS_KEY });

  const createMutation = useMutation({
    mutationFn: (data: CreatePaymentTerminalRequest) => paymentsService.createPaymentTerminal(data),
    onSuccess: () => {
      void invalidate();
      closeModal();
      notifications.show({
        title: "Terminal registered",
        message: "Device added.",
        color: "success",
      });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Register failed", message: err.message, color: "danger" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePaymentTerminalRequest }) =>
      paymentsService.updatePaymentTerminal(id, data),
    onSuccess: () => {
      void invalidate();
      closeModal();
      notifications.show({ title: "Terminal updated", message: "Device saved.", color: "success" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Update failed", message: err.message, color: "danger" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentsService.deletePaymentTerminal(id),
    onSuccess: () => {
      void invalidate();
      setDeleteConfirmId(null);
      notifications.show({
        title: "Terminal removed",
        message: "Device de-registered.",
        color: "success",
      });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Delete failed", message: err.message, color: "danger" }),
  });

  const toggleActive = (t: PaymentTerminal) =>
    updateMutation.mutate({ id: t.id, data: { is_active: !t.is_active } });

  const submit = () => {
    if (!form.label.trim()) {
      notifications.show({
        title: "Label required",
        message: "Give the device a label.",
        color: "danger",
      });
      return;
    }
    const fields = {
      kind: form.kind,
      label: form.label.trim(),
      terminal_code: form.terminal_code.trim() || undefined,
      acquiring_bank: form.acquiring_bank.trim() || undefined,
      counter_id: form.counter_id.trim() || undefined,
      mode: form.mode,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: fields });
    } else {
      createMutation.mutate({ provider: form.provider, ...fields });
    }
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading payment terminals…</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load terminals: {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Text fw={600} size="lg">
            Payment Terminals
          </Text>
          <Text size="sm" c="dimmed">
            Register POS / QR / online devices per billing counter. One TSP adapter (Pine Labs,
            Mswipe, Worldline) serves any acquiring bank (SBI, Canara, TMB…).
          </Text>
        </div>
        <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Add Terminal
        </Button>
      </Group>

      {terminals && terminals.length > 0 ? (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Label</Table.Th>
              <Table.Th>Provider</Table.Th>
              <Table.Th>Kind</Table.Th>
              <Table.Th>Device / counter</Table.Th>
              <Table.Th>Mode</Table.Th>
              <Table.Th>Active</Table.Th>
              <Table.Th w={100}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {terminals.map((t) => (
              <Table.Tr key={t.id}>
                <Table.Td>
                  <Text fw={500} size="sm">
                    {t.label}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{t.provider}</Text>
                  {t.acquiring_bank && (
                    <Text size="xs" c="dimmed">
                      MID: {t.acquiring_bank}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge tone="info" size="sm">
                    {kindLabel(t.kind)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="xs">
                    {t.terminal_code ?? "—"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t.counter_id ? `Counter ${t.counter_id}` : "Any counter"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge tone={t.mode === "live" ? "warning" : "neutral"} size="sm">
                    {t.mode === "live" ? "LIVE" : "SANDBOX"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={t.is_active}
                    onChange={() => toggleActive(t)}
                    aria-label={`Toggle ${t.label}`}
                  />
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <IconButton
                      tone="primary"
                      size="sm"
                      onClick={() => openEdit(t)}
                      aria-label={`Edit ${t.label}`}
                    >
                      <IconPencil size={16} />
                    </IconButton>
                    <IconButton
                      tone="danger"
                      size="sm"
                      onClick={() => setDeleteConfirmId(t.id)}
                      aria-label={`Delete ${t.label}`}
                    >
                      <IconTrash size={16} />
                    </IconButton>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Stack align="center" py="xl" gap="xs">
          <IconDeviceMobile size={32} color="var(--mb-text-secondary)" />
          <Text c="dimmed">No payment terminals registered yet.</Text>
        </Stack>
      )}

      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={editingId ? "Edit terminal" : "Add terminal"}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Label"
            placeholder="e.g. Main cash counter card machine"
            required
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.currentTarget.value })}
          />
          <Group grow>
            <Select
              label="Provider / TSP"
              data={providerOptions}
              value={form.provider}
              onChange={(v) => setForm({ ...form, provider: v ?? form.provider })}
              allowDeselect={false}
            />
            <Select
              label="Kind"
              data={[...KIND_OPTIONS]}
              value={form.kind}
              onChange={(v) => setForm({ ...form, kind: v ?? form.kind })}
              allowDeselect={false}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Device / terminal code"
              placeholder="Plutus IMEI / EDC id / QR id"
              value={form.terminal_code}
              onChange={(e) => setForm({ ...form, terminal_code: e.currentTarget.value })}
            />
            <TextInput
              label="Acquiring bank"
              placeholder="SBI / Canara / TMB…"
              value={form.acquiring_bank}
              onChange={(e) => setForm({ ...form, acquiring_bank: e.currentTarget.value })}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Billing counter"
              placeholder="Counter id (blank = any)"
              value={form.counter_id}
              onChange={(e) => setForm({ ...form, counter_id: e.currentTarget.value })}
            />
            <Select
              label="Mode"
              data={[...MODE_OPTIONS]}
              value={form.mode}
              onChange={(v) => setForm({ ...form, mode: v ?? form.mode })}
              allowDeselect={false}
            />
          </Group>
          <Group justify="flex-end" gap="sm">
            <Button tone="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              tone="primary"
              leftSection={<IconCheck size={16} />}
              loading={isMutating}
              onClick={submit}
            >
              {editingId ? "Save" : "Register"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Remove terminal"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            De-register this payment device? It will no longer be selectable at the counter.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button tone="ghost" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              tone="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
            >
              Remove
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
