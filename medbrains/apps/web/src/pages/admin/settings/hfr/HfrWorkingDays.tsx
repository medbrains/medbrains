/**
 * Working days and opening hours (HFR-020/021): days from HFR's
 * `WORKING-DAYS` list, and for each chosen day a From and a To time or
 * "open 24×7". Hours exist only for a chosen day.
 */

import { Group, Stack, Text } from "@mantine/core";
import type { UseFormReturn } from "react-hook-form";
import { MultiSelect, Select, Switch } from "@/components/ui";
import type { BasicForm, DayHours } from "./hfrRules";
import { useHfrMaster } from "./useHfrMaster";

/** Half-hour times as HFR writes them: `12:00 AM` … `11:30 PM`. */
const TIMES: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const half = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${i % 2 === 0 ? "00" : "30"} ${half}`;
});

interface HfrWorkingDaysProps {
  form: UseFormReturn<BasicForm>;
}

/** The day picker and one hours row per chosen day. */
export function HfrWorkingDays({ form }: HfrWorkingDaysProps) {
  const { watch, setValue, formState } = form;
  const days = watch("days");
  const status = watch("operationalStatus");
  const master = useHfrMaster("data", "WORKING-DAYS");
  const labelOf = (code: string) => master.data.find((d) => d.value === code)?.label ?? code;

  /** Keep the hours of days still chosen; a new day starts with none. */
  const chooseDays = (codes: string[]) => {
    const next: DayHours[] = codes.map(
      (code) => days.find((d) => d.day === code) ?? { day: code, from: "", to: "", allDay: false },
    );
    setValue("days", next, { shouldValidate: formState.isSubmitted });
  };
  const update = (index: number, patch: Partial<DayHours>) => {
    const next = days.map((d, i) => (i === index ? { ...d, ...patch } : d));
    setValue("days", next, { shouldValidate: formState.isSubmitted });
  };
  const dayErrors = formState.errors.days;

  return (
    <Stack gap="sm">
      <Text fw={600}>Working days and hours</Text>
      <MultiSelect
        label="Working days"
        withAsterisk={status === "F"}
        data={master.data}
        value={days.map((d) => d.day)}
        onChange={chooseDays}
        error={dayErrors?.message ?? dayErrors?.root?.message ?? master.error}
      />
      {days.map((d, i) => (
        <Group key={d.day} align="flex-end">
          <Text size="sm" w={120}>
            {labelOf(d.day)}
          </Text>
          <Select
            label="From"
            data={TIMES}
            searchable
            disabled={d.allDay}
            value={d.from || null}
            onChange={(v) => update(i, { from: v ?? "" })}
          />
          <Select
            label="To"
            data={TIMES}
            searchable
            disabled={d.allDay}
            value={d.to || null}
            onChange={(v) => update(i, { to: v ?? "" })}
            error={dayErrors?.[i]?.message}
          />
          <Switch
            label="Open 24×7"
            checked={d.allDay}
            onChange={(e) => update(i, { allDay: e.currentTarget.checked })}
          />
        </Group>
      ))}
    </Stack>
  );
}
