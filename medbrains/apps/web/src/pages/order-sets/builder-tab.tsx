// Order-sets BuilderTab — split from order-sets.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { OrderSetItemFormInput } from "@medbrains/schemas";
import { orderSetItemFormSchema } from "@medbrains/schemas";
import type { AddOrderSetItemRequest, OrderSetTemplateItem } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, IconButton } from "@/components/ui";
import {
  orderSetItemTypeOptions,
  orderSetOptionalInteger,
  orderSetOptionalText,
} from "@/forms/order-sets.form";
import { orderSetsService } from "@/services/order-sets.service";
import { statusColorTone } from "./shared";

const emptyItemForm: OrderSetItemFormInput = {
  item_type: "lab",
  sort_order: 0,
  is_mandatory: false,
  default_selected: true,
  lab_priority: "",
  lab_notes: "",
  drug_name: "",
  dosage: "",
  frequency: "",
  duration: "",
  route: "",
  med_instructions: "",
  task_type: "",
  task_description: "",
  task_frequency: "",
  diet_type: "",
  diet_instructions: "",
};

export function BuilderTab({ canUpdate }: { canUpdate: boolean }) {
  const qc = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [itemDrawer, { open: openItem, close: closeItem }] = useDisclosure(false);

  // List templates for picker
  const { data: templates = [] } = useQuery({
    queryKey: ["order-set-templates"],
    queryFn: () => orderSetsService.listOrderSetTemplates({ is_active: true }),
  });

  // Fetch selected template with items
  const { data: templateDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["order-set-template-detail", selectedTemplateId],
    queryFn: () => {
      if (!selectedTemplateId) throw new Error("Template not selected");
      return orderSetsService.getOrderSetTemplate(selectedTemplateId);
    },
    enabled: !!selectedTemplateId,
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<OrderSetItemFormInput>({
    resolver: zodResolver(orderSetItemFormSchema),
    defaultValues: emptyItemForm,
  });
  const selectedItemType = watch("item_type");

  const addItemMut = useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: AddOrderSetItemRequest }) =>
      orderSetsService.addOrderSetItem(templateId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-set-template-detail", selectedTemplateId] });
      notifications.show({ title: "Added", message: "Item added to template", color: "success" });
      closeItem();
      reset(emptyItemForm);
    },
  });

  const deleteItemMut = useMutation({
    mutationFn: ({ templateId, itemId }: { templateId: string; itemId: string }) =>
      orderSetsService.deleteOrderSetItem(templateId, itemId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-set-template-detail", selectedTemplateId] });
      notifications.show({
        title: "Removed",
        message: "Item removed from template",
        color: "warning",
      });
    },
  });

  const submitItem = (values: OrderSetItemFormInput) => {
    if (!selectedTemplateId) return;
    addItemMut.mutate({
      templateId: selectedTemplateId,
      data: {
        item_type: values.item_type,
        sort_order: orderSetOptionalInteger(values.sort_order),
        is_mandatory: values.is_mandatory,
        default_selected: values.default_selected,
        lab_priority: orderSetOptionalText(values.lab_priority),
        lab_notes: orderSetOptionalText(values.lab_notes),
        drug_name: orderSetOptionalText(values.drug_name),
        dosage: orderSetOptionalText(values.dosage),
        frequency: orderSetOptionalText(values.frequency),
        duration: orderSetOptionalText(values.duration),
        route: orderSetOptionalText(values.route),
        med_instructions: orderSetOptionalText(values.med_instructions),
        task_type: orderSetOptionalText(values.task_type),
        task_description: orderSetOptionalText(values.task_description),
        task_frequency: orderSetOptionalText(values.task_frequency),
        diet_type: orderSetOptionalText(values.diet_type),
        diet_instructions: orderSetOptionalText(values.diet_instructions),
      },
    });
  };

  const templateOptions = templates.map((t) => ({
    value: t.id,
    label: `${t.name}${t.code ? ` (${t.code})` : ""} — v${t.version}`,
  }));

  const itemColumns: Column<OrderSetTemplateItem>[] = [
    {
      key: "sort_order",
      label: "#",
      render: (r) => <Text size="sm">{r.sort_order}</Text>,
    },
    {
      key: "item_type",
      label: "Type",
      render: (r) => (
        <Badge tone={statusColorTone(r.item_type)} size="sm">
          {r.item_type}
        </Badge>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (r) => {
        if (r.item_type === "lab") return <Text size="sm">{r.lab_notes ?? "Lab test"}</Text>;
        if (r.item_type === "medication")
          return (
            <Text size="sm">
              {r.drug_name ?? "Medication"} {r.dosage ? `— ${r.dosage}` : ""}
            </Text>
          );
        if (r.item_type === "nursing")
          return <Text size="sm">{r.task_description ?? r.task_type ?? "Nursing task"}</Text>;
        return <Text size="sm">{r.diet_type ?? "Diet order"}</Text>;
      },
    },
    {
      key: "mandatory",
      label: "Mandatory",
      render: (r) =>
        r.is_mandatory ? (
          <Badge tone="danger" size="xs">
            Required
          </Badge>
        ) : (
          <Text size="xs" c="dimmed">
            Optional
          </Text>
        ),
    },
    {
      key: "default",
      label: "Default",
      render: (r) => <Text size="sm">{r.default_selected ? "Selected" : "—"}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canUpdate ? (
          <Tooltip label="Remove">
            <IconButton
              size="sm"
              tone="danger"
              onClick={() => {
                if (selectedTemplateId) {
                  deleteItemMut.mutate({ templateId: selectedTemplateId, itemId: r.id });
                }
              }}
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <>
      <Group mb="md" justify="space-between">
        <Select
          placeholder="Select a template to edit"
          data={templateOptions}
          value={selectedTemplateId}
          onChange={setSelectedTemplateId}
          searchable
          size="sm"
          w={400}
        />
        {canUpdate && selectedTemplateId && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(emptyItemForm);
              openItem();
            }}
            size="sm"
          >
            Add Item
          </Button>
        )}
      </Group>

      {selectedTemplateId && templateDetail && (
        <>
          <Card withBorder mb="md" p="sm">
            <Group justify="space-between">
              <div>
                <Text fw={600}>{templateDetail.template.name}</Text>
                <Text size="sm" c="dimmed">
                  {templateDetail.template.description ?? "No description"} — v
                  {templateDetail.template.version}
                </Text>
              </div>
              <Badge tone={statusColorTone(templateDetail.template.context)}>
                {templateDetail.template.context.replace(/_/g, " ")}
              </Badge>
            </Group>
          </Card>

          <DataTable
            columns={itemColumns}
            data={templateDetail.items}
            loading={detailLoading}
            rowKey={(r) => r.id}
          />
        </>
      )}

      <Drawer
        opened={itemDrawer}
        onClose={closeItem}
        title="Add Item to Order Set"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(submitItem)}>
          <Controller
            name="item_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Item Type"
                data={orderSetItemTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "lab")}
                required
                error={errors.item_type?.message}
              />
            )}
          />
          <Controller
            name="sort_order"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Sort Order"
                value={field.value}
                onChange={field.onChange}
                error={errors.sort_order?.message}
              />
            )}
          />
          <Controller
            name="is_mandatory"
            control={control}
            render={({ field }) => (
              <Switch
                label="Mandatory (cannot be deselected)"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            name="default_selected"
            control={control}
            render={({ field }) => (
              <Switch
                label="Selected by default"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />

          {/* Type-specific fields */}
          {selectedItemType === "lab" && (
            <>
              <Controller
                name="lab_priority"
                control={control}
                render={({ field }) => (
                  <TextInput
                    label="Lab Priority"
                    placeholder="routine / urgent / stat"
                    {...field}
                  />
                )}
              />
              <Controller
                name="lab_notes"
                control={control}
                render={({ field }) => <Textarea label="Lab Notes" {...field} />}
              />
            </>
          )}

          {selectedItemType === "medication" && (
            <>
              <Controller
                name="drug_name"
                control={control}
                render={({ field }) => <TextInput label="Drug Name" {...field} />}
              />
              <Controller
                name="dosage"
                control={control}
                render={({ field }) => (
                  <TextInput label="Dosage" placeholder="e.g. 500mg" {...field} />
                )}
              />
              <Controller
                name="frequency"
                control={control}
                render={({ field }) => (
                  <TextInput label="Frequency" placeholder="e.g. TID, BD" {...field} />
                )}
              />
              <Controller
                name="duration"
                control={control}
                render={({ field }) => (
                  <TextInput label="Duration" placeholder="e.g. 5 days" {...field} />
                )}
              />
              <Controller
                name="route"
                control={control}
                render={({ field }) => (
                  <TextInput label="Route" placeholder="e.g. PO, IV" {...field} />
                )}
              />
              <Controller
                name="med_instructions"
                control={control}
                render={({ field }) => <Textarea label="Instructions" {...field} />}
              />
            </>
          )}

          {selectedItemType === "nursing" && (
            <>
              <Controller
                name="task_type"
                control={control}
                render={({ field }) => (
                  <TextInput
                    label="Task Type"
                    placeholder="e.g. vital_check, wound_care"
                    {...field}
                  />
                )}
              />
              <Controller
                name="task_description"
                control={control}
                render={({ field }) => <Textarea label="Task Description" {...field} />}
              />
              <Controller
                name="task_frequency"
                control={control}
                render={({ field }) => (
                  <TextInput label="Frequency" placeholder="e.g. Q4H, daily" {...field} />
                )}
              />
            </>
          )}

          {selectedItemType === "diet" && (
            <>
              <Controller
                name="diet_type"
                control={control}
                render={({ field }) => (
                  <TextInput label="Diet Type" placeholder="e.g. regular, liquid, NPO" {...field} />
                )}
              />
              <Controller
                name="diet_instructions"
                control={control}
                render={({ field }) => <Textarea label="Diet Instructions" {...field} />}
              />
            </>
          )}

          <Button tone="primary" type="submit" loading={addItemMut.isPending}>
            Add Item
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3: Activations
// ══════════════════════════════════════════════════════════
