import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Card,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import type { PrescriptionItem, TimeOfDay } from "@medbrains/types";
import {
  frequencyToDefaultSlots,
  instructionsDisplayText,
  parseInstructions,
  foodTimingLabel,
} from "../../lib/medication-timing-utils";

// ── Shared types & helpers ─────────────────────────────────────

export interface FlatItem extends PrescriptionItem {
  rxDate: string;
  rxIndex: number;
}

const FREQ_LABEL: Record<string, string> = {
  OD: "1x/day", BD: "2x/day", TDS: "3x/day", QID: "4x/day",
  SOS: "PRN", PRN: "PRN", HS: "Bedtime", STAT: "Once",
};

const FREQ_DOSES_PER_DAY: Record<string, number> = {
  OD: 1, BD: 2, TDS: 3, QID: 4, HS: 1, STAT: 1, SOS: 0, PRN: 0,
};

const TIMELINE_HOURS: Array<{ hour: number; label: string; slot: TimeOfDay | null }> = [
  { hour: 6, label: "06", slot: null },
  { hour: 8, label: "08", slot: "morning" },
  { hour: 10, label: "10", slot: null },
  { hour: 12, label: "12", slot: null },
  { hour: 14, label: "14", slot: "afternoon" },
  { hour: 16, label: "16", slot: null },
  { hour: 18, label: "18", slot: "evening" },
  { hour: 20, label: "20", slot: null },
  { hour: 22, label: "22", slot: "bedtime" },
];

function matchesAllergy(drugName: string, allergies: string[]): string | undefined {
  const lower = drugName.toLowerCase();
  return allergies.find((a) => lower.includes(a.toLowerCase()));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function parseDosageNumeric(dosage: string): number | null {
  const m = dosage.match(/(\d+(?:\.\d+)?)/);
  return m?.[1] ? Number.parseFloat(m[1]) : null;
}

function timingLabel(item: PrescriptionItem): string {
  const parsed = parseInstructions(item.instructions);
  if (!parsed) return "Any time";
  if ("text" in parsed) return parsed.text;
  const parts: string[] = [];
  if (parsed.time_slots?.length) {
    const labels: Record<string, string> = {
      morning: "Morning", afternoon: "Afternoon", evening: "Evening", bedtime: "Bedtime",
    };
    parts.push(parsed.time_slots.map((s) => labels[s] ?? s).join(", "));
  }
  if (parsed.food_timing && parsed.food_timing !== "any") {
    parts.push(foodTimingLabel(parsed.food_timing, true));
  }
  return parts.join(" -- ") || "Any time";
}

// ── A. Prose View ──────────────────────────────────────────────

export function ProseView({
  items, allergies, doctorName,
}: {
  items: FlatItem[]; allergies: string[]; doctorName?: string;
}) {
  const grouped = useMemo(() => {
    const map = new Map<number, { date: string; entries: FlatItem[] }>();
    for (const item of items) {
      const existing = map.get(item.rxIndex);
      if (existing) { existing.entries.push(item); }
      else { map.set(item.rxIndex, { date: item.rxDate, entries: [item] }); }
    }
    return Array.from(map.values());
  }, [items]);

  return (
    <Stack gap="xs">
      {grouped.map((rx, gi) => (
        <Card key={gi} padding="sm" radius="md" withBorder>
          <Group gap={6} mb="xs">
            <Text size="xs" ff="var(--fc-font-mono, monospace)" c="dimmed">Rx {gi + 1}</Text>
            <Text size="xs" c="dimmed">{formatDate(rx.date)}</Text>
            {doctorName && <Text size="xs" c="dimmed" fs="italic">-- Dr. {doctorName}</Text>}
          </Group>
          <Stack gap={4}>
            {rx.entries.map((item, idx) => {
              const allergyMatch = matchesAllergy(item.drug_name, allergies);
              const timing = instructionsDisplayText(item.instructions);
              return (
                <Group key={item.id} gap={6} wrap="nowrap" align="baseline">
                  <Text size="xs" ff="var(--fc-font-mono, monospace)" c="dimmed" w={20} ta="right">
                    {String(idx + 1).padStart(2, "0")}
                  </Text>
                  <Text size="sm" fw={500}>{item.drug_name}</Text>
                  <Text size="sm" c="var(--mantine-color-primary-5)">{item.dosage}</Text>
                  <Badge size="xs" variant="light" color="gray" ff="var(--fc-font-mono, monospace)">
                    {FREQ_LABEL[item.frequency.toUpperCase()] ?? item.frequency}
                  </Badge>
                  <Text size="xs" c="dimmed">x {item.duration}</Text>
                  {timing && <Text size="xs" c="dimmed" fs="italic">{timing}</Text>}
                  {allergyMatch && (
                    <Badge size="xs" color="var(--fc-copper, #B8924A)" variant="filled">
                      Allergy: {allergyMatch}
                    </Badge>
                  )}
                </Group>
              );
            })}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

// ── B. Timeline View ───────────────────────────────────────────

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0} align="center">
      <Text size="xs" ff="var(--fc-font-mono, monospace)" c="dimmed" tt="uppercase">{label}</Text>
      <Text size="lg" fw={600} ff="var(--fc-font-display, serif)">{value}</Text>
    </Stack>
  );
}

export function TimelineView({ items }: { items: FlatItem[] }) {
  const drugSlots = useMemo(() => {
    return items.map((item) => ({ item, slots: frequencyToDefaultSlots(item.frequency) }));
  }, [items]);

  const summary = useMemo(() => {
    let totalDoses = 0;
    let earliest: number | null = null;
    let latest: number | null = null;
    for (const { slots } of drugSlots) {
      totalDoses += slots.length;
      for (const slot of slots) {
        const th = TIMELINE_HOURS.find((h) => h.slot === slot);
        if (th) {
          if (earliest === null || th.hour < earliest) earliest = th.hour;
          if (latest === null || th.hour > latest) latest = th.hour;
        }
      }
    }
    return {
      totalDrugs: items.length, totalDoses,
      earliest: earliest !== null ? `${String(earliest).padStart(2, "0")}:00` : "--",
      latest: latest !== null ? `${String(latest).padStart(2, "0")}:00` : "--",
    };
  }, [drugSlots, items.length]);

  return (
    <Card padding="sm" radius="md" withBorder>
      <Group gap="lg" mb="sm">
        <SummaryPill label="Drugs" value={String(summary.totalDrugs)} />
        <SummaryPill label="Doses/day" value={String(summary.totalDoses)} />
        <SummaryPill label="Earliest" value={summary.earliest} />
        <SummaryPill label="Latest" value={summary.latest} />
      </Group>
      <Table horizontalSpacing="xs" verticalSpacing={4} withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={140}>Drug</Table.Th>
            {TIMELINE_HOURS.map((h) => (
              <Table.Th key={h.hour} ta="center" w={40}>
                <Text size="xs" ff="var(--fc-font-mono, monospace)">{h.label}</Text>
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {drugSlots.map(({ item, slots }) => (
            <Table.Tr key={item.id}>
              <Table.Td><Text size="xs" fw={500} truncate="end">{item.drug_name}</Text></Table.Td>
              {TIMELINE_HOURS.map((h) => {
                const active = h.slot !== null && slots.includes(h.slot);
                return (
                  <Table.Td key={h.hour} ta="center">
                    {active ? (
                      <Box w={10} h={10} mx="auto" style={{ borderRadius: "50%", backgroundColor: "var(--mantine-color-primary-5)" }} />
                    ) : (
                      <Text size="xs" c="dimmed">--</Text>
                    )}
                  </Table.Td>
                );
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

// ── C. Dose Calculator View ────────────────────────────────────

function DoseCalcCard({ item, weight }: { item: FlatItem; weight?: number }) {
  const doseMg = parseDosageNumeric(item.dosage);
  const dosesPerDay = FREQ_DOSES_PER_DAY[item.frequency.toUpperCase()] ?? 0;
  const calc = useMemo(() => {
    if (!weight || weight <= 0 || !doseMg || dosesPerDay <= 0) return null;
    const totalDaily = doseMg * dosesPerDay;
    return { totalDaily, mgPerKgDay: totalDaily / weight, perDose: doseMg };
  }, [weight, doseMg, dosesPerDay]);

  return (
    <Card padding="sm" radius="md" withBorder>
      <Text size="sm" fw={500} mb={4}>{item.drug_name}</Text>
      <Text size="xs" c="dimmed" mb="xs">
        {item.dosage} -- {FREQ_LABEL[item.frequency.toUpperCase()] ?? item.frequency} -- {item.duration}
      </Text>
      {calc ? (
        <Box p="xs" style={{
          borderRadius: "var(--mantine-radius-sm)",
          backgroundColor: "var(--mantine-color-primary-9, #0d2417)",
          color: "var(--mantine-color-white, #fff)",
          fontFamily: "var(--fc-font-mono, monospace)",
          fontSize: "var(--mantine-font-size-xs)",
          lineHeight: 1.6,
        }}>
          <div>{calc.perDose} mg/dose x {dosesPerDay} doses/day = {calc.totalDaily} mg/day</div>
          <div>{calc.totalDaily} mg/day / {weight} kg = {calc.mgPerKgDay.toFixed(2)} mg/kg/day</div>
        </Box>
      ) : (
        <Text size="xs" c="dimmed" fs="italic">
          {!weight ? "Enter weight to calculate" : "Cannot parse dosage for calculation"}
        </Text>
      )}
    </Card>
  );
}

export function DoseCalculatorView({
  items, patientWeight, patientAge,
}: {
  items: FlatItem[]; patientWeight?: number; patientAge?: string;
}) {
  const [weight, setWeight] = useState<number | undefined>(patientWeight);
  return (
    <Stack gap="sm">
      <Group gap="sm" align="flex-end">
        <NumberInput
          label="Patient weight (kg)" value={weight}
          onChange={(v) => setWeight(typeof v === "number" ? v : undefined)}
          min={0.5} max={300} step={0.5} decimalScale={1} w={160} size="xs"
        />
        {patientAge && <Text size="xs" c="dimmed" pb={4}>Age: {patientAge}</Text>}
      </Group>
      {items.map((item) => <DoseCalcCard key={item.id} item={item} weight={weight} />)}
      {items.length === 0 && <Text size="sm" c="dimmed" ta="center">No items to calculate.</Text>}
    </Stack>
  );
}

// ── D. Rule Cards View ─────────────────────────────────────────

function RuleCard({ item }: { item: FlatItem }) {
  const freqUpper = item.frequency.toUpperCase();
  const isPrn = freqUpper === "SOS" || freqUpper === "PRN";
  const when = timingLabel(item);
  const bandLabelStyle = {
    fontFamily: "var(--fc-font-mono, monospace)",
    fontSize: 10, color: "var(--mantine-color-dimmed)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em", marginBottom: 2,
  };

  return (
    <Card padding={0} radius="md" withBorder>
      <Group gap={0} wrap="nowrap" style={{ overflow: "hidden" }}>
        <Box p="xs" w="33.33%" style={{ borderRight: "1px solid var(--fc-rule, #e7ebe8)", backgroundColor: "var(--fc-panel, #f7f8f6)" }}>
          <div style={bandLabelStyle}>When</div>
          <Text size="xs" fw={500}>{when}</Text>
        </Box>
        <Box p="xs" w="33.33%" style={{ borderRight: "1px solid var(--fc-rule, #e7ebe8)" }}>
          <div style={bandLabelStyle}>Trigger</div>
          <Text size="xs" fw={500}>{isPrn ? "As needed (PRN)" : "Regular schedule"}</Text>
          <Text size="xs" c="dimmed">{item.dosage} -- {FREQ_LABEL[freqUpper] ?? item.frequency}</Text>
        </Box>
        <Box p="xs" w="33.33%">
          <div style={bandLabelStyle}>For</div>
          <Text size="xs" fw={500}>{item.duration}</Text>
          {item.route && <Text size="xs" c="dimmed">via {item.route}</Text>}
        </Box>
      </Group>
      <Box px="xs" py={4} style={{ borderTop: "1px solid var(--fc-rule, #e7ebe8)", backgroundColor: "var(--fc-panel, #f7f8f6)" }}>
        <Text size="sm" fw={600}>{item.drug_name}</Text>
      </Box>
    </Card>
  );
}

export function RuleCardsView({ items }: { items: FlatItem[] }) {
  return (
    <Stack gap="xs">
      {items.map((item) => <RuleCard key={item.id} item={item} />)}
      {items.length === 0 && <Text size="sm" c="dimmed" ta="center">No prescription items.</Text>}
    </Stack>
  );
}
