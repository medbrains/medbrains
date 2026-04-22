import { useMemo } from "react";
import { Badge, Card, Group, Paper, Stack, Text } from "@mantine/core";
import {
  IconCoffee,
  IconMoon,
  IconSun,
  IconSunset,
  IconAlertCircle,
  IconToolsKitchen2,
  IconArrowUp,
  IconArrowDown,
  IconSunrise,
} from "@tabler/icons-react";
import type { FoodTiming, PrescriptionItem, TimeOfDay } from "@medbrains/types";
import {
  parseInstructions,
  frequencyToDefaultSlots,
  foodTimingLabel,
  ROUTE_COLORS,
} from "../../lib/medication-timing-utils";
import classes from "./pharmacy-dispensing.module.scss";

interface PharmacyDispensingViewProps {
  items: PrescriptionItem[];
  patientName?: string;
  uhid?: string;
}

interface GroupedDrug {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string | null;
  food_timing?: FoodTiming;
  custom_instruction?: string;
}

const TIME_GROUPS: Array<{ slot: TimeOfDay; label: string; icon: React.ReactNode; hint: string }> = [
  { slot: "morning", label: "Morning Medications", icon: <IconCoffee size={18} />, hint: "6–8 AM" },
  { slot: "afternoon", label: "Afternoon Medications", icon: <IconSun size={18} />, hint: "12–2 PM" },
  { slot: "evening", label: "Evening Medications", icon: <IconSunset size={18} />, hint: "6–8 PM" },
  { slot: "bedtime", label: "Bedtime Medications", icon: <IconMoon size={18} />, hint: "9–10 PM" },
];

const FOOD_ICONS: Record<string, React.ReactNode> = {
  before_food: <IconArrowUp size={12} />,
  with_food: <IconToolsKitchen2 size={12} />,
  after_food: <IconArrowDown size={12} />,
  empty_stomach: <IconSunrise size={12} />,
};

export function PharmacyDispensingView({ items, patientName, uhid }: PharmacyDispensingViewProps) {
  const grouped = useMemo(() => {
    const timeGroups = new Map<TimeOfDay, GroupedDrug[]>();
    const prnDrugs: GroupedDrug[] = [];
    for (const grp of TIME_GROUPS) timeGroups.set(grp.slot, []);

    for (const item of items) {
      const parsed = parseInstructions(item.instructions);
      let slots: TimeOfDay[];
      let foodTiming: FoodTiming | undefined;
      let customInstruction: string | undefined;

      if (parsed && !("text" in parsed)) {
        slots = parsed.time_slots?.length ? parsed.time_slots : frequencyToDefaultSlots(item.frequency);
        foodTiming = parsed.food_timing;
        customInstruction = parsed.custom_instruction;
      } else {
        slots = frequencyToDefaultSlots(item.frequency);
      }

      const drug: GroupedDrug = {
        drug_name: item.drug_name,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        route: item.route,
        food_timing: foodTiming,
        custom_instruction: customInstruction,
      };

      if (slots.length === 0) {
        prnDrugs.push(drug);
      } else {
        for (const slot of slots) {
          timeGroups.get(slot)?.push(drug);
        }
      }
    }

    return { timeGroups, prnDrugs };
  }, [items]);

  return (
    <Stack gap="sm">
      {patientName && (
        <Group gap="xs">
          <Text fw={600}>{patientName}</Text>
          {uhid && <Badge variant="light" color="slate" size="sm">{uhid}</Badge>}
        </Group>
      )}

      {TIME_GROUPS.map(({ slot, label, icon, hint }) => {
        const drugs = grouped.timeGroups.get(slot) ?? [];
        if (drugs.length === 0) return null;

        return (
          <Card key={slot} padding="sm" radius="md" withBorder className={classes.timeGroupCard}>
            <Group gap="xs" mb="xs">
              {icon}
              <div>
                <Text fw={600} size="sm">{label}</Text>
                <Text size="xs" c="dimmed">{hint}</Text>
              </div>
              <Badge size="sm" variant="light" ml="auto">{drugs.length} med{drugs.length > 1 ? "s" : ""}</Badge>
            </Group>

            <Stack gap={4}>
              {drugs.map((drug, idx) => (
                <DrugRow key={idx} drug={drug} />
              ))}
            </Stack>
          </Card>
        );
      })}

      {grouped.prnDrugs.length > 0 && (
        <Card padding="sm" radius="md" withBorder className={classes.timeGroupCard}>
          <Group gap="xs" mb="xs">
            <IconAlertCircle size={18} />
            <div>
              <Text fw={600} size="sm">As Needed (PRN / SOS / STAT)</Text>
              <Text size="xs" c="dimmed">Take only when required</Text>
            </div>
            <Badge size="sm" variant="light" color="warning" ml="auto">{grouped.prnDrugs.length}</Badge>
          </Group>
          <Stack gap={4}>
            {grouped.prnDrugs.map((drug, idx) => (
              <DrugRow key={idx} drug={drug} />
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

function DrugRow({ drug }: { drug: GroupedDrug }) {
  const routeColor = drug.route ? ROUTE_COLORS[drug.route] ?? "slate" : "primary";
  const foodIcon = drug.food_timing ? FOOD_ICONS[drug.food_timing] : null;
  const foodLabel = drug.food_timing ? foodTimingLabel(drug.food_timing, true) : null;

  return (
    <Paper className={classes.drugRow} style={{ borderLeft: `3px solid var(--mantine-color-${routeColor}-5)` }}>
      <Group justify="space-between" wrap="nowrap">
        <div style={{ flex: 1 }}>
          <Text fw={600} size="sm">{drug.drug_name}</Text>
          <Group gap={8}>
            <Text size="xs" c="dimmed">{drug.dosage}</Text>
            {drug.route && <Badge size="xs" variant="light" color={routeColor}>{drug.route}</Badge>}
            <Badge size="xs" variant="light">{drug.frequency}</Badge>
            <Text size="xs" c="dimmed">{drug.duration}</Text>
          </Group>
        </div>
        <div style={{ textAlign: "right" }}>
          {foodLabel && (
            <Group gap={4} justify="flex-end">
              {foodIcon}
              <Text size="xs" fw={500}>{foodLabel}</Text>
            </Group>
          )}
          {drug.custom_instruction && (
            <Text size="xs" c="dimmed" fs="italic">{drug.custom_instruction}</Text>
          )}
        </div>
      </Group>
    </Paper>
  );
}
