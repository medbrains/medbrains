import { Stack, Text } from "@mantine/core";
import type { PharmacyCatalog } from "@medbrains/types";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { Alert } from "@/components/ui";
import type { DictatedPick } from "./dictatedRx";

interface DictatedPicksProps {
  picks: DictatedPick[];
  /** The doctor chose `drug` for the dictated medicine at `index`. */
  onPick: (index: number, drug: PharmacyCatalog) => void;
}

/** What was said, read back as one line. */
function said(pick: DictatedPick): string {
  const m = pick.medicine;
  return [m.name, m.dose, m.frequency, m.duration, m.route].filter(Boolean).join(" ");
}

/**
 * Dictated medicines the formulary could not name on its own: none matched,
 * or several did. The doctor picks the drug; a guess is never made for them.
 */
export function DictatedPicks({ picks, onPick }: DictatedPicksProps) {
  if (picks.length === 0) return null;
  return (
    <Alert tone="warning" title="Pick the drug for these dictated medicines">
      <Stack gap="sm">
        {picks.map((pick) => (
          <Stack key={pick.index} gap={4}>
            <Text size="sm">
              You said: <strong>{said(pick)}</strong>
              {pick.candidates === 0
                ? " (no formulary drug by that name)"
                : ` (matches ${pick.candidates} formulary drugs)`}
            </Text>
            <DrugSearchSelect
              label={`Drug for ${pick.medicine.name}`}
              value=""
              onChange={(_id, drug) => drug && onPick(pick.index, drug)}
            />
          </Stack>
        ))}
      </Stack>
    </Alert>
  );
}
