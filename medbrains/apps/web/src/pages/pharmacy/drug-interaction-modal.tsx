// IPD DrugInteractionModal — split from pharmacy.tsx (pure move).

import { PharmacyPatientContext, sharedColorBadgeTone } from "./shared";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button } from "@/components/ui";
import type { AlertTone } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { Group, Modal, Stack, Text } from "@mantine/core";
import type { DrugInteractionCheckRequest, DrugInteractionResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

export function DrugInteractionModal({
  opened,
  onClose,
  canViewPatientRecord,
}: {
  opened: boolean;
  onClose: () => void;
  canViewPatientRecord: boolean;
}) {
  const [patientId, setPatientId] = useState("");
  const [drugId, setDrugId] = useState("");

  const checkMutation = useMutation({
    mutationFn: (data: DrugInteractionCheckRequest) => pharmacyService.checkDrugInteractions(data),
  });

  const severityColors: Record<string, string> = {
    severe: "danger",
    moderate: "orange",
    mild: "warning",
    minor: "gray",
  };

  const severityAlertTones: Record<string, AlertTone> = {
    severe: "danger",
    moderate: "warning",
    mild: "warning",
    minor: "neutral",
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Drug Interaction Check" size="xl">
      <Stack>
        <PatientSearchSelect value={patientId} onChange={setPatientId} required />
        <PharmacyPatientContext patientId={patientId} canViewPatientRecord={canViewPatientRecord} />
        <DrugSearchSelect
          value={drugId}
          onChange={(id) => setDrugId(id)}
          label="Drug to Check"
          required
        />
        <Button
          tone="primary"
          onClick={() => checkMutation.mutate({ patient_id: patientId, drug_id: drugId })}
          loading={checkMutation.isPending}
          disabled={!patientId.trim() || !drugId.trim()}
        >
          Check Interactions
        </Button>

        {checkMutation.data && (checkMutation.data as DrugInteractionResult[]).length > 0 && (
          <Stack gap="xs">
            <Text fw={600} size="sm">
              Interactions Found:
            </Text>
            {(checkMutation.data as DrugInteractionResult[]).map((r) => (
              <Alert
                key={`${r.interacting_drug}-${r.interaction_type}-${r.severity}`}
                tone={severityAlertTones[r.severity] ?? "neutral"}
                title={r.interacting_drug}
              >
                <Group gap="xs" mb={4}>
                  <Badge tone={sharedColorBadgeTone(severityColors[r.severity])} size="sm">
                    {r.severity}
                  </Badge>
                  <Badge variant="outline" size="sm">
                    {r.interaction_type}
                  </Badge>
                </Group>
                <Text size="sm">{r.description}</Text>
              </Alert>
            ))}
          </Stack>
        )}

        {checkMutation.data && (checkMutation.data as DrugInteractionResult[]).length === 0 && (
          <Alert tone="success" title="No Interactions">
            <Text size="sm">No drug interactions found for this combination.</Text>
          </Alert>
        )}
      </Stack>
    </Modal>
  );
}

// ── Formulary Check Modal ─────────────────────────────────
