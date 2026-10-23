import { LineChart } from "@mantine/charts";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychScreening, type ScreeningInstrument } from "@medbrains/types";
import { IconAlertTriangle, IconPlus } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { Column } from "@/components/DataTable";
import { Alert, Badge, Button, SegmentedControl } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { INSTRUMENT_LABEL, MAX_TOTAL, SEVERITY_CUTOFFS, SEVERITY_LABEL } from "./instruments";
import { formatDate, formatDateTime } from "./labels";
import { RecordListFrame, usePsychList } from "./RecordListFrame";
import { SafetyReviewModal } from "./SafetyReviewModal";
import { ScreeningForm } from "./ScreeningForm";

const INSTRUMENTS = [
  { value: "phq9", label: "PHQ-9" },
  { value: "gad7", label: "GAD-7" },
];

function reviewBadge(r: PsychScreening) {
  if (r.safety_review_status === "pending") return <Badge tone="danger">Review pending</Badge>;
  if (r.safety_review_status === "completed") return <Badge tone="success">Reviewed</Badge>;
  return null;
}

export function ScreeningsTab({ psychPatientId }: { psychPatientId: string }) {
  const canList = useHasPermission(P.SPECIALTY.PSYCHIATRY.ASSESSMENTS_LIST);
  const canAdd = useHasPermission(P.SPECIALTY.PSYCHIATRY.ASSESSMENTS_CREATE);
  const canReview = useHasPermission(P.SPECIALTY.PSYCHIATRY.SAFETY_REVIEW);
  const query = usePsychList(
    "psych-screenings",
    psychPatientId,
    psychiatryService.listScreenings,
    canList,
  );
  const [instrument, setInstrument] = useState<ScreeningInstrument>("phq9");
  const [formOpen, setFormOpen] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const rows = query.data ?? [];
  const pending = rows.filter((r) => r.safety_review_status === "pending");
  const trend = useMemo(
    () =>
      rows
        .filter((r) => r.instrument === instrument)
        .map((r) => ({ date: formatDate(r.administered_at), total: r.total })),
    [rows, instrument],
  );

  const columns = useMemo<Column<PsychScreening>[]>(
    () => [
      {
        key: "when",
        label: "Date",
        render: (r) => <Text size="sm">{formatDateTime(r.administered_at)}</Text>,
      },
      {
        key: "instrument",
        label: "Questionnaire",
        render: (r) => <Text size="sm">{INSTRUMENT_LABEL[r.instrument]}</Text>,
      },
      {
        key: "total",
        label: "Total",
        render: (r) => (
          <Text size="sm">
            {r.total} / {MAX_TOTAL[r.instrument]}
          </Text>
        ),
      },
      {
        key: "severity",
        label: "Severity",
        render: (r) => <Badge tone="neutral">{SEVERITY_LABEL[r.severity] ?? r.severity}</Badge>,
      },
      {
        key: "item9",
        label: "Self-harm item",
        render: (r) =>
          r.instrument !== "phq9" ? (
            <Text size="sm">—</Text>
          ) : (
            <Group gap={4} wrap="nowrap">
              {r.item9_positive && <IconAlertTriangle size={16} aria-hidden />}
              <Text size="sm">{r.item9_positive ? "Positive" : "Negative"}</Text>
              {reviewBadge(r)}
            </Group>
          ),
      },
    ],
    [],
  );

  return (
    <Stack gap="md">
      {pending.map((p) => (
        <Alert key={p.id} tone="danger" title="Suicide-risk review needed today">
          <Stack gap="xs">
            <Text size="sm">
              The PHQ-9 of {formatDateTime(p.administered_at)} recorded thoughts of self-harm.
              Assess the patient in person now; do not leave a patient at risk alone. The treating
              psychiatrist has been notified.
            </Text>
            {canReview && (
              <Group>
                <Button tone="danger" size="xs" onClick={() => setReviewing(p.id)}>
                  Record the review
                </Button>
              </Group>
            )}
          </Stack>
        </Alert>
      ))}
      <Group justify="space-between">
        <SegmentedControl
          aria-label="Questionnaire"
          data={INSTRUMENTS}
          value={instrument}
          onChange={(v) => setInstrument(v as ScreeningInstrument)}
        />
        {canAdd && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => setFormOpen(true)}
          >
            Record {instrument === "phq9" ? "PHQ-9" : "GAD-7"}
          </Button>
        )}
      </Group>
      {trend.length > 1 && (
        <LineChart
          h={240}
          data={trend}
          dataKey="date"
          series={[
            { name: "total", label: `${INSTRUMENT_LABEL[instrument]} total`, color: "primary.6" },
          ]}
          yAxisProps={{ domain: [0, MAX_TOTAL[instrument]] }}
          referenceLines={SEVERITY_CUTOFFS[instrument].map((c) => ({
            y: c.value,
            label: c.label,
            color: "gray.6",
          }))}
          withTooltip
          aria-label={`${INSTRUMENT_LABEL[instrument]} totals over time; the table below lists every score`}
        />
      )}
      <RecordListFrame
        description="Every PHQ-9 and GAD-7, scored on the server with the published cut-offs."
        addLabel=""
        canAdd={false}
        onAdd={() => undefined}
        columns={columns}
        query={query}
        emptyTitle="No screenings recorded"
      />
      <ScreeningForm
        key={instrument}
        psychPatientId={psychPatientId}
        instrument={instrument}
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(row) => {
          if (row.item9_positive && canReview) setReviewing(row.id);
        }}
      />
      <SafetyReviewModal screeningId={reviewing} onClose={() => setReviewing(null)} />
    </Stack>
  );
}
