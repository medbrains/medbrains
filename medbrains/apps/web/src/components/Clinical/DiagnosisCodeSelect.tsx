import { Group, Loader, Stack, Text } from "@mantine/core";
import type { TerminologySearchResult } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, SegmentedControl } from "@/components/ui";
import {
  codingSystems,
  type IcdSystem,
  terminologySearchPlaceholder,
  terminologySystemLabel,
} from "@/domain/clinical/terminology-policy";
import { DIAGNOSIS_CODING_KEY, diagnosisCodingService } from "@/services/diagnosisCoding.service";
import { Icd10CodeSelect } from "./Icd10CodeSelect";
import { Icd11CodeSelect } from "./Icd11CodeSelect";

interface DiagnosisCodeSelectProps {
  value: string | null;
  /** The system of the chosen code; follows the hospital's switch. */
  onSystemChange?: (system: IcdSystem) => void;
  onChange: (value: string | undefined) => void;
  onSelectResult?: (result: TerminologySearchResult) => void;
  label?: string;
  w?: number;
  size?: "xs" | "sm" | "md";
  limit?: number;
}

/**
 * The diagnosis code picker, in the system(s) the hospital codes in
 * (Settings → Diagnosis coding). With "both" the doctor picks the system;
 * a code is never translated from one to the other.
 */
export function DiagnosisCodeSelect({
  value,
  onSystemChange,
  onChange,
  onSelectResult,
  label,
  w,
  size = "sm",
  limit = 15,
}: DiagnosisCodeSelectProps) {
  const coding = useQuery({
    queryKey: DIAGNOSIS_CODING_KEY,
    queryFn: diagnosisCodingService.get,
    staleTime: 60_000,
  });
  const [picked, setPicked] = useState<IcdSystem | null>(null);

  if (coding.isLoading) {
    return (
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="sm">Loading the hospital's coding system…</Text>
      </Group>
    );
  }
  if (coding.isError || !coding.data) {
    return (
      <Alert tone="danger" title="Could not load the diagnosis coding setting">
        <Button tone="secondary" size="xs" onClick={() => void coding.refetch()}>
          Try again
        </Button>
      </Alert>
    );
  }

  const systems = codingSystems(coding.data.mode);
  const system = picked && systems.includes(picked) ? picked : (systems[0] ?? "icd11");
  const chooseSystem = (next: IcdSystem) => {
    setPicked(next);
    onChange(undefined);
    onSystemChange?.(next);
  };
  const common = {
    label,
    w,
    size,
    limit,
    value,
    onChange,
    onSelectResult,
    "aria-label": label ? undefined : `${terminologySystemLabel(system)} diagnosis code`,
    placeholder: terminologySearchPlaceholder(system),
  };

  return (
    <Stack gap={4}>
      {systems.length > 1 && (
        <SegmentedControl
          aria-label="Diagnosis coding system"
          size="xs"
          value={system}
          onChange={(next) => chooseSystem(next === "icd10" ? "icd10" : "icd11")}
          data={systems.map((s) => ({ value: s, label: terminologySystemLabel(s) }))}
        />
      )}
      {system === "icd10" ? (
        <Icd10CodeSelect {...common} catalogueLoaded={coding.data.icd10_catalogue !== null} />
      ) : (
        <Icd11CodeSelect {...common} />
      )}
    </Stack>
  );
}
