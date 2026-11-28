// GENERATED from crates/medbrains-clinical-scores/src/ews/news2_table.rs by
// news2_bands_ts.rs. Do not edit by hand: change the Rust, then run
// `NEWS2_BANDS_WRITE=1 cargo test -p medbrains-clinical-scores news2_bands`.
//
// Adult NEWS2 (Royal College of Physicians, 2017, Chart 1), SpO2 Scale 1.
// Inclusive ranges: `normal` scores 0, `borderline` scores 0-2, outside it
// scores 3. Temperature in degrees Celsius, to one decimal.

export const NEWS2_BANDS = {
  respiratory_rate: {
    normal: [12, 20],
    borderline: [9, 24],
  },
  spo2: {
    normal: [96, Number.POSITIVE_INFINITY],
    borderline: [92, Number.POSITIVE_INFINITY],
  },
  systolic_bp: {
    normal: [111, 219],
    borderline: [91, 219],
  },
  pulse: {
    normal: [51, 90],
    borderline: [41, 130],
  },
  temperature: {
    normal: [36.1, 38.0],
    borderline: [35.1, Number.POSITIVE_INFINITY],
  },
} as const;
