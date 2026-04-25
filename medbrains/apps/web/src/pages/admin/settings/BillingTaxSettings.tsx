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
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
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
import type { TaxCategoryRow, PaymentMethodRow } from "@medbrains/types";

// ── Constants ─────────────────────────────────────────────

const APPLICABILITY_OPTIONS = [
  { value: "taxable", label: "Taxable" },
  { value: "exempt", label: "Exempt" },
  { value: "zero_rated", label: "Zero Rated" },
];

const APPLICABILITY_COLORS: Record<string, string> = {
  taxable: "primary",
  exempt: "success",
  zero_rated: "slate",
};

// ── Tax Category Form State ──────────────────────────────

interface TaxCategoryFormState {
  code: string;
  name: string;
  rate_percent: number | string;
  applicability: string | null;
  description: string;
}

const EMPTY_TAX_FORM: TaxCategoryFormState = {
  code: "",
  name: "",
  rate_percent: "",
  applicability: null,
  description: "",
};

function taxFormFromRow(row: TaxCategoryRow): TaxCategoryFormState {
  return {
    code: row.code,
    name: row.name,
    rate_percent: row.rate_percent,
    applicability: row.applicability,
    description: row.description ?? "",
  };
}

function taxFormToPayload(form: TaxCategoryFormState) {
  return {
    code: form.code,
    name: form.name,
    rate_percent: typeof form.rate_percent === "number" ? form.rate_percent : 0,
    applicability: form.applicability ?? "taxable",
    description: form.description || undefined,
  };
}

// ── Payment Method Form State ────────────────────────────

interface PaymentMethodFormState {
  code: string;
  name: string;
  is_default: boolean;
}

const EMPTY_PAYMENT_FORM: PaymentMethodFormState = {
  code: "",
  name: "",
  is_default: false,
};

function paymentFormFromRow(row: PaymentMethodRow): PaymentMethodFormState {
  return {
    code: row.code,
    name: row.name,
    is_default: row.is_default,
  };
}

function paymentFormToPayload(form: PaymentMethodFormState) {
  return {
    code: form.code,
    name: form.name,
    is_default: form.is_default,
  };
}

// ── Tax Category Modal ───────────────────────────────────

function TaxCategoryModal({
  opened,
  onClose,
  editingRow,
}: {
  opened: boolean;
  onClose: () => void;
  editingRow: TaxCategoryRow | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingRow;

  const [form, setForm] = useState<TaxCategoryFormState>(EMPTY_TAX_FORM);

  const updateField = <K extends keyof TaxCategoryFormState>(
    key: K,
    value: TaxCategoryFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleOpen = () => {
    if (editingRow) {
      setForm(taxFormFromRow(editingRow));
    } else {
      setForm(EMPTY_TAX_FORM);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof taxFormToPayload>) =>
      api.createTaxCategory(data),
    onSuccess: () => {
      notifications.show({
        title: "Tax category created",
        message: "Tax category has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-tax-categories"] });
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
    mutationFn: (data: ReturnType<typeof taxFormToPayload>) =>
      api.updateTaxCategory(editingRow!.id, data),
    onSuccess: () => {
      notifications.show({
        title: "Tax category updated",
        message: "Tax category has been updated successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-tax-categories"] });
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
    if (!form.code.trim() || !form.name.trim() || !form.applicability) {
      notifications.show({
        title: "Missing fields",
        message: "Code, name, and applicability are required",
        color: "danger",
      });
      return;
    }

    const payload = taxFormToPayload(form);

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
      title={isEdit ? "Edit Tax Category" : "Add Tax Category"}
      size="md"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label="Code"
            placeholder="GST-18"
            value={form.code}
            onChange={(e) => updateField("code", e.currentTarget.value)}
            required
          />
          <TextInput
            label="Name"
            placeholder="GST 18%"
            value={form.name}
            onChange={(e) => updateField("name", e.currentTarget.value)}
            required
          />
        </Group>

        <Group grow>
          <NumberInput
            label="Rate (%)"
            placeholder="18.00"
            value={form.rate_percent}
            onChange={(v) => updateField("rate_percent", v)}
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
            required
          />
          <Select
            label="Applicability"
            data={APPLICABILITY_OPTIONS}
            value={form.applicability}
            onChange={(v) => updateField("applicability", v)}
            placeholder="Select..."
            required
          />
        </Group>

        <Textarea
          label="Description"
          placeholder="Optional description"
          value={form.description}
          onChange={(e) => updateField("description", e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={4}
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

// ── Payment Method Modal ─────────────────────────────────

function PaymentMethodModal({
  opened,
  onClose,
  editingRow,
}: {
  opened: boolean;
  onClose: () => void;
  editingRow: PaymentMethodRow | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingRow;

  const [form, setForm] = useState<PaymentMethodFormState>(EMPTY_PAYMENT_FORM);

  const updateField = <K extends keyof PaymentMethodFormState>(
    key: K,
    value: PaymentMethodFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleOpen = () => {
    if (editingRow) {
      setForm(paymentFormFromRow(editingRow));
    } else {
      setForm(EMPTY_PAYMENT_FORM);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof paymentFormToPayload>) =>
      api.createPaymentMethod(data),
    onSuccess: () => {
      notifications.show({
        title: "Payment method created",
        message: "Payment method has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-payment-methods"] });
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
    mutationFn: (data: ReturnType<typeof paymentFormToPayload>) =>
      api.updatePaymentMethod(editingRow!.id, data),
    onSuccess: () => {
      notifications.show({
        title: "Payment method updated",
        message: "Payment method has been updated successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-payment-methods"] });
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
        title: "Missing fields",
        message: "Code and name are required",
        color: "danger",
      });
      return;
    }

    const payload = paymentFormToPayload(form);

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
      title={isEdit ? "Edit Payment Method" : "Add Payment Method"}
      size="sm"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="CASH"
          value={form.code}
          onChange={(e) => updateField("code", e.currentTarget.value)}
          required
        />
        <TextInput
          label="Name"
          placeholder="Cash Payment"
          value={form.name}
          onChange={(e) => updateField("name", e.currentTarget.value)}
          required
        />
        <Switch
          label="Default payment method"
          checked={form.is_default}
          onChange={(e) => updateField("is_default", e.currentTarget.checked)}
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

// ── Main Component ───────────────────────────────────────

export function BillingTaxSettings() {
  const queryClient = useQueryClient();

  // Tax Categories state
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxCategoryRow | null>(null);

  // Payment Methods state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentMethodRow | null>(null);

  // ── Tax Categories Query ─────────────────────────────

  const { data: taxCategories, isLoading: taxLoading } = useQuery({
    queryKey: ["setup-tax-categories"],
    queryFn: () => api.listTaxCategories(),
  });

  const deleteTaxMutation = useMutation({
    mutationFn: (id: string) => api.deleteTaxCategory(id),
    onSuccess: () => {
      notifications.show({
        title: "Tax category deleted",
        message: "Tax category has been removed",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-tax-categories"] });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  // ── Payment Methods Query ────────────────────────────

  const { data: paymentMethods, isLoading: paymentLoading } = useQuery({
    queryKey: ["setup-payment-methods"],
    queryFn: () => api.listPaymentMethods(),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => api.deletePaymentMethod(id),
    onSuccess: () => {
      notifications.show({
        title: "Payment method deleted",
        message: "Payment method has been removed",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-payment-methods"] });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  // ── Tax Handlers ─────────────────────────────────────

  const openCreateTax = () => {
    setEditingTax(null);
    setTaxModalOpen(true);
  };

  const openEditTax = (row: TaxCategoryRow) => {
    setEditingTax(row);
    setTaxModalOpen(true);
  };

  const handleDeleteTax = (row: TaxCategoryRow) => {
    if (window.confirm(`Delete tax category "${row.name}"? This cannot be undone.`)) {
      deleteTaxMutation.mutate(row.id);
    }
  };

  // ── Payment Handlers ─────────────────────────────────

  const openCreatePayment = () => {
    setEditingPayment(null);
    setPaymentModalOpen(true);
  };

  const openEditPayment = (row: PaymentMethodRow) => {
    setEditingPayment(row);
    setPaymentModalOpen(true);
  };

  const handleDeletePayment = (row: PaymentMethodRow) => {
    if (window.confirm(`Delete payment method "${row.name}"? This cannot be undone.`)) {
      deletePaymentMutation.mutate(row.id);
    }
  };

  // ── Tax Category Rows ────────────────────────────────

  const taxRows = (taxCategories ?? []).map((row) => (
    <Table.Tr key={row.id}>
      <Table.Td>
        <Text size="sm" ff="monospace" fw={500}>
          {row.code}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{row.name}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{Number(row.rate_percent).toFixed(2)}%</Text>
      </Table.Td>
      <Table.Td>
        <Badge
          size="sm"
          variant="light"
          color={APPLICABILITY_COLORS[row.applicability] ?? "slate"}
        >
          {row.applicability.replace(/_/g, " ")}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {row.description ?? "-"}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge
          size="sm"
          variant="light"
          color={row.is_active ? "success" : "slate"}
        >
          {row.is_active ? "Active" : "Inactive"}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            color="primary"
            onClick={() => openEditTax(row)}
            aria-label="Edit"
          >
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="danger"
            onClick={() => handleDeleteTax(row)}
            loading={deleteTaxMutation.isPending}
            aria-label="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  // ── Payment Method Rows ──────────────────────────────

  const paymentRows = (paymentMethods ?? []).map((row) => (
    <Table.Tr key={row.id}>
      <Table.Td>
        <Text size="sm" ff="monospace" fw={500}>
          {row.code}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{row.name}</Text>
      </Table.Td>
      <Table.Td>
        {row.is_default ? (
          <Badge size="sm" variant="light" color="primary">
            Default
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">-</Text>
        )}
      </Table.Td>
      <Table.Td>
        <Badge
          size="sm"
          variant="light"
          color={row.is_active ? "success" : "slate"}
        >
          {row.is_active ? "Active" : "Inactive"}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            color="primary"
            onClick={() => openEditPayment(row)}
            aria-label="Edit"
          >
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="danger"
            onClick={() => handleDeletePayment(row)}
            loading={deletePaymentMutation.isPending}
            aria-label="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  // ── Render ───────────────────────────────────────────

  return (
    <Stack gap="xl">
      {/* ── Tax Categories Section ─────────────────────── */}
      <div>
        <Group justify="space-between" mb="md">
          <Title order={5}>Tax Categories</Title>
          <Button
            size="sm"
            leftSection={<IconPlus size={14} />}
            onClick={openCreateTax}
          >
            Add Tax Category
          </Button>
        </Group>

        {taxLoading ? (
          <Stack align="center" py="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Loading tax categories...
            </Text>
          </Stack>
        ) : (
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Rate</Table.Th>
                <Table.Th>Applicability</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th w={80} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {taxRows.length > 0 ? (
                taxRows
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text ta="center" c="dimmed" py="lg">
                      No tax categories configured. Click "Add Tax Category" to
                      get started.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </div>

      {/* ── Payment Methods Section ────────────────────── */}
      <div>
        <Group justify="space-between" mb="md">
          <Title order={5}>Payment Methods</Title>
          <Button
            size="sm"
            leftSection={<IconPlus size={14} />}
            onClick={openCreatePayment}
          >
            Add Payment Method
          </Button>
        </Group>

        {paymentLoading ? (
          <Stack align="center" py="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Loading payment methods...
            </Text>
          </Stack>
        ) : (
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Default</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th w={80} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paymentRows.length > 0 ? (
                paymentRows
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="lg">
                      No payment methods configured. Click "Add Payment Method"
                      to get started.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────── */}
      <TaxCategoryModal
        opened={taxModalOpen}
        onClose={() => setTaxModalOpen(false)}
        editingRow={editingTax}
      />
      <PaymentMethodModal
        opened={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        editingRow={editingPayment}
      />
    </Stack>
  );
}
