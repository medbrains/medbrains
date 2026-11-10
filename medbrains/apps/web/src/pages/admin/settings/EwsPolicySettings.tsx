// The hospital's early-warning policy: minutes to the next full set of
// observations per score band, which bands escalate, and how long an
// escalation may wait for acknowledgement. The server refuses a policy that
// would watch a sicker patient less often or stop the emergency band
// escalating; NEWS2 defaults are the RCP NEWS2 (2017) Chart 4 minimums.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type EwsBand, type EwsPolicy, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, type FieldPath, type UseFormReturn, useForm } from "react-hook-form";
import { z } from "zod";
import { EWS_BAND_LABEL, EWS_TOOL_LABEL } from "@/components/EarlyWarning/ews-display";
import { Alert, Button, Card, Checkbox, NumberField, toast } from "@/components/ui";
import { nurseActivitiesService } from "@/services/nurseActivities.service";

const minutes = z.number().int().min(5, "At least 5 minutes").max(1440, "At most 1440 minutes");
const bands = z.object({
  routine: minutes,
  low: minutes,
  low_medium: minutes,
  urgent: minutes,
  emergency: minutes,
});
const schema = z.object({
  news2: bands,
  pews: bands,
  meows: bands,
  incomplete_max_minutes: z.number().int().min(5).max(240),
  escalate_bands: z.array(z.enum(["low_medium", "urgent", "emergency"])),
  ack_minutes_urgent: z.number().int().min(5).max(120),
  ack_minutes_emergency: z.number().int().min(5).max(120),
  max_escalation_levels: z.number().int().min(1).max(5),
});

type FormValues = z.infer<typeof schema>;
const TOOLS = ["news2", "pews", "meows"] as const;
const BANDS: EwsBand[] = ["routine", "low", "low_medium", "urgent", "emergency"];

interface MinutesFieldProps {
  form: UseFormReturn<FormValues>;
  name: FieldPath<FormValues>;
  label: string;
}

function MinutesField({ form, name, label }: MinutesFieldProps) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <NumberField
          label={label}
          min={5}
          suffix=" min"
          value={field.value as number}
          onChange={(v) => field.onChange(Number(v))}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

export function EwsPolicySettings() {
  const canEdit = useHasPermission(P.NURSE.EWS.POLICY);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["ews-policy"],
    queryFn: () => nurseActivitiesService.getEwsPolicy(),
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: data as FormValues | undefined,
  });
  const save = useMutation({
    mutationFn: (v: FormValues) => nurseActivitiesService.setEwsPolicy(v as EwsPolicy),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ews-policy"] });
      toast.success("Early-warning policy saved");
    },
  });
  if (error) {
    return (
      <Alert tone="danger" title="Policy could not be loaded">
        {(error as Error).message}
      </Alert>
    );
  }
  if (isLoading || !data) return <Text c="dimmed">Loading policy…</Text>;
  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))}>
      <Stack>
        <Text size="sm" c="dimmed">
          Minutes to the next full set of observations after a score in each band. NEWS2 defaults
          are the RCP NEWS2 (2017) minimums; PEWS (HQSC Aotearoa NZ, 2023) and MEOWS frequencies are
          local policy.
        </Text>
        {TOOLS.map((tool) => (
          <Card key={tool} withBorder padding="sm">
            <Title order={5} mb="xs">
              {EWS_TOOL_LABEL[tool]}
            </Title>
            <SimpleGrid cols={{ base: 2, md: 5 }}>
              {BANDS.map((band) => (
                <MinutesField
                  key={band}
                  form={form}
                  name={`${tool}.${band}`}
                  label={EWS_BAND_LABEL[band]}
                />
              ))}
            </SimpleGrid>
          </Card>
        ))}
        <Card withBorder padding="sm">
          <Title order={5} mb="xs">
            Escalation
          </Title>
          <Controller
            control={form.control}
            name="escalate_bands"
            render={({ field }) => (
              <Group>
                {(["low_medium", "urgent", "emergency"] as const).map((band) => (
                  <Checkbox
                    key={band}
                    label={`Escalate ${EWS_BAND_LABEL[band].toLowerCase()}`}
                    checked={(field.value ?? []).includes(band)}
                    disabled={band === "emergency"}
                    onChange={(e) =>
                      field.onChange(
                        e.currentTarget.checked
                          ? [...(field.value ?? []), band]
                          : (field.value ?? []).filter((b) => b !== band),
                      )
                    }
                  />
                ))}
              </Group>
            )}
          />
          <SimpleGrid cols={{ base: 1, md: 4 }} mt="sm">
            <MinutesField
              form={form}
              name="ack_minutes_urgent"
              label="Urgent waits for acknowledgement"
            />
            <MinutesField
              form={form}
              name="ack_minutes_emergency"
              label="Emergency waits for acknowledgement"
            />
            <MinutesField
              form={form}
              name="incomplete_max_minutes"
              label="Repeat an incomplete set within"
            />
            <Controller
              control={form.control}
              name="max_escalation_levels"
              render={({ field, fieldState }) => (
                <NumberField
                  label="Escalation levels"
                  min={1}
                  max={5}
                  value={field.value}
                  onChange={(v) => field.onChange(Number(v))}
                  error={fieldState.error?.message}
                />
              )}
            />
          </SimpleGrid>
        </Card>
        {save.error && (
          <Alert tone="danger" title="Not saved">
            {save.error.message}
          </Alert>
        )}
        {canEdit && (
          <Group justify="flex-end">
            <Button tone="primary" type="submit" loading={save.isPending}>
              Save policy
            </Button>
          </Group>
        )}
      </Stack>
    </form>
  );
}
