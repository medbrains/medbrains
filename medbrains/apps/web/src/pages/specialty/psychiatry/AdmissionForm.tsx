import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { Alert, Modal, NumberField, Select, Switch, TextArea } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import {
  ADMISSION_CATEGORIES,
  APPLICANTS,
  CRITERIA,
  EXAMINER_ROLES,
  SECTION_REQUIREMENTS,
} from "./labels";

const role = z.enum(["psychiatrist", "mental_health_professional", "medical_practitioner"]);
const schema = z.object({
  category: z.enum([
    "independent",
    "supported",
    "minor_supported",
    "emergency",
    "supported_extended",
  ]),
  applicant: z.enum(["self", "nominated_representative", "medical_practitioner"]),
  criteria: z.array(
    z.enum(["self_harm", "harm_to_others", "unable_to_self_care", "property_damage"]),
  ),
  exams: z.array(z.object({ user_id: z.string(), role, examined_at: z.string().nullable() })),
  least_restrictive_certified: z.boolean(),
  needs_high_support: z.boolean(),
  minor_safeguards_confirmed: z.boolean(),
  extension_number: z.number().int().min(0),
  capacity_note: z.string().max(5000),
});
type Form = z.infer<typeof schema>;

const DEFAULTS: Form = {
  category: "independent",
  applicant: "self",
  criteria: [],
  exams: [
    { user_id: "", role: "psychiatrist", examined_at: null },
    { user_id: "", role: "mental_health_professional", examined_at: null },
  ],
  least_restrictive_certified: false,
  needs_high_support: false,
  minor_safeguards_confirmed: false,
  extension_number: 0,
  capacity_note: "",
};

function toRequest(v: Form) {
  const needsExams = v.category !== "independent" && v.category !== "emergency";
  return {
    category: v.category,
    applicant: v.applicant,
    criteria: v.category === "independent" ? [] : v.criteria,
    least_restrictive_certified: v.least_restrictive_certified,
    needs_high_support: v.needs_high_support,
    minor_safeguards_confirmed: v.minor_safeguards_confirmed,
    extension_number: v.extension_number,
    capacity_note: v.capacity_note.trim() || undefined,
    examinations: needsExams
      ? v.exams
          .filter((e) => e.user_id && e.examined_at)
          .map((e) => ({
            user_id: e.user_id,
            role: e.role,
            examined_at: new Date(e.examined_at ?? "").toISOString(),
          }))
      : [],
  };
}

interface AdmissionFormProps {
  psychPatientId: string;
  opened: boolean;
  onClose: () => void;
}

/** Admit under a section. The server checks the section's requirements and
 *  lists every one unmet, so they are shown together here. */
export function AdmissionForm({ psychPatientId, opened, onClose }: AdmissionFormProps) {
  const qc = useQueryClient();
  const { control, handleSubmit, watch, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });
  const category = watch("category");
  const needsExams = category !== "independent" && category !== "emergency";
  const save = useMutation({
    mutationFn: (v: Form) => psychiatryService.createAdmission(psychPatientId, toRequest(v)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["psych-admissions", psychPatientId] });
      void qc.invalidateQueries({ queryKey: ["psych-patients"] });
      reset(DEFAULTS);
      onClose();
    },
  });
  const sw = (
    name: "least_restrictive_certified" | "needs_high_support" | "minor_safeguards_confirmed",
    label: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Switch
          label={label}
          checked={field.value}
          onChange={(e) => field.onChange(e.currentTarget.checked)}
        />
      )}
    />
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Admit under the Mental Healthcare Act"
      size="xl"
      primaryAction={{
        label: "Admit",
        onClick: () => void handleSubmit((v) => save.mutate(v))(),
        loading: save.isPending,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                label="Section"
                data={ADMISSION_CATEGORIES}
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
                allowDeselect={false}
              />
            )}
          />
          <Controller
            control={control}
            name="applicant"
            render={({ field }) => (
              <Select
                label="Applied for by"
                data={APPLICANTS}
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
                allowDeselect={false}
              />
            )}
          />
        </SimpleGrid>
        <Alert tone="info">{SECTION_REQUIREMENTS[category]}</Alert>
        {category !== "independent" && (
          <Controller
            control={control}
            name="criteria"
            render={({ field }) => (
              <Checkbox.Group label="Grounds" value={field.value} onChange={field.onChange}>
                <Stack gap={4} mt={4}>
                  {CRITERIA.map((c) => (
                    <Checkbox key={c.value} value={c.value} label={c.label} />
                  ))}
                </Stack>
              </Checkbox.Group>
            )}
          />
        )}
        {needsExams &&
          ([0, 1] as const).map((i) => (
            <Group key={`exam-${i}`} grow align="flex-end">
              <Controller
                control={control}
                name={`exams.${i}.user_id`}
                render={({ field }) => (
                  <DoctorSearchSelect
                    label={`Examiner ${i + 1}`}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name={`exams.${i}.role`}
                render={({ field }) => (
                  <Select
                    label="Role"
                    data={EXAMINER_ROLES}
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                    allowDeselect={false}
                  />
                )}
              />
              <Controller
                control={control}
                name={`exams.${i}.examined_at`}
                render={({ field }) => (
                  <DateTimePicker
                    label="Examined at"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </Group>
          ))}
        {needsExams &&
          sw(
            "least_restrictive_certified",
            "Examiners certify admission is the least restrictive option",
          )}
        {sw(
          "needs_high_support",
          "Needs very high support from the representative to make treatment decisions",
        )}
        {category === "minor_supported" &&
          sw(
            "minor_safeguards_confirmed",
            "Housed apart from adults, with the representative or an attendant present throughout",
          )}
        {category === "supported_extended" && (
          <Controller
            control={control}
            name="extension_number"
            render={({ field }) => (
              <NumberField
                label="Extension number (0 = first admission under s.90)"
                min={0}
                value={field.value}
                onChange={(v) => field.onChange(typeof v === "number" ? v : 0)}
              />
            )}
          />
        )}
        <Controller
          control={control}
          name="capacity_note"
          render={({ field }) => (
            <TextArea label="Capacity and support assessment" autosize minRows={2} {...field} />
          )}
        />
        {save.isError && (
          <Alert tone="danger" title="The admission does not meet its section">
            <Text size="sm">{save.error.message}</Text>
          </Alert>
        )}
      </Stack>
    </Modal>
  );
}
