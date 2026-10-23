/**
 * Settings → Diagnosis coding: whether doctors code diagnoses in ICD-11,
 * ICD-10 or both, and the hospital's own licensed ICD-10 catalogue.
 */
import { Group, Radio, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DiagnosisCodingMode, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Card, toast } from "@/components/ui";
import { codingModeLabel } from "@/domain/clinical/terminology-policy";
import { DIAGNOSIS_CODING_KEY, diagnosisCodingService } from "@/services/diagnosisCoding.service";
import { Icd10CatalogueSection } from "./Icd10CatalogueSection";

const MODES: { value: DiagnosisCodingMode; description: string }[] = [
  { value: "icd11", description: "WHO ICD-11, searched live. The default." },
  { value: "icd10", description: "ICD-10 from the catalogue the hospital loads below." },
  { value: "both", description: "Doctors choose ICD-11 or ICD-10 for each diagnosis." },
];

function isMode(value: string): value is DiagnosisCodingMode {
  return value === "icd11" || value === "icd10" || value === "both";
}

export function DiagnosisCodingSettings() {
  const canConfigure = useHasPermission(P.TERMINOLOGY.CODING.CONFIGURE);
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: DIAGNOSIS_CODING_KEY,
    queryFn: diagnosisCodingService.get,
    enabled: canConfigure,
  });
  const [draft, setDraft] = useState<DiagnosisCodingMode | null>(null);
  const save = useMutation({
    mutationFn: diagnosisCodingService.set,
    onSuccess: (next) => {
      qc.setQueryData(DIAGNOSIS_CODING_KEY, next);
      setDraft(null);
      toast.success(`Diagnoses are now coded in ${codingModeLabel(next.mode)}`);
    },
  });

  if (!canConfigure) {
    return <Alert tone="warning">You do not have permission to change diagnosis coding.</Alert>;
  }
  if (status.isLoading) return <Text size="sm">Loading…</Text>;
  if (status.isError || !status.data) {
    return (
      <Alert tone="danger" title="Could not load the diagnosis coding setting">
        <Button tone="secondary" size="xs" onClick={() => void status.refetch()}>
          Try again
        </Button>
      </Alert>
    );
  }

  const current = status.data.mode;
  const chosen = draft ?? current;
  const needsCatalogue = chosen !== "icd11" && status.data.icd10_catalogue === null;

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Stack gap="sm">
          <Radio.Group
            label="Diagnosis coding system"
            description="Diagnoses already recorded keep the system they were coded in; only new ones follow this."
            value={chosen}
            onChange={(v) => isMode(v) && setDraft(v)}
          >
            <Stack gap="xs" mt="xs">
              {MODES.map((m) => (
                <Radio
                  key={m.value}
                  value={m.value}
                  label={codingModeLabel(m.value)}
                  description={m.description}
                />
              ))}
            </Stack>
          </Radio.Group>
          {needsCatalogue && (
            <Alert tone="warning" title="No ICD-10 catalogue is loaded">
              Until one is loaded, doctors see "ICD-10 catalogue not loaded — ask your
              administrator" in the ICD-10 picker.
            </Alert>
          )}
          <Text size="xs" c="dimmed">
            ICD-11 and ICD-10 codes are never converted into each other: WHO licenses that mapping
            separately.
          </Text>
          <Group justify="flex-end">
            <Button
              tone="primary"
              disabled={chosen === current}
              loading={save.isPending}
              onClick={() => save.mutate({ mode: chosen })}
            >
              Save
            </Button>
          </Group>
          {save.error && <Alert tone="danger">{save.error.message}</Alert>}
        </Stack>
      </Card>
      <Icd10CatalogueSection />
    </Stack>
  );
}
