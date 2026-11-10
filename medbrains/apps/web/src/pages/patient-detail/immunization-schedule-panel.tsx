// The patient's immunisation schedule: each dose given, due, overdue or no
// longer given, by the hospital's schedule (UIP or IAP), computed by the
// server from the date of birth and the doses recorded.

import { Group, Stack, Text } from "@mantine/core";
import type { ScheduledDose, ScheduledDoseState, ScheduleSeries } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, type BadgeTone, Button, SegmentedControl, Table } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";

/** A dose the schedule suggests recording. */
export interface ScheduledDoseChoice {
  vaccine_name: string;
  vaccine_key: string;
  label: string;
}

interface ImmunizationSchedulePanelProps {
  patientId: string;
  canRecord: boolean;
  onRecord: (dose: ScheduledDoseChoice) => void;
}

const STATE: Record<ScheduledDoseState, { label: string; tone: BadgeTone }> = {
  given: { label: "Given", tone: "success" },
  not_counted: { label: "Did not count", tone: "danger" },
  upcoming: { label: "Upcoming", tone: "info" },
  due: { label: "Due", tone: "warning" },
  overdue: { label: "Overdue", tone: "danger" },
  age_passed: { label: "No longer given", tone: "neutral" },
};

const NOW: ScheduledDoseState[] = ["due", "overdue", "not_counted"];

export function ImmunizationSchedulePanel({
  patientId,
  canRecord,
  onRecord,
}: ImmunizationSchedulePanelProps) {
  const [view, setView] = useState<"now" | "all">("now");
  const schedule = useQuery({
    queryKey: ["patient-immunization-schedule", patientId],
    queryFn: () => patientDetailService.getImmunizationSchedule(patientId),
  });
  const rows = useMemo(() => {
    const series = schedule.data?.schedule?.series ?? [];
    return series.flatMap((s: ScheduleSeries) =>
      s.doses
        .filter((d) => view === "all" || NOW.includes(d.state))
        .map((d: ScheduledDose) => ({ series: s, dose: d })),
    );
  }, [schedule.data, view]);

  if (schedule.isError) {
    return (
      <Alert tone="danger" title="The schedule could not be loaded">
        {(schedule.error as Error).message}
      </Alert>
    );
  }
  if (schedule.data?.unavailable) {
    return (
      <Alert tone="info" title="No schedule">
        {schedule.data.unavailable}
      </Alert>
    );
  }
  const data = schedule.data?.schedule;
  if (!data) return null;

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={600}>
          Schedule: {data.kind === "iap" ? "IAP recommended (ACVIP)" : "National (UIP)"}
        </Text>
        <SegmentedControl
          aria-label="Which doses to show"
          value={view}
          onChange={(v) => setView(v === "all" ? "all" : "now")}
          data={[
            { value: "now", label: "Needs action" },
            { value: "all", label: "Whole schedule" },
          ]}
        />
      </Group>
      {data.unmatched.length > 0 && (
        <Alert tone="warning" title="Doses the schedule could not place">
          {data.unmatched.map((u) => (
            <Text key={u.dose_id} size="sm">
              {u.vaccine_name} on {u.given_on}: {u.reason}
            </Text>
          ))}
        </Alert>
      )}
      {rows.length === 0 ? (
        <Text size="sm">Nothing is due or overdue.</Text>
      ) : (
        <Table aria-label="Immunisation schedule">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Vaccine</Table.Th>
              <Table.Th>Dose</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Notes</Table.Th>
              <Table.Th>Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map(({ series, dose }) => (
              <Table.Tr key={`${series.key}-${dose.label}-${dose.dose_id ?? dose.date}`}>
                <Table.Td>{series.name}</Table.Td>
                <Table.Td>{dose.label}</Table.Td>
                <Table.Td>
                  <Badge tone={STATE[dose.state].tone}>{STATE[dose.state].label}</Badge>
                </Table.Td>
                <Table.Td>
                  {dose.date}
                  {dose.latest && dose.state !== "given" ? ` (until ${dose.latest})` : ""}
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{dose.reason ?? series.note}</Text>
                </Table.Td>
                <Table.Td>
                  {canRecord && (dose.state === "due" || dose.state === "overdue") && (
                    <Button
                      tone="secondary"
                      size="xs"
                      onClick={() =>
                        onRecord({
                          vaccine_name: dose.product_name,
                          vaccine_key: dose.product_key,
                          label: dose.label,
                        })
                      }
                    >
                      Record
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
