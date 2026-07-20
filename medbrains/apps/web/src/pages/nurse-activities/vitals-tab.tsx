// IPD VitalsTab — split from nurse-activities.tsx (pure move).

import { Card, Group, NumberInput, Stack, Tabs, Text, Timeline } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CreateVitalRequest, Vital } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconDeviceHeartMonitor } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { VitalsRecorder } from "@/components";
import { Alert, Badge, Button, toast } from "@/components/ui";
import { nurseActivitiesService } from "@/services/nurseActivities.service";
import {
  type ClinicalStatus,
  EncounterContextField,
  encounterLocked,
  formatDateTime,
  statusBadgeTone,
  toNumber,
} from "./shared";

function VitalsTimeline({ vitals, isLoading }: { vitals: Vital[]; isLoading: boolean }) {
  if (isLoading) {
    return <Text c="dimmed">Loading vitals timeline...</Text>;
  }

  if (vitals.length === 0) {
    return <Text c="dimmed">No vitals recorded for this encounter yet.</Text>;
  }

  return (
    <Timeline active={0} bulletSize={30} lineWidth={2} color="primary">
      {vitals.map((row, index) => (
        <Timeline.Item
          key={row.id}
          bullet={<IconDeviceHeartMonitor size={15} />}
          title={
            <Group gap="xs">
              <Text size="sm" fw={700}>
                {formatDateTime(row.recorded_at)}
              </Text>
              {index === 0 && (
                <Badge tone="success" size="xs">
                  Latest
                </Badge>
              )}
            </Group>
          }
        >
          <Group gap="xs" mt={5} wrap="wrap">
            {vitalDisplayValue(row.temperature, " C") && (
              <Badge tone="neutral">{vitalDisplayValue(row.temperature, " C")}</Badge>
            )}
            {vitalDisplayValue(row.pulse, " bpm") && (
              <Badge tone="neutral">{vitalDisplayValue(row.pulse, " bpm")}</Badge>
            )}
            {row.systolic_bp != null && row.diastolic_bp != null && (
              <Badge tone="neutral">
                BP {row.systolic_bp}/{row.diastolic_bp}
              </Badge>
            )}
            {vitalDisplayValue(row.spo2, "% SpO2") && (
              <Badge tone="neutral">{vitalDisplayValue(row.spo2, "% SpO2")}</Badge>
            )}
            {vitalDisplayValue(row.respiratory_rate, "/min RR") && (
              <Badge tone="neutral">{vitalDisplayValue(row.respiratory_rate, "/min RR")}</Badge>
            )}
            {vitalDisplayValue(row.weight_kg, " kg") && (
              <Badge tone="neutral" variant="outline">
                {vitalDisplayValue(row.weight_kg, " kg")}
              </Badge>
            )}
            {vitalDisplayValue(row.height_cm, " cm") && (
              <Badge tone="neutral" variant="outline">
                {vitalDisplayValue(row.height_cm, " cm")}
              </Badge>
            )}
            {vitalDisplayValue(row.bmi, " BMI") && (
              <Badge tone="neutral" variant="outline">
                {vitalDisplayValue(row.bmi, " BMI")}
              </Badge>
            )}
          </Group>
          {row.notes && (
            <Text size="xs" c="dimmed" mt={6}>
              {row.notes}
            </Text>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

interface VitalsScheduleRow {
  id: string;
  encounter_id: string;
  frequency_minutes: number;
  next_due_at: string;
  last_captured_at?: string | null;
}

function scheduleDueStatus(nextDueAt: string): ClinicalStatus {
  const minutes = Math.round((new Date(nextDueAt).getTime() - Date.now()) / 60_000);
  if (minutes <= 0) {
    return { label: "Overdue", color: "red", tone: "critical" };
  }
  if (minutes <= 15) {
    return { label: "Due soon", color: "orange", tone: "high" };
  }
  return { label: "Scheduled", color: "green", tone: "good" };
}

function vitalDisplayValue(value: string | number | null | undefined, suffix: string): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return `${value}${suffix}`;
}

export function VitalsTab({
  initialEncounterId,
  patientId,
}: {
  initialEncounterId: string;
  patientId: string;
}) {
  const qc = useQueryClient();
  const canView = useHasPermission(P.NURSE.VITALS_VIEW);
  const canRecord = useHasPermission(P.NURSE.VITALS_RECORD);
  const isLinkedEncounter = encounterLocked(initialEncounterId);
  const [encounterId, setEncounterId] = useState(initialEncounterId);
  const [frequency, setFrequency] = useState<number>(240);
  const [activeVitalsTab, setActiveVitalsTab] = useState<"record" | "timeline">("record");

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["nurse-vitals-schedules", encounterId],
    queryFn: () =>
      nurseActivitiesService.listVitalsSchedules({ encounter_id: encounterId }) as Promise<
        VitalsScheduleRow[]
      >,
    enabled: canView && encounterId.length > 0,
  });
  const { data: vitals = [], isLoading: vitalsLoading } = useQuery({
    queryKey: ["nurse-vitals", encounterId],
    queryFn: () => nurseActivitiesService.listNurseVitals(encounterId) as Promise<Vital[]>,
    enabled: canView && encounterId.length > 0,
  });

  const createSchedule = useMutation({
    mutationFn: () =>
      nurseActivitiesService.createVitalsSchedule({
        encounter_id: encounterId,
        frequency_minutes: frequency,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nurse-vitals-schedules"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not create schedule" }),
  });

  const endSchedule = useMutation({
    mutationFn: (id: string) => nurseActivitiesService.endVitalsSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nurse-vitals-schedules"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not end schedule" }),
  });

  const recordVitals = useMutation({
    mutationFn: (data: CreateVitalRequest) =>
      nurseActivitiesService.createNurseVital({
        ...data,
        encounter_id: encounterId,
      }) as Promise<Vital>,
    onSuccess: (row) => {
      qc.setQueryData<Vital[]>(["nurse-vitals", encounterId], (current = []) => [
        row,
        ...current.filter((item) => item.id !== row.id),
      ]);
      void qc.invalidateQueries({ queryKey: ["nurse-vitals-schedules"] });
      void qc.invalidateQueries({ queryKey: ["nurse-vitals", encounterId] });
      if (canView) {
        setActiveVitalsTab("timeline");
      }
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not record vitals" }),
  });

  return (
    <Stack>
      <Group align="end">
        <EncounterContextField
          value={encounterId}
          onChange={setEncounterId}
          locked={isLinkedEncounter}
          patientId={patientId}
        />
        <NumberInput
          label="Repeat vitals due every"
          value={frequency}
          onChange={(value) => setFrequency(toNumber(value, 240))}
          min={15}
          step={15}
          suffix=" min"
          w={160}
        />
        <Button
          tone="primary"
          onClick={() => createSchedule.mutate()}
          loading={createSchedule.isPending}
          disabled={!encounterId || !canRecord}
        >
          Set frequency
        </Button>
      </Group>

      <Card withBorder padding="md">
        <Stack>
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={700}>Vitals Capture</Text>
              <Text size="xs" c="dimmed">
                Same configured vitals component used in OPD, linked to this nursing encounter.
              </Text>
            </Stack>
            {isLinkedEncounter && <Badge tone="neutral">IPD linked</Badge>}
          </Group>
          <Tabs
            value={activeVitalsTab}
            onChange={(value) => {
              if (value === "record" || value === "timeline") {
                setActiveVitalsTab(value);
              }
            }}
            keepMounted={false}
          >
            <Tabs.List>
              <Tabs.Tab value="record">Record</Tabs.Tab>
              {canView && <Tabs.Tab value="timeline">Timeline</Tabs.Tab>}
            </Tabs.List>

            <Tabs.Panel value="record" pt="md">
              <Stack>
                {!encounterId && (
                  <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
                    Select or open a linked encounter before recording vitals.
                  </Alert>
                )}
                {canRecord && encounterId ? (
                  <VitalsRecorder
                    onSubmit={(data) => recordVitals.mutate(data)}
                    isSubmitting={recordVitals.isPending}
                  />
                ) : (
                  <Text size="sm" c="dimmed">
                    {canRecord
                      ? "Vitals can be recorded after an encounter is linked."
                      : "You can view schedules and timeline, but recording vitals is not available for this role."}
                  </Text>
                )}
              </Stack>
            </Tabs.Panel>

            {canView && (
              <Tabs.Panel value="timeline" pt="md">
                <VitalsTimeline vitals={vitals} isLoading={vitalsLoading} />
              </Tabs.Panel>
            )}
          </Tabs>
        </Stack>
      </Card>

      {canView ? (
        <>
          {isLoading && <Text c="dimmed">Loading schedules...</Text>}
          <Stack gap="xs">
            {schedules?.map((row) => (
              <Card key={row.id} withBorder padding="sm">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Text fw={600}>Every {row.frequency_minutes} min</Text>
                      <Badge tone={statusBadgeTone(scheduleDueStatus(row.next_due_at).color)}>
                        {scheduleDueStatus(row.next_due_at).label}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Next due {formatDateTime(row.next_due_at)}
                      {row.last_captured_at
                        ? ` · Last ${formatDateTime(row.last_captured_at)}`
                        : ""}
                    </Text>
                  </Stack>
                  {canRecord && (
                    <Button
                      tone="secondary"
                      size="xs"
                      onClick={() => endSchedule.mutate(row.id)}
                      loading={endSchedule.isPending}
                    >
                      End
                    </Button>
                  )}
                </Group>
              </Card>
            ))}
          </Stack>
        </>
      ) : (
        <Text size="sm" c="dimmed">
          You can record vitals, but schedules and timeline require vitals view permission.
        </Text>
      )}
    </Stack>
  );
}
