// DAMA / LAMA modal — records discharge against medical advice with
// witnessed consent. Backend POST /api/ipd/admissions/{id}/dama
// accepts patient + relative + witness signatures plus risks-explained
// acknowledgment. MLC notification fires automatically when the case
// is flagged.

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  Radio,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { IpdDamaFormInput } from "@medbrains/schemas";
import { ipdDamaFormSchema } from "@medbrains/schemas";
import type { IpdDamaRequest } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { clinicalActionsService } from "../../services/clinicalActions.service";

interface DamaModalProps {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
}

export function DamaModal({ admissionId, opened, onClose }: DamaModalProps) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<IpdDamaFormInput>({
    resolver: zodResolver(ipdDamaFormSchema),
    defaultValues: {
      record_type: "dama",
      patient_signed: false,
      relative_name: "",
      relative_relation: "",
      relative_signed: false,
      witness_name: "",
      witness_signed: false,
      risks_explained: "",
      reason_for_leaving: "",
      is_mlc_case: false,
      notes: "",
    },
    mode: "onTouched",
  });
  const recordType = watch("record_type");

  const mutation = useMutation({
    mutationFn: (body: IpdDamaRequest) => clinicalActionsService.recordIpdDama(admissionId, body),
    onSuccess: () => {
      notifications.show({
        title: recordType === "dama" ? "DAMA recorded" : "LAMA recorded",
        message: "Refusal documented. MLC notified if applicable.",
        color: "warning",
      });
      void queryClient.invalidateQueries({ queryKey: ["ipd-dama", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-admission", admissionId] });
      reset();
      onClose();
    },
  });

  const submit = handleSubmit((values) => {
    mutation.mutate({
      record_type: values.record_type,
      patient_signed: values.patient_signed,
      relative_name: values.relative_name || undefined,
      relative_relation: values.relative_relation || undefined,
      relative_signed: values.relative_signed,
      witness_name: values.witness_name || undefined,
      witness_signed: values.witness_signed,
      risks_explained: values.risks_explained || undefined,
      reason_for_leaving: values.reason_for_leaving || undefined,
      is_mlc_case: values.is_mlc_case,
      notes: values.notes || undefined,
    });
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Discharge / Leave Against Medical Advice"
      size="xl"
    >
      <Stack gap="sm">
        <Alert color="warning" variant="light">
          This records a formal refusal of medical care. The patient (or authorised relative) and a
          witness must sign. If this is an MLC, notification will fire to the police liaison.
        </Alert>

        <Controller
          control={control}
          name="record_type"
          render={({ field }) => (
            <Radio.Group label="Record type" value={field.value} onChange={field.onChange} required>
              <Group mt="xs">
                <Radio value="dama" label="DAMA — formal discharge against advice" />
                <Radio value="lama" label="LAMA — left without formal discharge" />
              </Group>
            </Radio.Group>
          )}
        />

        <Controller
          control={control}
          name="risks_explained"
          render={({ field }) => (
            <Textarea
              label="Risks explained to patient/family"
              autosize
              minRows={2}
              value={field.value}
              onChange={field.onChange}
              error={errors.risks_explained?.message}
              placeholder="What was explained — risk of complications, mortality, alternative care options"
            />
          )}
        />

        <Controller
          control={control}
          name="reason_for_leaving"
          render={({ field }) => (
            <Textarea
              label="Reason for leaving"
              autosize
              minRows={2}
              value={field.value}
              onChange={field.onChange}
              placeholder="Patient-stated reason"
            />
          )}
        />

        <Controller
          control={control}
          name="patient_signed"
          render={({ field }) => (
            <Checkbox
              label="Patient signed (or thumb impression)"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
              error={errors.patient_signed?.message}
            />
          )}
        />

        <Group grow>
          <Controller
            control={control}
            name="relative_name"
            render={({ field }) => (
              <TextInput
                label="Authorised relative — name"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="relative_relation"
            render={({ field }) => (
              <TextInput label="Relation" value={field.value} onChange={field.onChange} />
            )}
          />
        </Group>
        <Controller
          control={control}
          name="relative_signed"
          render={({ field }) => (
            <Checkbox
              label="Relative signed"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
              error={errors.relative_signed?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="witness_name"
          render={({ field }) => (
            <TextInput
              label="Witness name (staff or independent)"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="witness_signed"
          render={({ field }) => (
            <Checkbox
              label="Witness signed"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />

        <Controller
          control={control}
          name="is_mlc_case"
          render={({ field }) => (
            <Checkbox
              label="MLC case — notify police liaison"
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
              label="Internal notes"
              autosize
              minRows={2}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button color="warning" loading={mutation.isPending} onClick={() => void submit()}>
            Record refusal
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
