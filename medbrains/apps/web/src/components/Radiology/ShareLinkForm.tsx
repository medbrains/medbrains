/**
 * Who a shared-images link is for, and where their one-time code goes.
 *
 * The patient's own link sends the code to the mobile on their record. A
 * clinician's needs a phone or email to send it to, and can be
 * de-identified for a second opinion. A link lasts a day unless set
 * otherwise, a week at most.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { CreateStudyShareLink } from "@medbrains/types";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, SegmentedControl, Switch } from "@/components/ui";

const MIN_PHONE_DIGITS = 10;

const schema = z
  .object({
    recipient_kind: z.enum(["clinician", "patient"]),
    recipient_name: z.string().trim(),
    recipient_phone: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || v.replace(/\D/g, "").length >= MIN_PHONE_DIGITS,
        "A full mobile number, with area or country code",
      ),
    recipient_email: z.union([z.literal(""), z.email("Not an email address")]),
    deidentify: z.boolean(),
    expires_hours: z.enum(["24", "72", "168"]),
  })
  .superRefine((v, ctx) => {
    if (v.recipient_kind !== "clinician") return;
    if (v.recipient_name === "")
      ctx.addIssue({ code: "custom", path: ["recipient_name"], message: "Who is it for?" });
    if (v.recipient_phone === "" && v.recipient_email === "")
      ctx.addIssue({
        code: "custom",
        path: ["recipient_phone"],
        message: "A phone or email: the images open only with a code sent there",
      });
  });
type Form = z.infer<typeof schema>;

const DEFAULTS: Form = {
  recipient_kind: "clinician",
  recipient_name: "",
  recipient_phone: "",
  recipient_email: "",
  deidentify: false,
  expires_hours: "24",
};

export function toRequest(studyId: string, v: Form): CreateStudyShareLink {
  if (v.recipient_kind === "patient")
    return { study_id: studyId, recipient_kind: "patient", expires_hours: Number(v.expires_hours) };
  return {
    study_id: studyId,
    recipient_kind: "clinician",
    recipient_name: v.recipient_name,
    ...(v.recipient_phone ? { recipient_phone: v.recipient_phone } : {}),
    ...(v.recipient_email ? { recipient_email: v.recipient_email } : {}),
    deidentify: v.deidentify,
    expires_hours: Number(v.expires_hours),
  };
}

interface ShareLinkFormProps {
  studyId: string;
  loading: boolean;
  onSubmit: (request: CreateStudyShareLink) => void;
}

export function ShareLinkForm({ studyId, loading, onSubmit }: ShareLinkFormProps) {
  const { control, handleSubmit, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });
  const kind = watch("recipient_kind");
  const deidentify = watch("deidentify");
  return (
    <form
      aria-label="Share link"
      noValidate
      onSubmit={handleSubmit((v) => onSubmit(toRequest(studyId, v)))}
    >
      <Stack>
        <Controller
          control={control}
          name="recipient_kind"
          render={({ field }) => (
            <SegmentedControl
              aria-label="Who the link is for"
              data={[
                { value: "clinician", label: "A doctor or clinician" },
                { value: "patient", label: "The patient" },
              ]}
              {...field}
            />
          )}
        />
        {kind === "patient" ? (
          <Text size="sm" c="dimmed">
            The code goes to the mobile number on the patient&apos;s record.
          </Text>
        ) : (
          <>
            <Controller
              control={control}
              name="recipient_name"
              render={({ field, fieldState }) => (
                <Input
                  label="For"
                  required
                  placeholder="Dr Rao, City Hospital"
                  {...field}
                  error={fieldState.error?.message}
                />
              )}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Controller
                control={control}
                name="recipient_phone"
                render={({ field, fieldState }) => (
                  <Input
                    label="Their mobile"
                    type="tel"
                    {...field}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="recipient_email"
                render={({ field, fieldState }) => (
                  <Input
                    label="or their email"
                    type="email"
                    {...field}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <Controller
              control={control}
              name="deidentify"
              render={({ field }) => (
                <Switch
                  label="De-identify (second opinion, teleradiology)"
                  description="Removes names, IDs, birth date, accession and staff names from the images' data."
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            {deidentify && (
              <Alert tone="warning" title="Check the images first">
                Text burned into an image — common on ultrasound and scanned films — is not removed.
              </Alert>
            )}
          </>
        )}
        <Group justify="space-between">
          <Controller
            control={control}
            name="expires_hours"
            render={({ field }) => (
              <SegmentedControl
                aria-label="Link lasts"
                data={[
                  { value: "24", label: "1 day" },
                  { value: "72", label: "3 days" },
                  { value: "168", label: "7 days" },
                ]}
                {...field}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={loading}>
            Make link
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
