// The admission nursing assessment (NABH initial assessment) — the nurse's
// head-to-toe record on arrival. Fall and pressure-injury risk are scored on
// the Assessments tab (Morse, Braden), which acts on a high score.

import { zodResolver } from "@hookform/resolvers/zod";
import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { Alert, Input, Modal, NumberField, Select, TextArea } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import {
  NURSING_ASSESSMENT_DEFAULTS,
  type NursingAssessmentValues,
  nursingAssessmentSchema,
  toNursingAssessmentRequest,
} from "./nursing-forms";

interface NursingAssessmentFormModalProps {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
}

const CONSCIOUSNESS = [
  { value: "alert", label: "Alert" },
  { value: "drowsy", label: "Drowsy" },
  { value: "confused", label: "Confused" },
  { value: "unresponsive", label: "Unresponsive" },
];
const SKIN = [
  { value: "intact", label: "Intact" },
  { value: "dry", label: "Dry / fragile" },
  { value: "broken", label: "Broken / wound" },
  { value: "pressure_injury", label: "Pressure injury present" },
];
const NUTRITION = [
  { value: "normal", label: "Eating normally" },
  { value: "poor_intake", label: "Poor intake" },
  { value: "nil_by_mouth", label: "Nil by mouth" },
  { value: "tube_feeding", label: "Tube feeding" },
];
const BREATHING = [
  { value: "room_air", label: "Room air" },
  { value: "oxygen", label: "On oxygen" },
  { value: "ventilated", label: "Ventilated" },
];

type TextField = Exclude<
  keyof NursingAssessmentValues,
  "consciousness" | "skin_condition" | "nutrition" | "breathing" | "pain_score"
>;

const TEXT_AREAS: { name: TextField; label: string }[] = [
  { name: "elimination", label: "Elimination (bladder, bowel)" },
  { name: "psychosocial", label: "Psychosocial (mood, support, language)" },
  { name: "medications_on_admission", label: "Medicines brought in / taken at home" },
  { name: "personal_belongings", label: "Personal belongings and valuables" },
  { name: "patient_education_needs", label: "Education needs" },
];

export function NursingAssessmentFormModal({
  admissionId,
  opened,
  onClose,
}: NursingAssessmentFormModalProps) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NursingAssessmentValues>({
    resolver: zodResolver(nursingAssessmentSchema) as Resolver<NursingAssessmentValues>,
    defaultValues: NURSING_ASSESSMENT_DEFAULTS,
  });

  const save = useMutation({
    mutationFn: (values: NursingAssessmentValues) =>
      ipdService.createNursingAssessment(admissionId, toNursingAssessmentRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-nursing-assessments", admissionId] });
      reset(NURSING_ASSESSMENT_DEFAULTS);
      onClose();
    },
  });

  const select = (
    name: "consciousness" | "skin_condition" | "nutrition" | "breathing",
    label: string,
    data: { value: string; label: string }[],
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          label={label}
          data={data}
          value={field.value}
          onChange={(v) => v && field.onChange(v)}
          allowDeselect={false}
        />
      )}
    />
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Admission nursing assessment"
      size="xl"
      primaryAction={{
        label: "Save assessment",
        onClick: () => void handleSubmit((values) => save.mutate(values))(),
        loading: save.isPending,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Controller
          control={control}
          name="general_appearance"
          render={({ field }) => (
            <Input
              {...field}
              label="General appearance"
              placeholder="e.g. comfortable, pale, in pain"
              required
              error={errors.general_appearance?.message}
            />
          )}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {select("consciousness", "Consciousness", CONSCIOUSNESS)}
          {select("skin_condition", "Skin", SKIN)}
          {select("nutrition", "Nutrition", NUTRITION)}
          {select("breathing", "Breathing", BREATHING)}
          <Controller
            control={control}
            name="pain_score"
            render={({ field }) => (
              <NumberField
                label="Pain score (0–10)"
                min={0}
                max={10}
                value={field.value}
                onChange={(v) => field.onChange(typeof v === "number" ? v : 0)}
                error={errors.pain_score?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="pain_location"
            render={({ field }) => <Input {...field} label="Pain location" />}
          />
          <Controller
            control={control}
            name="allergies"
            render={({ field }) => (
              <Input {...field} label="Allergies" placeholder="None known, or list them" />
            )}
          />
        </SimpleGrid>
        <Controller
          control={control}
          name="skin_notes"
          render={({ field }) => <TextArea {...field} label="Skin findings" />}
        />
        <Controller
          control={control}
          name="respiratory_notes"
          render={({ field }) => <TextArea {...field} label="Respiratory findings" />}
        />
        {TEXT_AREAS.map(({ name, label }) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => <TextArea {...field} label={label} />}
          />
        ))}
        <Text size="xs" c="dimmed">
          Score fall risk (Morse) and pressure-injury risk (Braden) on the Assessments tab. A high
          score opens the prevention care plan and a ward task.
        </Text>
        {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
      </Stack>
    </Modal>
  );
}
