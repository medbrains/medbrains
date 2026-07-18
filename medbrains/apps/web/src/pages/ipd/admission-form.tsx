import type { CreateAdmissionResponse } from "@medbrains/types";

// IPD AdmissionForm — split from ipd.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Textarea, TextInput } from "@mantine/core";
import type { IpdAdmissionFormInput } from "@medbrains/schemas";
import { ipdAdmissionFormSchema } from "@medbrains/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useClinicalEmit } from "@/components";
import { BedSelect } from "@/components/BedSelect";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Button, toast } from "@/components/ui";
import { WardSelect } from "@/components/WardSelect";
import {
  DEFAULT_IPD_ADMISSION_VALUES,
  IPD_ADMISSION_SOURCE_OPTIONS,
  normalizeIpdAdmissionSource,
  toCreateAdmissionRequest,
} from "@/forms/ipd.form";
import { ipdService } from "@/services/ipd.service";

interface AdmissionFormProps {
  initialPatientId?: string;
  onCancel?: () => void;
  onCreated?: (result: CreateAdmissionResponse) => void;
}

export function AdmissionForm({ initialPatientId = "", onCancel, onCreated }: AdmissionFormProps) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<IpdAdmissionFormInput>({
    resolver: zodResolver(ipdAdmissionFormSchema),
    defaultValues: {
      ...DEFAULT_IPD_ADMISSION_VALUES,
      patient_id: initialPatientId,
    },
  });
  const admissionSource = watch("admission_source");
  const wardId = watch("ward_id");

  const resetAdmissionForm = () =>
    reset({
      ...DEFAULT_IPD_ADMISSION_VALUES,
      patient_id: initialPatientId,
    });

  const createMutation = useMutation({
    mutationFn: (values: IpdAdmissionFormInput) =>
      ipdService.createAdmission(toCreateAdmissionRequest(values)),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      toast.success("Patient admitted successfully", { title: "Admitted" });
      emit("ipd.admission.created", {
        admission_id: result.admission.id,
        patient_id: variables.patient_id,
        department_id: variables.department_id,
        bed_id: result.admission.bed_id,
        encounter_id: result.admission.encounter_id,
        source_record_id: result.admission.id,
      });
      if (result.admission.bed_id) {
        emit("bed.assigned", {
          admission_id: result.admission.id,
          patient_id: variables.patient_id,
          department_id: variables.department_id,
          bed_id: result.admission.bed_id,
          encounter_id: result.admission.encounter_id,
          source_record_id: result.admission.id,
        });
      }
      resetAdmissionForm();
      onCreated?.(result);
    },
    onError: () => {
      toast.error("Failed to create admission", { title: "Error" });
    },
  });

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
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
          <DepartmentSelect
            departmentType="clinical"
            value={field.value}
            onChange={field.onChange}
            error={errors.department_id?.message}
            required
          />
        )}
      />
      <Controller
        control={control}
        name="doctor_id"
        render={({ field }) => <DoctorSearchSelect value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={control}
        name="ward_id"
        render={({ field }) => <WardSelect value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={control}
        name="bed_id"
        render={({ field }) => (
          <BedSelect value={field.value} onChange={field.onChange} wardId={wardId || undefined} />
        )}
      />
      <Controller
        control={control}
        name="admission_source"
        render={({ field }) => (
          <Select
            label="Admission Source"
            data={IPD_ADMISSION_SOURCE_OPTIONS}
            value={field.value}
            onChange={(value) => field.onChange(normalizeIpdAdmissionSource(value))}
            error={errors.admission_source?.message}
            clearable
          />
        )}
      />
      {admissionSource === "referral" && (
        <>
          <Controller
            control={control}
            name="referral_from"
            render={({ field }) => <TextInput label="Referral From" {...field} />}
          />
          <Controller
            control={control}
            name="referral_doctor"
            render={({ field }) => <TextInput label="Referral Doctor" {...field} />}
          />
          <Controller
            control={control}
            name="referral_notes"
            render={({ field }) => <Textarea label="Referral Notes" {...field} />}
          />
        </>
      )}
      <Group grow>
        <Controller
          control={control}
          name="admission_weight_kg"
          render={({ field }) => (
            <NumberInput
              label="Weight (kg)"
              value={field.value}
              onChange={field.onChange}
              error={errors.admission_weight_kg?.message}
              min={0}
              max={500}
              decimalScale={2}
            />
          )}
        />
        <Controller
          control={control}
          name="admission_height_cm"
          render={({ field }) => (
            <NumberInput
              label="Height (cm)"
              value={field.value}
              onChange={field.onChange}
              error={errors.admission_height_cm?.message}
              min={0}
              max={300}
              decimalScale={2}
            />
          )}
        />
      </Group>
      <Controller
        control={control}
        name="expected_discharge_date"
        render={({ field }) => <TextInput label="Expected Discharge Date" type="date" {...field} />}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <Textarea label="Notes" {...field} />}
      />
      <Group justify="flex-end">
        {onCancel && (
          <Button tone="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button tone="primary" type="submit" loading={createMutation.isPending}>
          Admit Patient
        </Button>
      </Group>
    </Stack>
  );
}
