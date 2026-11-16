import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Modal, Select, Stack, Textarea, TextInput } from "@mantine/core";
import {
  type OpdMedicalCertificateFormInput,
  opdMedicalCertificateFormSchema,
} from "@medbrains/schemas";
import { IconCertificate } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Control, Controller, type FieldErrors, useForm } from "react-hook-form";
import { useClinicalEmit } from "@/components";
import { Button, toast } from "@/components/ui";
import {
  DEFAULT_OPD_MEDICAL_CERTIFICATE_FORM_VALUES,
  OPD_CERTIFICATE_TYPE_OPTIONS,
  toCreateMedicalCertificateRequest,
} from "@/forms/opd.form";
import { todayDateString } from "@/lib/date-utils";
import { opdService } from "@/services/opd.service";

interface NewCertificateModalProps {
  opened: boolean;
  onClose: () => void;
  /** Called when the closing animation has finished. */
  onClosed: () => void;
  patientId: string;
  encounterId: string;
}

interface FieldsProps {
  control: Control<OpdMedicalCertificateFormInput>;
  errors: FieldErrors<OpdMedicalCertificateFormInput>;
}

/**
 * Issues a medical certificate from this visit. On success it records the clinical event (so the
 * case sheet and audit see it), refreshes the patient's list and closes. The parent mounts a new
 * one after each close, so the form always starts empty with today as the issued date.
 */
export function NewCertificateModal({
  opened,
  onClose,
  onClosed,
  patientId,
  encounterId,
}: NewCertificateModalProps) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const { control, handleSubmit, watch, formState } = useForm<OpdMedicalCertificateFormInput>({
    resolver: zodResolver(opdMedicalCertificateFormSchema),
    defaultValues: {
      ...DEFAULT_OPD_MEDICAL_CERTIFICATE_FORM_VALUES,
      issued_date: todayDateString(),
    },
    mode: "onTouched",
  });
  const create = useMutation({
    mutationFn: opdService.createCertificate,
    onSuccess: (certificate) => {
      emit("opd.certificate.created", {
        certificate_id: certificate.id,
        certificate_number: certificate.certificate_number,
        certificate_type: certificate.certificate_type,
        encounter_id: certificate.encounter_id,
        issued_date: certificate.issued_date,
        patient_id: certificate.patient_id,
        source_record_id: certificate.id,
      });
      void queryClient.invalidateQueries({ queryKey: ["patient-certificates", patientId] });
      toast.success("Medical certificate generated", { title: "Certificate created" });
      onClose();
    },
    onError: () => {
      toast.error("Failed to create certificate", { title: "Error" });
    },
  });
  const submit = handleSubmit((values) =>
    create.mutate(toCreateMedicalCertificateRequest(values, patientId, encounterId)),
  );
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      onExitTransitionEnd={onClosed}
      title="New Medical Certificate"
      size="md"
    >
      <Stack gap="sm">
        <CertificateTypeField control={control} errors={formState.errors} />
        <CertificateDateFields control={control} errors={formState.errors} />
        <CertificateNoteFields control={control} errors={formState.errors} />
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            onClick={submit}
            loading={create.isPending}
            disabled={!watch("certificate_type")}
            leftSection={<IconCertificate size={14} />}
          >
            Create Certificate
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** The certificate type; clearing it falls back to the default type, as the form requires one. */
function CertificateTypeField({ control, errors }: FieldsProps) {
  return (
    <Controller
      control={control}
      name="certificate_type"
      render={({ field }) => (
        <Select
          label="Certificate Type"
          placeholder="Select type"
          data={OPD_CERTIFICATE_TYPE_OPTIONS}
          value={field.value}
          onChange={(value) =>
            field.onChange(value ?? DEFAULT_OPD_MEDICAL_CERTIFICATE_FORM_VALUES.certificate_type)
          }
          error={errors.certificate_type?.message}
          required
        />
      )}
    />
  );
}

/** The issued date (required) and the optional validity period. */
function CertificateDateFields({ control, errors }: FieldsProps) {
  return (
    <>
      <Controller
        control={control}
        name="issued_date"
        render={({ field }) => (
          <TextInput
            label="Issued Date"
            type="date"
            error={errors.issued_date?.message}
            required
            {...field}
          />
        )}
      />
      <Group grow>
        <Controller
          control={control}
          name="valid_from"
          render={({ field }) => (
            <TextInput
              label="Valid From"
              type="date"
              error={errors.valid_from?.message}
              {...field}
            />
          )}
        />
        <Controller
          control={control}
          name="valid_to"
          render={({ field }) => (
            <TextInput label="Valid To" type="date" error={errors.valid_to?.message} {...field} />
          )}
        />
      </Group>
    </>
  );
}

/** The diagnosis printed on the certificate, and free remarks. */
function CertificateNoteFields({ control, errors }: FieldsProps) {
  return (
    <>
      <Controller
        control={control}
        name="diagnosis"
        render={({ field }) => (
          <Textarea
            label="Diagnosis"
            placeholder="Primary diagnosis for certificate"
            error={errors.diagnosis?.message}
            autosize
            minRows={2}
            {...field}
          />
        )}
      />
      <Controller
        control={control}
        name="remarks"
        render={({ field }) => (
          <Textarea
            label="Remarks"
            placeholder="Additional remarks or instructions"
            error={errors.remarks?.message}
            autosize
            minRows={2}
            {...field}
          />
        )}
      />
    </>
  );
}
