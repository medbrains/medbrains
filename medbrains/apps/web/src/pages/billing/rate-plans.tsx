// Billing RatePlansTab — split from billing.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import type { BillingRatePlanFormInput, BillingRatePlanItemFormInput } from "@medbrains/schemas";
import { billingRatePlanFormSchema, billingRatePlanItemFormSchema } from "@medbrains/schemas";
import type { CreateRatePlanRequest, RatePlan } from "@medbrains/types";
import { IconCheck, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, Button, IconButton } from "@/components/ui";
import { billingNumberOrFallback, billingOptionalText } from "@/forms/billing.form";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { billingService } from "@/services/billing.service";

export function RatePlansTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const ratePlanDefaults: BillingRatePlanFormInput = {
    name: "",
    description: "",
    patient_category: "",
    items: [],
  };
  const ratePlanItemDefaults: BillingRatePlanItemFormInput = {
    charge_code: "",
    override_price: 0,
  };
  const {
    control: ratePlanControl,
    register: registerRatePlan,
    reset: resetRatePlan,
    handleSubmit: handleSubmitRatePlan,
    formState: { errors: ratePlanErrors },
  } = useForm<BillingRatePlanFormInput>({
    resolver: zodResolver(billingRatePlanFormSchema),
    defaultValues: ratePlanDefaults,
  });
  const {
    control: ratePlanItemControl,
    register: registerRatePlanItem,
    reset: resetRatePlanItem,
    handleSubmit: handleSubmitRatePlanItem,
    formState: { errors: ratePlanItemErrors },
  } = useForm<BillingRatePlanItemFormInput>({
    resolver: zodResolver(billingRatePlanItemFormSchema),
    defaultValues: ratePlanItemDefaults,
  });
  const {
    fields: ratePlanItems,
    append: appendRatePlanItem,
    remove: removeRatePlanItem,
  } = useFieldArray({ control: ratePlanControl, name: "items" });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["rate-plans"],
    queryFn: () => billingService.listRatePlans(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateRatePlanRequest) => billingService.createRatePlan(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rate-plans"] });
      setShowForm(false);
      resetRatePlan(ratePlanDefaults);
      resetRatePlanItem(ratePlanItemDefaults);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => billingService.deleteRatePlan(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rate-plans"] }),
  });

  const addRpItem = (values: BillingRatePlanItemFormInput) => {
    appendRatePlanItem({
      charge_code: values.charge_code.trim(),
      override_price: billingNumberOrFallback(values.override_price, 0),
    });
    resetRatePlanItem(ratePlanItemDefaults);
  };

  const handleCreateRatePlan = (values: BillingRatePlanFormInput) => {
    createMutation.mutate({
      name: values.name.trim(),
      description: billingOptionalText(values.description),
      patient_category: billingOptionalText(values.patient_category),
      items: values.items.map((item) => ({
        charge_code: item.charge_code.trim(),
        override_price: billingNumberOrFallback(item.override_price, 0),
      })),
    });
  };

  const columns = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      searchable: true,
      accessor: (row: RatePlan) => row.name,
      render: (row: RatePlan) => <Text fw={500}>{row.name}</Text>,
    },
    {
      key: "patient_category",
      label: "Category",
      sortable: true,
      searchable: true,
      accessor: (row: RatePlan) => row.patient_category ?? "All",
      render: (row: RatePlan) => <Text size="sm">{row.patient_category ?? "All"}</Text>,
    },
    {
      key: "is_default",
      label: "Default",
      render: (row: RatePlan) =>
        row.is_default ? (
          <Badge size="xs" tone="primary">
            Default
          </Badge>
        ) : null,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: RatePlan) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    {
      key: "actions",
      label: "",
      render: (row: RatePlan) =>
        canCreate ? (
          <IconButton
            tone="danger"
            aria-label="Delete"
            onClick={() =>
              confirmDestructive({
                title: "Delete rate plan",
                message: `Delete rate plan "${row.name}"? This cannot be undone.`,
                confirmLabel: "Delete rate plan",
                onConfirm: () => deleteMutation.mutate(row.id),
              })
            }
          >
            <IconTrash size={14} />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowForm(!showForm)}
          >
            Add Rate Plan
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack component="form" gap="xs" onSubmit={handleSubmitRatePlan(handleCreateRatePlan)}>
          <Group grow>
            <TextInput
              label="Name"
              required
              error={ratePlanErrors.name?.message}
              {...registerRatePlan("name")}
            />
            <Controller
              control={ratePlanControl}
              name="patient_category"
              render={({ field }) => (
                <Select
                  label="Patient Category"
                  data={[
                    { value: "general", label: "General" },
                    { value: "insurance", label: "Insurance" },
                    { value: "corporate", label: "Corporate" },
                    { value: "staff", label: "Staff" },
                  ]}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={ratePlanErrors.patient_category?.message}
                  clearable
                />
              )}
            />
          </Group>
          <Textarea
            label="Description"
            error={ratePlanErrors.description?.message}
            {...registerRatePlan("description")}
          />
          <Text fw={500} size="sm" mt="xs">
            Price Overrides ({ratePlanItems.length})
          </Text>
          {ratePlanErrors.items?.message && (
            <Text size="xs" c="danger">
              {ratePlanErrors.items.message}
            </Text>
          )}
          {ratePlanItems.map((item, index) => (
            <Group key={item.id} gap="xs">
              <Text size="xs" c="dimmed">
                {item.charge_code} → ₹{item.override_price}
              </Text>
              <IconButton
                size="xs"
                tone="danger"
                aria-label="Delete"
                onClick={() => removeRatePlanItem(index)}
              >
                <IconTrash size={12} />
              </IconButton>
            </Group>
          ))}
          <Group grow>
            <TextInput
              size="xs"
              placeholder="Charge Code"
              error={ratePlanItemErrors.charge_code?.message}
              {...registerRatePlanItem("charge_code")}
            />
            <Controller
              control={ratePlanItemControl}
              name="override_price"
              render={({ field }) => (
                <NumberInput
                  size="xs"
                  placeholder="Override Price"
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={ratePlanItemErrors.override_price?.message}
                />
              )}
            />
            <Button
              tone="secondary"
              size="xs"
              type="button"
              onClick={handleSubmitRatePlanItem(addRpItem)}
            >
              + Override
            </Button>
          </Group>
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save Rate Plan
          </Button>
        </Stack>
      )}
      <DataTable
        columns={columns}
        data={plans}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search name or category"
        exportable
        exportFileName="rate-plans"
      />
    </Stack>
  );
}

// ── Refunds & Credits Tab ───────────────────────────────
