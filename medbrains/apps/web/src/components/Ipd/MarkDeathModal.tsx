// Mark death modal — captures cause of death + MLC + autopsy flags
// and creates an `ipd_mortality_reviews` row. Server stamps
// review_due_at = death + 72h (NABH M&M conference deadline).
//
// Today this modal does NOT yet flip the admission status to
// 'expired' — that lives in the discharge tab. Operator workflow:
// (1) Mark death here → mortality queue + Form 4/4A obligations.
// (2) Generate death summary doc.
// (3) Then discharge with disposition='expired'.

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Checkbox, Group, Modal, Stack, Textarea } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import type { IpdMarkDeathFormInput } from "@medbrains/schemas";
import { ipdMarkDeathFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import { type IpdMortalityCreate, P } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { clinicalActionsService } from "../../services/clinicalActions.service";
import { Icd11CodeSelect } from "../Clinical/Icd11CodeSelect";

interface MarkDeathModalProps {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
}

export function MarkDeathModal({ admissionId, opened, onClose }: MarkDeathModalProps) {
  const queryClient = useQueryClient();
  const canRecordDeath = useHasPermission(P.IPD.DEATH_RECORDS_MANAGE);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IpdMarkDeathFormInput>({
    resolver: zodResolver(ipdMarkDeathFormSchema),
    defaultValues: {
      death_at: new Date(),
      cause_of_death: "",
      primary_dx: "",
      is_mlc_case: false,
      autopsy_required: false,
      notes: "",
    },
    mode: "onTouched",
  });

  const mutation = useMutation({
    mutationFn: (body: IpdMortalityCreate) => {
      if (!canRecordDeath) {
        throw new Error("You do not have permission to record death details");
      }
      return clinicalActionsService.createIpdMortalityReview(body);
    },
    onSuccess: () => {
      notifications.show({
        title: "Death recorded",
        message: "M&M review scheduled within 72h. Form 4 / 4A pending.",
        color: "danger",
      });
      void queryClient.invalidateQueries({ queryKey: ["ipd-mortality"] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-admission", admissionId] });
      reset();
      onClose();
    },
  });

  const submit = handleSubmit((values) => {
    mutation.mutate({
      admission_id: admissionId,
      death_at: values.death_at?.toISOString() ?? "",
      cause_of_death: values.cause_of_death || undefined,
      primary_dx: values.primary_dx || undefined,
      is_mlc_case: values.is_mlc_case,
      autopsy_required: values.autopsy_required,
    });
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Mark patient death" size="lg">
      <Stack gap="sm">
        <Alert color="danger" variant="light">
          Records the death event and queues the case for M&M review. Civil registration (Form 4
          medical, Form 4A cause of death) and the discharge-with-`expired` disposition are separate
          steps that follow.
        </Alert>
        {!canRecordDeath && (
          <Alert color="danger" variant="light">
            Recording death details requires IPD death-record permission.
          </Alert>
        )}

        <Controller
          control={control}
          name="death_at"
          render={({ field }) => (
            <DateTimePicker
              label="Time of death"
              value={field.value}
              onChange={(v) => field.onChange(v ? new Date(v) : null)}
              error={errors.death_at?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="cause_of_death"
          render={({ field }) => (
            <Icd11CodeSelect
              label="Cause of death ICD-11"
              value={parseLeadingIcdCode(field.value)}
              onChange={(value) => {
                if (!value) field.onChange("");
              }}
              onSelectResult={(result) => field.onChange(`${result.code} - ${result.display}`)}
            />
          )}
        />

        <Controller
          control={control}
          name="primary_dx"
          render={({ field }) => (
            <Icd11CodeSelect
              label="Primary ICD-11 diagnosis"
              value={parseLeadingIcdCode(field.value)}
              onChange={(value) => {
                if (!value) field.onChange("");
              }}
              onSelectResult={(result) => field.onChange(`${result.code} - ${result.display}`)}
            />
          )}
        />

        <Controller
          control={control}
          name="is_mlc_case"
          render={({ field }) => (
            <Checkbox
              label="MLC case — police liaison + autopsy obligation"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />

        <Controller
          control={control}
          name="autopsy_required"
          render={({ field }) => (
            <Checkbox
              label="Autopsy required"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />

        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Textarea
              label="Additional notes"
              autosize
              minRows={2}
              value={field.value}
              onChange={field.onChange}
              placeholder="Family present? Resuscitation duration? Time of last vitals?"
            />
          )}
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="danger"
            loading={mutation.isPending}
            disabled={!canRecordDeath}
            onClick={() => void submit()}
          >
            Confirm death recorded
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function parseLeadingIcdCode(value: string | undefined): string | null {
  if (!value) return null;
  const [code] = value.split(" - ");
  return code?.trim() || null;
}
