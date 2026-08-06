// Camp screening — medical history and point-of-care tests, for the tablet.
//
// Kept out of modules/camp.tsx, which is already 2,781 lines.
//
// Every history question is three-state. On the paper form a tick means yes and
// a blank means the question was never reached — not that the patient denied it.
// Recording an unasked question as a negative finding would make a camp
// population look healthier than it is, which is the one thing a screening camp
// must not do. Same rule as the web form.
//
// Constrained-device notes: both field lists are fixed consts, so nothing grows
// with data; the answers live in one state object per group rather than 18
// separate hooks; and SegmentedButtons meets the 44px touch target on its own.

import { Card, COLORS, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { View } from "react-native";
import { SegmentedButtons, Text } from "react-native-paper";

/** Blank is "not asked" and must never be sent as `false`. */
export type CampHistoryAnswer = "" | "yes" | "no";

export type CampHistoryState = Record<string, CampHistoryAnswer>;
export type CampTestState = Record<string, string>;

export const CAMP_HISTORY_QUESTIONS = [
  { key: "mh_diabetes", label: "Diabetes" },
  { key: "mh_hypertension", label: "Hypertension" },
  { key: "mh_asthma", label: "Asthma" },
  { key: "mh_heart_disease", label: "Heart disease" },
  { key: "mh_thyroid_disorder", label: "Thyroid" },
  { key: "mh_previous_surgeries", label: "Previous surgeries" },
  { key: "mh_allergies", label: "Allergies" },
  { key: "mh_smoking_history", label: "Smoking" },
  { key: "mh_alcohol_use", label: "Alcohol" },
  { key: "mh_family_history", label: "Family history" },
  { key: "mh_others", label: "Other conditions" },
] as const;

export const CAMP_TEST_FIELDS = [
  { key: "test_hba1c", label: "HbA1c (%)", numeric: true },
  { key: "test_haemoglobin", label: "Haemoglobin (g/dl)", numeric: true },
  { key: "test_thyroid", label: "TSH", numeric: true },
  { key: "test_ecg", label: "ECG impression", numeric: false },
  { key: "test_xray", label: "X-ray impression", numeric: false },
  { key: "test_bmd", label: "BMD", numeric: false },
  { key: "test_biothesiometry", label: "Biothesiometry", numeric: false },
] as const;

const ANSWER_BUTTONS = [
  { value: "", label: "—" },
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];

/** Blank stays undefined so the server records "not asked", never a denial. */
export function campHistoryAnswerToBool(value: CampHistoryAnswer): boolean | undefined {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

interface HistoryProps {
  values: CampHistoryState;
  onChange: (key: string, value: CampHistoryAnswer) => void;
}

export function CampHistoryFields({ values, onChange }: HistoryProps): ReactNode {
  return (
    <Card eyebrow="Screening" title="Medical history" pattern="sky">
      <View style={{ gap: SPACING.sm }}>
        <Text variant="bodySmall" style={{ color: COLORS.muted }}>
          Leave on “—” when the question was not reached. It is not the same as a no.
        </Text>
        {CAMP_HISTORY_QUESTIONS.map((question) => (
          <View key={question.key} style={{ gap: SPACING.xs }}>
            <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
              {question.label}
            </Text>
            <SegmentedButtons
              density="small"
              value={values[question.key] ?? ""}
              onValueChange={(value) => onChange(question.key, value as CampHistoryAnswer)}
              buttons={ANSWER_BUTTONS}
            />
          </View>
        ))}
      </View>
    </Card>
  );
}

interface TestsProps {
  values: CampTestState;
  onChange: (key: string, value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}

export function CampTestFields({ values, onChange, notes, onNotesChange }: TestsProps): ReactNode {
  return (
    <Card eyebrow="Screening" title="Point-of-care tests" pattern="violet">
      <View style={{ gap: SPACING.sm }}>
        {CAMP_TEST_FIELDS.map((test) => (
          <MobileTextField
            key={test.key}
            label={test.label}
            keyboardType={test.numeric ? "decimal-pad" : "default"}
            value={values[test.key] ?? ""}
            onChangeText={(value: string) => onChange(test.key, value)}
          />
        ))}
        <MobileTextField
          label="Medical history notes"
          multiline
          value={notes}
          onChangeText={onNotesChange}
        />
      </View>
    </Card>
  );
}
