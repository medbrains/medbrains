/**
 * Step 3 — additional information: the health programme IDs the campus
 * holds (HFR-039…046; on update HFR-093…100). All optional; saved with the
 * trackingId from basic information.
 */

import { SimpleGrid, Stack, Text } from "@mantine/core";
import type { HfrLinkedProgramIds, HfrStepSaved } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { abdmRegistryService } from "@/services/abdmRegistry.service";
import { stateSchemeSchema } from "./hfrRules";

export const EMPTY_PROGRAM_IDS: HfrLinkedProgramIds = {
  nhrrId: "",
  nin: "",
  abpmjayId: "",
  rohiniId: "",
  echsId: "",
  cghsId: "",
  ceaRegistration: "",
  stateInsuranceSchemeId: "",
};

const FIELDS: { key: keyof HfrLinkedProgramIds; label: string }[] = [
  { key: "nhrrId", label: "National Health Resource Repository ID" },
  { key: "nin", label: "National Identification Number (NIN)" },
  { key: "abpmjayId", label: "AB-PMJAY hospital ID" },
  { key: "rohiniId", label: "ROHINI ID" },
  { key: "echsId", label: "ECHS ID" },
  { key: "cghsId", label: "CGHS ID" },
  { key: "ceaRegistration", label: "Clinical Establishments Act registration number" },
  { key: "stateInsuranceSchemeId", label: "State insurance scheme ID" },
];

interface HfrAdditionalStepProps {
  facilityId: string;
  initial: HfrLinkedProgramIds;
  onSaved: (saved: HfrStepSaved) => void;
}

/** The eight programme ID fields and their save. */
export function HfrAdditionalStep({ facilityId, initial, onSaved }: HfrAdditionalStepProps) {
  const [ids, setIds] = useState<HfrLinkedProgramIds>(initial);
  const schemeError = stateSchemeSchema.safeParse(ids.stateInsuranceSchemeId).error?.issues[0]
    ?.message;
  const save = useMutation({
    mutationFn: () => abdmRegistryService.saveHfrAdditional(facilityId, ids),
    onSuccess: onSaved,
  });
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Programme IDs this campus holds. Leave blank any it does not have.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {FIELDS.map((f) => (
          <Input
            key={f.key}
            label={f.label}
            value={ids[f.key]}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setIds((cur) => ({ ...cur, [f.key]: value }));
            }}
            error={f.key === "stateInsuranceSchemeId" ? schemeError : undefined}
          />
        ))}
      </SimpleGrid>
      {save.isError && (
        <Alert tone="danger" title="HFR did not save additional information">
          {save.error.message}
        </Alert>
      )}
      <Button
        tone="primary"
        loading={save.isPending}
        disabled={schemeError !== undefined}
        onClick={() => save.mutate()}
      >
        Save additional information
      </Button>
    </Stack>
  );
}
