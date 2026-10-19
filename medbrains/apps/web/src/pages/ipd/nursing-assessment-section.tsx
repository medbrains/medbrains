// The admission nursing assessments recorded so far, and the button that
// writes one. Reads gate the query; an outage is said, never shown as "none".

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { IpdNursingAssessment } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { NursingAssessmentFormModal } from "./nursing-assessment-form";

function field(section: unknown, key: string): string {
  if (section && typeof section === "object" && key in section) {
    const value = (section as Record<string, unknown>)[key];
    return value === null || value === undefined ? "" : String(value);
  }
  return "";
}

function summarise(a: IpdNursingAssessment): string {
  const parts = [
    field(a.general_appearance, "appearance"),
    field(a.general_appearance, "consciousness"),
    `skin ${field(a.skin_assessment, "condition") || "—"}`,
    `pain ${field(a.pain_assessment, "score") || "—"}/10`,
    a.allergies ? `allergies: ${a.allergies}` : "",
  ];
  return parts.filter(Boolean).join(" · ").replaceAll("_", " ");
}

export function NursingAssessmentSection({ admissionId }: { admissionId: string }) {
  const canList = useHasPermission(P.IPD.NURSING_ASSESSMENT_LIST);
  const canCreate = useHasPermission(P.IPD.NURSING_ASSESSMENT_CREATE);
  const [opened, setOpened] = useState(false);

  const query = useQuery({
    queryKey: ["ipd-nursing-assessments", admissionId],
    queryFn: () => ipdService.listNursingAssessments(admissionId),
    enabled: canList,
  });
  const assessments = (query.data ?? []) as IpdNursingAssessment[];

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={600} size="sm">
          Admission nursing assessment
        </Text>
        {canCreate && (
          <Button
            tone={assessments.length === 0 ? "primary" : "secondary"}
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setOpened(true)}
          >
            {assessments.length === 0 ? "Record assessment" : "Reassess"}
          </Button>
        )}
      </Group>
      {query.isError && (
        <Alert tone="danger">Nursing assessments could not be loaded. Try again shortly.</Alert>
      )}
      {canList && query.isSuccess && assessments.length === 0 && (
        <Alert tone="warning">
          No admission nursing assessment yet. It is due within 24 hours of admission.
        </Alert>
      )}
      {assessments.map((a) => (
        <Stack key={a.id} gap={2} p="xs" bd="1px solid var(--mantine-color-gray-3)">
          <Text size="xs" c="dimmed" ff="monospace">
            {new Date(a.assessed_at).toLocaleString()}
          </Text>
          <Text size="sm">{summarise(a)}</Text>
        </Stack>
      ))}
      {canCreate && (
        <NursingAssessmentFormModal
          admissionId={admissionId}
          opened={opened}
          onClose={() => setOpened(false)}
        />
      )}
    </Stack>
  );
}
