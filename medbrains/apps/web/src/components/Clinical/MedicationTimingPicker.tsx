import { useEffect } from "react";
import {
  Chip,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconMoon,
  IconSun,
  IconSunrise,
  IconSunset,
  IconToolsKitchen2,
  IconCoffee,
  IconArrowUp,
  IconArrowDown,
  IconMinus,
} from "@tabler/icons-react";
import type { FoodTiming, TimeOfDay } from "@medbrains/types";
import { frequencyToDefaultSlots } from "../../lib/medication-timing-utils";
import classes from "./medication-timing.module.scss";

interface MedicationTimingPickerProps {
  foodTiming: FoodTiming;
  onFoodTimingChange: (ft: FoodTiming) => void;
  timeSlots: TimeOfDay[];
  onTimeSlotsChange: (slots: TimeOfDay[]) => void;
  customInstruction: string;
  onCustomInstructionChange: (val: string) => void;
  frequency?: string;
}

const FOOD_OPTIONS: Array<{ value: FoodTiming; label: string; icon: React.ReactNode }> = [
  { value: "empty_stomach", label: "Empty stomach", icon: <IconSunrise size={14} /> },
  { value: "before_food", label: "Before food", icon: <IconArrowUp size={14} /> },
  { value: "with_food", label: "With food", icon: <IconToolsKitchen2 size={14} /> },
  { value: "after_food", label: "After food", icon: <IconArrowDown size={14} /> },
  { value: "any", label: "Any time", icon: <IconMinus size={14} /> },
];

const TIME_CHIPS: Array<{ value: TimeOfDay; label: string; icon: React.ReactNode; hint: string }> = [
  { value: "morning", label: "Morning", icon: <IconCoffee size={14} />, hint: "6–8 AM" },
  { value: "afternoon", label: "Afternoon", icon: <IconSun size={14} />, hint: "12–2 PM" },
  { value: "evening", label: "Evening", icon: <IconSunset size={14} />, hint: "6–8 PM" },
  { value: "bedtime", label: "Bedtime", icon: <IconMoon size={14} />, hint: "9–10 PM" },
];

export function MedicationTimingPicker({
  foodTiming,
  onFoodTimingChange,
  timeSlots,
  onTimeSlotsChange,
  customInstruction,
  onCustomInstructionChange,
  frequency,
}: MedicationTimingPickerProps) {
  // Auto-suggest time slots from frequency (only on frequency change, not on mount if slots exist)
  useEffect(() => {
    if (!frequency) return;
    const suggested = frequencyToDefaultSlots(frequency);
    if (suggested.length > 0) {
      onTimeSlotsChange(suggested);
    }
  }, [frequency]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={classes.timingPicker}>
      <Stack gap="xs">
        {/* Food timing */}
        <div>
          <Text size="xs" fw={600} c="dimmed" mb={4} className={classes.sectionLabel}>
            Food Timing
          </Text>
          <SegmentedControl
            size="xs"
            value={foodTiming}
            onChange={(val) => onFoodTimingChange(val as FoodTiming)}
            data={FOOD_OPTIONS.map((opt) => ({
              value: opt.value,
              label: (
                <Group gap={4} wrap="nowrap" justify="center">
                  {opt.icon}
                  <span>{opt.label}</span>
                </Group>
              ),
            }))}
            fullWidth
            className={classes.foodControl}
          />
        </div>

        {/* Time of day */}
        <div>
          <Text size="xs" fw={600} c="dimmed" mb={4} className={classes.sectionLabel}>
            Time of Day
          </Text>
          <Chip.Group
            multiple
            value={timeSlots}
            onChange={(vals) => onTimeSlotsChange(vals as TimeOfDay[])}
          >
            <Group gap="xs">
              {TIME_CHIPS.map((chip) => (
                <Chip
                  key={chip.value}
                  value={chip.value}
                  size="xs"
                  variant="light"
                  className={classes.timeChip}
                >
                  <Group gap={4} wrap="nowrap">
                    {chip.icon}
                    <span>{chip.label}</span>
                    <Text span size="10px" c="dimmed">
                      {chip.hint}
                    </Text>
                  </Group>
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </div>

        {/* Custom instruction */}
        <TextInput
          size="xs"
          placeholder="Additional instructions (e.g., 'Take with warm water', 'Avoid dairy')"
          value={customInstruction}
          onChange={(e) => onCustomInstructionChange(e.currentTarget.value)}
          className={classes.customInput}
        />
      </Stack>
    </div>
  );
}
