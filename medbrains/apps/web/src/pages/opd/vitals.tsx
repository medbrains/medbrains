// OPD VitalsTab — split from opd.tsx (pure move).

import { Group, Modal, Stack, Text, Timeline } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { CreateVitalRequest, Vital, VitalHistoryPoint } from "@medbrains/types";
import { IconHeartbeat, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useClinicalEmit, VitalsRecorder } from "@/components";
import { Badge, Button } from "@/components/ui";
import { useVitalsSource } from "@/hooks/useVitalsSource";
import { opdService } from "@/services/opd.service";
import { bloodPressureSeverity, severityTone, spo2Severity } from "./vitals-thresholds";

export function VitalsTab({
  encounterId,
  patientId,
  canUpdate,
}: {
  encounterId: string;
  patientId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
  const [formOpened, formHandlers] = useDisclosure(false);

  // Mode (REST vs CRDT) is read from <TenantConfigProvider>. Flips
  // automatically when a tenant turns on tenant_settings.clinical.
  // offline_mode + provides an edge_url. No code change here.
  const { records: vitals, append, unsyncedOps } = useVitalsSource({ encounterId });
  const { data: patientVitals = [] } = useQuery({
    queryKey: ["patient-vitals-history", patientId, "timeline"],
    queryFn: () => opdService.listPatientVitalsHistory(patientId),
  });
  const patientVitalsTimeline = useMemo(
    () =>
      [...patientVitals].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)).slice(0, 12),
    [patientVitals],
  );

  const handleSubmit = (data: CreateVitalRequest) => {
    append(data);
    emit("opd.vitals.recorded", { encounter_id: encounterId, patient_id: patientId, ...data });
    formHandlers.close();
  };

  return (
    <Stack>
      {canUpdate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.open}
          >
            Record Vitals
          </Button>
        </Group>
      )}
      <Modal opened={formOpened} onClose={formHandlers.close} title="Record Vitals" size="lg">
        <VitalsRecorder
          onSubmit={handleSubmit}
          isSubmitting={unsyncedOps > 0}
          onCancel={formHandlers.close}
        />
      </Modal>
      {vitals.length > 0 && (
        <Timeline
          active={0}
          bulletSize={32}
          lineWidth={2}
          color="primary"
          styles={{ item: { marginBottom: 8 } }}
        >
          {vitals.map((v: Vital, idx: number) => {
            const prev = vitals[idx + 1] as Vital | undefined;
            const trend = (curr: number | null, prevVal: number | null) => {
              if (!curr || !prevVal) return "";
              if (curr > prevVal) return " ↑";
              if (curr < prevVal) return " ↓";
              return " →";
            };
            return (
              <Timeline.Item
                key={v.id}
                bullet={<IconHeartbeat size={16} />}
                title={
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      {new Date(v.created_at).toLocaleString()}
                    </Text>
                    {idx === 0 && (
                      <Badge size="sm" tone="success">
                        Latest
                      </Badge>
                    )}
                  </Group>
                }
              >
                <Group gap="md" mt={4} wrap="wrap">
                  {v.temperature != null && (
                    <Badge tone={Number(v.temperature) > 37.5 ? "danger" : "primary"} size="md">
                      🌡 {v.temperature}°C
                      {trend(
                        Number(v.temperature),
                        prev?.temperature ? Number(prev.temperature) : null,
                      )}
                    </Badge>
                  )}
                  {v.pulse != null && (
                    <Badge
                      tone={
                        Number(v.pulse) > 100
                          ? "danger"
                          : Number(v.pulse) < 60
                            ? "warning"
                            : "primary"
                      }
                      size="md"
                    >
                      ❤ {v.pulse} bpm
                      {trend(Number(v.pulse), prev?.pulse ? Number(prev.pulse) : null)}
                    </Badge>
                  )}
                  {v.systolic_bp != null && v.diastolic_bp != null && (
                    <Badge
                      tone={severityTone(bloodPressureSeverity(v.systolic_bp, v.diastolic_bp))}
                      size="md"
                    >
                      🩸 {v.systolic_bp}/{v.diastolic_bp} mmHg
                    </Badge>
                  )}
                  {v.spo2 != null && (
                    <Badge tone={severityTone(spo2Severity(v.spo2))} size="md">
                      💨 SpO₂ {v.spo2}%
                    </Badge>
                  )}
                  {v.respiratory_rate != null && (
                    <Badge size="sm">🫁 RR {v.respiratory_rate}</Badge>
                  )}
                  {v.weight_kg != null && (
                    <Badge variant="outline" size="md">
                      ⚖ {v.weight_kg} kg
                    </Badge>
                  )}
                  {v.bmi != null && (
                    <Badge variant="outline" size="md">
                      BMI {v.bmi}
                    </Badge>
                  )}
                </Group>
                {v.notes && (
                  <Text size="sm" c="dimmed" fs="italic" mt={6} pr="lg">
                    {v.notes}
                  </Text>
                )}
              </Timeline.Item>
            );
          })}
        </Timeline>
      )}
      {patientVitalsTimeline.length > 0 && (
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Patient vitals timeline
          </Text>
          <Timeline active={0} bulletSize={28} lineWidth={2} color="teal">
            {patientVitalsTimeline.map((v: VitalHistoryPoint) => (
              <Timeline.Item
                key={v.id}
                bullet={<IconHeartbeat size={14} />}
                title={
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      {new Date(v.recorded_at).toLocaleString()}
                    </Text>
                    {v.encounter_id === encounterId && (
                      <Badge size="xs" tone="primary">
                        Current encounter
                      </Badge>
                    )}
                  </Group>
                }
              >
                <Group gap="xs" mt={4} wrap="wrap">
                  {v.temperature != null && (
                    <Badge tone={Number(v.temperature) > 37.5 ? "danger" : "primary"}>
                      Temp {v.temperature}°C
                    </Badge>
                  )}
                  {v.pulse != null && (
                    <Badge tone={v.pulse > 100 ? "danger" : v.pulse < 60 ? "warning" : "primary"}>
                      Pulse {v.pulse}
                    </Badge>
                  )}
                  {v.systolic_bp != null && v.diastolic_bp != null && (
                    <Badge
                      tone={severityTone(bloodPressureSeverity(v.systolic_bp, v.diastolic_bp))}
                    >
                      BP {v.systolic_bp}/{v.diastolic_bp}
                    </Badge>
                  )}
                  {v.spo2 != null && (
                    <Badge tone={severityTone(spo2Severity(v.spo2))}>SpO₂ {v.spo2}%</Badge>
                  )}
                  {v.weight_kg != null && <Badge variant="outline">Weight {v.weight_kg} kg</Badge>}
                  {v.bmi != null && <Badge variant="outline">BMI {v.bmi}</Badge>}
                </Group>
              </Timeline.Item>
            ))}
          </Timeline>
        </Stack>
      )}
    </Stack>
  );
}

// ── Consultation ─────────────────────────────────────────
