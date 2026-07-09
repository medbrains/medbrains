import { Card, Divider, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { HypoglycemiaView } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, NumberField, Select, Switch } from "@/components/ui";
import { hypoglycemiaService } from "@/services/hypoglycemia.service";

const TREATMENTS = [
  { value: "oral_carbs", label: "15–20 g oral carbohydrate" },
  { value: "iv_dextrose", label: "IV dextrose (D25/D50)" },
  { value: "im_glucagon", label: "IM glucagon" },
  { value: "none", label: "None yet" },
];

const severityTone = (s: string) =>
  s === "severe" ? "danger" : s === "moderate" ? "warning" : "neutral";

function Panel({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const key = ["hypoglycemia-events", patientId];
  const [glucose, setGlucose] = useState<number | "">("");
  const [conscious, setConscious] = useState(true);
  const [treatment, setTreatment] = useState<string | null>("oral_carbs");
  const [recheck, setRecheck] = useState<number | "">("");

  const { data: events = [] } = useQuery({
    queryKey: key,
    queryFn: () => hypoglycemiaService.listHypoglycemiaEvents(patientId),
    enabled: !!patientId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });
  const onError = (e: Error) =>
    notifications.show({ title: "Action failed", message: e.message, color: "danger" });

  const create = useMutation({
    mutationFn: () =>
      hypoglycemiaService.createHypoglycemiaEvent({
        patient_id: patientId,
        glucose_value: Number(glucose),
        conscious,
        treatment: treatment ?? undefined,
      }),
    onSuccess: (r) => {
      void invalidate();
      notifications.show({
        title: `Hypoglycaemia — ${r.event.severity}`,
        message: r.treatment_advice,
        color: severityTone(r.event.severity),
      });
      setGlucose("");
    },
    onError,
  });

  const doRecheck = useMutation({
    mutationFn: (vars: { id: string; value: number }) =>
      hypoglycemiaService.recheckHypoglycemiaEvent(vars.id, { recheck_glucose: vars.value }),
    onSuccess: (r) => {
      void invalidate();
      notifications.show({
        title: r.event.resolved ? "Recovered (≥ 70)" : "Still low — repeat treatment",
        message: "",
        color: r.event.resolved ? "success" : "warning",
      });
      setRecheck("");
    },
    onError,
  });

  const active = events.find((e: HypoglycemiaView) => !e.event.resolved);

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Record hypoglycaemia event
          </Text>
          <Group align="flex-end">
            <NumberField
              label="Blood glucose (mg/dL)"
              value={glucose}
              onChange={(v) => setGlucose(v === "" ? "" : Number(v))}
              min={1}
              max={2000}
              w={180}
            />
            <Switch
              label="Conscious / able to swallow"
              checked={conscious}
              onChange={(e) => setConscious(e.currentTarget.checked)}
            />
          </Group>
          <Select
            label="Treatment given"
            data={TREATMENTS}
            value={treatment}
            onChange={setTreatment}
            w={280}
          />
          <Button
            tone="primary"
            loading={create.isPending}
            disabled={glucose === ""}
            onClick={() => create.mutate()}
            w="fit-content"
          >
            Record event
          </Button>
        </Stack>
      </Card>

      {active && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>Active event — glucose {active.event.glucose_value} mg/dL</Text>
              <Badge tone={severityTone(active.event.severity)}>{active.event.severity}</Badge>
            </Group>
            <Text size="sm">{active.treatment_advice}</Text>
            <Divider />
            <Text size="sm" fw={500}>
              15-minute recheck
            </Text>
            <Group align="flex-end">
              <NumberField
                label="Recheck glucose (mg/dL)"
                value={recheck}
                onChange={(v) => setRecheck(v === "" ? "" : Number(v))}
                min={1}
                max={2000}
                w={180}
              />
              <Button
                tone="primary"
                loading={doRecheck.isPending}
                disabled={recheck === ""}
                onClick={() => doRecheck.mutate({ id: active.event.id, value: Number(recheck) })}
              >
                Record recheck
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {events.length > 0 && (
        <Stack gap={4}>
          <Text fw={600} size="sm">
            History
          </Text>
          {events.map((e: HypoglycemiaView) => (
            <Group key={e.event.id} justify="space-between">
              <Text size="xs" c="dimmed">
                {new Date(e.event.created_at).toLocaleString()} — {e.event.glucose_value} mg/dL
                {e.event.recheck_glucose != null ? ` → ${e.event.recheck_glucose}` : ""}
              </Text>
              <Badge tone={e.event.resolved ? "success" : severityTone(e.event.severity)}>
                {e.event.resolved ? "resolved" : e.event.severity}
              </Badge>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/** Inpatient hypoglycaemia management for a selected patient. */
export function HypoglycemiaTab() {
  const [patientId, setPatientId] = useState("");
  return (
    <Stack gap="md" maw={680}>
      <PatientSearchSelect value={patientId} onChange={setPatientId} />
      {patientId ? (
        <Panel patientId={patientId} />
      ) : (
        <Text size="sm" c="dimmed">
          Select a patient to record and manage a hypoglycaemia event.
        </Text>
      )}
    </Stack>
  );
}
