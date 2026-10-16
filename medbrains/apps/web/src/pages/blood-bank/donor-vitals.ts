// The D&C Rules (Schedule F Part XII-B) donor limits, as the server's
// collection check applies them (medbrains-blood-bank donor_eligibility.rs).
// Shown before submit so the couch sees the deferral, not a 409.

export const DONOR_SYSTOLIC = { min: 100, max: 180 } as const;
export const DONOR_DIASTOLIC = { min: 50, max: 100 } as const;
export const DONOR_PULSE = { min: 60, max: 100 } as const;
export const DONOR_MAX_TEMPERATURE_C = 37.5;

interface DonorVitals {
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  temperatureC?: number;
}

const within = (v: number, r: { min: number; max: number }) => v >= r.min && v <= r.max;

/** Why these vitals defer the donor, or null when they may donate. */
export function donorVitalsRefusal({ systolic, diastolic, pulse, temperatureC }: DonorVitals) {
  if (systolic === undefined || diastolic === undefined || pulse === undefined) {
    return "Record blood pressure (systolic and diastolic) and pulse measured today.";
  }
  if (!within(systolic, DONOR_SYSTOLIC) || !within(diastolic, DONOR_DIASTOLIC)) {
    return `Blood pressure ${systolic}/${diastolic} mmHg is outside ${DONOR_SYSTOLIC.min}–${DONOR_SYSTOLIC.max} / ${DONOR_DIASTOLIC.min}–${DONOR_DIASTOLIC.max}. Defer the donor.`;
  }
  if (!within(pulse, DONOR_PULSE)) {
    return `Pulse ${pulse}/min is outside ${DONOR_PULSE.min}–${DONOR_PULSE.max}. Defer the donor.`;
  }
  if (temperatureC !== undefined && temperatureC > DONOR_MAX_TEMPERATURE_C) {
    return `Temperature ${temperatureC} °C: the donor must be afebrile (≤ ${DONOR_MAX_TEMPERATURE_C} °C). Defer.`;
  }
  return null;
}
