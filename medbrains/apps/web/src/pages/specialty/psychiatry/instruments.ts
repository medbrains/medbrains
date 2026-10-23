import type { ScreeningInstrument } from "@medbrains/types";

/** "Over the last two weeks, how often have you been bothered by…" */
export const INSTRUMENT_ITEMS: Record<ScreeningInstrument, string[]> = {
  phq9: [
    "Little interest or pleasure in doing things",
    "Feeling down, depressed, or hopeless",
    "Trouble falling or staying asleep, or sleeping too much",
    "Feeling tired or having little energy",
    "Poor appetite or overeating",
    "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
    "Trouble concentrating on things, such as reading the newspaper or watching television",
    "Moving or speaking so slowly that other people could have noticed — or the opposite, being so fidgety or restless that you have been moving around a lot more than usual",
    "Thoughts that you would be better off dead, or of hurting yourself in some way",
  ],
  gad7: [
    "Feeling nervous, anxious, or on edge",
    "Not being able to stop or control worrying",
    "Worrying too much about different things",
    "Trouble relaxing",
    "Being so restless that it is hard to sit still",
    "Becoming easily annoyed or irritable",
    "Feeling afraid, as if something awful might happen",
  ],
};

export const INSTRUMENT_LABEL: Record<ScreeningInstrument, string> = {
  phq9: "PHQ-9 (depression)",
  gad7: "GAD-7 (anxiety)",
};

export const ANSWER_OPTIONS = [
  { value: "0", label: "Not at all" },
  { value: "1", label: "Several days" },
  { value: "2", label: "More than half the days" },
  { value: "3", label: "Nearly every day" },
];

/** The published severity cut-offs, for the trend chart's reference lines. */
export const SEVERITY_CUTOFFS: Record<ScreeningInstrument, { value: number; label: string }[]> = {
  phq9: [
    { value: 5, label: "Mild" },
    { value: 10, label: "Moderate" },
    { value: 15, label: "Moderately severe" },
    { value: 20, label: "Severe" },
  ],
  gad7: [
    { value: 5, label: "Mild" },
    { value: 10, label: "Moderate" },
    { value: 15, label: "Severe" },
  ],
};

export const MAX_TOTAL: Record<ScreeningInstrument, number> = { phq9: 27, gad7: 21 };

export const SEVERITY_LABEL: Record<string, string> = {
  minimal: "Minimal",
  mild: "Mild",
  moderate: "Moderate",
  moderately_severe: "Moderately severe",
  severe: "Severe",
};

export const REVIEW_OUTCOMES = [
  { value: "no_current_risk", label: "No current risk" },
  { value: "low", label: "Low risk" },
  { value: "moderate", label: "Moderate risk" },
  { value: "high", label: "High risk" },
];
