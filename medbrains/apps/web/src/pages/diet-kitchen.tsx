import { zodResolver } from "@hookform/resolvers/zod";
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
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  DietOrderFormInput,
  DietTemplateFormInput,
  KitchenAuditFormInput,
  KitchenInventoryFormInput,
  KitchenMenuFormInput,
  MealPrepFormInput,
} from "@medbrains/schemas";
import {
  dietOrderFormSchema,
  dietTemplateFormSchema,
  kitchenAuditFormSchema,
  kitchenInventoryFormSchema,
  kitchenMenuFormSchema,
  mealPrepFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AdmissionRow,
  CreateDietOrderRequest,
  CreateDietTemplateRequest,
  CreateKitchenAuditRequest,
  CreateKitchenInventoryRequest,
  CreateKitchenMenuRequest,
  CreateMealPrepRequest,
  DietOrder,
  DietTemplate,
  DietType,
  KitchenAudit,
  KitchenInventory,
  KitchenMenu,
  MealCount,
  MealPreparation,
  UpdateMealPrepStatusRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconClipboardList,
  IconPackage,
  IconPencil,
  IconPlus,
  IconSalad,
  IconShieldCheck,
  IconToolsKitchen2,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "../components";
import { PatientContextBanner } from "../components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import {
  dietOptionalInteger,
  dietOptionalNumber,
  dietOptionalText,
  dietTypeOptions,
  kitchenAuditTypeOptions,
  mealTypeOptions,
} from "../forms/diet-kitchen.form";
import { usePatientContext } from "../hooks/usePatientContext";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { dietKitchenService } from "../services/diet-kitchen.service";

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mutationError(error: unknown) {
  return error instanceof Error ? error.message : "Request failed. Please try again.";
}

function notifyFormError(message: string) {
  notifications.show({ title: "Check form", message, color: "warning" });
}

function notifyMutationError(title: string) {
  return (error: unknown) => {
    notifications.show({ title, message: mutationError(error), color: "danger" });
  };
}

function rowsOrEmpty<T>(rows: T[] | null | undefined): T[] {
  return Array.isArray(rows) ? rows.filter((row): row is T => Boolean(row)) : [];
}

function optionalUuid(value: string | undefined, label: string) {
  if (!value) {
    return undefined;
  }

  if (!UUID_PATTERN.test(value)) {
    notifyFormError(`${label} must be a valid ID.`);
    return null;
  }

  return value;
}

function dietTypeFromPreference(preference: string | null | undefined): DietType | undefined {
  const normalized = preference?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) {
    return undefined;
  }

  if (normalized.includes("diabetic")) return "diabetic";
  if (normalized.includes("renal")) return "renal";
  if (normalized.includes("cardiac")) return "cardiac";
  if (normalized.includes("liquid")) return "liquid";
  if (normalized.includes("soft")) return "soft";
  if (normalized.includes("high_protein") || normalized.includes("protein")) return "high_protein";
  if (normalized.includes("low_sodium") || normalized.includes("sodium")) return "low_sodium";
  if (normalized.includes("npo")) return "npo";
  return undefined;
}

function admissionLabel(admission: AdmissionRow) {
  const ward = admission.ward_name ? ` · ${admission.ward_name}` : "";
  const bed = admission.bed_id ? ` · Bed ${admission.bed_id.slice(0, 8)}` : "";
  return `${admission.patient_name} · ${admission.uhid}${ward}${bed}`;
}

// ══════════════════════════════════════════════════════════
//  Diet Orders Tab
// ══════════════════════════════════════════════════════════

function DietOrdersTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.DIET.ORDERS_CREATE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["diet-orders"],
    queryFn: dietKitchenService.listDietOrders,
  });
  const orders = rowsOrEmpty(ordersData);

  const { data: admissionsData, isLoading: admissionsLoading } = useQuery({
    queryKey: ["diet-active-admissions"],
    queryFn: () => dietKitchenService.listAdmissions({ status: "admitted", per_page: "200" }),
    staleTime: 30_000,
  });
  const activeAdmissions = rowsOrEmpty(admissionsData?.admissions);
  const admissionById = useMemo(
    () => new Map(activeAdmissions.map((admission) => [admission.id, admission])),
    [activeAdmissions],
  );
  const admissionOptions = useMemo(
    () =>
      activeAdmissions.map((admission) => ({
        value: admission.id,
        label: admissionLabel(admission),
      })),
    [activeAdmissions],
  );

  const { data: templatesData } = useQuery({
    queryKey: ["diet-templates"],
    queryFn: dietKitchenService.listDietTemplates,
  });
  const templates = rowsOrEmpty(templatesData);
  const templateOptions = useMemo(
    () =>
      templates
        .filter((template) => Boolean(template.id))
        .map((template) => ({
          value: template.id,
          label: `${template.name || "Unnamed template"} (${template.diet_type || "custom"})`,
        })),
    [templates],
  );

  const orderForm = useForm<DietOrderFormInput>({
    resolver: zodResolver(dietOrderFormSchema),
    defaultValues: {
      admission_id: "",
      patient_id: "",
      template_id: "",
      diet_type: "regular",
      special_instructions: "",
      calories_target: "",
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, dirtyFields },
  } = orderForm;
  const watchedAdmissionId = watch("admission_id");
  const watchedPatientId = watch("patient_id");
  const selectedAdmission = watchedAdmissionId ? admissionById.get(watchedAdmissionId) : undefined;
  const contextPatientId = watchedPatientId || selectedAdmission?.patient_id;
  const { data: patientContext } = usePatientContext(contextPatientId);
  const contextDietType = dietTypeFromPreference(patientContext?.dietary_preference);
  const contextInstructions = [
    patientContext?.dietary_preference
      ? `Diet preference: ${patientContext.dietary_preference}`
      : null,
    patientContext?.drug_allergies.length
      ? `Drug allergies: ${patientContext.drug_allergies.join(", ")}`
      : null,
    patientContext?.known_allergies.length
      ? `Known allergies: ${patientContext.known_allergies.map((allergy) => allergy.substance).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const createMut = useMutation({
    mutationFn: (data: CreateDietOrderRequest) => dietKitchenService.createDietOrder(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["diet-orders"] });
      notifications.show({ title: "Success", message: "Diet order created", color: "success" });
      close();
      reset();
    },
    onError: notifyMutationError("Could not create diet order"),
  });

  const submitOrder = (values: DietOrderFormInput) => {
    const patientId = values.patient_id || selectedAdmission?.patient_id;
    if (!patientId) {
      notifyFormError("Select a patient before creating a diet order.");
      return;
    }

    const admissionId = optionalUuid(values.admission_id, "Admission ID");
    if (admissionId === null) {
      return;
    }

    createMut.mutate({
      admission_id: admissionId,
      template_id: dietOptionalText(values.template_id),
      diet_type: dirtyFields.diet_type ? values.diet_type : (contextDietType ?? values.diet_type),
      patient_id: patientId,
      special_instructions: dietOptionalText(values.special_instructions) ?? contextInstructions,
      calories_target: dietOptionalNumber(values.calories_target),
    });
  };

  const columns = [
    {
      key: "diet_type",
      label: "Diet Type",
      render: (r: DietOrder) => <Badge variant="light">{r.diet_type}</Badge>,
    },
    {
      key: "patient_id",
      label: "Patient / Bed",
      render: (r: DietOrder) => {
        const admission = r.admission_id ? admissionById.get(r.admission_id) : undefined;
        if (!admission) {
          return (
            <Text size="sm" truncate>
              {r.patient_id}
            </Text>
          );
        }

        return (
          <Stack gap={2}>
            <Text size="sm" fw={500} truncate>
              {admission.patient_name}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {admission.uhid}
              {admission.ward_name ? ` · ${admission.ward_name}` : ""}
            </Text>
          </Stack>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r: DietOrder) => (
        <Badge color={ORDER_STATUS_COLORS[r.status] ?? "slate"}>{r.status}</Badge>
      ),
    },
    {
      key: "is_npo",
      label: "NPO",
      render: (r: DietOrder) =>
        r.is_npo ? <Badge color="danger">NPO</Badge> : <Text size="sm">-</Text>,
    },
    {
      key: "start_date",
      label: "Start",
      render: (r: DietOrder) => <Text size="sm">{r.start_date}</Text>,
    },
    {
      key: "end_date",
      label: "End",
      render: (r: DietOrder) => <Text size="sm">{r.end_date ?? "-"}</Text>,
    },
    {
      key: "calories_target",
      label: "Cal Target",
      render: (r: DietOrder) => <Text size="sm">{r.calories_target ?? "-"}</Text>,
    },
    {
      key: "special_instructions",
      label: "Instructions",
      render: (r: DietOrder) => (
        <Text size="sm" truncate>
          {r.special_instructions ?? "-"}
        </Text>
      ),
    },
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
      <DataTable
        columns={columns}
        data={orders}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No diet orders"
      />
      <Drawer opened={opened} onClose={close} title="New Diet Order" position="right" size="xl">
        <Stack component="form" onSubmit={handleSubmit(submitOrder)}>
          <Controller
            name="admission_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Active IPD patient / bed"
                placeholder="Search active admission, UHID, ward"
                data={admissionOptions}
                value={field.value || null}
                onChange={(value) => {
                  const admission = value ? admissionById.get(value) : undefined;
                  field.onChange(value ?? "");
                  if (admission?.patient_id) {
                    setValue("patient_id", admission.patient_id, { shouldValidate: true });
                  }
                }}
                searchable
                clearable
                nothingFoundMessage="No active IPD patients found"
                disabled={admissionsLoading}
                error={errors.admission_id?.message}
              />
            )}
          />
          {contextPatientId && (
            <PatientContextBanner patientId={contextPatientId} hideLoadingState />
          )}
          <Controller
            name="patient_id"
            control={control}
            render={({ field }) => (
              <PatientSearchSelect
                value={field.value}
                onChange={(id) => {
                  field.onChange(id);
                  setValue("admission_id", "", { shouldValidate: true });
                }}
                required={!watchedAdmissionId}
              />
            )}
          />
          {errors.patient_id?.message && (
            <Text size="xs" c="danger">
              {errors.patient_id.message}
            </Text>
          )}
          <Controller
            name="template_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Template"
                data={templateOptions}
                value={field.value || null}
                clearable
                onChange={(value) => field.onChange(value ?? "")}
                error={errors.template_id?.message}
              />
            )}
          />
          <Controller
            name="diet_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Diet Type"
                data={dietTypeOptions}
                value={!dirtyFields.diet_type && contextDietType ? contextDietType : field.value}
                onChange={(value) => field.onChange(value ?? "regular")}
                error={errors.diet_type?.message}
              />
            )}
          />
          <Controller
            name="special_instructions"
            control={control}
            render={({ field }) => (
              <Textarea
                label="Special Instructions"
                value={field.value || contextInstructions}
                onChange={(event) => field.onChange(event.currentTarget.value)}
                error={errors.special_instructions?.message}
              />
            )}
          />
          <Controller
            name="calories_target"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Calories Target"
                value={field.value}
                onChange={field.onChange}
                error={errors.calories_target?.message}
              />
            )}
          />
          <Button loading={createMut.isPending} type="submit">
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

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ["diet-templates"],
    queryFn: dietKitchenService.listDietTemplates,
  });
  const templates = rowsOrEmpty(templatesData);

  const templateForm = useForm<DietTemplateFormInput>({
    resolver: zodResolver(dietTemplateFormSchema),
    defaultValues: {
      name: "",
      diet_type: "custom",
      description: "",
      calories_target: "",
      protein_g: "",
      carbs_g: "",
      fat_g: "",
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = templateForm;

  const createMut = useMutation({
    mutationFn: (data: CreateDietTemplateRequest) => dietKitchenService.createDietTemplate(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["diet-templates"] });
      notifications.show({ title: "Success", message: "Template created", color: "success" });
      close();
      reset();
    },
    onError: notifyMutationError("Could not create template"),
  });

  const submitTemplate = (values: DietTemplateFormInput) => {
    createMut.mutate({
      name: values.name.trim(),
      diet_type: values.diet_type,
      description: dietOptionalText(values.description),
      calories_target: dietOptionalNumber(values.calories_target),
      protein_g: dietOptionalNumber(values.protein_g),
      carbs_g: dietOptionalNumber(values.carbs_g),
      fat_g: dietOptionalNumber(values.fat_g),
    });
  };

  const columns = [
    { key: "name", label: "Name", render: (r: DietTemplate) => <Text fw={500}>{r.name}</Text> },
    {
      key: "diet_type",
      label: "Type",
      render: (r: DietTemplate) => <Badge variant="light">{r.diet_type}</Badge>,
    },
    {
      key: "nutrition",
      label: "Nutritional Profile",
      render: (r: DietTemplate) => {
        const hasNutrition = r.calories_target || r.protein_g || r.carbs_g || r.fat_g;
        if (!hasNutrition)
          return (
            <Text size="sm" c="dimmed">
              Not specified
            </Text>
          );

        const totalMacros = (r.protein_g ?? 0) + (r.carbs_g ?? 0) + (r.fat_g ?? 0);
        const proteinPct = totalMacros > 0 ? ((r.protein_g ?? 0) / totalMacros) * 100 : 0;
        const carbsPct = totalMacros > 0 ? ((r.carbs_g ?? 0) / totalMacros) * 100 : 0;
        const fatPct = totalMacros > 0 ? ((r.fat_g ?? 0) / totalMacros) * 100 : 0;

        return (
          <Stack gap={4}>
            {r.calories_target && (
              <Text size="xs" fw={500}>
                {r.calories_target} kcal target
              </Text>
            )}
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
      },
    },
    {
      key: "is_active",
      label: "Active",
      render: (r: DietTemplate) => (
        <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Yes" : "No"}</Badge>
      ),
    },
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
      <DataTable
        columns={columns}
        data={templates}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No diet templates"
      />
      <Drawer opened={opened} onClose={close} title="New Diet Template" position="right" size="xl">
        <Stack component="form" onSubmit={handleSubmit(submitTemplate)}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextInput label="Name" required {...field} error={errors.name?.message} />
            )}
          />
          <Controller
            name="diet_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Diet Type"
                data={dietTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "custom")}
                error={errors.diet_type?.message}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Textarea label="Description" {...field} error={errors.description?.message} />
            )}
          />
          <Controller
            name="calories_target"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Calories Target"
                value={field.value}
                onChange={field.onChange}
                error={errors.calories_target?.message}
              />
            )}
          />
          <Group grow>
            <Controller
              name="protein_g"
              control={control}
              render={({ field }) => (
                <NumberInput
                  label="Protein (g)"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.protein_g?.message}
                />
              )}
            />
            <Controller
              name="carbs_g"
              control={control}
              render={({ field }) => (
                <NumberInput
                  label="Carbs (g)"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.carbs_g?.message}
                />
              )}
            />
            <Controller
              name="fat_g"
              control={control}
              render={({ field }) => (
                <NumberInput
                  label="Fat (g)"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.fat_g?.message}
                />
              )}
            />
          </Group>
          <Button loading={createMut.isPending} type="submit">
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

  const { data: menusData, isLoading: menusLoading } = useQuery({
    queryKey: ["kitchen-menus"],
    queryFn: dietKitchenService.listKitchenMenus,
  });
  const menus = rowsOrEmpty(menusData);

  const { data: prepsData, isLoading: prepsLoading } = useQuery({
    queryKey: ["meal-preps"],
    queryFn: dietKitchenService.listMealPreps,
  });
  const preps = rowsOrEmpty(prepsData);

  const { data: countsData, isLoading: countsLoading } = useQuery({
    queryKey: ["meal-counts"],
    queryFn: dietKitchenService.listMealCounts,
  });
  const counts = rowsOrEmpty(countsData);

  const { data: ordersData } = useQuery({
    queryKey: ["diet-orders-for-prep"],
    queryFn: dietKitchenService.listDietOrders,
    staleTime: 30_000,
  });
  const prepOrders = rowsOrEmpty(ordersData);
  const prepOrderOptions = useMemo(
    () =>
      prepOrders
        .filter((order) => order.status === "active")
        .map((order) => ({
          value: order.id,
          label: `${order.diet_type}${order.admission_id ? " · IPD" : ""} · ${order.id.slice(0, 8)}`,
        })),
    [prepOrders],
  );

  const menuForm = useForm<KitchenMenuFormInput>({
    resolver: zodResolver(kitchenMenuFormSchema),
    defaultValues: {
      name: "",
      week_number: "",
      season: "",
    },
  });
  const {
    control: menuControl,
    handleSubmit: handleMenuSubmit,
    reset: resetMenu,
    formState: { errors: menuErrors },
  } = menuForm;
  const prepForm = useForm<MealPrepFormInput>({
    resolver: zodResolver(mealPrepFormSchema),
    defaultValues: {
      diet_order_id: "",
      meal_type: "breakfast",
    },
  });
  const {
    control: prepControl,
    handleSubmit: handlePrepSubmit,
    reset: resetPrep,
    formState: { errors: prepErrors },
  } = prepForm;

  const createMenuMut = useMutation({
    mutationFn: (data: CreateKitchenMenuRequest) => dietKitchenService.createKitchenMenu(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kitchen-menus"] });
      notifications.show({ title: "Success", message: "Menu created", color: "success" });
      closeMenu();
      resetMenu();
    },
    onError: notifyMutationError("Could not create menu"),
  });

  const createPrepMut = useMutation({
    mutationFn: (data: CreateMealPrepRequest) => dietKitchenService.createMealPrep(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meal-preps"] });
      notifications.show({ title: "Success", message: "Meal prep created", color: "success" });
      closePrep();
      resetPrep();
    },
    onError: notifyMutationError("Could not create meal prep"),
  });

  const updatePrepMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMealPrepStatusRequest }) =>
      dietKitchenService.updateMealPrepStatus(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meal-preps"] });
      notifications.show({ title: "Success", message: "Status updated", color: "success" });
    },
    onError: notifyMutationError("Could not update meal status"),
  });

  const submitMenu = (values: KitchenMenuFormInput) => {
    createMenuMut.mutate({
      name: values.name.trim(),
      week_number: dietOptionalInteger(values.week_number),
      season: dietOptionalText(values.season),
    });
  };

  const submitPrep = (values: MealPrepFormInput) => {
    const dietOrderId = optionalUuid(values.diet_order_id, "Diet Order ID");
    if (dietOrderId === null) {
      return;
    }

    if (!dietOrderId) {
      notifyFormError("Enter a diet order ID and select a meal type.");
      return;
    }

    createPrepMut.mutate({
      diet_order_id: dietOrderId,
      meal_type: values.meal_type,
    });
  };

  const menuCols = [
    { key: "name", label: "Menu Name", render: (r: KitchenMenu) => <Text fw={500}>{r.name}</Text> },
    {
      key: "week_number",
      label: "Week",
      render: (r: KitchenMenu) => <Text size="sm">{r.week_number ?? "-"}</Text>,
    },
    {
      key: "season",
      label: "Season",
      render: (r: KitchenMenu) => <Text size="sm">{r.season ?? "-"}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (r: KitchenMenu) => (
        <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Yes" : "No"}</Badge>
      ),
    },
    {
      key: "valid_from",
      label: "Valid From",
      render: (r: KitchenMenu) => <Text size="sm">{r.valid_from ?? "-"}</Text>,
    },
    {
      key: "valid_until",
      label: "Valid Until",
      render: (r: KitchenMenu) => <Text size="sm">{r.valid_until ?? "-"}</Text>,
    },
  ];

  const prepCols = [
    {
      key: "meal_type",
      label: "Meal",
      render: (r: MealPreparation) => <Badge variant="light">{r.meal_type}</Badge>,
    },
    {
      key: "meal_date",
      label: "Date",
      render: (r: MealPreparation) => <Text size="sm">{r.meal_date}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r: MealPreparation) => (
        <Badge color={PREP_STATUS_COLORS[r.status] ?? "slate"}>{r.status}</Badge>
      ),
    },
    {
      key: "delivered_to_ward",
      label: "Ward",
      render: (r: MealPreparation) => <Text size="sm">{r.delivered_to_ward ?? "-"}</Text>,
    },
    {
      key: "feedback_rating",
      label: "Rating",
      render: (r: MealPreparation) => (
        <Text size="sm">{r.feedback_rating ? `${r.feedback_rating}/5` : "-"}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r: MealPreparation) => {
        if (!canManage) return <Text size="sm">-</Text>;
        const next: Partial<
          Record<MealPreparation["status"], UpdateMealPrepStatusRequest["status"]>
        > = {
          pending: "preparing",
          preparing: "ready",
          ready: "dispatched",
          dispatched: "delivered",
        };
        const nextStatus = next[r.status];
        if (!nextStatus) return <Text size="sm">-</Text>;
        return (
          <Tooltip label={`Mark ${nextStatus}`}>
            <ActionIcon
              variant="light"
              size="sm"
              loading={updatePrepMut.isPending}
              onClick={() =>
                updatePrepMut.mutate({
                  id: r.id,
                  data: { status: nextStatus },
                })
              }
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
    {
      key: "count_date",
      label: "Date",
      render: (r: MealCount) => <Text size="sm">{r.count_date}</Text>,
    },
    {
      key: "meal_type",
      label: "Meal",
      render: (r: MealCount) => <Badge variant="light">{r.meal_type}</Badge>,
    },
    { key: "ward", label: "Ward", render: (r: MealCount) => <Text size="sm">{r.ward}</Text> },
    {
      key: "occupied",
      label: "Occupied",
      render: (r: MealCount) => (
        <Text size="sm">
          {r.occupied}/{r.total_beds}
        </Text>
      ),
    },
    {
      key: "npo_count",
      label: "NPO",
      render: (r: MealCount) => (
        <Text size="sm" c={r.npo_count > 0 ? "danger" : undefined}>
          {r.npo_count}
        </Text>
      ),
    },
    {
      key: "regular_count",
      label: "Regular",
      render: (r: MealCount) => <Text size="sm">{r.regular_count}</Text>,
    },
    {
      key: "special_count",
      label: "Special",
      render: (r: MealCount) => <Text size="sm">{r.special_count}</Text>,
    },
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
        <Button
          variant={sub === "menus" ? "filled" : "light"}
          size="xs"
          onClick={() => setSub("menus")}
        >
          Menus
        </Button>
        <Button
          variant={sub === "preps" ? "filled" : "light"}
          size="xs"
          onClick={() => setSub("preps")}
        >
          Meal Prep
        </Button>
        <Button
          variant={sub === "counts" ? "filled" : "light"}
          size="xs"
          onClick={() => setSub("counts")}
        >
          Meal Counts
        </Button>
        <Button
          variant={sub === "summary" ? "filled" : "light"}
          size="xs"
          onClick={() => setSub("summary")}
        >
          Summary
        </Button>
        <div style={{ flex: 1 }} />
        {canManage && sub === "menus" && (
          <Button leftSection={<IconPlus size={16} />} size="xs" onClick={openMenu}>
            New Menu
          </Button>
        )}
        {canManage && sub === "preps" && (
          <Button leftSection={<IconPlus size={16} />} size="xs" onClick={openPrep}>
            New Meal Prep
          </Button>
        )}
      </Group>

      {sub === "menus" && (
        <DataTable
          columns={menuCols}
          data={menus}
          loading={menusLoading}
          rowKey={(r) => r.id}
          emptyTitle="No menus"
        />
      )}
      {sub === "preps" && (
        <DataTable
          columns={prepCols}
          data={preps}
          loading={prepsLoading}
          rowKey={(r) => r.id}
          emptyTitle="No meal preps"
        />
      )}
      {sub === "counts" && (
        <DataTable
          columns={countCols}
          data={counts}
          loading={countsLoading}
          rowKey={(r) => r.id}
          emptyTitle="No meal counts"
        />
      )}

      {sub === "summary" && (
        <Stack>
          <Text fw={600} size="lg">
            Kitchen Production Summary
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 6 }}>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">
                Total Meals
              </Text>
              <Text size="xl" fw={700}>
                {summary.stats.total}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">
                Pending
              </Text>
              <Text size="xl" fw={700} c="slate">
                {summary.stats.pending}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">
                Preparing
              </Text>
              <Text size="xl" fw={700} c="warning">
                {summary.stats.preparing}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">
                Ready
              </Text>
              <Text size="xl" fw={700} c="primary">
                {summary.stats.ready}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">
                Dispatched
              </Text>
              <Text size="xl" fw={700} c="orange">
                {summary.stats.dispatched}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">
                Delivered
              </Text>
              <Text size="xl" fw={700} c="success">
                {summary.stats.delivered}
              </Text>
            </Card>
          </SimpleGrid>

          <Text fw={600} mt="md">
            Meals by Type
          </Text>
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
                        <Text size="sm" fw={500} w={40} ta="right">
                          {count}
                        </Text>
                      </Group>
                    </Group>
                  ))
              ) : (
                <Text size="sm" c="dimmed">
                  No meal data available
                </Text>
              )}
            </Stack>
          </Card>
        </Stack>
      )}

      <Drawer
        opened={menuOpened}
        onClose={closeMenu}
        title="New Kitchen Menu"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleMenuSubmit(submitMenu)}>
          <Controller
            name="name"
            control={menuControl}
            render={({ field }) => (
              <TextInput label="Menu Name" required {...field} error={menuErrors.name?.message} />
            )}
          />
          <Controller
            name="week_number"
            control={menuControl}
            render={({ field }) => (
              <NumberInput
                label="Week Number"
                value={field.value}
                onChange={field.onChange}
                error={menuErrors.week_number?.message}
              />
            )}
          />
          <Controller
            name="season"
            control={menuControl}
            render={({ field }) => (
              <TextInput label="Season" {...field} error={menuErrors.season?.message} />
            )}
          />
          <Button loading={createMenuMut.isPending} type="submit">
            Create Menu
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={prepOpened}
        onClose={closePrep}
        title="New Meal Preparation"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handlePrepSubmit(submitPrep)}>
          <Controller
            name="diet_order_id"
            control={prepControl}
            render={({ field }) => (
              <Select
                label="Diet Order"
                required
                searchable
                data={prepOrderOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                nothingFoundMessage="No active diet orders"
                error={prepErrors.diet_order_id?.message}
              />
            )}
          />
          <Controller
            name="meal_type"
            control={prepControl}
            render={({ field }) => (
              <Select
                label="Meal Type"
                data={mealTypeOptions}
                required
                value={field.value}
                onChange={(value) => field.onChange(value ?? "breakfast")}
                error={prepErrors.meal_type?.message}
              />
            )}
          />
          <Button loading={createPrepMut.isPending} type="submit">
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

  const { data: itemsData, isLoading } = useQuery({
    queryKey: ["kitchen-inventory"],
    queryFn: dietKitchenService.listKitchenInventory,
  });
  const items = rowsOrEmpty(itemsData);

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
        <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Yes" : "No"}</Badge>
      ),
    },
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
      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No inventory items"
      />
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
          <Button loading={createMut.isPending} type="submit">
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

  const { data: auditsData, isLoading } = useQuery({
    queryKey: ["kitchen-audits"],
    queryFn: dietKitchenService.listKitchenAudits,
  });
  const audits = rowsOrEmpty(auditsData);

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
      render: (r: KitchenAudit) => <Badge variant="light">{r.audit_type}</Badge>,
    },
    {
      key: "hygiene_score",
      label: "Hygiene Score",
      render: (r: KitchenAudit) => {
        const score = r.hygiene_score;
        const color =
          score == null ? "slate" : score >= 80 ? "success" : score >= 60 ? "warning" : "danger";
        return <Badge color={color}>{score ?? "-"}/100</Badge>;
      },
    },
    {
      key: "is_compliant",
      label: "Compliant",
      render: (r: KitchenAudit) => (
        <Badge color={r.is_compliant ? "success" : "danger"}>{r.is_compliant ? "Yes" : "No"}</Badge>
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
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            New Audit
          </Button>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={audits}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No audits recorded"
      />
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
          <Button loading={createMut.isPending} type="submit">
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
          <Tabs.Tab value="orders" leftSection={<IconClipboardList size={16} />}>
            Diet Orders
          </Tabs.Tab>
          <Tabs.Tab value="templates" leftSection={<IconSalad size={16} />}>
            Templates
          </Tabs.Tab>
          <Tabs.Tab value="kitchen" leftSection={<IconToolsKitchen2 size={16} />}>
            Kitchen
          </Tabs.Tab>
          <Tabs.Tab value="inventory" leftSection={<IconPackage size={16} />}>
            Inventory
          </Tabs.Tab>
          <Tabs.Tab value="audits" leftSection={<IconShieldCheck size={16} />}>
            FSSAI Audits
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="orders">
          <DietOrdersTab />
        </Tabs.Panel>
        <Tabs.Panel value="templates">
          <DietTemplatesTab />
        </Tabs.Panel>
        <Tabs.Panel value="kitchen">
          <KitchenTab />
        </Tabs.Panel>
        <Tabs.Panel value="inventory">
          <InventoryTab />
        </Tabs.Panel>
        <Tabs.Panel value="audits">
          <AuditsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
