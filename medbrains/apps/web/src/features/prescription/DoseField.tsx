import { Chip, Group, Stack } from "@mantine/core";
import { useMemo } from "react";
import { NumberField } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import classes from "./prescription.module.scss";

/** Common dose units, grouped so liquids / counts / topicals are all reachable. */
const DOSE_UNITS = [
  "mg",
  "mcg",
  "g",
  "ml",
  "tablet",
  "capsule",
  "drop",
  "puff",
  "spray",
  "sachet",
  "IU",
  "unit",
  "tsp",
  "%",
  "application",
];

interface ParsedDose {
  amount: string;
  unit: string;
}

/** Split "500 mg" → { amount: "500", unit: "mg" }; "1 tablet" → { "1", "tablet" }. */
function parseDose(value: string): ParsedDose {
  const m = value.trim().match(/^([\d.]+)\s*(.*)$/);
  if (m) return { amount: m[1] ?? "", unit: (m[2] ?? "").trim() };
  return { amount: "", unit: value.trim() };
}

function composeDose(amount: string, unit: string): string {
  const a = amount.trim();
  const u = unit.trim();
  if (a && u) return `${a} ${u}`;
  return a || u;
}

interface Props {
  /** Current dose string e.g. "10 ml" / "500 mg" / "1 tablet". */
  value: string;
  /** Catalog strengths for this drug → quick-pick chips. */
  strengths: string[];
  onChange: (value: string) => void;
  /** Compact inline mode — amount + unit only, no label or chips (for table rows). */
  compact?: boolean;
}

/**
 * Intelligent dose entry — numeric amount stepper + unit picker, with the
 * catalog's known strengths offered as quick-pick chips. Composes a clean
 * `"<amount> <unit>"` string so liquids, counts, drops, puffs etc. are all
 * expressible without free-typing. Replaces a raw text field.
 */
export function DoseField({ value, strengths, onChange, compact = false }: Props) {
  const { amount, unit } = useMemo(() => parseDose(value), [value]);

  // Unit options = standard list ∪ any unit already in use / from the catalog.
  const unitData = useMemo(() => {
    const extra = [unit, ...strengths.map((s) => parseDose(s).unit)].filter(Boolean);
    return Array.from(new Set([...DOSE_UNITS, ...extra]));
  }, [unit, strengths]);

  const inputs = (
    <Group gap="xs" wrap="nowrap" className={classes.doseField}>
      <NumberField
        aria-label="Dose amount"
        value={amount === "" ? "" : Number(amount)}
        min={0}
        step={amount && Number(amount) < 1 ? 0.25 : 1}
        decimalScale={3}
        onChange={(v) => onChange(composeDose(v === "" ? "" : String(v), unit))}
        w={compact ? 72 : 110}
        size={compact ? "xs" : "sm"}
      />
      <Select
        aria-label="Dose unit"
        value={unit || null}
        data={unitData}
        searchable
        onChange={(v) => onChange(composeDose(amount, v ?? ""))}
        allowDeselect={false}
        w={compact ? 96 : 140}
        size={compact ? "xs" : "sm"}
      />
    </Group>
  );

  if (compact) return inputs;

  return (
    <Stack gap={6} className={classes.fg}>
      <span className={classes.fgLbl}>Dose</span>
      {strengths.length > 0 && (
        <Group gap="xs" className={classes.chipRow}>
          {strengths.map((s) => (
            <Chip
              key={s}
              checked={s === value}
              onChange={() => onChange(s)}
              variant="outline"
              size="xs"
              classNames={{ label: classes.chip }}
            >
              {s}
            </Chip>
          ))}
        </Group>
      )}
      {inputs}
    </Stack>
  );
}
