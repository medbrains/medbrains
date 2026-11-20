/**
 * Step 4 — detailed information (HFR-047…061; on update HFR-101…115): for
 * each system of medicine chosen in basic information, whether
 * specialisations are offered and which; then bed and chair counts. The two
 * totals are computed, never typed (HFR-057/060).
 */

import { SimpleGrid, Stack, Text } from "@mantine/core";
import type {
  HfrDetailedInformation,
  HfrMedicalInfrastructure,
  HfrStepSaved,
  HfrSystemSpecialities,
} from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Button, MultiSelect, NumberField, SegmentedControl } from "@/components/ui";
import { abdmRegistryService } from "@/services/abdmRegistry.service";
import { checkSpecialities, countSchema, withTotals } from "./hfrRules";
import { useHfrMaster } from "./useHfrMaster";

export const EMPTY_INFRASTRUCTURE: HfrMedicalInfrastructure = {
  countIPDBedsWithoutOxygen: 0,
  countIPDBedsWithOxygen: 0,
  countICUBedsWithVentilators: 0,
  countICUBedsWithoutVentilators: 0,
  countHDUBedsWithFunctionalVentilators: 0,
  countHDUBedsWithVentilators: 0,
  countHDUBedsWithoutVentilators: 0,
  countDayCareBedsWithoutOxygen: 0,
  countDayCareBedsWithOxygen: 0,
  countDentalChairs: 0,
  totalNumberOfVentilators: 0,
  totalNumberOfBeds: 0,
};

type CountKey = Exclude<
  keyof HfrMedicalInfrastructure,
  "totalNumberOfVentilators" | "totalNumberOfBeds"
>;

const COUNTS: { key: CountKey; label: string }[] = [
  { key: "countIPDBedsWithoutOxygen", label: "IPD beds without oxygen" },
  { key: "countIPDBedsWithOxygen", label: "IPD beds with oxygen" },
  { key: "countICUBedsWithVentilators", label: "ICU beds with ventilators" },
  { key: "countICUBedsWithoutVentilators", label: "ICU beds without ventilators" },
  { key: "countHDUBedsWithFunctionalVentilators", label: "HDU beds with functional ventilators" },
  { key: "countHDUBedsWithVentilators", label: "HDU beds with ventilators" },
  { key: "countHDUBedsWithoutVentilators", label: "HDU beds without ventilators" },
  { key: "countDayCareBedsWithoutOxygen", label: "Day-care beds without oxygen" },
  { key: "countDayCareBedsWithOxygen", label: "Day-care beds with oxygen" },
  { key: "countDentalChairs", label: "Dental chairs" },
];

interface HfrDetailedStepProps {
  facilityId: string;
  /** Codes chosen in basic information, with their names. */
  systems: { code: string; name: string }[];
  facilityTypeName: string;
  initial: HfrDetailedInformation | null;
  onSaved: (saved: HfrStepSaved) => void;
}

/** One entry per system, defaulting to the saved draft. */
function startingEntries(
  systems: { code: string }[],
  initial: HfrDetailedInformation | null,
): HfrSystemSpecialities[] {
  return systems.map(
    (s) =>
      initial?.specialities.find((e) => e.systemOfMedicineCode === s.code) ?? {
        systemOfMedicineCode: s.code,
        isSpecializationAvalaible: "N",
        specialities: [],
      },
  );
}

/** Specialities per system, the counts, and the save. */
export function HfrDetailedStep(props: HfrDetailedStepProps) {
  const { facilityId, systems, facilityTypeName, initial, onSaved } = props;
  const [entries, setEntries] = useState(() => startingEntries(systems, initial));
  const [counts, setCounts] = useState(initial?.medicalInfrastructure ?? EMPTY_INFRASTRUCTURE);
  const totals = useMemo(() => withTotals(counts), [counts]);
  const detailed: HfrDetailedInformation = { specialities: entries, medicalInfrastructure: totals };
  const specialityError = checkSpecialities(detailed, facilityTypeName);
  const countsValid = COUNTS.every((c) => countSchema.safeParse(counts[c.key]).success);
  const save = useMutation({
    mutationFn: () => abdmRegistryService.saveHfrDetailed(facilityId, detailed),
    onSuccess: onSaved,
  });
  /** Change one system's entry, leaving the others. */
  const setEntry = (i: number, patch: Partial<HfrSystemSpecialities>) =>
    setEntries((cur) => cur.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  return (
    <Stack gap="md">
      <Text fw={600}>Specialisations</Text>
      {entries.map((e, i) => (
        <SystemRow
          key={e.systemOfMedicineCode}
          entry={e}
          name={systems[i]?.name ?? e.systemOfMedicineCode}
          onChange={(patch) => setEntry(i, patch)}
        />
      ))}
      {specialityError && <Alert tone="warning">{specialityError}</Alert>}
      <Text fw={600}>Medical infrastructure</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        {COUNTS.map((c) => (
          <NumberField
            key={c.key}
            label={c.label}
            min={0}
            max={99}
            allowDecimal={false}
            value={counts[c.key]}
            onChange={(v) =>
              setCounts((cur) => ({ ...cur, [c.key]: typeof v === "number" ? v : 0 }))
            }
            error={countSchema.safeParse(counts[c.key]).success ? undefined : "0 to 99"}
          />
        ))}
        <NumberField label="Total ventilators" value={totals.totalNumberOfVentilators} readOnly />
        <NumberField label="Total beds" value={totals.totalNumberOfBeds} readOnly />
      </SimpleGrid>
      {save.isError && (
        <Alert tone="danger" title="HFR did not save detailed information">
          {save.error.message}
        </Alert>
      )}
      <Button
        tone="primary"
        loading={save.isPending}
        disabled={specialityError !== null || !countsValid}
        onClick={() => save.mutate()}
      >
        Save detailed information
      </Button>
    </Stack>
  );
}

interface SystemRowProps {
  entry: HfrSystemSpecialities;
  name: string;
  onChange: (patch: Partial<HfrSystemSpecialities>) => void;
}

/** Yes/no (HFR-048) and, only for yes, the specialities (HFR-049). */
function SystemRow({ entry, name, onChange }: SystemRowProps) {
  const offered = entry.isSpecializationAvalaible === "Y";
  const list = useHfrMaster("specialities", entry.systemOfMedicineCode, "", offered);
  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }}>
      <Text size="sm">{name}</Text>
      <SegmentedControl
        aria-label={`Specialisations offered in ${name}`}
        value={entry.isSpecializationAvalaible}
        onChange={(v) =>
          onChange({ isSpecializationAvalaible: v === "Y" ? "Y" : "N", specialities: [] })
        }
        data={[
          { value: "Y", label: "Offered" },
          { value: "N", label: "None" },
        ]}
      />
      {offered && (
        <MultiSelect
          label="Specialities"
          searchable
          data={list.data}
          value={entry.specialities}
          onChange={(v) => onChange({ specialities: v })}
          error={list.error}
        />
      )}
    </SimpleGrid>
  );
}
