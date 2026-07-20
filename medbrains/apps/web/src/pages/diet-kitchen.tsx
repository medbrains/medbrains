import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  DietOrderFormInput,
  DietTemplateFormInput,
  KitchenAuditFormInput,
  KitchenInventoryFormInput,
} from "@medbrains/schemas";
import {
  dietOrderFormSchema,
  dietTemplateFormSchema,
  kitchenAuditFormSchema,
  kitchenInventoryFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AdmissionRow,
  CreateDietOrderRequest,
  CreateDietTemplateRequest,
  CreateKitchenAuditRequest,
  CreateKitchenInventoryRequest,
  DietOrder,
  DietTemplate,
  DietType,
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
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router";
import { DataTable, PageHeader } from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, type BadgeTone, Button } from "@/components/ui";
import {
  dietOptionalNumber,
  dietOptionalText,
  dietTypeOptions,
  kitchenAuditTypeOptions,
} from "@/forms/diet-kitchen.form";
import { usePatientContext } from "@/hooks/usePatientContext";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { dietKitchenService } from "@/services/diet-kitchen.service";
import { KitchenTab } from "./diet-kitchen/kitchen-tab";
import {
  notifyFormError,
  notifyMutationError,
  optionalUuid,
  rowsOrEmpty,
} from "./diet-kitchen/shared";

const ORDER_STATUS_COLORS: Record<string, BadgeTone> = {
  active: "success",
  modified: "warning",
  completed: "primary",
  cancelled: "neutral",
};

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
  const canViewOrders = useHasPermission(P.DIET.ORDERS_LIST);
  const canCreate = useHasPermission(P.DIET.ORDERS_CREATE);
  const canViewTemplates = useHasPermission(P.DIET.TEMPLATES_LIST);
  const canListAdmissions = useHasPermission(P.IPD.ADMISSIONS_LIST);
  const [searchParams] = useSearchParams();
  const contextAdmissionId = searchParams.get("admission_id") ?? "";
  const requestedPatientId = searchParams.get("patient_id") ?? "";
  const contextWardId = searchParams.get("ward_id") ?? "";
  const contextBedId = searchParams.get("bed_id") ?? "";
  const contextChargeable = searchParams.get("chargeable") ?? "";
  const contextChargeContext = searchParams.get("charge_context") ?? "";
  const shouldOpenContextOrder = searchParams.get("action") === "new" && canCreate;
  const [opened, { open, close }] = useDisclosure(shouldOpenContextOrder);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["diet-orders"],
    queryFn: dietKitchenService.listDietOrders,
    enabled: canViewOrders,
  });
  const orders = canViewOrders ? rowsOrEmpty(ordersData) : [];

  const { data: admissionsData, isLoading: admissionsLoading } = useQuery({
    queryKey: ["diet-active-admissions"],
    queryFn: () => dietKitchenService.listAdmissions({ status: "admitted", per_page: "200" }),
    enabled: canListAdmissions,
    staleTime: 30_000,
  });
  const activeAdmissions = canListAdmissions ? rowsOrEmpty(admissionsData?.admissions) : [];
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
    enabled: canViewTemplates,
  });
  const templates = canViewTemplates ? rowsOrEmpty(templatesData) : [];
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
      admission_id: contextAdmissionId,
      patient_id: requestedPatientId,
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
  const selectedPatientDisplay =
    contextPatientId && patientContext?.patient_id === contextPatientId
      ? `${patientContext.full_name} (${patientContext.uhid})`
      : contextPatientId
        ? `Linked patient ${contextPatientId.slice(0, 8)}`
        : undefined;

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
      render: (r: DietOrder) => <Badge>{r.diet_type}</Badge>,
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
        <Badge tone={ORDER_STATUS_COLORS[r.status] ?? "neutral"}>{r.status}</Badge>
      ),
    },
    {
      key: "is_npo",
      label: "NPO",
      render: (r: DietOrder) =>
        r.is_npo ? <Badge tone="danger">NPO</Badge> : <Text size="sm">-</Text>,
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
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            New Diet Order
          </Button>
        )}
      </Group>
      {canViewOrders ? (
        <DataTable
          columns={columns}
          data={orders}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No diet orders"
        />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            Diet order list is not available for your role. You can still create an order from the
            linked IPD admission when order creation is allowed.
          </Text>
        </Card>
      )}
      <Drawer opened={opened} onClose={close} title="New Diet Order" position="right" size="xl">
        <Stack component="form" onSubmit={handleSubmit(submitOrder)}>
          {contextAdmissionId && (
            <Alert tone="info" title="Linked IPD admission">
              {[
                contextWardId ? `Ward ${contextWardId.slice(0, 8)}` : "",
                contextBedId ? `Bed ${contextBedId.slice(0, 8)}` : "",
                contextChargeContext ? `Billing: ${contextChargeContext}` : "",
                contextChargeable ? `Chargeable: ${contextChargeable}` : "",
              ]
                .filter(Boolean)
                .join(" · ") || "Diet order is linked to the current admission context."}
            </Alert>
          )}
          {canListAdmissions ? (
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
          ) : (
            watchedAdmissionId && (
              <TextInput
                label="Admission ID"
                value={watchedAdmissionId}
                readOnly
                description="Linked from IPD context"
                error={errors.admission_id?.message}
              />
            )
          )}
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
                selectedDisplay={selectedPatientDisplay}
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
          <Button tone="primary" loading={createMut.isPending} type="submit">
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
  const canViewTemplates = useHasPermission(P.DIET.TEMPLATES_LIST);
  const canManage = useHasPermission(P.DIET.TEMPLATES_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ["diet-templates"],
    queryFn: dietKitchenService.listDietTemplates,
    enabled: canViewTemplates,
  });
  const templates = canViewTemplates ? rowsOrEmpty(templatesData) : [];

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
      render: (r: DietTemplate) => <Badge>{r.diet_type}</Badge>,
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
        <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Yes" : "No"}</Badge>
      ),
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            New Template
          </Button>
        )}
      </Group>
      {canViewTemplates ? (
        <DataTable
          columns={columns}
          data={templates}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No diet templates"
        />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            Template list is not available for your role. You can still create a new template when
            template management is allowed.
          </Text>
        </Card>
      )}
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
          <Button tone="primary" loading={createMut.isPending} type="submit">
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
