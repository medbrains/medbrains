// Billing PackagesTab — split from billing.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Stack, Text, Textarea, TextInput } from "@mantine/core";
import type { BillingPackageFormInput, BillingPackageItemFormInput } from "@medbrains/schemas";
import { billingPackageFormSchema, billingPackageItemFormSchema } from "@medbrains/schemas";
import type { BillingPackage, CreatePackageRequest } from "@medbrains/types";
import { IconCheck, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Button, IconButton } from "@/components/ui";
import {
  billingIntegerOrFallback,
  billingNumberOrFallback,
  billingOptionalText,
} from "@/forms/billing.form";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { billingService } from "@/services/billing.service";

export function PackagesTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const packageDefaults: BillingPackageFormInput = {
    code: "",
    name: "",
    description: "",
    total_price: 0,
    discount_percent: 0,
    items: [],
  };
  const packageItemDefaults: BillingPackageItemFormInput = {
    charge_code: "",
    description: "",
    quantity: 1,
    unit_price: 0,
  };
  const {
    control: packageControl,
    register: registerPackage,
    reset: resetPackage,
    handleSubmit: handleSubmitPackage,
    formState: { errors: packageErrors },
  } = useForm<BillingPackageFormInput>({
    resolver: zodResolver(billingPackageFormSchema),
    defaultValues: packageDefaults,
  });
  const {
    control: packageItemControl,
    register: registerPackageItem,
    reset: resetPackageItem,
    handleSubmit: handleSubmitPackageItem,
    formState: { errors: packageItemErrors },
  } = useForm<BillingPackageItemFormInput>({
    resolver: zodResolver(billingPackageItemFormSchema),
    defaultValues: packageItemDefaults,
  });
  const {
    fields: packageItems,
    append: appendPackageItem,
    remove: removePackageItem,
  } = useFieldArray({ control: packageControl, name: "items" });

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["billing-packages"],
    queryFn: () => billingService.listPackages(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePackageRequest) => billingService.createPackage(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing-packages"] });
      setShowForm(false);
      resetPackage(packageDefaults);
      resetPackageItem(packageItemDefaults);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => billingService.deletePackage(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["billing-packages"] }),
  });

  const addPkgItem = (values: BillingPackageItemFormInput) => {
    appendPackageItem({
      charge_code: values.charge_code.trim(),
      description: values.description.trim(),
      quantity: billingIntegerOrFallback(values.quantity, 1),
      unit_price: billingNumberOrFallback(values.unit_price, 0),
    });
    resetPackageItem(packageItemDefaults);
  };

  const handleCreatePackage = (values: BillingPackageFormInput) => {
    createMutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      description: billingOptionalText(values.description),
      total_price: billingNumberOrFallback(values.total_price, 0),
      discount_percent: billingNumberOrFallback(values.discount_percent, 0),
      items: values.items.map((item) => ({
        charge_code: item.charge_code.trim(),
        description: item.description.trim(),
        quantity: billingIntegerOrFallback(item.quantity, 1),
        unit_price: billingNumberOrFallback(item.unit_price, 0),
      })),
    });
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      searchable: true,
      accessor: (row: BillingPackage) => row.code,
      render: (row: BillingPackage) => <Text fw={500}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      searchable: true,
      accessor: (row: BillingPackage) => row.name,
      render: (row: BillingPackage) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "total_price",
      label: "Price",
      sortable: true,
      sortValue: (row: BillingPackage) => Number(row.total_price),
      accessor: (row: BillingPackage) => row.total_price,
      render: (row: BillingPackage) => <Text size="sm">₹{row.total_price}</Text>,
    },
    {
      key: "discount_percent",
      label: "Discount",
      render: (row: BillingPackage) => <Text size="sm">{row.discount_percent}%</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: BillingPackage) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    {
      key: "actions",
      label: "",
      render: (row: BillingPackage) =>
        canCreate ? (
          <IconButton
            tone="danger"
            aria-label="Delete"
            onClick={() =>
              confirmDestructive({
                title: "Delete package",
                message: `Delete package "${row.name}"? This cannot be undone.`,
                confirmLabel: "Delete package",
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
            Add Package
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack component="form" gap="xs" onSubmit={handleSubmitPackage(handleCreatePackage)}>
          <Group grow>
            <TextInput
              label="Code"
              required
              error={packageErrors.code?.message}
              {...registerPackage("code")}
            />
            <TextInput
              label="Name"
              required
              error={packageErrors.name?.message}
              {...registerPackage("name")}
            />
          </Group>
          <Group grow>
            <Controller
              control={packageControl}
              name="total_price"
              render={({ field }) => (
                <NumberInput
                  label="Total Price"
                  required
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={packageErrors.total_price?.message}
                />
              )}
            />
            <Controller
              control={packageControl}
              name="discount_percent"
              render={({ field }) => (
                <NumberInput
                  label="Discount %"
                  min={0}
                  max={100}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={packageErrors.discount_percent?.message}
                />
              )}
            />
          </Group>
          <Textarea
            label="Description"
            error={packageErrors.description?.message}
            {...registerPackage("description")}
          />
          <Text fw={500} size="sm" mt="xs">
            Package Items ({packageItems.length})
          </Text>
          {packageErrors.items?.message && (
            <Text size="xs" c="danger">
              {packageErrors.items.message}
            </Text>
          )}
          {packageItems.map((item, index) => (
            <Group key={item.id} gap="xs">
              <Text size="xs" c="dimmed">
                {item.charge_code} — {item.description} x{item.quantity} @ ₹{item.unit_price}
              </Text>
              <IconButton
                size="xs"
                tone="danger"
                aria-label="Delete"
                onClick={() => removePackageItem(index)}
              >
                <IconTrash size={12} />
              </IconButton>
            </Group>
          ))}
          <Group grow>
            <TextInput
              size="xs"
              placeholder="Charge Code"
              error={packageItemErrors.charge_code?.message}
              {...registerPackageItem("charge_code")}
            />
            <TextInput
              size="xs"
              placeholder="Description"
              error={packageItemErrors.description?.message}
              {...registerPackageItem("description")}
            />
            <Controller
              control={packageItemControl}
              name="quantity"
              render={({ field }) => (
                <NumberInput
                  size="xs"
                  placeholder="Qty"
                  min={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={packageItemErrors.quantity?.message}
                />
              )}
            />
            <Controller
              control={packageItemControl}
              name="unit_price"
              render={({ field }) => (
                <NumberInput
                  size="xs"
                  placeholder="Price"
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={packageItemErrors.unit_price?.message}
                />
              )}
            />
            <Button
              tone="secondary"
              size="xs"
              type="button"
              onClick={handleSubmitPackageItem(addPkgItem)}
            >
              + Item
            </Button>
          </Group>
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save Package
          </Button>
        </Stack>
      )}
      <DataTable
        columns={columns}
        data={packages}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search code or name"
        exportable
        exportFileName="billing-packages"
      />
    </Stack>
  );
}

// ── Rate Plans Tab ──────────────────────────────────────
