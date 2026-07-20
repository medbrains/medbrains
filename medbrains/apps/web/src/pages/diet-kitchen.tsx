import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { KitchenAuditFormInput, KitchenInventoryFormInput } from "@medbrains/schemas";
import { kitchenAuditFormSchema, kitchenInventoryFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateKitchenAuditRequest,
  CreateKitchenInventoryRequest,
  KitchenAudit,
  KitchenInventory,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconClipboardList,
  IconPackage,
  IconPlus,
  IconSalad,
  IconShieldCheck,
  IconToolsKitchen2,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router";
import { DataTable, PageHeader } from "@/components";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import {
  dietOptionalNumber,
  dietOptionalText,
  kitchenAuditTypeOptions,
} from "@/forms/diet-kitchen.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { dietKitchenService } from "@/services/diet-kitchen.service";
import { DietOrdersTab } from "./diet-kitchen/diet-orders-tab";
import { DietTemplatesTab } from "./diet-kitchen/diet-templates-tab";
import { KitchenTab } from "./diet-kitchen/kitchen-tab";
import { notifyMutationError, rowsOrEmpty } from "./diet-kitchen/shared";

type DietKitchenTabKey = "orders" | "templates" | "kitchen" | "inventory" | "audits";

const DIET_PAGE_PERMISSIONS = [
  P.DIET.ORDERS_LIST,
  P.DIET.ORDERS_CREATE,
  P.DIET.TEMPLATES_LIST,
  P.DIET.TEMPLATES_MANAGE,
  P.DIET.KITCHEN_LIST,
  P.DIET.KITCHEN_MANAGE,
  P.DIET.INVENTORY_LIST,
  P.DIET.INVENTORY_MANAGE,
  P.DIET.AUDITS_LIST,
  P.DIET.AUDITS_CREATE,
] as const;

function dietTabFromSearch(value: string | null): DietKitchenTabKey | null {
  if (
    value === "orders" ||
    value === "templates" ||
    value === "kitchen" ||
    value === "inventory" ||
    value === "audits"
  ) {
    return value;
  }

  return null;
}

// ══════════════════════════════════════════════════════════
//  Diet Orders Tab
// ══════════════════════════════════════════════════════════

function InventoryTab() {
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

function AuditsTab() {
  const qc = useQueryClient();
  const canViewAudits = useHasPermission(P.DIET.AUDITS_LIST);
  const canCreate = useHasPermission(P.DIET.AUDITS_CREATE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data: auditsData, isLoading } = useQuery({
    queryKey: ["kitchen-audits"],
    queryFn: dietKitchenService.listKitchenAudits,
    enabled: canViewAudits,
  });
  const audits = canViewAudits ? rowsOrEmpty(auditsData) : [];

  const auditForm = useForm<KitchenAuditFormInput>({
    resolver: zodResolver(kitchenAuditFormSchema),
    defaultValues: {
      auditor_name: "",
      audit_type: "routine",
      hygiene_score: "",
      findings: "",
      corrective_actions: "",
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = auditForm;

  const createMut = useMutation({
    mutationFn: (data: CreateKitchenAuditRequest) => dietKitchenService.createKitchenAudit(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kitchen-audits"] });
      notifications.show({ title: "Success", message: "Audit recorded", color: "success" });
      close();
      reset();
    },
    onError: notifyMutationError("Could not record audit"),
  });

  const submitAudit = (values: KitchenAuditFormInput) => {
    createMut.mutate({
      auditor_name: values.auditor_name.trim(),
      audit_type: values.audit_type,
      hygiene_score: dietOptionalNumber(values.hygiene_score),
      findings: dietOptionalText(values.findings),
      corrective_actions: dietOptionalText(values.corrective_actions),
    });
  };

  const columns = [
    {
      key: "audit_date",
      label: "Date",
      render: (r: KitchenAudit) => <Text size="sm">{r.audit_date}</Text>,
    },
    {
      key: "auditor_name",
      label: "Auditor",
      render: (r: KitchenAudit) => <Text size="sm">{r.auditor_name}</Text>,
    },
    {
      key: "audit_type",
      label: "Type",
      render: (r: KitchenAudit) => <Badge>{r.audit_type}</Badge>,
    },
    {
      key: "hygiene_score",
      label: "Hygiene Score",
      render: (r: KitchenAudit) => {
        const score = r.hygiene_score;
        const tone: BadgeTone =
          score == null ? "neutral" : score >= 80 ? "success" : score >= 60 ? "warning" : "danger";
        return <Badge tone={tone}>{score ?? "-"}/100</Badge>;
      },
    },
    {
      key: "is_compliant",
      label: "Compliant",
      render: (r: KitchenAudit) => (
        <Badge tone={r.is_compliant ? "success" : "danger"}>{r.is_compliant ? "Yes" : "No"}</Badge>
      ),
    },
    {
      key: "findings",
      label: "Findings",
      render: (r: KitchenAudit) => (
        <Text size="sm" truncate>
          {r.findings ?? "-"}
        </Text>
      ),
    },
    {
      key: "next_audit_date",
      label: "Next Audit",
      render: (r: KitchenAudit) => <Text size="sm">{r.next_audit_date ?? "-"}</Text>,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            New Audit
          </Button>
        )}
      </Group>
      {canViewAudits ? (
        <DataTable
          columns={columns}
          data={audits}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No audits recorded"
        />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            Audit history is not available for your role. You can still record an audit when audit
            creation is allowed.
          </Text>
        </Card>
      )}
      <Drawer opened={opened} onClose={close} title="Record FSSAI Audit" position="right" size="xl">
        <Stack component="form" onSubmit={handleSubmit(submitAudit)}>
          <Controller
            name="auditor_name"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Auditor Name"
                required
                {...field}
                error={errors.auditor_name?.message}
              />
            )}
          />
          <Controller
            name="audit_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Audit Type"
                data={kitchenAuditTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "routine")}
                error={errors.audit_type?.message}
              />
            )}
          />
          <Controller
            name="hygiene_score"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Hygiene Score (0-100)"
                min={0}
                max={100}
                value={field.value}
                onChange={field.onChange}
                error={errors.hygiene_score?.message}
              />
            )}
          />
          <Controller
            name="findings"
            control={control}
            render={({ field }) => (
              <Textarea label="Findings" {...field} error={errors.findings?.message} />
            )}
          />
          <Controller
            name="corrective_actions"
            control={control}
            render={({ field }) => (
              <Textarea
                label="Corrective Actions"
                {...field}
                error={errors.corrective_actions?.message}
              />
            )}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Record Audit
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function DietKitchenPage() {
  useRequirePermission(DIET_PAGE_PERMISSIONS);
  const [searchParams] = useSearchParams();
  const requestedTab = dietTabFromSearch(searchParams.get("tab"));
  const canViewOrders = useHasPermission(P.DIET.ORDERS_LIST);
  const canCreateOrders = useHasPermission(P.DIET.ORDERS_CREATE);
  const canViewTemplates = useHasPermission(P.DIET.TEMPLATES_LIST);
  const canManageTemplates = useHasPermission(P.DIET.TEMPLATES_MANAGE);
  const canViewKitchen = useHasPermission(P.DIET.KITCHEN_LIST);
  const canManageKitchen = useHasPermission(P.DIET.KITCHEN_MANAGE);
  const canViewInventory = useHasPermission(P.DIET.INVENTORY_LIST);
  const canManageInventory = useHasPermission(P.DIET.INVENTORY_MANAGE);
  const canViewAudits = useHasPermission(P.DIET.AUDITS_LIST);
  const canCreateAudits = useHasPermission(P.DIET.AUDITS_CREATE);

  const availableTabs = [
    {
      value: "orders" as const,
      label: "Diet Orders",
      icon: <IconClipboardList size={16} />,
      visible: canViewOrders || canCreateOrders,
    },
    {
      value: "templates" as const,
      label: "Templates",
      icon: <IconSalad size={16} />,
      visible: canViewTemplates || canManageTemplates,
    },
    {
      value: "kitchen" as const,
      label: "Kitchen",
      icon: <IconToolsKitchen2 size={16} />,
      visible: canViewKitchen || canManageKitchen,
    },
    {
      value: "inventory" as const,
      label: "Inventory",
      icon: <IconPackage size={16} />,
      visible: canViewInventory || canManageInventory,
    },
    {
      value: "audits" as const,
      label: "FSSAI Audits",
      icon: <IconShieldCheck size={16} />,
      visible: canViewAudits || canCreateAudits,
    },
  ].filter((item) => item.visible);
  const fallbackTab = availableTabs[0]?.value ?? "orders";
  const initialTab =
    requestedTab && availableTabs.some((item) => item.value === requestedTab)
      ? requestedTab
      : fallbackTab;
  const [selectedTab, setSelectedTab] = useState<DietKitchenTabKey>(initialTab);
  const activeTab = availableTabs.some((item) => item.value === selectedTab)
    ? selectedTab
    : fallbackTab;

  return (
    <div>
      <PageHeader
        title="Diet & Kitchen"
        subtitle="Patient dietary orders, meal planning, kitchen operations, and FSSAI compliance"
      />
      {availableTabs.length === 0 ? (
        <Text c="dimmed" size="sm">
          No diet or kitchen work areas are available for your current role.
        </Text>
      ) : (
        <Tabs
          value={activeTab}
          onChange={(value) => {
            const nextTab = dietTabFromSearch(value);
            if (nextTab) {
              setSelectedTab(nextTab);
            }
          }}
          keepMounted={false}
        >
          <Tabs.List mb="md">
            {availableTabs.map((tab) => (
              <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {(canViewOrders || canCreateOrders) && (
            <Tabs.Panel value="orders">
              <DietOrdersTab />
            </Tabs.Panel>
          )}
          {(canViewTemplates || canManageTemplates) && (
            <Tabs.Panel value="templates">
              <DietTemplatesTab />
            </Tabs.Panel>
          )}
          {(canViewKitchen || canManageKitchen) && (
            <Tabs.Panel value="kitchen">
              <KitchenTab />
            </Tabs.Panel>
          )}
          {(canViewInventory || canManageInventory) && (
            <Tabs.Panel value="inventory">
              <InventoryTab />
            </Tabs.Panel>
          )}
          {(canViewAudits || canCreateAudits) && (
            <Tabs.Panel value="audits">
              <AuditsTab />
            </Tabs.Panel>
          )}
        </Tabs>
      )}
    </div>
  );
}
