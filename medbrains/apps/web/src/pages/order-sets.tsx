import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { OrderSetTemplateFormInput } from "@medbrains/schemas";
import { orderSetTemplateFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateOrderSetTemplateRequest, OrderSetTemplate } from "@medbrains/types";
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
import { Badge, Button, IconButton } from "@/components/ui";
import {
  orderSetContextOptions,
  orderSetOptionalText,
  parseTriggerDiagnoses,
} from "@/forms/order-sets.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm";
import { orderSetsService } from "@/services/order-sets.service";
import { ActivationsTab } from "./order-sets/activations-tab";
import { AnalyticsTab } from "./order-sets/analytics-tab";
import { BuilderTab } from "./order-sets/builder-tab";
import { statusColorTone } from "./order-sets/shared";

// ── Constants ──────────────────────────────────────────

const emptyTemplateForm: OrderSetTemplateFormInput = {
  name: "",
  code: "",
  description: "",
  context: "general",
  surgery_type: "",
  trigger_diagnoses_text: "",
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
                onClick={() =>
                  confirmDestructive({
                    title: "Delete order set",
                    message: "Permanently delete this order set? This cannot be undone.",
                    onConfirm: () => deleteMut.mutate(r.id),
                  })
                }
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
