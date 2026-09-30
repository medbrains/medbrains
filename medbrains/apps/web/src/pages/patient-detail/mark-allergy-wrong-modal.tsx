/**
 * Mark an allergy as wrong — corrected on the chart, never erased.
 *
 * "Entered in error" is a record that should not exist (wrong patient, wrong
 * drug); "Not allergic" is a real re-assessment (a penicillin challenge came
 * back negative). Either way the allergy stops alerting and stays listed,
 * struck through, with who, when and why. The reason is required: the next
 * doctor needs it before prescribing what used to be flagged.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import type { AllergyVerdict, PatientAllergy } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Modal, SegmentedControl, TextArea, toast } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";

const RETIRING_VERDICTS = ["entered_in_error", "refuted"] as const;

const markWrongSchema = z.object({
  verdict: z.enum(RETIRING_VERDICTS),
  reason: z.string().trim().min(1, "Say why this allergy is wrong"),
});
type MarkWrongInput = z.infer<typeof markWrongSchema>;

const VERDICTS: Array<{ value: (typeof RETIRING_VERDICTS)[number]; label: string }> = [
  { value: "entered_in_error", label: "Entered in error" },
  { value: "refuted", label: "Not allergic" },
];

export interface MarkAllergyWrongModalProps {
  patientId: string;
  allergy: PatientAllergy | null;
  onClose: () => void;
}

export function MarkAllergyWrongModal({ patientId, allergy, onClose }: MarkAllergyWrongModalProps) {
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset, formState } = useForm<MarkWrongInput>({
    resolver: zodResolver(markWrongSchema),
    defaultValues: { verdict: "entered_in_error", reason: "" },
  });
  const close = () => {
    reset();
    onClose();
  };
  const mutation = useMutation({
    mutationFn: (values: MarkWrongInput) =>
      patientDetailService.verifyPatientAllergy(patientId, allergy?.id ?? "", {
        verdict: values.verdict satisfies AllergyVerdict,
        reason: values.reason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-allergies", patientId] });
      toast.success("It no longer alerts, and stays on the chart struck through.", {
        title: "Allergy marked as wrong",
      });
      close();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not mark the allergy" }),
  });

  return (
    <Modal opened={allergy !== null} onClose={close} title="Mark allergy as wrong">
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Stack>
          <Text size="sm">
            <strong>{allergy?.allergen_name}</strong> will stop alerting on prescribing and
            dispensing. The record stays, with your name and reason.
          </Text>
          <Controller
            control={control}
            name="verdict"
            render={({ field }) => (
              <SegmentedControl
                aria-label="Why it is wrong"
                value={field.value}
                onChange={field.onChange}
                data={VERDICTS}
              />
            )}
          />
          <Controller
            control={control}
            name="reason"
            render={({ field }) => (
              <TextArea
                label="Reason"
                placeholder="e.g. Recorded on the wrong patient / negative oral challenge 30 Sep"
                minRows={2}
                required
                error={formState.errors.reason?.message}
                {...field}
              />
            )}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" tone="danger" loading={mutation.isPending}>
              Mark as wrong
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
