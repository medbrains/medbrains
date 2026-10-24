import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import type { PsychPatient } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Modal, Select, Switch, TextArea } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { ADMISSION_CATEGORIES, blankToUndefined } from "./labels";

const schema = z.object({
  patient_id: z.string().min(1, "Choose the patient"),
  admission_category: z.enum(["independent", "supported", "minor_supported", "emergency"]),
  treating_psychiatrist_id: z.string(),
  substance_abuse_flag: z.boolean(),
  notes: z.string().max(5000),
});
type Form = z.infer<typeof schema>;

interface RegisterPsychPatientModalProps {
  opened: boolean;
  onClose: () => void;
  initialPatientId?: string;
  onRegistered: (row: PsychPatient) => void;
}

export function RegisterPsychPatientModal({
  opened,
  onClose,
  initialPatientId,
  onRegistered,
}: RegisterPsychPatientModalProps) {
  const qc = useQueryClient();
  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      patient_id: initialPatientId ?? "",
      admission_category: "independent",
      treating_psychiatrist_id: "",
      substance_abuse_flag: false,
      notes: "",
    },
  });
  const create = useMutation({
    mutationFn: (v: Form) =>
      psychiatryService.createPatient({
        patient_id: v.patient_id,
        admission_category: v.admission_category,
        treating_psychiatrist_id: blankToUndefined(v.treating_psychiatrist_id),
        substance_abuse_flag: v.substance_abuse_flag,
        notes: blankToUndefined(v.notes),
      }),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["psych-patients"] });
      reset();
      onRegistered(row);
      onClose();
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Register psychiatric patient"
      size="lg"
      primaryAction={{
        label: "Register patient",
        onClick: () => void handleSubmit((v) => create.mutate(v))(),
        loading: create.isPending,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          The record is restricted from the start: only the treating psychiatrist, people your
          hospital has authorised, and an emergency (break-glass) session can open it. Record the
          nominated representative, advance directive and admission section on the record.
        </Text>
        <Controller
          control={control}
          name="patient_id"
          render={({ field, fieldState }) => (
            <PatientSearchSelect
              value={field.value}
              onChange={field.onChange}
              required
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="admission_category"
          render={({ field }) => (
            <Select
              label="Admission category"
              required
              data={ADMISSION_CATEGORIES}
              value={field.value}
              onChange={(v) => v && field.onChange(v)}
              allowDeselect={false}
            />
          )}
        />
        <Controller
          control={control}
          name="treating_psychiatrist_id"
          render={({ field }) => (
            <DoctorSearchSelect
              label="Treating psychiatrist"
              placeholder="You, if left blank"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="substance_abuse_flag"
          render={({ field }) => (
            <Switch
              label="Substance use disorder"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => <TextArea label="Notes" autosize minRows={2} {...field} />}
        />
        {create.isError && <Alert tone="danger">{create.error.message}</Alert>}
      </Stack>
    </Modal>
  );
}
