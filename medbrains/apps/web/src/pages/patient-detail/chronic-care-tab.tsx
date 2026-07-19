// PATIENT ChronicCareTab — split from patient-detail.tsx (pure move).

import {
  Card,
  Group,
  Loader,
  Progress,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type {
  DrugTimelineWithLabsResponse,
  MedicationTimelineEvent,
  TreatmentSummaryResponse,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconPrinter } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, type BadgeTone, Button, Table } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";

const TIMELINE_RANGES = [
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
  { value: "2y", label: "2 Years" },
  { value: "all", label: "All" },
];

const EVENT_COLORS: Record<string, string> = {
  started: "#40c057",
  dose_changed: "#228be6",
  switched: "#be4bdb",
  discontinued: "#fa5252",
  resumed: "#12b886",
  held: "#fab005",
};

const ENROLLMENT_STATUS_COLORS: Record<string, BadgeTone> = {
  active: "success",
  completed: "success",
  discontinued: "warning",
  transferred: "primary",
  lost_to_followup: "danger",
  deceased: "neutral",
};

function getDateRange(range: string): { from_date?: string; to_date?: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  switch (range) {
    case "3m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { from_date: d.toISOString().slice(0, 10), to_date: to };
    }
    case "6m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return { from_date: d.toISOString().slice(0, 10), to_date: to };
    }
    case "1y": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return { from_date: d.toISOString().slice(0, 10), to_date: to };
    }
    case "2y": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 2);
      return { from_date: d.toISOString().slice(0, 10), to_date: to };
    }
    default:
      return {};
  }
}

function DrugOGramSegment({ patientId }: { patientId: string }) {
  const [range, setRange] = useState("1y");
  const dateRange = useMemo(() => getDateRange(range), [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["drug-timeline-labs", patientId, range],
    queryFn: () => patientDetailService.drugTimelineWithLabs(patientId, dateRange),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["interaction-alerts", patientId],
    queryFn: () => patientDetailService.listInteractionAlerts(patientId),
  });

  const activeAlerts = alerts.filter((a) => a.status === "active");

  const { data: summary } = useQuery({
    queryKey: ["treatment-summary", patientId],
    queryFn: () => patientDetailService.treatmentSummary(patientId),
  });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <SegmentedControl value={range} onChange={setRange} data={TIMELINE_RANGES} size="xs" />
        <Group gap="xs">
          {summary && (
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconPrinter size={14} />}
              onClick={() => printTreatmentSummary(summary)}
            >
              Print Summary
            </Button>
          )}
        </Group>
      </Group>

      {/* Polypharmacy Alerts */}
      {activeAlerts.length > 0 && (
        <Alert
          tone="danger"
          title={`${activeAlerts.length} Drug Interaction Alert(s)`}
          icon={<IconAlertTriangle size={16} />}
        >
          <Stack gap={4}>
            {activeAlerts.map((a) => (
              <Group key={a.id} gap="xs">
                <Badge
                  tone={
                    a.severity === "contraindicated"
                      ? "danger"
                      : a.severity === "major"
                        ? "warning"
                        : "warning"
                  }
                  size="sm"
                >
                  {a.severity}
                </Badge>
                <Text size="sm">
                  {a.drug_a_name} + {a.drug_b_name}
                </Text>
                {a.description && (
                  <Text size="xs" c="dimmed">
                    {a.description}
                  </Text>
                )}
              </Group>
            ))}
          </Stack>
        </Alert>
      )}

      {isLoading && <Loader size="sm" />}

      {data && <DrugSwimLane data={data} />}
    </Stack>
  );
}

function DrugSwimLane({ data }: { data: DrugTimelineWithLabsResponse }) {
  const { medication_events, active_drugs, lab_series } = data;

  if (medication_events.length === 0 && active_drugs.length === 0) {
    return <Text c="dimmed">No medication timeline events found for this period.</Text>;
  }

  // Group events by drug_name
  const drugEvents = medication_events.reduce<Record<string, MedicationTimelineEvent[]>>(
    (acc, ev) => {
      const list = acc[ev.drug_name] ?? [];
      list.push(ev);
      acc[ev.drug_name] = list;
      return acc;
    },
    {},
  );

  const drugNames = Object.keys(drugEvents).sort();

  // Calculate time range
  const allDates = medication_events.map((e) => new Date(e.effective_date).getTime());
  const minDate = allDates.length > 0 ? Math.min(...allDates) : Date.now();
  const maxDate = Math.max(Date.now(), ...allDates);
  const rangeMs = maxDate - minDate || 1;

  const ROW_HEIGHT = 36;
  const LABEL_WIDTH = 180;
  const CHART_WIDTH = 600;
  const totalHeight = drugNames.length * ROW_HEIGHT + 40;

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Text fw={500} mb="sm">
          Medication Timeline
        </Text>
        <ScrollArea>
          <svg
            width={LABEL_WIDTH + CHART_WIDTH + 20}
            height={totalHeight}
            role="img"
            aria-label="Medication timeline"
          >
            {/* Header line */}
            <line
              x1={LABEL_WIDTH}
              y1={20}
              x2={LABEL_WIDTH + CHART_WIDTH}
              y2={20}
              stroke="#dee2e6"
            />
            {/* Date labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const x = LABEL_WIDTH + frac * CHART_WIDTH;
              const d = new Date(minDate + frac * rangeMs);
              return (
                <text key={frac} x={x} y={14} fontSize={10} fill="#868e96" textAnchor="middle">
                  {d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}
                </text>
              );
            })}

            {drugNames.map((drug, idx) => {
              const y = 30 + idx * ROW_HEIGHT;
              const events = drugEvents[drug] ?? [];
              const isActive = active_drugs.some((d) => d.drug_name === drug);

              return (
                <g key={drug}>
                  {/* Drug label */}
                  <text
                    x={4}
                    y={y + 14}
                    fontSize={11}
                    fill={isActive ? "#212529" : "#868e96"}
                    fontWeight={isActive ? 600 : 400}
                  >
                    {drug.length > 22 ? `${drug.slice(0, 20)}...` : drug}
                  </text>
                  {/* Row background */}
                  <rect
                    x={LABEL_WIDTH}
                    y={y}
                    width={CHART_WIDTH}
                    height={ROW_HEIGHT - 4}
                    fill={idx % 2 === 0 ? "#f8f9fa" : "#fff"}
                    rx={2}
                  />

                  {/* Event bars and markers */}
                  {events.map((ev) => {
                    const startX =
                      LABEL_WIDTH +
                      ((new Date(ev.effective_date).getTime() - minDate) / rangeMs) * CHART_WIDTH;
                    const endTs = ev.end_date
                      ? new Date(ev.end_date).getTime()
                      : ev.event_type === "discontinued"
                        ? new Date(ev.effective_date).getTime()
                        : maxDate;
                    const endX = LABEL_WIDTH + ((endTs - minDate) / rangeMs) * CHART_WIDTH;
                    const color = EVENT_COLORS[ev.event_type] ?? "#868e96";

                    if (ev.event_type === "started" || ev.event_type === "resumed") {
                      return (
                        <g key={ev.id}>
                          <rect
                            x={startX}
                            y={y + 8}
                            width={Math.max(endX - startX, 2)}
                            height={14}
                            fill={color}
                            opacity={0.3}
                            rx={3}
                          />
                          <circle cx={startX} cy={y + 15} r={4} fill={color}>
                            <title>{`${ev.event_type}: ${ev.dosage ?? ""} ${ev.frequency ?? ""}`}</title>
                          </circle>
                        </g>
                      );
                    }

                    return (
                      <g key={ev.id}>
                        <circle
                          cx={startX}
                          cy={y + 15}
                          r={5}
                          fill={color}
                          stroke="#fff"
                          strokeWidth={1}
                        >
                          <title>{`${ev.event_type}: ${ev.change_reason ?? ev.dosage ?? ""}`}</title>
                        </circle>
                        {ev.event_type === "dose_changed" && (
                          <text x={startX + 8} y={y + 19} fontSize={8} fill={color}>
                            {ev.dosage}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </ScrollArea>

        {/* Legend */}
        <Group gap="md" mt="sm">
          {Object.entries(EVENT_COLORS).map(([type, color]) => (
            <Group key={type} gap={4}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
              <Text size="xs">{type.replace(/_/g, " ")}</Text>
            </Group>
          ))}
        </Group>
      </Card>

      {/* Active drugs */}
      {active_drugs.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">
            Currently Active Medications
          </Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Drug</Table.Th>
                <Table.Th>Generic</Table.Th>
                <Table.Th>Dosage</Table.Th>
                <Table.Th>Frequency</Table.Th>
                <Table.Th>Route</Table.Th>
                <Table.Th>Started</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {active_drugs.map((d) => (
                <Table.Tr
                  key={`${d.drug_name}-${d.started_date}-${d.dosage ?? ""}-${d.frequency ?? ""}`}
                >
                  <Table.Td>
                    <Text fw={500} size="sm">
                      {d.drug_name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {d.generic_name ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>{d.dosage ?? "—"}</Table.Td>
                  <Table.Td>{d.frequency ?? "—"}</Table.Td>
                  <Table.Td>{d.route ?? "—"}</Table.Td>
                  <Table.Td>{d.started_date}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Lab trends */}
      {lab_series.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">
            Lab Value Trends
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {lab_series.slice(0, 9).map((series) => {
              const points = series.data_points;
              if (points.length === 0) return null;
              const latest = points.at(-1);
              if (!latest) return null;
              const atTarget =
                series.target_value != null && latest.numeric_value != null
                  ? latest.numeric_value <= series.target_value
                  : null;
              return (
                <Card key={series.parameter_name} withBorder padding="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      {series.parameter_name}
                    </Text>
                    {atTarget !== null && (
                      <Badge tone={atTarget ? "success" : "danger"} size="xs">
                        {atTarget ? "At Target" : "Off Target"}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xl" fw={700} mt={4}>
                    {latest.value} {series.unit ?? ""}
                  </Text>
                  {series.target_value != null && (
                    <Text size="xs" c="dimmed">
                      Target: {series.target_value} {series.unit ?? ""}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {points.length} readings | Last:{" "}
                    {new Date(latest.result_date).toLocaleDateString()}
                  </Text>
                </Card>
              );
            })}
          </SimpleGrid>
        </Card>
      )}
    </Stack>
  );
}

function OutcomesSegment({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["outcome-dashboard", patientId],
    queryFn: () => patientDetailService.outcomeDashboard(patientId),
  });

  if (isLoading) return <Loader size="sm" />;
  if (!data) return <Text c="dimmed">No outcome data available.</Text>;

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Active Enrollments
          </Text>
          <Text fw={700} size="xl">
            {data.active_enrollments}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Adherence Rate
          </Text>
          <Text fw={700} size="xl">
            {data.adherence_rate != null ? `${Math.round(Number(data.adherence_rate))}%` : "N/A"}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Duration
          </Text>
          <Text fw={700} size="xl">
            {data.enrollment_duration_days != null
              ? `${data.enrollment_duration_days} days`
              : "N/A"}
          </Text>
        </Card>
      </SimpleGrid>

      {data.targets.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">
            Outcome Targets
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {data.targets.map((t) => (
              <Card key={t.target.id} withBorder padding="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    {t.target.parameter_name}
                  </Text>
                  {t.at_target !== null && (
                    <Badge tone={t.at_target ? "success" : "danger"} size="xs">
                      {t.at_target ? "At Target" : "Off Target"}
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  Target: {t.target.comparison} {t.target.target_value} {t.target.unit}
                </Text>
                <Text size="lg" fw={600} mt={4}>
                  {t.latest_value != null ? `${t.latest_value} ${t.target.unit}` : "No data"}
                </Text>
                {t.latest_date && (
                  <Text size="xs" c="dimmed">
                    Last: {new Date(t.latest_date).toLocaleDateString()}
                  </Text>
                )}
              </Card>
            ))}
          </SimpleGrid>
        </Card>
      )}
    </Stack>
  );
}

function AdherenceSegment({ patientId }: { patientId: string }) {
  const { data: enrollments = [] } = useQuery({
    queryKey: ["patient-enrollments-chronic", patientId],
    queryFn: () => patientDetailService.patientEnrollments(patientId),
  });

  const activeEnrollments = enrollments.filter((e) => e.status === "active");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["adherence-summary-detail", selected],
    queryFn: () => patientDetailService.adherenceSummary(selected ?? ""),
    enabled: !!selected,
  });

  if (activeEnrollments.length === 0 && enrollments.length === 0) {
    return <Text c="dimmed">No chronic care enrollments found.</Text>;
  }

  return (
    <Stack gap="md">
      {/* Enrollment list */}
      <Card withBorder padding="md">
        <Text fw={500} mb="sm">
          Enrollments
        </Text>
        <Stack gap="xs">
          {enrollments.map((e) => (
            <Group
              key={e.id}
              justify="space-between"
              style={{
                cursor: "pointer",
                padding: 8,
                borderRadius: 0,
                background: selected === e.id ? "var(--mb-nav-active-bg)" : undefined,
              }}
              onClick={() => setSelected(e.id)}
            >
              <div>
                <Text size="sm" fw={500}>
                  {e.program_name}
                </Text>
                <Text size="xs" c="dimmed">
                  Enrolled: {e.enrollment_date}
                </Text>
              </div>
              <Badge tone={ENROLLMENT_STATUS_COLORS[e.status] ?? "neutral"}>
                {e.status.replace(/_/g, " ")}
              </Badge>
            </Group>
          ))}
        </Stack>
      </Card>

      {/* Adherence summary */}
      {summary && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed" tt="uppercase">
                Dose Adherence
              </Text>
              <Text fw={700} size="xl">
                {Math.round(Number(summary.dose_adherence_pct))}%
              </Text>
              <Progress
                value={Number(summary.dose_adherence_pct)}
                color={Number(summary.dose_adherence_pct) >= 80 ? "success" : "danger"}
                mt="xs"
              />
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed" tt="uppercase">
                Doses
              </Text>
              <Group gap="xs" mt="xs">
                <Badge tone="success">{summary.doses_taken} taken</Badge>
                <Badge tone="danger">{summary.doses_missed} missed</Badge>
                <Badge tone="warning">{summary.doses_late} late</Badge>
              </Group>
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed" tt="uppercase">
                Appointments
              </Text>
              <Group gap="xs" mt="xs">
                <Badge tone="success">{summary.appointments_attended} attended</Badge>
                <Badge tone="danger">{summary.appointments_missed} missed</Badge>
              </Group>
            </Card>
          </SimpleGrid>

          {summary.by_month.length > 0 && (
            <Card withBorder padding="md">
              <Text fw={500} mb="sm">
                Monthly Adherence
              </Text>
              {summary.by_month.map((m) => {
                const total = m.taken + m.missed + m.late;
                const pct = total > 0 ? Math.round((m.taken / total) * 100) : 0;
                return (
                  <Group key={m.month} mb="xs">
                    <Text size="sm" w={80}>
                      {m.month}
                    </Text>
                    <Progress
                      value={pct}
                      color={pct >= 80 ? "success" : "danger"}
                      style={{ flex: 1 }}
                    />
                    <Text size="sm" w={40}>
                      {pct}%
                    </Text>
                  </Group>
                );
              })}
            </Card>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function printTreatmentSummary(summary: TreatmentSummaryResponse) {
  const win = window.open("", "_blank");
  if (!win) return;

  const medsRows = summary.current_medications
    .map(
      (m) =>
        `<tr><td>${m.drug_name}</td><td>${m.generic_name ?? ""}</td><td>${m.dosage ?? ""}</td><td>${m.frequency ?? ""}</td><td>${m.route ?? ""}</td><td>${m.started_date}</td></tr>`,
    )
    .join("");

  const diagRows = summary.active_diagnoses
    .map(
      (d) =>
        `<tr><td>${d.diagnosis_name}</td><td>${d.icd_code ?? ""}</td><td>${d.diagnosed_date ?? ""}</td></tr>`,
    )
    .join("");

  const targetRows = summary.targets
    .map(
      (t) =>
        `<tr><td>${t.target.parameter_name}</td><td>${t.target.comparison} ${t.target.target_value} ${t.target.unit}</td><td>${t.latest_value ?? "N/A"}</td><td>${t.at_target === true ? "Yes" : t.at_target === false ? "No" : "N/A"}</td></tr>`,
    )
    .join("");

  win.document.write(`<!DOCTYPE html><html><head><title>Treatment Summary</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
      h1{font-size:16px;margin-bottom:4px}
      h2{font-size:14px;margin:16px 0 4px;border-bottom:1px solid #ccc;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #ddd;padding:4px 8px;text-align:left;font-size:11px}
      th{background:#f5f5f5;font-weight:600}
      .header{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:16px}
    </style>
  </head><body>
    <div class="header">
      <div><h1>Treatment Summary</h1><p>Generated: ${new Date().toLocaleDateString()}</p></div>
      <div style="text-align:right"><p><b>${summary.patient_name}</b><br/>UHID: ${summary.uhid}<br/>DOB: ${summary.date_of_birth ?? "N/A"}<br/>Gender: ${summary.gender ?? "N/A"}</p></div>
    </div>
    <h2>Active Diagnoses</h2>
    <table><tr><th>Diagnosis</th><th>ICD Code</th><th>Date</th></tr>${diagRows || "<tr><td colspan=3>None</td></tr>"}</table>
    <h2>Current Medications</h2>
    <table><tr><th>Drug</th><th>Generic</th><th>Dosage</th><th>Frequency</th><th>Route</th><th>Started</th></tr>${medsRows || "<tr><td colspan=6>None</td></tr>"}</table>
    <h2>Outcome Targets</h2>
    <table><tr><th>Parameter</th><th>Target</th><th>Latest</th><th>At Target</th></tr>${targetRows || "<tr><td colspan=4>None set</td></tr>"}</table>
    <h2>Adherence Rate</h2>
    <p>${summary.adherence_rate != null ? `${Math.round(Number(summary.adherence_rate))}%` : "No adherence data"}</p>
    <h2>Program Enrollments</h2>
    <table><tr><th>Program</th><th>Enrolled</th><th>Status</th></tr>${summary.enrollments.map((e) => `<tr><td>${e.program_name}</td><td>${e.enrollment_date}</td><td>${e.status}</td></tr>`).join("")}</table>
    <script>window.print();window.close();</script>
  </body></html>`);
  win.document.close();
}

export function ChronicCareTab({ patientId }: { patientId: string }) {
  const [segment, setSegment] = useState("drugogram");
  const canViewTimeline = useHasPermission(P.CHRONIC.TIMELINE_VIEW);
  const canViewOutcomes = useHasPermission(P.CHRONIC.OUTCOMES_VIEW);
  const canViewAdherence = useHasPermission(P.CHRONIC.ADHERENCE_LIST);

  return (
    <Stack gap="md" mt="md">
      <SegmentedControl
        value={segment}
        onChange={setSegment}
        data={[
          ...(canViewTimeline ? [{ value: "drugogram", label: "Drug-o-gram" }] : []),
          ...(canViewOutcomes ? [{ value: "outcomes", label: "Outcomes & Targets" }] : []),
          ...(canViewAdherence ? [{ value: "adherence", label: "Adherence" }] : []),
        ]}
      />

      {segment === "drugogram" && canViewTimeline && <DrugOGramSegment patientId={patientId} />}
      {segment === "outcomes" && canViewOutcomes && <OutcomesSegment patientId={patientId} />}
      {segment === "adherence" && canViewAdherence && <AdherenceSegment patientId={patientId} />}
    </Stack>
  );
}
