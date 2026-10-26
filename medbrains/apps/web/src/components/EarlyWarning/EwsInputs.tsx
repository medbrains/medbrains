// The observations an early-warning score needs beyond the classic vitals:
// ACVPU, oxygen, and — for children — capillary refill and respiratory
// distress. Anything left blank makes the score incomplete; it is never
// assumed normal.

import { Group, Stack, Text } from "@mantine/core";
import type {
  Consciousness,
  EwsScoringInputs,
  OxygenDevice,
  RespiratoryDistress,
} from "@medbrains/types";
import { NumberField, SegmentedControl, Select } from "@/components/ui";

const ACVPU: { value: Consciousness; label: string }[] = [
  { value: "A", label: "Alert" },
  { value: "C", label: "New confusion" },
  { value: "V", label: "Voice" },
  { value: "P", label: "Pain" },
  { value: "U", label: "Unresponsive" },
];

const DEVICES: { value: OxygenDevice; label: string }[] = [
  { value: "room_air", label: "Room air" },
  { value: "nasal_prongs", label: "Nasal prongs / cannula" },
  { value: "mask", label: "Mask" },
  { value: "high_flow", label: "High flow" },
  { value: "other", label: "Other support" },
];

const DISTRESS: { value: RespiratoryDistress; label: string }[] = [
  { value: "nil", label: "Nil" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

interface EwsInputsProps {
  value: EwsScoringInputs;
  onChange: (next: EwsScoringInputs) => void;
}

const num = (v: string | number): number | undefined =>
  v === "" || Number.isNaN(Number(v)) ? undefined : Number(v);

export function EwsInputs({ value, onChange }: EwsInputsProps) {
  const set = (patch: Partial<EwsScoringInputs>) => onChange({ ...value, ...patch });
  const onSupport = value.oxygen_device && value.oxygen_device !== "room_air";
  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        For the early-warning score
      </Text>
      <Stack gap={4}>
        <Text size="sm" id="ews-acvpu">
          Consciousness (ACVPU)
        </Text>
        <SegmentedControl
          aria-labelledby="ews-acvpu"
          data={ACVPU}
          value={value.consciousness ?? ""}
          onChange={(v) => set({ consciousness: v as Consciousness })}
          fullWidth
        />
      </Stack>
      <Group grow align="flex-start">
        <Select
          label="Oxygen / respiratory support"
          placeholder="Not charted"
          data={DEVICES}
          value={value.oxygen_device ?? null}
          onChange={(v) =>
            set({
              oxygen_device: (v ?? undefined) as OxygenDevice | undefined,
              oxygen_flow_lpm: undefined,
              fio2_percent: undefined,
            })
          }
          clearable
        />
        {onSupport && value.oxygen_device !== "high_flow" && (
          <NumberField
            label="Flow (L/min)"
            min={0}
            max={80}
            decimalScale={1}
            value={value.oxygen_flow_lpm ?? ""}
            onChange={(v) => set({ oxygen_flow_lpm: num(v) })}
          />
        )}
        {value.oxygen_device === "high_flow" && (
          <NumberField
            label="FiO₂ (%)"
            min={21}
            max={100}
            value={value.fio2_percent ?? ""}
            onChange={(v) => set({ fio2_percent: num(v) })}
          />
        )}
      </Group>
      <Group grow align="flex-start">
        <NumberField
          label="Central capillary refill (s) — children"
          min={0}
          max={20}
          decimalScale={1}
          value={value.capillary_refill_seconds ?? ""}
          onChange={(v) => set({ capillary_refill_seconds: num(v) })}
        />
        <Select
          label="Respiratory distress — children"
          placeholder="Not charted"
          data={DISTRESS}
          value={value.respiratory_distress ?? null}
          onChange={(v) =>
            set({ respiratory_distress: (v ?? undefined) as RespiratoryDistress | undefined })
          }
          clearable
        />
      </Group>
    </Stack>
  );
}
