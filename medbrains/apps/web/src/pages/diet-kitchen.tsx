import { useState, useMemo } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import {
  IconPlus,
  IconToolsKitchen2,
  IconSalad,
  IconClipboardList,
  IconPackage,
  IconShieldCheck,
  IconPencil,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type {
  DietTemplate,
  DietOrder,
  KitchenMenu,
  MealPreparation,
  MealCount,
  KitchenInventory,
  KitchenAudit,
  CreateDietTemplateRequest,
  CreateDietOrderRequest,
  CreateKitchenMenuRequest,
  CreateMealPrepRequest,
  UpdateMealPrepStatusRequest,
  CreateKitchenInventoryRequest,
  CreateKitchenAuditRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { DataTable, PageHeader } from "../components";

const DIET_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "diabetic", label: "Diabetic" },
  { value: "renal", label: "Renal" },
  { value: "cardiac", label: "Cardiac" },
  { value: "liquid", label: "Liquid" },
  { value: "soft", label: "Soft" },
  { value: "high_protein", label: "High Protein" },
  { value: "low_sodium", label: "Low Sodium" },
  { value: "npo", label: "NPO" },
  { value: "custom", label: "Custom" },
];

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "morning_snack", label: "Morning Snack" },
  { value: "lunch", label: "Lunch" },
  { value: "afternoon_snack", label: "Afternoon Snack" },
  { value: "dinner", label: "Dinner" },
  { value: "bedtime_snack", label: "Bedtime Snack" },
];

const ORDER_STATUS_COLORS: Record<string, string> = {
  active: "success",
  modified: "warning",
  completed: "primary",
  cancelled: "slate",
};

const PREP_STATUS_COLORS: Record<string, string> = {
  pending: "slate",
  preparing: "warning",
  ready: "primary",
  dispatched: "orange",
  delivered: "success",
};

// ══════════════════════════════════════════════════════════
//  Diet Orders Tab
// ══════════════════════════════════════════════════════════

function DietOrdersTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.DIET.ORDERS_CREATE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["diet-orders"],
    queryFn: api.listDietOrders,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["diet-templates"],
    queryFn: api.listDietTemplates,
  });

  const [form, setForm] = useState<Partial<CreateDietOrderRequest>>({});

  const createMut = useMutation({
    mutationFn: (data: CreateDietOrderRequest) => api.createDietOrder(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["diet-orders"] });
      notifications.show({ title: "Success", message: "Diet order created", color: "success" });
      close();
      setForm({});
    },
  });

  const columns = [
    { key: "diet_type", label: "Diet Type", render: (r: DietOrder) => <Badge variant="light">{r.diet_type}</Badge> },
    { key: "patient_id", label: "Patient", render: (r: DietOrder) => <Text size="sm" truncate>{r.patient_id}</Text> },
    {
      key: "status",
      label: "Status",
      render: (r: DietOrder) => <Badge color={ORDER_STATUS_COLORS[r.status] ?? "slate"}>{r.status}</Badge>,
    },
    { key: "is_npo", label: "NPO", render: (r: DietOrder) => r.is_npo ? <Badge color="danger">NPO</Badge> : <Text size="sm">-</Text> },
    { key: "start_date", label: "Start", render: (r: DietOrder) => <Text size="sm">{r.start_date}</Text> },
    { key: "end_date", label: "End", render: (r: DietOrder) => <Text size="sm">{r.end_date ?? "-"}</Text> },
    { key: "calories_target", label: "Cal Target", render: (r: DietOrder) => <Text size="sm">{r.calories_target ?? "-"}</Text> },
    { key: "special_instructions", label: "Instructions", render: (r: DietOrder) => <Text size="sm" truncate>{r.special_instructions ?? "-"}</Text> },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            New Diet Order
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={orders} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No diet orders" />
      <Drawer opened={opened} onClose={close} title="New Diet Order" position="right" size="md">
        <Stack>
          <PatientSearchSelect value={form.patient_id ?? ""} onChange={(id) => setForm((p) => ({ ...p, patient_id: id }))} required />
          <TextInput label="Admission ID" value={form.admission_id ?? ""} onChange={(e) => setForm((p) => ({ ...p, admission_id: e.currentTarget.value || undefined }))} />
          <Select label="Template" data={templates.map((t) => ({ value: t.id, label: `${t.name} (${t.diet_type})` }))} clearable onChange={(v) => setForm((p) => ({ ...p, template_id: v ?? undefined }))} />
          <Select label="Diet Type" data={DIET_TYPES} value={form.diet_type ?? "regular"} onChange={(v) => setForm((p) => ({ ...p, diet_type: (v as CreateDietOrderRequest["diet_type"]) ?? undefined }))} />
          <Textarea label="Special Instructions" value={form.special_instructions ?? ""} onChange={(e) => setForm((p) => ({ ...p, special_instructions: e.currentTarget.value }))} />
          <NumberInput label="Calories Target" value={form.calories_target ?? ""} onChange={(v) => setForm((p) => ({ ...p, calories_target: typeof v === "number" ? v : undefined }))} />
          <Button loading={createMut.isPending} onClick={() => form.patient_id && createMut.mutate(form as CreateDietOrderRequest)}>
            Create Order
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Diet Templates Tab
// ══════════════════════════════════════════════════════════

function DietTemplatesTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.DIET.TEMPLATES_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["diet-templates"],
    queryFn: api.listDietTemplates,
  });

  const [form, setForm] = useState<Partial<CreateDietTemplateRequest>>({});

  const createMut = useMutation({
    mutationFn: (data: CreateDietTemplateRequest) => api.createDietTemplate(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["diet-templates"] });
      notifications.show({ title: "Success", message: "Template created", color: "success" });
      close();
      setForm({});
    },
  });

  const columns = [
    { key: "name", label: "Name", render: (r: DietTemplate) => <Text fw={500}>{r.name}</Text> },
    { key: "diet_type", label: "Type", render: (r: DietTemplate) => <Badge variant="light">{r.diet_type}</Badge> },
    {
      key: "nutrition",
      label: "Nutritional Profile",
      render: (r: DietTemplate) => {
        const hasNutrition = r.calories_target || r.protein_g || r.carbs_g || r.fat_g;
        if (!hasNutrition) return <Text size="sm" c="dimmed">Not specified</Text>;

        const totalMacros = (r.protein_g ?? 0) + (r.carbs_g ?? 0) + (r.fat_g ?? 0);
        const proteinPct = totalMacros > 0 ? ((r.protein_g ?? 0) / totalMacros) * 100 : 0;
        const carbsPct = totalMacros > 0 ? ((r.carbs_g ?? 0) / totalMacros) * 100 : 0;
        const fatPct = totalMacros > 0 ? ((r.fat_g ?? 0) / totalMacros) * 100 : 0;

        return (
          <Stack gap={4}>
            {r.calories_target && <Text size="xs" fw={500}>{r.calories_target} kcal target</Text>}
            {totalMacros > 0 && (
              <>
                <Progress.Root size="sm">
                  <Progress.Section value={proteinPct} color="primary">
                    <Progress.Label>P</Progress.Label>
                  </Progress.Section>
                  <Progress.Section value={carbsPct} color="success">
                    <Progress.Label>C</Progress.Label>
                  </Progress.Section>
                  <Progress.Section value={fatPct} color="warning">
                    <Progress.Label>F</Progress.Label>
                  </Progress.Section>
                </Progress.Root>
                <Text size="xs" c="dimmed">
                  P: {r.protein_g ?? 0}g • C: {r.carbs_g ?? 0}g • F: {r.fat_g ?? 0}g
                </Text>
              </>
            )}
          </Stack>
        );
      }
    },
    { key: "is_active", label: "Active", render: (r: DietTemplate) => <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Yes" : "No"}</Badge> },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            New Template
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={templates} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No diet templates" />
      <Drawer opened={opened} onClose={close} title="New Diet Template" position="right" size="md">
        <Stack>
          <TextInput label="Name" required value={form.name ?? ""} onChange={(e) => setForm((p) => ({ ...p, name: e.currentTarget.value }))} />
          <Select label="Diet Type" data={DIET_TYPES} value={form.diet_type ?? "custom"} onChange={(v) => setForm((p) => ({ ...p, diet_type: (v as CreateDietTemplateRequest["diet_type"]) ?? undefined }))} />
          <Textarea label="Description" value={form.description ?? ""} onChange={(e) => setForm((p) => ({ ...p, description: e.currentTarget.value }))} />
          <NumberInput label="Calories Target" value={form.calories_target ?? ""} onChange={(v) => setForm((p) => ({ ...p, calories_target: typeof v === "number" ? v : undefined }))} />
          <Group grow>
            <NumberInput label="Protein (g)" value={form.protein_g ?? ""} onChange={(v) => setForm((p) => ({ ...p, protein_g: typeof v === "number" ? v : undefined }))} />
            <NumberInput label="Carbs (g)" value={form.carbs_g ?? ""} onChange={(v) => setForm((p) => ({ ...p, carbs_g: typeof v === "number" ? v : undefined }))} />
            <NumberInput label="Fat (g)" value={form.fat_g ?? ""} onChange={(v) => setForm((p) => ({ ...p, fat_g: typeof v === "number" ? v : undefined }))} />
          </Group>
          <Button loading={createMut.isPending} onClick={() => form.name && createMut.mutate(form as CreateDietTemplateRequest)}>
            Create Template
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Kitchen & Meal Prep Tab
// ══════════════════════════════════════════════════════════

function KitchenTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.DIET.KITCHEN_MANAGE);
  const [menuOpened, { open: openMenu, close: closeMenu }] = useDisclosure(false);
  const [prepOpened, { open: openPrep, close: closePrep }] = useDisclosure(false);
  const [sub, setSub] = useState<"menus" | "preps" | "counts" | "summary">("menus");

  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: ["kitchen-menus"],
    queryFn: api.listKitchenMenus,
  });

  const { data: preps = [], isLoading: prepsLoading } = useQuery({
    queryKey: ["meal-preps"],
    queryFn: api.listMealPreps,
  });

  const { data: counts = [], isLoading: countsLoading } = useQuery({
    queryKey: ["meal-counts"],
    queryFn: api.listMealCounts,
  });

  const [menuForm, setMenuForm] = useState<Partial<CreateKitchenMenuRequest>>({});
  const [prepForm, setPrepForm] = useState<Partial<CreateMealPrepRequest>>({});

  const createMenuMut = useMutation({
    mutationFn: (data: CreateKitchenMenuRequest) => api.createKitchenMenu(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kitchen-menus"] });
      notifications.show({ title: "Success", message: "Menu created", color: "success" });
      closeMenu();
      setMenuForm({});
    },
  });

  const createPrepMut = useMutation({
    mutationFn: (data: CreateMealPrepRequest) => api.createMealPrep(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meal-preps"] });
      notifications.show({ title: "Success", message: "Meal prep created", color: "success" });
      closePrep();
      setPrepForm({});
    },
  });

  const updatePrepMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMealPrepStatusRequest }) => api.updateMealPrepStatus(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meal-preps"] });
      notifications.show({ title: "Success", message: "Status updated", color: "success" });
    },
  });

  const menuCols = [
    { key: "name", label: "Menu Name", render: (r: KitchenMenu) => <Text fw={500}>{r.name}</Text> },
    { key: "week_number", label: "Week", render: (r: KitchenMenu) => <Text size="sm">{r.week_number ?? "-"}</Text> },
    { key: "season", label: "Season", render: (r: KitchenMenu) => <Text size="sm">{r.season ?? "-"}</Text> },
    { key: "is_active", label: "Active", render: (r: KitchenMenu) => <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Yes" : "No"}</Badge> },
    { key: "valid_from", label: "Valid From", render: (r: KitchenMenu) => <Text size="sm">{r.valid_from ?? "-"}</Text> },
    { key: "valid_until", label: "Valid Until", render: (r: KitchenMenu) => <Text size="sm">{r.valid_until ?? "-"}</Text> },
  ];

  const prepCols = [
    { key: "meal_type", label: "Meal", render: (r: MealPreparation) => <Badge variant="light">{r.meal_type}</Badge> },
    { key: "meal_date", label: "Date", render: (r: MealPreparation) => <Text size="sm">{r.meal_date}</Text> },
    {
      key: "status",
      label: "Status",
      render: (r: MealPreparation) => <Badge color={PREP_STATUS_COLORS[r.status] ?? "slate"}>{r.status}</Badge>,
    },
    { key: "delivered_to_ward", label: "Ward", render: (r: MealPreparation) => <Text size="sm">{r.delivered_to_ward ?? "-"}</Text> },
    { key: "feedback_rating", label: "Rating", render: (r: MealPreparation) => <Text size="sm">{r.feedback_rating ? `${r.feedback_rating}/5` : "-"}</Text> },
    {
      key: "actions",
      label: "Actions",
      render: (r: MealPreparation) => {
        if (!canManage) return <Text size="sm">-</Text>;
        const next: Record<string, string> = { pending: "preparing", preparing: "ready", ready: "dispatched", dispatched: "delivered" };
        const nextStatus = next[r.status];
        if (!nextStatus) return <Text size="sm">-</Text>;
        return (
          <Tooltip label={`Mark ${nextStatus}`}>
            <ActionIcon
              variant="light"
              size="sm"
              loading={updatePrepMut.isPending}
              onClick={() => updatePrepMut.mutate({ id: r.id, data: { status: nextStatus as UpdateMealPrepStatusRequest["status"] } })}
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
        );
      },
    },
  ];

  const countCols = [
    { key: "count_date", label: "Date", render: (r: MealCount) => <Text size="sm">{r.count_date}</Text> },
    { key: "meal_type", label: "Meal", render: (r: MealCount) => <Badge variant="light">{r.meal_type}</Badge> },
    { key: "ward", label: "Ward", render: (r: MealCount) => <Text size="sm">{r.ward}</Text> },
    { key: "occupied", label: "Occupied", render: (r: MealCount) => <Text size="sm">{r.occupied}/{r.total_beds}</Text> },
    { key: "npo_count", label: "NPO", render: (r: MealCount) => <Text size="sm" c={r.npo_count > 0 ? "danger" : undefined}>{r.npo_count}</Text> },
    { key: "regular_count", label: "Regular", render: (r: MealCount) => <Text size="sm">{r.regular_count}</Text> },
    { key: "special_count", label: "Special", render: (r: MealCount) => <Text size="sm">{r.special_count}</Text> },
  ];

  // Production summary aggregations
  const summary = useMemo(() => {
    const stats = {
      total: preps.length,
      pending: preps.filter((p) => p.status === "pending").length,
      preparing: preps.filter((p) => p.status === "preparing").length,
      ready: preps.filter((p) => p.status === "ready").length,
      dispatched: preps.filter((p) => p.status === "dispatched").length,
      delivered: preps.filter((p) => p.status === "delivered").length,
    };

    const byMealType: Record<string, number> = {};
    preps.forEach((p) => {
      byMealType[p.meal_type] = (byMealType[p.meal_type] ?? 0) + 1;
    });

    return { stats, byMealType };
  }, [preps]);

  return (
    <>
      <Group mb="md">
        <Button variant={sub === "menus" ? "filled" : "light"} size="xs" onClick={() => setSub("menus")}>Menus</Button>
        <Button variant={sub === "preps" ? "filled" : "light"} size="xs" onClick={() => setSub("preps")}>Meal Prep</Button>
        <Button variant={sub === "counts" ? "filled" : "light"} size="xs" onClick={() => setSub("counts")}>Meal Counts</Button>
        <Button variant={sub === "summary" ? "filled" : "light"} size="xs" onClick={() => setSub("summary")}>Summary</Button>
        <div style={{ flex: 1 }} />
        {canManage && sub === "menus" && <Button leftSection={<IconPlus size={16} />} size="xs" onClick={openMenu}>New Menu</Button>}
        {canManage && sub === "preps" && <Button leftSection={<IconPlus size={16} />} size="xs" onClick={openPrep}>New Meal Prep</Button>}
      </Group>

      {sub === "menus" && <DataTable columns={menuCols} data={menus} loading={menusLoading} rowKey={(r) => r.id} emptyTitle="No menus" />}
      {sub === "preps" && <DataTable columns={prepCols} data={preps} loading={prepsLoading} rowKey={(r) => r.id} emptyTitle="No meal preps" />}
      {sub === "counts" && <DataTable columns={countCols} data={counts} loading={countsLoading} rowKey={(r) => r.id} emptyTitle="No meal counts" />}

      {sub === "summary" && (
        <Stack>
          <Text fw={600} size="lg">Kitchen Production Summary</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 6 }}>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">Total Meals</Text>
              <Text size="xl" fw={700}>{summary.stats.total}</Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">Pending</Text>
              <Text size="xl" fw={700} c="slate">{summary.stats.pending}</Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">Preparing</Text>
              <Text size="xl" fw={700} c="warning">{summary.stats.preparing}</Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">Ready</Text>
              <Text size="xl" fw={700} c="primary">{summary.stats.ready}</Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">Dispatched</Text>
              <Text size="xl" fw={700} c="orange">{summary.stats.dispatched}</Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">Delivered</Text>
              <Text size="xl" fw={700} c="success">{summary.stats.delivered}</Text>
            </Card>
          </SimpleGrid>

          <Text fw={600} mt="md">Meals by Type</Text>
          <Card withBorder>
            <Stack gap="sm">
              {Object.entries(summary.byMealType).length > 0 ? (
                Object.entries(summary.byMealType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([mealType, count]) => (
                    <Group key={mealType} justify="space-between">
                      <Badge variant="light">{mealType}</Badge>
                      <Group gap="xs">
                        <Progress value={(count / summary.stats.total) * 100} w={100} size="sm" />
                        <Text size="sm" fw={500} w={40} ta="right">{count}</Text>
                      </Group>
                    </Group>
                  ))
              ) : (
                <Text size="sm" c="dimmed">No meal data available</Text>
              )}
            </Stack>
          </Card>
        </Stack>
      )}

      <Drawer opened={menuOpened} onClose={closeMenu} title="New Kitchen Menu" position="right" size="md">
        <Stack>
          <TextInput label="Menu Name" required value={menuForm.name ?? ""} onChange={(e) => setMenuForm((p) => ({ ...p, name: e.currentTarget.value }))} />
          <NumberInput label="Week Number" value={menuForm.week_number ?? ""} onChange={(v) => setMenuForm((p) => ({ ...p, week_number: typeof v === "number" ? v : undefined }))} />
          <TextInput label="Season" value={menuForm.season ?? ""} onChange={(e) => setMenuForm((p) => ({ ...p, season: e.currentTarget.value }))} />
          <Button loading={createMenuMut.isPending} onClick={() => menuForm.name && createMenuMut.mutate(menuForm as CreateKitchenMenuRequest)}>
            Create Menu
          </Button>
        </Stack>
      </Drawer>

      <Drawer opened={prepOpened} onClose={closePrep} title="New Meal Preparation" position="right" size="md">
        <Stack>
          <TextInput label="Diet Order ID" required value={prepForm.diet_order_id ?? ""} onChange={(e) => setPrepForm((p) => ({ ...p, diet_order_id: e.currentTarget.value }))} />
          <Select label="Meal Type" data={MEAL_TYPES} required onChange={(v) => setPrepForm((p) => ({ ...p, meal_type: (v as CreateMealPrepRequest["meal_type"]) ?? undefined }))} />
          <Button loading={createPrepMut.isPending} onClick={() => prepForm.diet_order_id && prepForm.meal_type && createPrepMut.mutate(prepForm as CreateMealPrepRequest)}>
            Create Meal Prep
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Kitchen Inventory Tab
// ══════════════════════════════════════════════════════════

function InventoryTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.DIET.INVENTORY_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["kitchen-inventory"],
    queryFn: api.listKitchenInventory,
  });

  const [form, setForm] = useState<Partial<CreateKitchenInventoryRequest>>({});

  const createMut = useMutation({
    mutationFn: (data: CreateKitchenInventoryRequest) => api.createKitchenInventoryItem(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kitchen-inventory"] });
      notifications.show({ title: "Success", message: "Item added", color: "success" });
      close();
      setForm({});
    },
  });

  const columns = [
    { key: "item_name", label: "Item", render: (r: KitchenInventory) => <Text fw={500}>{r.item_name}</Text> },
    { key: "category", label: "Category", render: (r: KitchenInventory) => <Text size="sm">{r.category ?? "-"}</Text> },
    { key: "current_stock", label: "Stock", render: (r: KitchenInventory) => {
      const low = r.reorder_level && r.current_stock <= r.reorder_level;
      return <Text size="sm" c={low ? "danger" : undefined} fw={low ? 700 : undefined}>{r.current_stock} {r.unit}</Text>;
    }},
    { key: "reorder_level", label: "Reorder Level", render: (r: KitchenInventory) => <Text size="sm">{r.reorder_level ?? "-"} {r.unit}</Text> },
    { key: "supplier", label: "Supplier", render: (r: KitchenInventory) => <Text size="sm">{r.supplier ?? "-"}</Text> },
    { key: "expiry_date", label: "Expiry", render: (r: KitchenInventory) => <Text size="sm">{r.expiry_date ?? "-"}</Text> },
    { key: "is_active", label: "Active", render: (r: KitchenInventory) => <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Yes" : "No"}</Badge> },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Add Item
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={items} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No inventory items" />
      <Drawer opened={opened} onClose={close} title="Add Inventory Item" position="right" size="md">
        <Stack>
          <TextInput label="Item Name" required value={form.item_name ?? ""} onChange={(e) => setForm((p) => ({ ...p, item_name: e.currentTarget.value }))} />
          <TextInput label="Category" value={form.category ?? ""} onChange={(e) => setForm((p) => ({ ...p, category: e.currentTarget.value }))} />
          <TextInput label="Unit" placeholder="kg" value={form.unit ?? ""} onChange={(e) => setForm((p) => ({ ...p, unit: e.currentTarget.value }))} />
          <NumberInput label="Current Stock" value={form.current_stock ?? ""} onChange={(v) => setForm((p) => ({ ...p, current_stock: typeof v === "number" ? v : undefined }))} />
          <NumberInput label="Reorder Level" value={form.reorder_level ?? ""} onChange={(v) => setForm((p) => ({ ...p, reorder_level: typeof v === "number" ? v : undefined }))} />
          <TextInput label="Supplier" value={form.supplier ?? ""} onChange={(e) => setForm((p) => ({ ...p, supplier: e.currentTarget.value }))} />
          <Button loading={createMut.isPending} onClick={() => form.item_name && createMut.mutate(form as CreateKitchenInventoryRequest)}>
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
  const canCreate = useHasPermission(P.DIET.AUDITS_CREATE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ["kitchen-audits"],
    queryFn: api.listKitchenAudits,
  });

  const [form, setForm] = useState<Partial<CreateKitchenAuditRequest>>({});

  const createMut = useMutation({
    mutationFn: (data: CreateKitchenAuditRequest) => api.createKitchenAudit(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kitchen-audits"] });
      notifications.show({ title: "Success", message: "Audit recorded", color: "success" });
      close();
      setForm({});
    },
  });

  const columns = [
    { key: "audit_date", label: "Date", render: (r: KitchenAudit) => <Text size="sm">{r.audit_date}</Text> },
    { key: "auditor_name", label: "Auditor", render: (r: KitchenAudit) => <Text size="sm">{r.auditor_name}</Text> },
    { key: "audit_type", label: "Type", render: (r: KitchenAudit) => <Badge variant="light">{r.audit_type}</Badge> },
    { key: "hygiene_score", label: "Hygiene Score", render: (r: KitchenAudit) => {
      const score = r.hygiene_score;
      const color = score == null ? "slate" : score >= 80 ? "success" : score >= 60 ? "warning" : "danger";
      return <Badge color={color}>{score ?? "-"}/100</Badge>;
    }},
    { key: "is_compliant", label: "Compliant", render: (r: KitchenAudit) => <Badge color={r.is_compliant ? "success" : "danger"}>{r.is_compliant ? "Yes" : "No"}</Badge> },
    { key: "findings", label: "Findings", render: (r: KitchenAudit) => <Text size="sm" truncate>{r.findings ?? "-"}</Text> },
    { key: "next_audit_date", label: "Next Audit", render: (r: KitchenAudit) => <Text size="sm">{r.next_audit_date ?? "-"}</Text> },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            New Audit
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={audits} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No audits recorded" />
      <Drawer opened={opened} onClose={close} title="Record FSSAI Audit" position="right" size="md">
        <Stack>
          <TextInput label="Auditor Name" required value={form.auditor_name ?? ""} onChange={(e) => setForm((p) => ({ ...p, auditor_name: e.currentTarget.value }))} />
          <Select label="Audit Type" data={["routine", "surprise", "external"]} value={form.audit_type ?? "routine"} onChange={(v) => setForm((p) => ({ ...p, audit_type: v ?? undefined }))} />
          <NumberInput label="Hygiene Score (0-100)" min={0} max={100} value={form.hygiene_score ?? ""} onChange={(v) => setForm((p) => ({ ...p, hygiene_score: typeof v === "number" ? v : undefined }))} />
          <Textarea label="Findings" value={form.findings ?? ""} onChange={(e) => setForm((p) => ({ ...p, findings: e.currentTarget.value }))} />
          <Textarea label="Corrective Actions" value={form.corrective_actions ?? ""} onChange={(e) => setForm((p) => ({ ...p, corrective_actions: e.currentTarget.value }))} />
          <Button loading={createMut.isPending} onClick={() => form.auditor_name && createMut.mutate(form as CreateKitchenAuditRequest)}>
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
  useRequirePermission(P.DIET.ORDERS_LIST);

  return (
    <div>
      <PageHeader
        title="Diet & Kitchen"
        subtitle="Patient dietary orders, meal planning, kitchen operations, and FSSAI compliance"
      />
      <Tabs defaultValue="orders" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="orders" leftSection={<IconClipboardList size={16} />}>Diet Orders</Tabs.Tab>
          <Tabs.Tab value="templates" leftSection={<IconSalad size={16} />}>Templates</Tabs.Tab>
          <Tabs.Tab value="kitchen" leftSection={<IconToolsKitchen2 size={16} />}>Kitchen</Tabs.Tab>
          <Tabs.Tab value="inventory" leftSection={<IconPackage size={16} />}>Inventory</Tabs.Tab>
          <Tabs.Tab value="audits" leftSection={<IconShieldCheck size={16} />}>FSSAI Audits</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="orders"><DietOrdersTab /></Tabs.Panel>
        <Tabs.Panel value="templates"><DietTemplatesTab /></Tabs.Panel>
        <Tabs.Panel value="kitchen"><KitchenTab /></Tabs.Panel>
        <Tabs.Panel value="inventory"><InventoryTab /></Tabs.Panel>
        <Tabs.Panel value="audits"><AuditsTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}
