// OPD OpdVisitForm — split from opd.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Select, Stack, Textarea } from "@mantine/core";
import type { OpdQueueVisitFormInput } from "@medbrains/schemas";
import { opdQueueVisitFormSchema } from "@medbrains/schemas";
import type { Camp, CreateEncounterResponse, DepartmentRow } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { DoctorSearchSelect, PatientSearchSelect, useClinicalEmit } from "@/components";
import { Alert, Button, toast } from "@/components/ui";
import {
  DEFAULT_OPD_QUEUE_VISIT_FORM_VALUES,
  OPD_VISIT_TYPE_OPTIONS,
  toCreateEncounterRequest,
} from "@/forms/opd.form";
import { campService } from "@/services/camp.service";
import { ipdService } from "@/services/ipd.service";
import { opdService } from "@/services/opd.service";

interface OpdVisitFormProps {
  initialPatientId?: string;
  onCancel: () => void;
  onCreated: (result: CreateEncounterResponse) => void;
}

export function OpdVisitForm({ initialPatientId = "", onCancel, onCreated }: OpdVisitFormProps) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OpdQueueVisitFormInput>({
    resolver: zodResolver(opdQueueVisitFormSchema),
    defaultValues: {
      ...DEFAULT_OPD_QUEUE_VISIT_FORM_VALUES,
      patient_id: initialPatientId,
    },
  });
  const visitType = watch("visit_type");
  const selectedPatientId = watch("patient_id");

  // An admitted patient can't start a new OPD visit (admission from OPD stays allowed).
  const { data: activeAdmissions } = useQuery({
    queryKey: ["patient-active-admissions", selectedPatientId],
    queryFn: () => ipdService.listAdmissions({ patient_id: selectedPatientId, status: "admitted" }),
    enabled: Boolean(selectedPatientId),
  });
  const hasActiveAdmission = (activeAdmissions?.admissions ?? []).length > 0;

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
    staleTime: 600_000,
  });
  const departmentOptions = (departments as DepartmentRow[])
    .filter((department) =>
      ["clinical", "para_clinical"].includes(department.department_type ?? ""),
    )
    .map((department) => ({ value: department.id, label: department.name }));

  const { data: campOptionsSource = [] } = useQuery<Camp[]>({
    queryKey: ["camps", "active-for-opd"],
    queryFn: () => campService.listCamps({ status: "active" }),
    staleTime: 300_000,
  });
  const activeCampOptions = useMemo(
    () =>
      campOptionsSource.map((camp) => ({
        value: camp.id,
        label: `${camp.camp_code} - ${camp.name}`,
      })),
    [campOptionsSource],
  );

  const createMutation = useMutation({
    mutationFn: (values: OpdQueueVisitFormInput) =>
      opdService.createEncounter(toCreateEncounterRequest(values)),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      toast.success("Patient added to queue", { title: "Visit created" });
      emit("opd.encounter.created", {
        encounter_id: result.encounter.id,
        patient_id: result.encounter.patient_id,
        department_id: result.encounter.department_id,
        doctor_id: result.encounter.doctor_id,
        queue_entry_id: result.queue.id,
        token_number: result.queue.token_number,
        visit_type: result.encounter.visit_type,
      });
      reset({
        ...DEFAULT_OPD_QUEUE_VISIT_FORM_VALUES,
        patient_id: initialPatientId,
      });
      onCreated(result);
    },
    onError: () => {
      toast.error("Failed to create visit", { title: "Error" });
    },
  });

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
      {hasActiveAdmission && (
        <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
          This patient has an active IPD admission. A new OPD visit can't be created while admitted
          — use the admission's encounter (or discharge first).
        </Alert>
      )}
      <Controller
        control={control}
        name="visit_type"
        render={({ field }) => (
          <Select
            label="Visit Type"
            data={OPD_VISIT_TYPE_OPTIONS}
            value={field.value}
            onChange={(value) => {
              const nextValue = value ?? "walk_in";
              field.onChange(nextValue);
              if (nextValue !== "camp") {
                setValue("camp_id", null, { shouldValidate: true });
              }
            }}
            error={errors.visit_type?.message}
            required
          />
        )}
      />
      {visitType === "camp" && (
        <Controller
          control={control}
          name="camp_id"
          render={({ field }) => (
            <Select
              label="Camp"
              placeholder="Select active camp"
              data={activeCampOptions}
              value={field.value ?? null}
              onChange={(value) => field.onChange(value ?? null)}
              error={errors.camp_id?.message}
              searchable
              required
            />
          )}
        />
      )}
      <Controller
        control={control}
        name="patient_id"
        render={({ field }) => (
          <PatientSearchSelect
            value={field.value}
            onChange={field.onChange}
            error={errors.patient_id?.message}
            required
          />
        )}
      />
      <Controller
        control={control}
        name="department_id"
        render={({ field }) => (
          <Select
            label="Department"
            placeholder="Select department"
            data={departmentOptions}
            value={field.value ?? ""}
            onChange={(value) => field.onChange(value || null)}
            error={errors.department_id?.message}
            searchable
            required
          />
        )}
      />
      <Controller
        control={control}
        name="doctor_id"
        render={({ field }) => (
          <DoctorSearchSelect
            value={field.value ?? ""}
            onChange={(value) => field.onChange(value || null)}
          />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <Textarea label="Notes" placeholder="Visit notes" {...field} />}
      />
      <Group justify="flex-end">
        <Button tone="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          tone="primary"
          type="submit"
          loading={createMutation.isPending}
          disabled={hasActiveAdmission}
        >
          Create Visit
        </Button>
      </Group>
    </Stack>
  );
}
