/** A flag on a growth point: beyond -2/+2 SD, a centile cut-off, or crossing centiles. */
export interface GrowthFlag {
  code: string;
  label: string;
}

export interface GrowthPoint {
  measured_on: string;
  /** Age in days the point was judged at; corrected for prematurity when `corrected`. */
  age_days: number;
  corrected: boolean;
  x: number;
  value: number;
  z: number;
  percentile: number;
  /** Outside the published IAP centiles: z is extrapolated. */
  extrapolated: boolean;
  flags: GrowthFlag[];
}

export interface GrowthRefLine {
  label: string;
  /** [x, y] pairs. */
  points: [number, number][];
}

export interface GrowthChart {
  key: string;
  title: string;
  standard: string;
  x_label: string;
  unit: string;
  lines: GrowthRefLine[];
  points: GrowthPoint[];
}

/** `GET /patients/{id}/growth` */
export interface GrowthResponse {
  unavailable: string | null;
  sex: "male" | "female" | null;
  date_of_birth: string | null;
  gestation_weeks: number | null;
  charts: GrowthChart[];
}
