// Scheduling PredictionsTab — split from scheduling.tsx (pure move).

import { Group, Select, Stack, Text } from "@mantine/core";
import type { NoshowPredictionScore } from "@medbrains/types";
import { IconBrain, IconPlayerPlay } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import { schedulingService } from "@/services/scheduling.service";
import { formatDate, formatPercent, truncateId } from "./shared";

const RISK_LEVEL_COLORS: Record<string, BadgeTone> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

export function PredictionsTab({ canScore }: { canScore: boolean }) {
  const qc = useQueryClient();
  const [riskFilter, setRiskFilter] = useState<string | null>(null);

  const { data: predictions = [], isLoading } = useQuery({
    queryKey: ["scheduling-predictions", riskFilter],
    queryFn: () =>
      schedulingService.listPredictions({
        risk_level: riskFilter ?? undefined,
      }),
  });

  const scoreBatchMut = useMutation({
    mutationFn: () => schedulingService.scoreBatch({ appointment_ids: [] }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-predictions"] });
      toast.success("Today's appointments have been scored", { title: "Batch Scoring Complete" });
    },
    onError: () => {
      toast.error("Failed to score appointments", { title: "Scoring Failed" });
    },
  });

  const scoreOneMut = useMutation({
    mutationFn: (appointmentId: string) =>
      schedulingService.scoreAppointment({ appointment_id: appointmentId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-predictions"] });
      toast.success("Appointment prediction scored", { title: "Scored" });
    },
  });

  const columns: Column<NoshowPredictionScore>[] = [
    {
      key: "appointment_id",
      label: "Appointment",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.appointment_id)}
        </Text>
      ),
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.patient_id)}
        </Text>
      ),
    },
    {
      key: "predicted_noshow_probability",
      label: "No-Show Probability",
      render: (r) => (
        <Text size="sm" fw={600}>
          {formatPercent(r.predicted_noshow_probability)}
        </Text>
      ),
    },
    {
      key: "risk_level",
      label: "Risk Level",
      render: (r) => (
        <Badge tone={RISK_LEVEL_COLORS[r.risk_level] ?? "neutral"} size="sm">
          {r.risk_level}
        </Badge>
      ),
    },
    {
      key: "model_version",
      label: "Model",
      render: (r) => <Text size="sm">{r.model_version}</Text>,
    },
    {
      key: "scored_at",
      label: "Scored At",
      render: (r) => <Text size="sm">{formatDate(r.scored_at)}</Text>,
    },
    ...(canScore
      ? [
          {
            key: "actions",
            label: "Actions",
            render: (r: NoshowPredictionScore) => (
              <IconButton
                tone="primary"
                size="sm"
                onClick={() => scoreOneMut.mutate(r.appointment_id)}
                loading={scoreOneMut.isPending}
                aria-label="Score appointment"
              >
                <IconPlayerPlay size={14} />
              </IconButton>
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Select
          placeholder="Filter by risk level"
          data={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ]}
          value={riskFilter}
          onChange={setRiskFilter}
          clearable
          w={200}
        />
        {canScore && (
          <Button
            tone="primary"
            leftSection={<IconBrain size={16} />}
            onClick={() => scoreBatchMut.mutate()}
            loading={scoreBatchMut.isPending}
          >
            Score Today's Appointments
          </Button>
        )}
      </Group>
      <DataTable<NoshowPredictionScore>
        columns={columns}
        data={predictions}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No predictions"
        emptyDescription="Score appointments to see no-show predictions"
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 2 — Waitlist
// ══════════════════════════════════════════════════════════
