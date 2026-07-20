// IPD DietOrdersTab — split from diet-kitchen.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { DietOrderFormInput } from "@medbrains/schemas";
import { dietOrderFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { AdmissionRow, CreateDietOrderRequest, DietOrder, DietType } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router";
import { DataTable } from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, type BadgeTone, Button } from "@/components/ui";
import { dietOptionalNumber, dietOptionalText, dietTypeOptions } from "@/forms/diet-kitchen.form";
import { usePatientContext } from "@/hooks/usePatientContext";
import { dietKitchenService } from "@/services/diet-kitchen.service";
import { notifyFormError, notifyMutationError, optionalUuid, rowsOrEmpty } from "./shared";

const ORDER_STATUS_COLORS: Record<string, BadgeTone> = {
  active: "success",
  modified: "warning",
  completed: "primary",
  cancelled: "neutral",
};

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

export function DietOrdersTab() {
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
