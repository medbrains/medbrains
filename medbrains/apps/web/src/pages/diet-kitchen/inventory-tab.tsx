// IPD InventoryTab — split from diet-kitchen.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Card, Drawer, Group, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { KitchenInventoryFormInput } from "@medbrains/schemas";
import { kitchenInventoryFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateKitchenInventoryRequest, KitchenInventory } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, Button } from "@/components/ui";
import { dietOptionalNumber, dietOptionalText } from "@/forms/diet-kitchen.form";
import { dietKitchenService } from "@/services/diet-kitchen.service";
import { notifyMutationError, rowsOrEmpty } from "./shared";

export function InventoryTab() {
  const qc = useQueryClient();
  const canViewInventory = useHasPermission(P.DIET.INVENTORY_LIST);
  const canManage = useHasPermission(P.DIET.INVENTORY_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data: itemsData, isLoading } = useQuery({
    queryKey: ["kitchen-inventory"],
    queryFn: dietKitchenService.listKitchenInventory,
    enabled: canViewInventory,
  });
  const items = canViewInventory ? rowsOrEmpty(itemsData) : [];

  const inventoryForm = useForm<KitchenInventoryFormInput>({
    resolver: zodResolver(kitchenInventoryFormSchema),
    defaultValues: {
      item_name: "",
      category: "",
      unit: "",
      current_stock: "",
      reorder_level: "",
      supplier: "",
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = inventoryForm;

  const createMut = useMutation({
    mutationFn: (data: CreateKitchenInventoryRequest) =>
      dietKitchenService.createKitchenInventoryItem(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kitchen-inventory"] });
      notifications.show({ title: "Success", message: "Item added", color: "success" });
      close();
      reset();
    },
    onError: notifyMutationError("Could not add inventory item"),
  });

  const submitInventoryItem = (values: KitchenInventoryFormInput) => {
    createMut.mutate({
      item_name: values.item_name.trim(),
      category: dietOptionalText(values.category),
      unit: dietOptionalText(values.unit),
      current_stock: dietOptionalNumber(values.current_stock),
      reorder_level: dietOptionalNumber(values.reorder_level),
      supplier: dietOptionalText(values.supplier),
    });
  };

  const columns = [
    {
      key: "item_name",
      label: "Item",
      render: (r: KitchenInventory) => <Text fw={500}>{r.item_name}</Text>,
    },
    {
      key: "category",
      label: "Category",
      render: (r: KitchenInventory) => <Text size="sm">{r.category ?? "-"}</Text>,
    },
    {
      key: "current_stock",
      label: "Stock",
      render: (r: KitchenInventory) => {
        const low = r.reorder_level && r.current_stock <= r.reorder_level;
        return (
          <Text size="sm" c={low ? "danger" : undefined} fw={low ? 700 : undefined}>
            {r.current_stock} {r.unit}
          </Text>
        );
      },
    },
    {
      key: "reorder_level",
      label: "Reorder Level",
      render: (r: KitchenInventory) => (
        <Text size="sm">
          {r.reorder_level ?? "-"} {r.unit}
        </Text>
      ),
    },
    {
      key: "supplier",
      label: "Supplier",
      render: (r: KitchenInventory) => <Text size="sm">{r.supplier ?? "-"}</Text>,
    },
    {
      key: "expiry_date",
      label: "Expiry",
      render: (r: KitchenInventory) => <Text size="sm">{r.expiry_date ?? "-"}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (r: KitchenInventory) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Yes" : "No"}</Badge>
      ),
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Add Item
          </Button>
        )}
      </Group>
      {canViewInventory ? (
        <DataTable
          columns={columns}
          data={items}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No inventory items"
        />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            Inventory list is not available for your role. You can still add an item when inventory
            management is allowed.
          </Text>
        </Card>
      )}
      <Drawer opened={opened} onClose={close} title="Add Inventory Item" position="right" size="xl">
        <Stack component="form" onSubmit={handleSubmit(submitInventoryItem)}>
          <Controller
            name="item_name"
            control={control}
            render={({ field }) => (
              <TextInput label="Item Name" required {...field} error={errors.item_name?.message} />
            )}
          />
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <TextInput label="Category" {...field} error={errors.category?.message} />
            )}
          />
          <Controller
            name="unit"
            control={control}
            render={({ field }) => (
              <TextInput label="Unit" placeholder="kg" {...field} error={errors.unit?.message} />
            )}
          />
          <Controller
            name="current_stock"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Current Stock"
                value={field.value}
                onChange={field.onChange}
                error={errors.current_stock?.message}
              />
            )}
          />
          <Controller
            name="reorder_level"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Reorder Level"
                value={field.value}
                onChange={field.onChange}
                error={errors.reorder_level?.message}
              />
            )}
          />
          <Controller
            name="supplier"
            control={control}
            render={({ field }) => (
              <TextInput label="Supplier" {...field} error={errors.supplier?.message} />
            )}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Add Item
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  FSSAI Audits Tab
// ══════════════════════════════════════════════════════════
