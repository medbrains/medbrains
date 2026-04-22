import { useMemo } from "react";
import { Badge, Card, Group, Text, Title, Tooltip } from "@mantine/core";
import {
  IconCoffee,
  IconMoon,
  IconPill,
  IconSun,
  IconSunset,
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
import classes from "./medication-timing.module.scss";

interface MedicationScheduleCardProps {
  items: PrescriptionItem[];
  compact?: boolean;
  title?: string;
}

/** Parsed row for the schedule table */
interface DrugRow {
  drug_name: string;
  dosage: string;
  route: string | null;
  frequency: string;
  duration: string;
  food_timing?: FoodTiming;
  custom_instruction?: string;
  slots: Set<TimeOfDay>;
}

const TIME_SLOTS: Array<{ slot: TimeOfDay; label: string; icon: React.ReactNode; hour: string }> = [
  { slot: "morning", label: "Morning", icon: <IconCoffee size={14} />, hour: "8 AM" },
  { slot: "afternoon", label: "Afternoon", icon: <IconSun size={14} />, hour: "2 PM" },
  { slot: "evening", label: "Evening", icon: <IconSunset size={14} />, hour: "6 PM" },
  { slot: "bedtime", label: "Bedtime", icon: <IconMoon size={14} />, hour: "10 PM" },
];

const FOOD_ICONS: Record<string, React.ReactNode> = {
  before_food: <IconArrowUp size={12} />,
  with_food: <IconToolsKitchen2 size={12} />,
  after_food: <IconArrowDown size={12} />,
  empty_stomach: <IconSunrise size={12} />,
};

export function MedicationScheduleCard({ items, compact, title }: MedicationScheduleCardProps) {
  const rows = useMemo<DrugRow[]>(() => {
    return items.map((item) => {
      const parsed = parseInstructions(item.instructions);
      let timeSlots: TimeOfDay[];
      let foodTiming: FoodTiming | undefined;
      let customInstruction: string | undefined;

      if (parsed && !("text" in parsed)) {
        timeSlots = parsed.time_slots?.length ? parsed.time_slots : frequencyToDefaultSlots(item.frequency);
        foodTiming = parsed.food_timing;
        customInstruction = parsed.custom_instruction;
      } else {
        timeSlots = frequencyToDefaultSlots(item.frequency);
      }

      return {
        drug_name: item.drug_name,
        dosage: item.dosage,
        route: item.route,
        frequency: item.frequency,
        duration: item.duration,
        food_timing: foodTiming,
        custom_instruction: customInstruction,
        slots: new Set(timeSlots),
      };
    });
  }, [items]);

  if (items.length === 0) return null;

  // Count total pills per time slot
  const slotCounts = TIME_SLOTS.map(({ slot }) => ({
    slot,
    count: rows.filter((r) => r.slots.has(slot)).length,
  }));

  return (
    <Card padding={compact ? "xs" : "md"} radius="md" withBorder>
      <Title order={compact ? 5 : 4} mb="sm">{title ?? "Medication Schedule"}</Title>

      {/* Summary strip — how many pills per time */}
      <Group gap="md" mb="md" className={classes.summaryStrip}>
        {slotCounts.map(({ slot, count }) => {
          const meta = TIME_SLOTS.find((t) => t.slot === slot);
          if (!meta) return null;
          return (
            <div key={slot} className={`${classes.summaryPill} ${count > 0 ? classes.summaryActive : classes.summaryEmpty}`}>
              <Group gap={4} wrap="nowrap">
                {meta.icon}
                <div>
                  <Text size="xs" fw={600}>{meta.label}</Text>
                  <Text size="10px" c="dimmed">{meta.hour}</Text>
                </div>
              </Group>
              <Text fw={700} size={compact ? "md" : "lg"} className={classes.pillCount}>
                {count > 0 ? count : "—"}
              </Text>
              {count > 0 && (
                <Text size="10px" c="dimmed">{count === 1 ? "med" : "meds"}</Text>
              )}
            </div>
          );
        })}
      </Group>

      {/* Drug rows — each drug shows which time slots it belongs to */}
      <div className={classes.drugTable}>
        {/* Header */}
        <div className={classes.drugTableHeader}>
          <div className={classes.drugInfoCol}>
            <Text size="10px" fw={600} c="dimmed" tt="uppercase">Medication</Text>
          </div>
          {TIME_SLOTS.map(({ slot, icon, label }) => (
            <div key={slot} className={classes.slotCol}>
              <Tooltip label={label}>
                <span>{icon}</span>
              </Tooltip>
            </div>
          ))}
          <div className={classes.foodCol}>
            <Text size="10px" fw={600} c="dimmed" tt="uppercase">Instructions</Text>
          </div>
        </div>

        {/* Rows */}
        {rows.map((drug, idx) => {
          const routeColor = drug.route ? ROUTE_COLORS[drug.route] ?? "slate" : "primary";
          const foodIcon = drug.food_timing ? FOOD_ICONS[drug.food_timing] : null;
          const foodLabel = drug.food_timing && drug.food_timing !== "any"
            ? foodTimingLabel(drug.food_timing, true)
            : null;

          return (
            <div key={idx} className={classes.drugTableRow}>
              {/* Drug info */}
              <div className={classes.drugInfoCol}>
                <Group gap={6} wrap="nowrap">
                  <div
                    className={classes.routeDot}
                    style={{ background: `var(--mantine-color-${routeColor}-5)` }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} lineClamp={1}>{drug.drug_name}</Text>
                    <Group gap={4}>
                      <Text size="xs" c="dimmed">{drug.dosage}</Text>
                      {drug.route && <Badge size="xs" variant="light" color={routeColor}>{drug.route}</Badge>}
                      <Text size="xs" c="dimmed">· {drug.duration}</Text>
                    </Group>
                  </div>
                </Group>
              </div>

              {/* Time slot indicators */}
              {TIME_SLOTS.map(({ slot }) => (
                <div key={slot} className={classes.slotCol}>
                  {drug.slots.has(slot) ? (
                    <Tooltip label={`Take ${drug.dosage} in the ${slot}`}>
                      <div className={classes.pillDot}>
                        <IconPill size={14} />
                      </div>
                    </Tooltip>
                  ) : (
                    <div className={classes.emptyDot} />
                  )}
                </div>
              ))}

              {/* Food/instructions */}
              <div className={classes.foodCol}>
                {foodLabel && (
                  <Group gap={4} wrap="nowrap">
                    {foodIcon}
                    <Text size="xs" c="dimmed">{foodLabel}</Text>
                  </Group>
                )}
                {drug.custom_instruction && (
                  <Text size="10px" c="dimmed" fs="italic" lineClamp={1}>{drug.custom_instruction}</Text>
                )}
                {!foodLabel && !drug.custom_instruction && (
                  <Text size="xs" c="dimmed">—</Text>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total count footer */}
      <Group justify="space-between" mt="sm">
        <Text size="xs" c="dimmed">{items.length} medication{items.length !== 1 ? "s" : ""} total</Text>
        <Group gap="xs">
          {items.some((i) => i.route === "IV") && <Badge size="xs" color="danger" variant="light">IV</Badge>}
          {items.some((i) => i.route === "Oral") && <Badge size="xs" color="primary" variant="light">Oral</Badge>}
          {items.some((i) => i.route === "Topical") && <Badge size="xs" color="teal" variant="light">Topical</Badge>}
        </Group>
      </Group>
    </Card>
  );
}
