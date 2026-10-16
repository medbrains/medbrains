// Report a tag event by hand — a band found cut, a tag seen leaving its zone.
// The tag reader posts the same event itself. An infant tag leaving or
// tampered with raises Code Pink on the server; this screen says so.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack } from "@mantine/core";
import type {
  RecordSecurityTagEventRequest,
  SecurityTagEventResult,
  SecurityZone,
} from "@medbrains/types";
import { IconAlertOctagon } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Panel, Select } from "@/components/ui";
import { securityService } from "@/services/security.service";

export const TAG_EVENT_LABELS: Record<string, string> = {
  exit_zone: "Left its zone",
  zone_breach: "Zone breach",
  tamper: "Band tampered",
  band_removed: "Band removed / cut",
  low_battery: "Low battery",
  band_mismatch: "Band mismatch at handover",
};

const EVENT_OPTIONS = ["exit_zone", "zone_breach", "tamper", "band_removed", "low_battery"].map(
  (value) => ({ value, label: TAG_EVENT_LABELS[value] ?? value }),
);

const eventSchema = z.object({
  tag_identifier: z.string().trim().min(1, "Enter the tag or band number"),
  event_type: z.enum(["exit_zone", "zone_breach", "tamper", "band_removed", "low_battery"]),
  zone_id: z.string().optional(),
  location_description: z.string().trim().optional(),
});
type EventForm = z.infer<typeof eventSchema>;

const EMPTY: EventForm = {
  tag_identifier: "",
  event_type: "band_removed",
  location_description: "",
};

interface TagEventPanelProps {
  zones: SecurityZone[];
}

export function TagEventPanel({ zones }: TagEventPanelProps) {
  const qc = useQueryClient();
  const form = useForm<EventForm>({ resolver: zodResolver(eventSchema), defaultValues: EMPTY });
  const reportMut = useMutation<SecurityTagEventResult, Error, RecordSecurityTagEventRequest>({
    mutationFn: (body) => securityService.recordSecurityTagEvent(body),
    onSuccess: () => {
      form.reset(EMPTY);
      void qc.invalidateQueries({ queryKey: ["sec-tag-alerts"] });
      void qc.invalidateQueries({ queryKey: ["sec-patient-tags"] });
      void qc.invalidateQueries({ queryKey: ["emergency-codes-active"] });
    },
    onError: () => undefined,
  });
  const result = reportMut.data;

  return (
    <Panel
      title="Report a tag event"
      description="An infant tag that leaves its zone or is tampered with raises Code Pink at once."
    >
      <Stack
        component="form"
        onSubmit={form.handleSubmit((values) =>
          reportMut.mutate({
            ...values,
            zone_id: values.zone_id || undefined,
            location_description: values.location_description || undefined,
          }),
        )}
      >
        <Group grow align="flex-start">
          <Controller
            control={form.control}
            name="tag_identifier"
            render={({ field, fieldState }) => (
              <Input
                label="Tag / band number"
                required
                {...field}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="event_type"
            render={({ field }) => (
              <Select
                label="What happened"
                data={EVENT_OPTIONS}
                value={field.value}
                onChange={(v) => field.onChange(v ?? "band_removed")}
                allowDeselect={false}
              />
            )}
          />
          <Controller
            control={form.control}
            name="zone_id"
            render={({ field }) => (
              <Select
                label="Zone"
                clearable
                data={zones.map((z) => ({ value: z.id, label: `${z.zone_code} — ${z.name}` }))}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? undefined)}
              />
            )}
          />
          <Controller
            control={form.control}
            name="location_description"
            render={({ field }) => <Input label="Where" {...field} value={field.value ?? ""} />}
          />
        </Group>
        <Group>
          <Button
            tone="danger"
            type="submit"
            leftSection={<IconAlertOctagon size={16} />}
            loading={reportMut.isPending}
          >
            Report event
          </Button>
        </Group>
        {result?.code_pink_activation_id && (
          <Alert tone="danger" title="Code Pink is active">
            {result.deduplicated
              ? "This tag already has an open alert; it is part of the running Code Pink."
              : "Code Pink has been raised for this infant tag. Secure the exits."}
          </Alert>
        )}
        {result && !result.code_pink_activation_id && (
          <Alert tone="warning" title="Alert raised">
            {result.deduplicated
              ? "This tag already has an open alert of this kind."
              : "The alert is on the list below for security to resolve."}
          </Alert>
        )}
        {reportMut.isError && (
          <Alert tone="danger" title="The event was not recorded">
            {reportMut.error.message}. If a baby or patient may be leaving, call security now.
          </Alert>
        )}
      </Stack>
    </Panel>
  );
}
