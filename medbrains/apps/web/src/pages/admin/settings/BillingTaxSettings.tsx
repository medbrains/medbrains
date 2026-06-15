import { zodResolver } from "@hookform/resolvers/zod";
import {
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  type PaymentMethodSettingsFormInput,
  paymentMethodSettingsFormSchema,
  type TaxApplicabilityFormValue,
  type TaxCategorySettingsFormInput,
  taxApplicabilityFormSchema,
  taxCategorySettingsFormSchema,
} from "@medbrains/schemas";
import type { PaymentMethodRow, TaxCategoryRow } from "@medbrains/types";
import { IconCheck, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Badge, type BadgeTone, Button, IconButton, Table } from "@/components/ui";
import { settingsSetupService } from "@/services/settingsSetup.service";

// ── Constants ─────────────────────────────────────────────

const APPLICABILITY_OPTIONS = [
  { value: "taxable", label: "Taxable" },
  { value: "exempt", label: "Exempt" },
  { value: "zero_rated", label: "Zero Rated" },
] satisfies Array<{ value: TaxApplicabilityFormValue; label: string }>;

const APPLICABILITY_TONE: Record<string, BadgeTone> = {
  taxable: "primary",
  exempt: "success",
  zero_rated: "neutral",
};

const EMPTY_TAX_FORM: TaxCategorySettingsFormInput = {
  code: "",
  name: "",
  rate_percent: "",
  applicability: "taxable",
  description: "",
};

function taxFormFromRow(row: TaxCategoryRow): TaxCategorySettingsFormInput {
  return {
    code: row.code,
    name: row.name,
    rate_percent: row.rate_percent,
    applicability: taxApplicabilityFormSchema.catch("taxable").parse(row.applicability),
    description: row.description ?? "",
  };
}

function taxFormToPayload(form: TaxCategorySettingsFormInput) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    rate_percent: Number(form.rate_percent),
    applicability: form.applicability,
    description: form.description.trim() || undefined,
  };
}

const EMPTY_PAYMENT_FORM: PaymentMethodSettingsFormInput = {
  code: "",
  name: "",
  is_default: false,
};

function paymentFormFromRow(row: PaymentMethodRow): PaymentMethodSettingsFormInput {
  return {
    code: row.code,
    name: row.name,
    is_default: row.is_default,
  };
}

function paymentFormToPayload(form: PaymentMethodSettingsFormInput) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
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

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<TaxCategorySettingsFormInput>({
    resolver: zodResolver(taxCategorySettingsFormSchema),
    defaultValues: EMPTY_TAX_FORM,
    values: editingRow ? taxFormFromRow(editingRow) : EMPTY_TAX_FORM,
  });

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof taxFormToPayload>) =>
      settingsSetupService.createTaxCategory(data),
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
    mutationFn: (data: ReturnType<typeof taxFormToPayload>) => {
      if (!editingRow) throw new Error("No tax category selected");
      return settingsSetupService.updateTaxCategory(editingRow.id, data);
    },
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

  const submitTaxCategory = handleSubmit((form) => {
    const payload = taxFormToPayload(form);

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
      title={isEdit ? "Edit Tax Category" : "Add Tax Category"}
      size="md"
    >
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label="Code"
            placeholder="GST-18"
            error={errors.code?.message}
            {...register("code")}
            required
          />
          <TextInput
            label="Name"
            placeholder="GST 18%"
            error={errors.name?.message}
            {...register("name")}
            required
          />
        </Group>

        <Group grow>
          <Controller
            control={control}
            name="rate_percent"
            render={({ field }) => (
              <NumberInput
                label="Rate (%)"
                placeholder="18.00"
                value={field.value}
                onChange={field.onChange}
                error={errors.rate_percent?.message}
                min={0}
                max={100}
                decimalScale={2}
                suffix="%"
                required
              />
            )}
          />
          <Controller
            control={control}
            name="applicability"
            render={({ field }) => (
              <Select
                label="Applicability"
                data={APPLICABILITY_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "taxable")}
                error={errors.applicability?.message}
                placeholder="Select..."
                required
              />
            )}
          />
        </Group>

        <Textarea
          label="Description"
          placeholder="Optional description"
          error={errors.description?.message}
          {...register("description")}
          autosize
          minRows={2}
          maxRows={4}
        />

        <Group justify="flex-end" mt="md">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            onClick={() => void submitTaxCategory()}
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

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<PaymentMethodSettingsFormInput>({
    resolver: zodResolver(paymentMethodSettingsFormSchema),
    defaultValues: EMPTY_PAYMENT_FORM,
    values: editingRow ? paymentFormFromRow(editingRow) : EMPTY_PAYMENT_FORM,
  });

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof paymentFormToPayload>) =>
      settingsSetupService.createPaymentMethod(data),
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
    mutationFn: (data: ReturnType<typeof paymentFormToPayload>) => {
      if (!editingRow) throw new Error("No payment method selected");
      return settingsSetupService.updatePaymentMethod(editingRow.id, data);
    },
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

  const submitPaymentMethod = handleSubmit((form) => {
    const payload = paymentFormToPayload(form);

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
      title={isEdit ? "Edit Payment Method" : "Add Payment Method"}
      size="sm"
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="CASH"
          error={errors.code?.message}
          {...register("code")}
          required
        />
        <TextInput
          label="Name"
          placeholder="Cash Payment"
          error={errors.name?.message}
          {...register("name")}
          required
        />
        <Controller
          control={control}
          name="is_default"
          render={({ field }) => (
            <Switch
              label="Default payment method"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
            />
          )}
        />

        <Group justify="flex-end" mt="md">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            onClick={() => void submitPaymentMethod()}
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
    queryFn: () => settingsSetupService.listTaxCategories(),
  });

  const deleteTaxMutation = useMutation({
    mutationFn: (id: string) => settingsSetupService.deleteTaxCategory(id),
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
    queryFn: () => settingsSetupService.listPaymentMethods(),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => settingsSetupService.deletePaymentMethod(id),
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
        <Badge size="sm" tone={APPLICABILITY_TONE[row.applicability] ?? "neutral"}>
          {row.applicability.replace(/_/g, " ")}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {row.description ?? "-"}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge size="sm" tone={row.is_active ? "success" : "neutral"}>
          {row.is_active ? "Active" : "Inactive"}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          <IconButton tone="primary" onClick={() => openEditTax(row)} aria-label="Edit">
            <IconPencil size={16} />
          </IconButton>
          <IconButton
            tone="danger"
            onClick={() => handleDeleteTax(row)}
            loading={deleteTaxMutation.isPending}
            aria-label="Delete"
          >
            <IconTrash size={16} />
          </IconButton>
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
          <Badge size="sm" tone="primary">
            Default
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            -
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <Badge size="sm" tone={row.is_active ? "success" : "neutral"}>
          {row.is_active ? "Active" : "Inactive"}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          <IconButton tone="primary" onClick={() => openEditPayment(row)} aria-label="Edit">
            <IconPencil size={16} />
          </IconButton>
          <IconButton
            tone="danger"
            onClick={() => handleDeletePayment(row)}
            loading={deletePaymentMutation.isPending}
            aria-label="Delete"
          >
            <IconTrash size={16} />
          </IconButton>
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
            tone="primary"
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
                      No tax categories configured. Click "Add Tax Category" to get started.
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
            tone="primary"
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
                      No payment methods configured. Click "Add Payment Method" to get started.
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
