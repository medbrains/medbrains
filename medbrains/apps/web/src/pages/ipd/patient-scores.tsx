import { Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { ClinicalScoreRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type Column, DataTable } from "@/components";
import { Alert, Badge, Button, Input } from "@/components/ui";
import { careViewService } from "@/services/careView.service";

/**
 * This patient's assessment scores.
 *
 * Care View has twenty of these as ward-level calculators: pick five values,
 * read a number, and nothing is kept. That is the wrong shape for what they
 * are. An Aldrete IS the record that a patient was fit to leave recovery, and
 * NEWS2 exists to show deterioration — a single number with nothing to
 * compare it against says nothing at all.
 *
 * Scored here against the admission, with the inputs kept alongside the
 * total, because a 9 whose parameters nobody can see cannot be reviewed or
 * corrected.
 */

// Aldrete first because it is the one with a hard threshold attached: a total
// below 9 means the patient is not ready to leave recovery.
const ALDRETE_PARAMS = [
  { key: "activity", label: "Activity", hint: "2 moves 4 limbs · 1 moves 2 · 0 moves 0" },
  { key: "respiration", label: "Respiration", hint: "2 deep/coughs · 1 dyspnoea · 0 apnoeic" },
  { key: "circulation", label: "Circulation", hint: "BP vs pre-op: 2 ±20 · 1 ±20–50 · 0 >±50" },
  {
    key: "consciousness",
    label: "Consciousness",
    hint: "2 fully awake · 1 arousable · 0 not responding",
  },
  { key: "oxygenation", label: "Oxygenation", hint: "2 SpO₂ >92% on air · 1 needs O₂ · 0 <90%" },
] as const;

const ALDRETE_DISCHARGE_THRESHOLD = 9;

const SCORE_LABELS: Record<string, string> = {
  aldrete: "Aldrete (PACU)",
  news2: "NEWS2",
  meows: "MEOWS",
  pews: "PEWS",
  sofa: "SOFA",
  gcs: "GCS",
  cam_icu: "CAM-ICU",
  qsofa: "qSOFA",
  cpot: "CPOT Pain",
  curb65: "CURB-65",
};

export function PatientScoresPanel({ admissionId }: { admissionId: string }) {
  const queryClient = useQueryClient();
  const canList = useHasPermission(P.CARE_VIEW.SCORES.LIST);
  const canRecord = useHasPermission(P.CARE_VIEW.SCORES.RECORD);

  const [params, setParams] = useState<Record<string, number>>({
    activity: 2,
    respiration: 2,
    circulation: 2,
    consciousness: 2,
    oxygenation: 2,
  });
  const [notes, setNotes] = useState("");

  const scoresQ = useQuery({
    queryKey: ["patient-scores", admissionId],
    queryFn: () => careViewService.listPatientScores(admissionId),
    enabled: canList && !!admissionId,
  });

  const total = ALDRETE_PARAMS.reduce((sum, p) => sum + (params[p.key] ?? 0), 0);
  const readyForDischarge = total >= ALDRETE_DISCHARGE_THRESHOLD;

  const recordMutation = useMutation({
    mutationFn: () =>
      careViewService.recordPatientScore(admissionId, {
        score_type: "aldrete",
        score_value: total,
        score_details: params,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-scores", admissionId] });
      setNotes("");
    },
  });

  const rows = (scoresQ.data ?? []) as ClinicalScoreRow[];

  const columns: Column<ClinicalScoreRow>[] = [
    {
      key: "score_type",
      label: "Score",
      render: (r) => <Text size="sm">{SCORE_LABELS[r.score_type] ?? r.score_type}</Text>,
    },
    {
      key: "score_value",
      label: "Value",
      render: (r) => (
        <Text size="sm" fw={600}>
          {r.score_value}
        </Text>
      ),
    },
    {
      key: "scored_at",
      label: "Recorded",
      render: (r) => <Text size="sm">{new Date(r.scored_at).toLocaleString()}</Text>,
    },
    {
      key: "scored_by_name",
      label: "By",
      render: (r) => <Text size="sm">{r.scored_by_name ?? "—"}</Text>,
    },
    {
      key: "notes",
      label: "Note",
      render: (r) => (
        <Text size="sm" c="dimmed">
          {r.notes ?? "—"}
        </Text>
      ),
    },
  ];

  if (!canList) return null;

  return (
    <Stack gap="lg">
      {canRecord && (
        <Stack gap="sm">
          <Text fw={600}>Aldrete recovery score</Text>
          <Text size="sm" c="dimmed">
            Post-anaesthesia recovery. Each parameter scores 0–2; a total of{" "}
            {ALDRETE_DISCHARGE_THRESHOLD} or more is the standard discharge-readiness threshold.
          </Text>

          {ALDRETE_PARAMS.map((p) => (
            <Stack key={p.key} gap={2}>
              <Text size="sm" fw={500}>
                {p.label}
              </Text>
              <SegmentedControl
                size="xs"
                data={["0", "1", "2"]}
                value={String(params[p.key] ?? 0)}
                onChange={(v) => setParams((prev) => ({ ...prev, [p.key]: Number(v) }))}
              />
              <Text size="xs" c="dimmed">
                {p.hint}
              </Text>
            </Stack>
          ))}

          <Input
            label="Note"
            placeholder="Fit for ward transfer"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />

          {/* The threshold is the clinical meaning of the number, so it is
              stated before the score is filed rather than left for the reader
              to remember. */}
          <Alert tone={readyForDischarge ? "success" : "warning"} title={`Total ${total} of 10`}>
            {readyForDischarge
              ? "At or above the discharge-readiness threshold."
              : `Below ${ALDRETE_DISCHARGE_THRESHOLD} — not yet ready to leave recovery.`}
          </Alert>

          {recordMutation.isError && (
            <Alert tone="danger" title="The score could not be recorded">
              {(recordMutation.error as Error).message}
            </Alert>
          )}

          <Group justify="flex-end">
            <Button
              tone="primary"
              loading={recordMutation.isPending}
              onClick={() => recordMutation.mutate()}
            >
              Record Aldrete
            </Button>
          </Group>
        </Stack>
      )}

      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>Recorded scores</Text>
          {rows.length > 0 && <Badge tone="neutral">{rows.length}</Badge>}
        </Group>
        {/* A failed read is not an empty history. A patient who looks
            unscored gets scored again from scratch, and the trend is lost. */}
        {scoresQ.isError ? (
          <Alert tone="danger" title="This patient's scores could not be loaded">
            This is a failed read, not an empty record. Do not assume the patient has not been
            scored.
          </Alert>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            loading={scoresQ.isLoading}
            rowKey={(row) => row.id}
          />
        )}
      </Stack>
    </Stack>
  );
}
