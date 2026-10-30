/** One tooth's six sites, mobility and furcation, for a periodontal chart. */
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { PerioTooth } from "@medbrains/types";
import { useState } from "react";
import { Button, Checkbox, NumberField, Select, Switch } from "@/components/ui";

export const SITES = ["DB", "B", "MB", "DL", "L", "ML"] as const;
const SITE_NAMES: Record<(typeof SITES)[number], string> = {
  DB: "distobuccal",
  B: "buccal",
  MB: "mesiobuccal",
  DL: "distolingual",
  L: "lingual",
  ML: "mesiolingual",
};
const GRADES = ["0", "1", "2", "3"].map((g) => ({ value: g, label: g }));

/** Permanent molars, upper first premolars and deciduous molars have furcations. */
export function isMultiRooted(tooth: string): boolean {
  const [q, t] = [Number(tooth[0]), Number(tooth[1])];
  if (q >= 1 && q <= 4) return t >= 6 || ((q === 1 || q === 2) && t === 4);
  return q >= 5 && q <= 8 && t >= 4;
}

export const blankTooth = (tooth: string): PerioTooth => ({
  tooth,
  missing: false,
  probing: Array(6).fill(null),
  recession: Array(6).fill(null),
  bleeding: Array(6).fill(false),
  mobility: null,
  furcation: null,
});

interface PerioToothFormProps {
  tooth: string;
  initial?: PerioTooth;
  onSave: (entry: PerioTooth) => void;
  onRemove: () => void;
}

export function PerioToothForm({ tooth, initial, onSave, onRemove }: PerioToothFormProps) {
  const [entry, setEntry] = useState<PerioTooth>(initial ?? blankTooth(tooth));
  const setAt = (field: "probing" | "recession", i: number, v: number | string) =>
    setEntry((e) => {
      const next = [...e[field]];
      next[i] = typeof v === "number" ? v : null;
      return { ...e, [field]: next };
    });
  const side = (from: number, title: string) => (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        {title}
      </Text>
      <SimpleGrid cols={3} spacing="xs">
        {SITES.slice(from, from + 3).map((site, k) => {
          const i = from + k;
          return (
            <Stack key={site} gap={4}>
              <NumberField
                label={`Probing, ${SITE_NAMES[site]} (mm)`}
                min={0}
                max={15}
                allowDecimal={false}
                value={entry.probing[i] ?? ""}
                onChange={(v) => setAt("probing", i, v)}
                disabled={entry.missing}
              />
              <NumberField
                label={`Recession, ${SITE_NAMES[site]} (mm)`}
                min={-5}
                max={15}
                allowDecimal={false}
                value={entry.recession[i] ?? ""}
                onChange={(v) => setAt("recession", i, v)}
                disabled={entry.missing}
              />
              <Checkbox
                label={`Bleeding, ${SITE_NAMES[site]}`}
                checked={entry.bleeding[i] ?? false}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setEntry((x) => {
                    const b = [...x.bleeding];
                    b[i] = checked;
                    return { ...x, bleeding: b };
                  });
                }}
                disabled={entry.missing}
              />
            </Stack>
          );
        })}
      </SimpleGrid>
    </Stack>
  );

  return (
    <Stack gap="sm" data-testid="perio-tooth-form">
      <Group justify="space-between">
        <Text fw={600}>Tooth {tooth}</Text>
        <Switch
          label="Missing"
          checked={entry.missing}
          onChange={(e) => {
            const missing = e.currentTarget.checked;
            setEntry((x) => ({ ...x, missing }));
          }}
        />
      </Group>
      {side(0, "Buccal / labial")}
      {side(3, "Lingual / palatal")}
      <Group grow>
        <Select
          label="Mobility (Miller)"
          data={GRADES}
          value={entry.mobility === null ? null : String(entry.mobility)}
          onChange={(v) => setEntry((x) => ({ ...x, mobility: v === null ? null : Number(v) }))}
          clearable
          disabled={entry.missing}
        />
        {isMultiRooted(tooth) && (
          <Select
            label="Furcation (grade)"
            data={GRADES}
            value={entry.furcation === null ? null : String(entry.furcation)}
            onChange={(v) => setEntry((x) => ({ ...x, furcation: v === null ? null : Number(v) }))}
            clearable
            disabled={entry.missing}
          />
        )}
      </Group>
      <Group justify="flex-end">
        {initial && (
          <Button tone="ghost" onClick={onRemove}>
            Remove tooth
          </Button>
        )}
        <Button tone="secondary" onClick={() => onSave(entry)}>
          Add to chart
        </Button>
      </Group>
    </Stack>
  );
}
