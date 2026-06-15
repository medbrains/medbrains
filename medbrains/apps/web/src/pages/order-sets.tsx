import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { OrderSetItemFormInput, OrderSetTemplateFormInput } from "@medbrains/schemas";
import { orderSetItemFormSchema, orderSetTemplateFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AddOrderSetItemRequest,
  CreateOrderSetTemplateRequest,
  OrderSetActivation,
  OrderSetTemplate,
  OrderSetTemplateItem,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconChartBar,
  IconCheck,
  IconCopy,
  IconHistory,
  IconListDetails,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import { Icd11CodeSelect } from "@/components/Clinical/Icd11CodeSelect";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  orderSetContextOptions,
  orderSetItemTypeOptions,
  orderSetOptionalInteger,
  orderSetOptionalText,
  parseTriggerDiagnoses,
} from "@/forms/order-sets.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { statusColor } from "@/lib/status-colors";
import { orderSetsService } from "@/services/order-sets.service";

// ── Constants ──────────────────────────────────────────

function statusColorTone(v: string): BadgeTone {
  const c = statusColor(v);
  const m: Record<string, BadgeTone> = {
    success: "success",
    danger: "danger",
    warning: "warning",
    primary: "primary",
    info: "info",
    slate: "neutral",
    gray: "neutral",
    teal: "success",
    green: "success",
    red: "danger",
    yellow: "warning",
    orange: "warning",
    blue: "info",
    violet: "accent",
    cinnabar: "accent",
  };
  return (c ? m[c] : undefined) ?? "neutral";
}

const emptyTemplateForm: OrderSetTemplateFormInput = {
  name: "",
  code: "",
  description: "",
  context: "general",
  surgery_type: "",
  trigger_diagnoses_text: "",
};

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

// ── Page ───────────────────────────────────────────────

export function OrderSetsPage() {
  useRequirePermission(P.ORDER_SETS.TEMPLATES_LIST);

  const canCreate = useHasPermission(P.ORDER_SETS.TEMPLATES_CREATE);
  const canUpdate = useHasPermission(P.ORDER_SETS.TEMPLATES_UPDATE);
  const canApprove = useHasPermission(P.ORDER_SETS.TEMPLATES_APPROVE);
  const canViewActivations = useHasPermission(P.ORDER_SETS.ACTIVATION_VIEW);
  const canViewAnalytics = useHasPermission(P.ORDER_SETS.ANALYTICS_VIEW);

  const [tab, setTab] = useState<string | null>("templates");

  return (
    <div>
      <PageHeader title="Order Sets" subtitle="Reusable bundles of orders for standardized care" />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="templates" leftSection={<IconListDetails size={16} />}>
            Templates
          </Tabs.Tab>
          <Tabs.Tab value="builder" leftSection={<IconPencil size={16} />}>
            Builder
          </Tabs.Tab>
          {canViewActivations && (
            <Tabs.Tab value="activations" leftSection={<IconHistory size={16} />}>
              Activations
            </Tabs.Tab>
          )}
          {canViewAnalytics && (
            <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
              Analytics
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="templates" pt="md">
          <TemplatesTab canCreate={canCreate} canUpdate={canUpdate} canApprove={canApprove} />
        </Tabs.Panel>
        <Tabs.Panel value="builder" pt="md">
          <BuilderTab canUpdate={canUpdate} />
        </Tabs.Panel>
        {canViewActivations && (
          <Tabs.Panel value="activations" pt="md">
            <ActivationsTab />
          </Tabs.Panel>
        )}
        {canViewAnalytics && (
          <Tabs.Panel value="analytics" pt="md">
            <AnalyticsTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1: Templates
// ══════════════════════════════════════════════════════════

function TemplatesTab({
  canCreate,
  canUpdate,
  canApprove,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canApprove: boolean;
}) {
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [contextFilter, setContextFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTriggerDiagnosis, setSelectedTriggerDiagnosis] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["order-set-templates", contextFilter, search],
    queryFn: () =>
      orderSetsService.listOrderSetTemplates({
        context: contextFilter ?? undefined,
        search: search || undefined,
        is_active: true,
      }),
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OrderSetTemplateFormInput>({
    resolver: zodResolver(orderSetTemplateFormSchema),
    defaultValues: emptyTemplateForm,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateOrderSetTemplateRequest) =>
      orderSetsService.createOrderSetTemplate(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-set-templates"] });
      notifications.show({
        title: "Created",
        message: "Order set template created",
        color: "success",
      });
      close();
      reset(emptyTemplateForm);
      setSelectedTriggerDiagnosis("");
    },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => orderSetsService.approveOrderSetTemplate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-set-templates"] });
      notifications.show({
        title: "Approved",
        message: "Template approved for clinical use",
        color: "success",
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => orderSetsService.deleteOrderSetTemplate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-set-templates"] });
      notifications.show({
        title: "Deactivated",
        message: "Template deactivated",
        color: "warning",
      });
    },
  });

  const versionMut = useMutation({
    mutationFn: (id: string) => orderSetsService.createOrderSetVersion(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-set-templates"] });
      notifications.show({
        title: "New Version",
        message: "New version created",
        color: "primary",
      });
    },
  });

  const columns: Column<OrderSetTemplate>[] = [
    {
      key: "name",
      label: "Name",
      render: (r) => (
        <div>
          <Text size="sm" fw={500}>
            {r.name}
          </Text>
          {r.code && (
            <Text size="xs" c="dimmed">
              {r.code}
            </Text>
          )}
        </div>
      ),
    },
    {
      key: "context",
      label: "Context",
      render: (r) => (
        <Badge tone={statusColorTone(r.context)} size="sm">
          {r.context.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "version",
      label: "Version",
      render: (r) => <Text size="sm">v{r.version}</Text>,
    },
    {
      key: "approved",
      label: "Approved",
      render: (r) =>
        r.approved_at ? (
          <Badge tone="success" size="sm">
            Approved
          </Badge>
        ) : (
          <Badge tone="warning" size="sm">
            Pending
          </Badge>
        ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          {canApprove && !r.approved_at && (
            <Tooltip label="Approve">
              <IconButton
                size="sm"
                tone="success"
                onClick={() => approveMut.mutate(r.id)}
                aria-label="Confirm"
              >
                <IconCheck size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip label="New Version">
              <IconButton
                size="sm"
                tone="primary"
                onClick={() => versionMut.mutate(r.id)}
                aria-label="Copy"
              >
                <IconCopy size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip label="Deactivate">
              <IconButton
                size="sm"
                tone="danger"
                onClick={() => deleteMut.mutate(r.id)}
                aria-label="Delete"
              >
                <IconTrash size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  const submitTemplate = (values: OrderSetTemplateFormInput) => {
    createMut.mutate({
      name: values.name.trim(),
      code: orderSetOptionalText(values.code),
      description: orderSetOptionalText(values.description),
      context: values.context,
      surgery_type: orderSetOptionalText(values.surgery_type),
      trigger_diagnoses: parseTriggerDiagnoses(values.trigger_diagnoses_text),
    });
  };

  const appendTriggerDiagnosis = (code: string) => {
    const current = watch("trigger_diagnoses_text") ?? "";
    const existing = current
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!existing.some((item) => item.toLowerCase() === code.toLowerCase())) {
      setValue("trigger_diagnoses_text", [...existing, code].join(", "), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  return (
    <>
      <Group mb="md" justify="space-between">
        <Group>
          <TextInput
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            size="sm"
            w={240}
          />
          <Select
            placeholder="All contexts"
            data={orderSetContextOptions}
            value={contextFilter}
            onChange={setContextFilter}
            clearable
            size="sm"
            w={200}
          />
        </Group>
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(emptyTemplateForm);
              open();
            }}
            size="sm"
          >
            New Template
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={templates} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={opened}
        onClose={close}
        title="Create Order Set Template"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(submitTemplate)}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextInput label="Name" required {...field} error={errors.name?.message} />
            )}
          />
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <TextInput label="Code (mnemonic)" placeholder="e.g. PNEUM-WU" {...field} />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => <Textarea label="Description" {...field} />}
          />
          <Controller
            name="context"
            control={control}
            render={({ field }) => (
              <Select
                label="Context"
                data={orderSetContextOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "general")}
                required
                error={errors.context?.message}
              />
            )}
          />
          <Controller
            name="surgery_type"
            control={control}
            render={({ field }) => (
              <TextInput label="Surgery Type" placeholder="For pre-operative sets" {...field} />
            )}
          />
          <Icd11CodeSelect
            label="Add trigger diagnosis"
            value={selectedTriggerDiagnosis || null}
            onChange={(value) => {
              setSelectedTriggerDiagnosis(value ?? "");
              if (value) appendTriggerDiagnosis(value);
            }}
          />
          <Controller
            name="trigger_diagnoses_text"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Trigger diagnoses"
                placeholder="ICD-11 codes, comma-separated"
                {...field}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Create Template
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 2: Builder
// ══════════════════════════════════════════════════════════

function BuilderTab({ canUpdate }: { canUpdate: boolean }) {
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

function ActivationsTab() {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailDrawer, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data: activations = [], isLoading } = useQuery({
    queryKey: ["order-set-activations"],
    queryFn: () => orderSetsService.listOrderSetActivations(),
  });

  const { data: detail } = useQuery({
    queryKey: ["order-set-activation-detail", detailId],
    queryFn: () => {
      if (!detailId) throw new Error("Activation not selected");
      return orderSetsService.getOrderSetActivation(detailId);
    },
    enabled: !!detailId,
  });

  const columns: Column<OrderSetActivation>[] = [
    {
      key: "template_id",
      label: "Template",
      render: (r) => <Text size="sm">{r.template_id.slice(0, 8)}...</Text>,
    },
    {
      key: "version",
      label: "Version",
      render: (r) => <Text size="sm">v{r.template_version}</Text>,
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "items",
      label: "Items",
      render: (r) => (
        <Text size="sm">
          {r.selected_items}/{r.total_items} selected
        </Text>
      ),
    },
    {
      key: "diagnosis",
      label: "Diagnosis",
      render: (r) => <Text size="sm">{r.diagnosis_icd ?? "—"}</Text>,
    },
    {
      key: "created_at",
      label: "Activated",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Tooltip label="View Details">
          <IconButton
            size="sm"
            tone="default"
            onClick={() => {
              setDetailId(r.id);
              openDetail();
            }}
            aria-label="List Details"
          >
            <IconListDetails size={14} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={activations} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={detailDrawer}
        onClose={closeDetail}
        title="Activation Details"
        position="right"
        size="lg"
      >
        {detail && (
          <Stack>
            <Group>
              <Text size="sm" fw={500}>
                Version:
              </Text>
              <Text size="sm">v{detail.activation.template_version}</Text>
            </Group>
            <Group>
              <Text size="sm" fw={500}>
                Items:
              </Text>
              <Text size="sm">
                {detail.activation.selected_items}/{detail.activation.total_items} selected
              </Text>
            </Group>
            {detail.activation.notes && (
              <Group>
                <Text size="sm" fw={500}>
                  Notes:
                </Text>
                <Text size="sm">{detail.activation.notes}</Text>
              </Group>
            )}
            <Text size="sm" fw={600} mt="md">
              Items:
            </Text>
            {detail.items.map((item) => (
              <Card key={item.id} withBorder p="xs">
                <Group justify="space-between">
                  <Group>
                    <Badge tone={statusColorTone(item.item_type)} size="sm">
                      {item.item_type}
                    </Badge>
                    <Text size="sm">{item.was_selected ? "Created" : "Skipped"}</Text>
                  </Group>
                  {item.skip_reason && (
                    <Text size="xs" c="dimmed">
                      {item.skip_reason}
                    </Text>
                  )}
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 4: Analytics
// ══════════════════════════════════════════════════════════

function AnalyticsTab() {
  const { data: summary } = useQuery({
    queryKey: ["order-set-analytics"],
    queryFn: () => orderSetsService.getOrderSetAnalytics(),
  });

  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <StatCard label="Active Templates" value={summary?.total_templates ?? 0} />
        <StatCard label="Total Activations" value={summary?.total_activations ?? 0} />
        <StatCard label="Unique Doctors" value={summary?.unique_doctors ?? 0} />
        <StatCard
          label="Avg Completion Rate"
          value={`${Number(summary?.avg_completion_rate ?? 0).toFixed(1)}%`}
        />
      </SimpleGrid>
    </Stack>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card withBorder p="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700} mt={4}>
        {value}
      </Text>
    </Card>
  );
}
