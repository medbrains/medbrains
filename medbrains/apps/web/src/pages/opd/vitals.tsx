// OPD VitalsTab — split from opd.tsx (pure move).

import { Group, Modal, Stack, Text, Timeline } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasAllPermissions } from "@medbrains/stores";
import type { CreateVitalRequest, Vital, VitalHistoryPoint } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconHeartbeat, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useClinicalEmit, VitalsRecorder } from "@/components";
import { Badge, Button } from "@/components/ui";
import { useVitalsSource } from "@/hooks/useVitalsSource";
import { opdService } from "@/services/opd.service";
import { VitalChips } from "./vital-chip";

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
  const canReadHistory = useHasAllPermissions([P.OPD.VITALS_LIST, P.PATIENTS.VIEW]);
  const { data: patientVitals = [] } = useQuery({
    queryKey: ["patient-vitals-history", patientId, "timeline"],
    queryFn: () => opdService.listPatientVitalsHistory(patientId),
    // The endpoint needs both: the visit's vitals and the patient's record.
    enabled: canReadHistory,
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
                  <VitalChips size="md" vitals={v} previous={vitals[idx + 1]} />
                  {v.weight_kg != null && (
                    <Badge variant="outline" size="md">
                      Weight {v.weight_kg} kg
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
                  <VitalChips vitals={v} />
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
