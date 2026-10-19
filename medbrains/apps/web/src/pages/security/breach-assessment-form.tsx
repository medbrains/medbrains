// Classify an incident as CERT-In reportable and/or a DPDP personal-data breach,
// and say when it was noticed — that moment starts the 6 h and 72 h clocks.
// Only `security.breach.manage` holders see this form; the server re-checks.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { AssessBreachRequest, SecurityIncident } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, MultiSelect, NumberField, Switch, toast } from "@/components/ui";
import { securityService } from "@/services/security.service";

export const BREACH_DATA_CATEGORIES = [
  { value: "health_records", label: "Health records" },
  { value: "identity", label: "Identity (name, ID numbers)" },
  { value: "contact", label: "Contact details" },
  { value: "financial", label: "Financial / payment" },
  { value: "biometric", label: "Biometric" },
  { value: "children", label: "Children's data" },
  { value: "credentials", label: "Passwords / credentials" },
  { value: "other", label: "Other" },
];

const schema = z
  .object({
    discovered_at: z.string().min(1, "When was it noticed?"),
    is_cert_in_reportable: z.boolean(),
    is_personal_data_breach: z.boolean(),
    breach_data_categories: z.array(z.string()),
    principals_affected_estimate: z.number().int().min(0).nullable(),
  })
  .refine((v) => !v.is_personal_data_breach || v.breach_data_categories.length > 0, {
    path: ["breach_data_categories"],
    message: "Say which kinds of personal data were involved",
  })
  .refine((v) => Date.parse(v.discovered_at) <= Date.now(), {
    path: ["discovered_at"],
    message: "Cannot be in the future",
  });
type FormValues = z.infer<typeof schema>;

/** ISO → the value a `datetime-local` input shows, in the browser's zone. */
function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function BreachAssessmentForm({ incident }: { incident: SecurityIncident }) {
  const qc = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      discovered_at: toLocalInput(incident.discovered_at ?? incident.occurred_at),
      is_cert_in_reportable: incident.is_cert_in_reportable,
      is_personal_data_breach: incident.is_personal_data_breach,
      breach_data_categories: incident.breach_data_categories,
      principals_affected_estimate: incident.principals_affected_estimate,
    },
  });
  const isBreach = form.watch("is_personal_data_breach");
  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body: AssessBreachRequest = {
        ...v,
        discovered_at: new Date(v.discovered_at).toISOString(),
      };
      return securityService.assessIncidentBreach(incident.id, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-incidents"] });
      void qc.invalidateQueries({ queryKey: ["sec-incident-updates", incident.id] });
      toast.success("Assessment saved; the reporting clocks are running", { title: "Saved" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Assessment not saved" }),
  });

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
      <Stack gap="sm">
        <Text fw={600}>Assessment</Text>
        <Controller
          control={form.control}
          name="discovered_at"
          render={({ field, fieldState }) => (
            <Input
              {...field}
              type="datetime-local"
              label="Noticed at"
              description="The clocks start when the incident was noticed, not when it was confirmed."
              error={fieldState.error?.message}
            />
          )}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Controller
            control={form.control}
            name="is_cert_in_reportable"
            render={({ field }) => (
              <Switch
                label="CERT-In reportable (report within 6 h)"
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
          <Controller
            control={form.control}
            name="is_personal_data_breach"
            render={({ field }) => (
              <Switch
                label="Personal-data breach (Board within 72 h)"
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
        </SimpleGrid>
        {isBreach && (
          <>
            <Controller
              control={form.control}
              name="breach_data_categories"
              render={({ field, fieldState }) => (
                <MultiSelect
                  label="Personal data involved"
                  data={BREACH_DATA_CATEGORIES}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="principals_affected_estimate"
              render={({ field, fieldState }) => (
                <NumberField
                  label="People affected (approximately)"
                  min={0}
                  value={field.value ?? ""}
                  onChange={(v) => field.onChange(typeof v === "number" ? v : null)}
                  error={fieldState.error?.message}
                />
              )}
            />
          </>
        )}
        <Group justify="flex-end">
          <Button type="submit" tone="primary" loading={save.isPending}>
            Save assessment
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
