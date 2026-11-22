import { useLocaleConfig } from "@medbrains/stores";
import type { Vital, VitalHistoryPoint } from "@medbrains/types";
import { Badge } from "@/components/ui";
import { getTemperatureConfig } from "@/lib/vital-units";
import {
  ADULT_VITAL_BANDS,
  bloodPressureGrade,
  gradeLabel,
  gradeTone,
  gradeVital,
  type VitalGrade,
} from "./vitals-thresholds";

type GradedReadings = Pick<
  VitalHistoryPoint | Vital,
  "temperature" | "pulse" | "systolic_bp" | "diastolic_bp" | "spo2" | "respiratory_rate"
>;

interface VitalChipsProps {
  vitals: GradedReadings;
  previous?: GradedReadings;
  size?: "sm" | "md";
}

/** " ↑", " ↓" or " →" against the previous reading; nothing when either is missing. */
function trend(current: unknown, previous: unknown): string {
  const [now, before] = [Number(current), Number(previous)];
  if (!now || !before) return "";
  if (now > before) return " ↑";
  return now < before ? " ↓" : " →";
}

/**
 * A visit's vitals as the doctor sees them: each reading as a chip and, when it
 * is outside normal, its grade in words beside the colour (LOW, CRITICAL
 * HIGH…), graded by the same rule and bands as the entry form.
 */
export function VitalChips({ vitals: v, previous, size = "sm" }: VitalChipsProps) {
  const config = getTemperatureConfig(useLocaleConfig().temperature_unit);
  const temperature = { normal: config.normalRange, borderline: config.borderlineRange };
  const bands = ADULT_VITAL_BANDS;
  const chips: [string, VitalGrade][] = [];
  if (v.temperature != null) {
    const arrow = trend(v.temperature, previous?.temperature);
    chips.push([
      `Temp ${v.temperature}${config.unit}${arrow}`,
      gradeVital(v.temperature, temperature),
    ]);
  }
  if (v.pulse != null) {
    const arrow = trend(v.pulse, previous?.pulse);
    chips.push([`Pulse ${v.pulse} bpm${arrow}`, gradeVital(v.pulse, bands.pulse)]);
  }
  if (v.systolic_bp != null && v.diastolic_bp != null) {
    const grade = bloodPressureGrade(v.systolic_bp, v.diastolic_bp);
    chips.push([`BP ${v.systolic_bp}/${v.diastolic_bp} mmHg`, grade]);
  }
  if (v.spo2 != null) chips.push([`SpO₂ ${v.spo2}%`, gradeVital(v.spo2, bands.spo2)]);
  if (v.respiratory_rate != null) {
    const grade = gradeVital(v.respiratory_rate, bands.respiratory_rate);
    chips.push([`RR ${v.respiratory_rate} /min`, grade]);
  }
  return chips.map(([reading, grade]) => (
    <Badge key={reading} tone={gradeTone(grade)} size={size}>
      {grade === "normal" ? reading : `${reading} · ${gradeLabel(grade)}`}
    </Badge>
  ));
}
