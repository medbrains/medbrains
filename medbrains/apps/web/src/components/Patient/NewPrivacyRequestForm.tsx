/**
 * Taking down a patient's DPDP request at the desk: what they asked for, how
 * it arrived, and — for a nominee — who. Its 90-day clock starts when saved.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Select, Stack, Textarea, TextInput } from "@mantine/core";
import type { CreatePrivacyRequest } from "@medbrains/types";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert, Button } from "@/components/ui";
import { PRIVACY_CHANNELS, PRIVACY_REQUEST_TYPES } from "./privacy-request-labels";

const schema = z
  .object({
    request_type: z.enum(["access", "correction", "erasure", "nominee", "grievance"]),
    received_via: z.enum(["desk", "email", "phone", "letter", "portal"]),
    details: z.string().trim().min(5, "Write down what the patient asked for"),
    nominee_name: z.string(),
    nominee_relation: z.string(),
    nominee_contact: z.string(),
  })
  .refine((v) => v.request_type !== "nominee" || v.nominee_name.trim().length > 0, {
    path: ["nominee_name"],
    message: "Name the nominee",
  });
type Values = z.infer<typeof schema>;

interface NewPrivacyRequestFormProps {
  patientId: string;
  saving: boolean;
  error: Error | null;
  onSubmit: (data: CreatePrivacyRequest) => void;
  /** The patient files it themselves: no "how it reached us". */
  byPatient?: boolean;
}

export function NewPrivacyRequestForm({
  patientId,
  saving,
  error,
  onSubmit,
  byPatient = false,
}: NewPrivacyRequestFormProps) {
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      request_type: "access",
      received_via: "desk",
      details: "",
      nominee_name: "",
      nominee_relation: "",
      nominee_contact: "",
    },
  });
  const type = useWatch({ control, name: "request_type" });
  const submit = (v: Values) =>
    onSubmit({
      patient_id: patientId,
      request_type: v.request_type,
      received_via: v.received_via,
      details: v.details,
      nominee_name: v.nominee_name || undefined,
      nominee_relation: v.nominee_relation || undefined,
      nominee_contact: v.nominee_contact || undefined,
    });
  return (
    <Stack
      component="form"
      gap="sm"
      aria-label="New privacy request"
      onSubmit={handleSubmit(submit)}
    >
      <Controller
        control={control}
        name="request_type"
        render={({ field }) => (
          <Select
            label={byPatient ? "I want to" : "The patient asks to"}
            data={PRIVACY_REQUEST_TYPES}
            allowDeselect={false}
            {...field}
          />
        )}
      />
      {!byPatient && (
        <Controller
          control={control}
          name="received_via"
          render={({ field }) => (
            <Select
              label="How it reached us"
              data={PRIVACY_CHANNELS}
              allowDeselect={false}
              {...field}
            />
          )}
        />
      )}
      <Controller
        control={control}
        name="details"
        render={({ field, fieldState }) => (
          <Textarea
            {...field}
            label={byPatient ? "Tell us more" : "In their words"}
            withAsterisk
            autosize
            minRows={2}
            error={fieldState.error?.message}
          />
        )}
      />
      {type === "nominee" && (
        <>
          <Controller
            control={control}
            name="nominee_name"
            render={({ field, fieldState }) => (
              <TextInput
                {...field}
                label="Nominee"
                withAsterisk
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="nominee_relation"
            render={({ field }) => <TextInput {...field} label="Relation to the patient" />}
          />
          <Controller
            control={control}
            name="nominee_contact"
            render={({ field }) => <TextInput {...field} label="Nominee's phone or email" />}
          />
        </>
      )}
      {error && <Alert tone="danger">{error.message}</Alert>}
      <Button tone="primary" type="submit" loading={saving}>
        {byPatient ? "Send request" : "Record request"}
      </Button>
    </Stack>
  );
}
