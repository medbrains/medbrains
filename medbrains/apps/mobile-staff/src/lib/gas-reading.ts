/**
 * Consistency rules for a medical-gas reading.
 *
 * Deliberately contains NO pressure or purity limits. Safe ranges for medical
 * gas are a site's PESO-logged engineering decision, and a threshold invented
 * here would be wrong in one of two dangerous directions: too tight and every
 * reading cries alarm until people stop reading them, too loose and a failing
 * supply logs as normal.
 *
 * What it does enforce is that the record cannot contradict itself. That needs
 * no clinical judgement and catches the case the web form allows today: an
 * alarm ticked with nothing said about it, or a reason typed and the alarm left
 * unticked so the record reads as normal.
 */

export interface GasReadingDraft {
  purity_percent: string;
  pressure_bar: string;
  tank_level_percent: string;
  is_alarm: boolean;
  alarm_reason: string;
}

export interface GasReadingProblems {
  /** Field-level messages, keyed by field. */
  purity?: string;
  pressure?: string;
  tankLevel?: string;
  alarmReason?: string;
  /** True when the draft may be submitted. */
  canSubmit: boolean;
}

/** Percentages are percentages; a typo of 900 should not reach the log. */
function numberProblem(raw: string, label: string, max: number): string | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return undefined;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return `${label} must be a number.`;
  }
  if (value < 0 || value > max) {
    return `${label} must be between 0 and ${max}.`;
  }
  return undefined;
}

export function checkGasReading(draft: GasReadingDraft): GasReadingProblems {
  const purity = numberProblem(draft.purity_percent, "Purity", 100);
  const pressure = numberProblem(draft.pressure_bar, "Pressure", 400);
  const tankLevel = numberProblem(draft.tank_level_percent, "Tank level", 100);

  // An alarm nobody explained is a row that tells a later reader nothing.
  const alarmReason =
    draft.is_alarm && draft.alarm_reason.trim().length < 4
      ? "Say what the alarm is. A flagged reading with no reason cannot be acted on."
      : undefined;

  const hasAnyMeasurement =
    draft.purity_percent.trim() !== "" ||
    draft.pressure_bar.trim() !== "" ||
    draft.tank_level_percent.trim() !== "";

  return {
    purity,
    pressure,
    tankLevel,
    alarmReason,
    canSubmit:
      !purity && !pressure && !tankLevel && !alarmReason && (hasAnyMeasurement || draft.is_alarm),
  };
}
