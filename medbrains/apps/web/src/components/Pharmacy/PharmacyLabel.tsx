import { useMemo } from "react";
import { Button, Group, Stack, Text } from "@mantine/core";
import { IconPrinter } from "@tabler/icons-react";
import type { FoodTiming, PrescriptionItem, TimeOfDay } from "@medbrains/types";
import {
  parseInstructions,
  frequencyToDefaultSlots,
  foodTimingLabel,
} from "../../lib/medication-timing-utils";
import classes from "./pharmacy-dispensing.module.scss";

interface PharmacyLabelProps {
  items: PrescriptionItem[];
  patientName: string;
  uhid: string;
  date?: string;
}

interface LabelData {
  drug_name: string;
  dosage: string;
  route: string | null;
  frequency: string;
  duration: string;
  time_slots: TimeOfDay[];
  food_timing?: FoodTiming;
  custom_instruction?: string;
}

const ALL_SLOTS: Array<{ slot: TimeOfDay; abbrev: string }> = [
  { slot: "morning", abbrev: "AM" },
  { slot: "afternoon", abbrev: "AF" },
  { slot: "evening", abbrev: "PM" },
  { slot: "bedtime", abbrev: "HS" },
];

export function PharmacyLabel({ items, patientName, uhid, date }: PharmacyLabelProps) {
  const labels = useMemo<LabelData[]>(() => {
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
        time_slots: timeSlots,
        food_timing: foodTiming,
        custom_instruction: customInstruction,
      };
    });
  }, [items]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Stack gap="sm">
      <Group justify="flex-end" className="no-print">
        <Button size="xs" variant="light" leftSection={<IconPrinter size={14} />} onClick={handlePrint}>
          Print Labels
        </Button>
      </Group>

      <div className={classes.labelGrid}>
        {labels.map((label, idx) => (
          <div key={idx} className={classes.labelCard}>
            {/* Drug name — large and bold */}
            <div className={classes.labelDrugName}>{label.drug_name}</div>

            {/* Dosage + route + frequency */}
            <div className={classes.labelDosage}>
              {label.dosage}
              {label.route && ` · ${label.route}`}
              {` · ${label.frequency}`}
              {` · ${label.duration}`}
            </div>

            {/* Timing strip — visual dots */}
            <div className={classes.timingStrip}>
              {ALL_SLOTS.map(({ slot, abbrev }) => {
                const active = label.time_slots.includes(slot);
                return (
                  <div
                    key={slot}
                    className={`${classes.timingDot} ${active ? classes.active : classes.inactive}`}
                  >
                    {abbrev}
                  </div>
                );
              })}
            </div>

            {/* Food instruction */}
            {label.food_timing && label.food_timing !== "any" && (
              <div className={classes.labelFoodInstruction}>
                {foodTimingLabel(label.food_timing)}
              </div>
            )}

            {/* Custom instruction */}
            {label.custom_instruction && (
              <Text size="xs" c="dimmed" fs="italic">{label.custom_instruction}</Text>
            )}

            {/* Patient info */}
            <div className={classes.labelPatient}>
              {patientName} · {uhid}
              {date && ` · ${date}`}
            </div>
          </div>
        ))}
      </div>
    </Stack>
  );
}
