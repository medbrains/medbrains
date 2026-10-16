/**
 * Taking a procedure consent. The procedure and consent type are fixed; what
 * was explained and who consented are the hospital's own consent form — its
 * published version, or the built-in one — so a hospital can add the
 * questions its consent needs without a code change.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack } from "@mantine/core";
import { api } from "@medbrains/api";
import { opdProcedureConsentFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import { type CreateConsentRequest, P } from "@medbrains/types";
import { IconFileCheck } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { cleanAnswers, DynamicFields, useDynamicForm } from "@/components/DynamicForm";
import { QueryError } from "@/components/QueryError";
import { Alert, Button, Input, Modal, Select } from "@/components/ui";
import {
  DEFAULT_OPD_CONSENT_FORM_VALUES,
  OPD_CONSENT_TYPE_OPTIONS,
  toCreateConsentRequest,
} from "@/forms/opd.form";
import { isOtConsentType, OtBookingForConsentSelect } from "./OtBookingForConsentSelect";

const CONSENT_FORM = "procedure_consent";
const NO_DEFINITION = { sections: [] };

interface NewConsentModalProps {
  opened: boolean;
  patientId: string;
  encounterId: string;
  saving: boolean;
  onClose: () => void;
  onCreate: (request: CreateConsentRequest) => void;
}

export function NewConsentModal({
  opened,
  patientId,
  encounterId,
  saving,
  onClose,
  onCreate,
}: NewConsentModalProps) {
  const canReadForm = useHasPermission(P.FORMS.DEFINITIONS.READ);
  const live = useQuery({
    queryKey: ["live-form", CONSENT_FORM],
    queryFn: () => api.getLiveForm(CONSENT_FORM),
    enabled: opened && canReadForm,
  });
  const header = useForm({
    resolver: zodResolver(opdProcedureConsentFormSchema),
    defaultValues: DEFAULT_OPD_CONSENT_FORM_VALUES,
    mode: "onTouched",
  });
  const answers = useDynamicForm(live.data?.definition ?? NO_DEFINITION);
  const [otBookingId, setOtBookingId] = useState<string | null>(null);
  const consentType = header.watch("consent_type");

  const close = () => {
    header.reset(DEFAULT_OPD_CONSENT_FORM_VALUES);
    answers.reset();
    setOtBookingId(null);
    onClose();
  };
  const submit = header.handleSubmit(async (values) => {
    const answered = await answers.trigger();
    if (!answered || !live.data) return;
    onCreate({
      ...toCreateConsentRequest(values, patientId, encounterId),
      ot_booking_id: isOtConsentType(values.consent_type) ? (otBookingId ?? undefined) : undefined,
      answers: cleanAnswers(answers.getValues()),
      form_version_id: live.data.version_id ?? undefined,
    });
  });

  return (
    <Modal opened={opened} onClose={close} title="New procedure consent" size="lg">
      <Stack gap="sm">
        <Controller
          control={header.control}
          name="procedure_name"
          render={({ field, fieldState }) => (
            <Input label="Procedure name" required error={fieldState.error?.message} {...field} />
          )}
        />
        <Controller
          control={header.control}
          name="consent_type"
          render={({ field }) => (
            <Select
              label="Consent type"
              data={OPD_CONSENT_TYPE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <OtBookingForConsentSelect
          patientId={patientId}
          consentType={consentType}
          value={otBookingId}
          onChange={setOtBookingId}
        />
        {!canReadForm && (
          <Alert tone="warning" title="You can't load the consent form">
            Ask an administrator for the "Load the live version of a form" permission.
          </Alert>
        )}
        {live.isError && <QueryError error={live.error} onRetry={() => void live.refetch()} />}
        {live.data && (
          <DynamicFields
            definition={live.data.definition}
            control={answers.control}
            errors={answers.formState.errors}
          />
        )}
        <Group justify="flex-end">
          <Button tone="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            tone="primary"
            onClick={submit}
            loading={saving}
            disabled={!live.data}
            leftSection={<IconFileCheck size={14} />}
          >
            Create consent
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
