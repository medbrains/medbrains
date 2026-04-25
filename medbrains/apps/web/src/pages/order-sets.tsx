import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
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
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconCheck,
  IconCopy,
  IconListDetails,
  IconChartBar,
  IconHistory,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  OrderSetTemplate,
  OrderSetTemplateItem,
  OrderSetActivation,
  CreateOrderSetTemplateRequest,
  AddOrderSetItemRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Constants ──────────────────────────────────────────

const CONTEXT_OPTIONS = [
  { value: "general", label: "General" },
  { value: "admission", label: "Admission" },
  { value: "pre_operative", label: "Pre-Operative" },
  { value: "diagnosis_specific", label: "Diagnosis-Specific" },
  { value: "department_specific", label: "Department-Specific" },
];

const ITEM_TYPE_OPTIONS = [
  { value: "lab", label: "Lab Test" },
  { value: "medication", label: "Medication" },
  { value: "nursing", label: "Nursing Task" },
  { value: "diet", label: "Diet Order" },
];

const CONTEXT_COLORS: Record<string, string> = {
  general: "slate",
  admission: "primary",
  pre_operative: "orange",
  diagnosis_specific: "violet",
  department_specific: "teal",
};

const ITEM_TYPE_COLORS: Record<string, string> = {
  lab: "primary",
  medication: "success",
  nursing: "orange",
  diet: "info",
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
      <PageHeader
        title="Order Sets"
        subtitle="Reusable bundles of orders for standardized care"
      />
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
          <TemplatesTab
            canCreate={canCreate}
            canUpdate={canUpdate}
            canApprove={canApprove}
          />
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

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["order-set-templates", contextFilter, search],
    queryFn: () =>
      api.listOrderSetTemplates({
        context: contextFilter ?? undefined,
        search: search || undefined,
        is_active: true,
      }),
  });

  // Create template form state
  const [form, setForm] = useState<CreateOrderSetTemplateRequest>({
    name: "",
    context: "general",
  });

  const createMut = useMutation({
    mutationFn: (data: CreateOrderSetTemplateRequest) =>
      api.createOrderSetTemplate(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-set-templates"] });
      notifications.show({ title: "Created", message: "Order set template created", color: "success" });
      close();
      setForm({ name: "", context: "general" });
    },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.approveOrderSetTemplate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-set-templates"] });
      notifications.show({ title: "Approved", message: "Template approved for clinical use", color: "success" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteOrderSetTemplate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-set-templates"] });
      notifications.show({ title: "Deactivated", message: "Template deactivated", color: "warning" });
    },
  });

  const versionMut = useMutation({
    mutationFn: (id: string) => api.createOrderSetVersion(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-set-templates"] });
      notifications.show({ title: "New Version", message: "New version created", color: "primary" });
    },
  });

  const columns: Column<OrderSetTemplate>[] = [
    {
      key: "name",
      label: "Name",
      render: (r) => (
        <div>
          <Text size="sm" fw={500}>{r.name}</Text>
          {r.code && <Text size="xs" c="dimmed">{r.code}</Text>}
        </div>
      ),
    },
    {
      key: "context",
      label: "Context",
      render: (r) => (
        <Badge color={CONTEXT_COLORS[r.context] ?? "slate"} variant="light" size="sm">
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
          <Badge color="success" variant="light" size="sm">Approved</Badge>
        ) : (
          <Badge color="warning" variant="light" size="sm">Pending</Badge>
        ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          {canApprove && !r.approved_at && (
            <Tooltip label="Approve">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="success"
                onClick={() => approveMut.mutate(r.id)}
                aria-label="Confirm"
              >
                <IconCheck size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip label="New Version">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="primary"
                onClick={() => versionMut.mutate(r.id)}
                aria-label="Copy"
              >
                <IconCopy size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip label="Deactivate">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="danger"
                onClick={() => deleteMut.mutate(r.id)}
                aria-label="Delete"
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

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
            data={CONTEXT_OPTIONS}
            value={contextFilter}
            onChange={setContextFilter}
            clearable
            size="sm"
            w={200}
          />
        </Group>
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={open} size="sm">
            New Template
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={templates}
        loading={isLoading}
        rowKey={(r) => r.id}
      />

      <Drawer opened={opened} onClose={close} title="Create Order Set Template" position="right" size="md">
        <Stack>
          <TextInput
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          />
          <TextInput
            label="Code (mnemonic)"
            placeholder="e.g. PNEUM-WU"
            value={form.code ?? ""}
            onChange={(e) => setForm({ ...form, code: e.currentTarget.value || undefined })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })}
          />
          <Select
            label="Context"
            data={CONTEXT_OPTIONS}
            value={form.context}
            onChange={(v) => setForm({ ...form, context: (v ?? "general") as CreateOrderSetTemplateRequest["context"] })}
            required
          />
          <TextInput
            label="Surgery Type"
            placeholder="For pre-operative sets"
            value={form.surgery_type ?? ""}
            onChange={(e) => setForm({ ...form, surgery_type: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Trigger Diagnoses (ICD-10 codes, comma-separated)"
            placeholder="e.g. J18.9, J15.9"
            value={(form.trigger_diagnoses ?? []).join(", ")}
            onChange={(e) =>
              setForm({
                ...form,
                trigger_diagnoses: e.currentTarget.value
                  ? e.currentTarget.value.split(",").map((s) => s.trim()).filter(Boolean)
                  : undefined,
              })
            }
          />
          <Button
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
            disabled={!form.name}
          >
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
    queryFn: () => api.listOrderSetTemplates({ is_active: true }),
  });

  // Fetch selected template with items
  const { data: templateDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["order-set-template-detail", selectedTemplateId],
    queryFn: () => api.getOrderSetTemplate(selectedTemplateId!),
    enabled: !!selectedTemplateId,
  });

  // Add item form
  const [itemForm, setItemForm] = useState<AddOrderSetItemRequest>({
    item_type: "lab",
  });

  const addItemMut = useMutation({
    mutationFn: (data: AddOrderSetItemRequest) =>
      api.addOrderSetItem(selectedTemplateId!, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-set-template-detail", selectedTemplateId] });
      notifications.show({ title: "Added", message: "Item added to template", color: "success" });
      closeItem();
      setItemForm({ item_type: "lab" });
    },
  });

  const deleteItemMut = useMutation({
    mutationFn: (itemId: string) =>
      api.deleteOrderSetItem(selectedTemplateId!, itemId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-set-template-detail", selectedTemplateId] });
      notifications.show({ title: "Removed", message: "Item removed from template", color: "warning" });
    },
  });

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
        <Badge color={ITEM_TYPE_COLORS[r.item_type] ?? "slate"} variant="light" size="sm">
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
          return <Text size="sm">{r.drug_name ?? "Medication"} {r.dosage ? `— ${r.dosage}` : ""}</Text>;
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
          <Badge color="danger" variant="light" size="xs">Required</Badge>
        ) : (
          <Text size="xs" c="dimmed">Optional</Text>
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
            <ActionIcon
              size="sm"
              variant="subtle"
              color="danger"
              onClick={() => deleteItemMut.mutate(r.id)}
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </ActionIcon>
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
          <Button leftSection={<IconPlus size={16} />} onClick={openItem} size="sm">
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
                  {templateDetail.template.description ?? "No description"} — v{templateDetail.template.version}
                </Text>
              </div>
              <Badge
                color={CONTEXT_COLORS[templateDetail.template.context] ?? "slate"}
                variant="light"
              >
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

      <Drawer opened={itemDrawer} onClose={closeItem} title="Add Item to Order Set" position="right" size="md">
        <Stack>
          <Select
            label="Item Type"
            data={ITEM_TYPE_OPTIONS}
            value={itemForm.item_type}
            onChange={(v) =>
              setItemForm({ ...itemForm, item_type: (v ?? "lab") as AddOrderSetItemRequest["item_type"] })
            }
            required
          />
          <NumberInput
            label="Sort Order"
            value={itemForm.sort_order ?? 0}
            onChange={(v) => setItemForm({ ...itemForm, sort_order: typeof v === "number" ? v : 0 })}
          />
          <Switch
            label="Mandatory (cannot be deselected)"
            checked={itemForm.is_mandatory ?? false}
            onChange={(e) => setItemForm({ ...itemForm, is_mandatory: e.currentTarget.checked })}
          />
          <Switch
            label="Selected by default"
            checked={itemForm.default_selected ?? true}
            onChange={(e) => setItemForm({ ...itemForm, default_selected: e.currentTarget.checked })}
          />

          {/* Type-specific fields */}
          {itemForm.item_type === "lab" && (
            <>
              <TextInput
                label="Lab Priority"
                placeholder="routine / urgent / stat"
                value={itemForm.lab_priority ?? ""}
                onChange={(e) => setItemForm({ ...itemForm, lab_priority: e.currentTarget.value || undefined })}
              />
              <Textarea
                label="Lab Notes"
                value={itemForm.lab_notes ?? ""}
                onChange={(e) => setItemForm({ ...itemForm, lab_notes: e.currentTarget.value || undefined })}
              />
            </>
          )}

          {itemForm.item_type === "medication" && (
            <>
              <TextInput
                label="Drug Name"
                value={itemForm.drug_name ?? ""}
                onChange={(e) => setItemForm({ ...itemForm, drug_name: e.currentTarget.value || undefined })}
              />
              <TextInput
                label="Dosage"
                placeholder="e.g. 500mg"
                value={itemForm.dosage ?? ""}
                onChange={(e) => setItemForm({ ...itemForm, dosage: e.currentTarget.value || undefined })}
              />
              <TextInput
                label="Frequency"
                placeholder="e.g. TID, BD"
                value={itemForm.frequency ?? ""}
                onChange={(e) => setItemForm({ ...itemForm, frequency: e.currentTarget.value || undefined })}
              />
              <TextInput
                label="Duration"
                placeholder="e.g. 5 days"
                value={itemForm.duration ?? ""}
                onChange={(e) => setItemForm({ ...itemForm, duration: e.currentTarget.value || undefined })}
              />
              <TextInput
                label="Route"
                placeholder="e.g. PO, IV"
                value={itemForm.route ?? ""}
                onChange={(e) => setItemForm({ ...itemForm, route: e.currentTarget.value || undefined })}
              />
              <Textarea
                label="Instructions"
                value={itemForm.med_instructions ?? ""}
                onChange={(e) =>
                  setItemForm({ ...itemForm, med_instructions: e.currentTarget.value || undefined })
                }
              />
            </>
          )}

          {itemForm.item_type === "nursing" && (
            <>
              <TextInput
                label="Task Type"
                placeholder="e.g. vital_check, wound_care"
                value={itemForm.task_type ?? ""}
                onChange={(e) => setItemForm({ ...itemForm, task_type: e.currentTarget.value || undefined })}
              />
              <Textarea
                label="Task Description"
                value={itemForm.task_description ?? ""}
                onChange={(e) =>
                  setItemForm({ ...itemForm, task_description: e.currentTarget.value || undefined })
                }
              />
              <TextInput
                label="Frequency"
                placeholder="e.g. Q4H, daily"
                value={itemForm.task_frequency ?? ""}
                onChange={(e) =>
                  setItemForm({ ...itemForm, task_frequency: e.currentTarget.value || undefined })
                }
              />
            </>
          )}

          {itemForm.item_type === "diet" && (
            <>
              <TextInput
                label="Diet Type"
                placeholder="e.g. regular, liquid, NPO"
                value={itemForm.diet_type ?? ""}
                onChange={(e) => setItemForm({ ...itemForm, diet_type: e.currentTarget.value || undefined })}
              />
              <Textarea
                label="Diet Instructions"
                value={itemForm.diet_instructions ?? ""}
                onChange={(e) =>
                  setItemForm({ ...itemForm, diet_instructions: e.currentTarget.value || undefined })
                }
              />
            </>
          )}

          <Button onClick={() => addItemMut.mutate(itemForm)} loading={addItemMut.isPending}>
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
    queryFn: () => api.listOrderSetActivations(),
  });

  const { data: detail } = useQuery({
    queryKey: ["order-set-activation-detail", detailId],
    queryFn: () => api.getOrderSetActivation(detailId!),
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
      render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}...</Text>,
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
      render: (r) => (
        <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Tooltip label="View Details">
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => {
              setDetailId(r.id);
              openDetail();
            }}
            aria-label="List Details"
          >
            <IconListDetails size={14} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={activations}
        loading={isLoading}
        rowKey={(r) => r.id}
      />

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
              <Text size="sm" fw={500}>Version:</Text>
              <Text size="sm">v{detail.activation.template_version}</Text>
            </Group>
            <Group>
              <Text size="sm" fw={500}>Items:</Text>
              <Text size="sm">
                {detail.activation.selected_items}/{detail.activation.total_items} selected
              </Text>
            </Group>
            {detail.activation.notes && (
              <Group>
                <Text size="sm" fw={500}>Notes:</Text>
                <Text size="sm">{detail.activation.notes}</Text>
              </Group>
            )}
            <Text size="sm" fw={600} mt="md">Items:</Text>
            {detail.items.map((item) => (
              <Card key={item.id} withBorder p="xs">
                <Group justify="space-between">
                  <Group>
                    <Badge
                      color={ITEM_TYPE_COLORS[item.item_type] ?? "slate"}
                      variant="light"
                      size="sm"
                    >
                      {item.item_type}
                    </Badge>
                    <Text size="sm">
                      {item.was_selected ? "Created" : "Skipped"}
                    </Text>
                  </Group>
                  {item.skip_reason && (
                    <Text size="xs" c="dimmed">{item.skip_reason}</Text>
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
    queryFn: () => api.getOrderSetAnalytics(),
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
