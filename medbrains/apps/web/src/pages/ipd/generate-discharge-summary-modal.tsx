// IPD GenerateDischargeSummaryModal — split from ipd.tsx (pure move).

import { Group, Modal, Stack, Text } from "@mantine/core";
import type { DischargeSummary as DischargeSummaryGenerated } from "@medbrains/types";
import { PATIENT_NAME_FIELD_ACCESS_KEYS } from "@medbrains/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useProtectedFieldAccess } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { protectedIpdPatientName } from "./shared";

export function GenerateDischargeSummaryModal({
  admissionId,
  opened,
  onClose,
}: {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
}) {
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["generated-discharge-summary", admissionId],
    queryFn: () => ipdService.generateDischargeSummary(admissionId),
    enabled: false,
  });

  const generateMutation = useMutation({
    mutationFn: () => ipdService.generateDischargeSummary(admissionId),
    onSuccess: () => {
      refetch();
      toast.success("Discharge summary generated", { title: "Generated" });
    },
    onError: () => {
      toast.error("Failed to generate discharge summary", { title: "Error" });
    },
  });

  const summary = data as DischargeSummaryGenerated | undefined;
  const patientName = summary
    ? protectedIpdPatientName(summary.patient_name, patientNameAccess)
    : "Patient";

  return (
    <Modal opened={opened} onClose={onClose} title="Discharge Summary" size="lg">
      <Stack>
        {!summary && !isLoading && (
          <Button
            tone="primary"
            onClick={() => generateMutation.mutate()}
            loading={generateMutation.isPending}
          >
            Generate Discharge Summary
          </Button>
        )}
        {(isLoading || generateMutation.isPending) && <Text c="dimmed">Generating...</Text>}
        {summary && (
          <Stack gap="sm">
            <Group>
              <Text fw={600}>Patient:</Text>
              <Text>{patientName}</Text>
            </Group>
            <Group>
              <Text fw={600}>Admission Date:</Text>
              <Text>{new Date(summary.admission_date).toLocaleDateString()}</Text>
            </Group>
            {summary.discharge_date && (
              <Group>
                <Text fw={600}>Discharge Date:</Text>
                <Text>{new Date(summary.discharge_date).toLocaleDateString()}</Text>
              </Group>
            )}
            {summary.diagnoses.length > 0 && (
              <Stack gap={2}>
                <Text fw={600}>Diagnoses:</Text>
                {summary.diagnoses.map((d) => (
                  <Badge key={d} size="sm">
                    {d}
                  </Badge>
                ))}
              </Stack>
            )}
            {summary.procedures.length > 0 && (
              <Stack gap={2}>
                <Text fw={600}>Procedures:</Text>
                {summary.procedures.map((p) => (
                  <Badge key={p} tone="primary" size="sm">
                    {p}
                  </Badge>
                ))}
              </Stack>
            )}
            {summary.medications.length > 0 && (
              <Stack gap={2}>
                <Text fw={600}>Medications at Discharge:</Text>
                {summary.medications.map((m) => (
                  <Badge key={m} tone="success" size="sm">
                    {m}
                  </Badge>
                ))}
              </Stack>
            )}
            {summary.instructions && (
              <Stack gap={2}>
                <Text fw={600}>Instructions:</Text>
                <Text size="sm">{summary.instructions}</Text>
              </Stack>
            )}
            {summary.follow_up && (
              <Stack gap={2}>
                <Text fw={600}>Follow-up:</Text>
                <Text size="sm">{summary.follow_up}</Text>
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Bed Transfer Modal ────────────────────────────────────
// ═══════════════════════════════════════════════════════════
