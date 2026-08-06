/**
 * Report a security incident from where it happened.
 *
 * The guard's module listed incidents but had no way to add one — the action
 * existed on the home screen and did nothing when pressed. A guard is the one
 * member of staff who genuinely cannot reach a desk: they are walking the
 * building when the thing they need to report occurs.
 *
 * Field order follows what is known at the moment of reporting, not the shape
 * of the table: what happened, how bad, where, when, then the account. Severity
 * comes second because it decides who gets woken up.
 */

import { COLORS, FormScrollView, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "react-native";
import { Button, HelperText, SegmentedButtons, Text } from "react-native-paper";
import { reportSecurityIncident } from "../../api/security.js";
import { ScreenHeader } from "../../components/screen-header.js";

/** Mirrors the categories on the web incidents tab so the two agree. */
const CATEGORIES = [
  { value: "theft", label: "Theft" },
  { value: "assault", label: "Assault" },
  { value: "trespass", label: "Trespass" },
  { value: "property_damage", label: "Property damage" },
  { value: "policy_violation", label: "Policy violation" },
  { value: "elopement", label: "Elopement" },
  { value: "other", label: "Other" },
] as const;

/** Split for one-handed use — seven chips in a row are unreadable on a phone. */
const CATEGORY_ROWS: ReadonlyArray<ReadonlyArray<{ value: string; label: string }>> = [
  CATEGORIES.slice(0, 4),
  CATEGORIES.slice(4),
];

const SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

const MIN_DESCRIPTION = 10;

export interface ReportIncidentScreenProps {
  onReported: () => void;
}

export function ReportIncidentScreen({ onReported }: ReportIncidentScreenProps): ReactNode {
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const categoryError = touched && !category ? "Pick what happened." : null;
  const descriptionError =
    touched && description.trim().length < MIN_DESCRIPTION
      ? "Describe what happened — this is the record an investigation works from."
      : null;
  const isValid = !categoryError && !descriptionError && Boolean(category);

  const submit = async () => {
    setTouched(true);
    if (!isValid) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const incident = await reportSecurityIncident({
        category,
        severity,
        description: description.trim(),
        location_description: location.trim() || undefined,
        // Stamped here rather than server-side: writing it up minutes later is
        // normal, and the time it happened is what the record turns on.
        occurred_at: new Date().toISOString(),
      });
      setSaved(incident.incident_number);
      onReported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not file the incident.");
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
        <ScreenHeader
          eyebrow="SECURITY"
          title="Incident filed"
          description={`Reference ${saved}`}
        />
        <View style={{ padding: SPACING.md, gap: SPACING.sm }}>
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            The incident is on the log and visible to the security desk. Quote {saved} in any
            follow-up or police report.
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              setSaved(null);
              setCategory("");
              setSeverity("medium");
              setLocation("");
              setDescription("");
              setTouched(false);
            }}
            accessibilityLabel="Report another incident"
          >
            Report another
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="SECURITY"
        title="Report incident"
        description="Filed against your name and the time you give."
      />
      <FormScrollView>
        <FieldLabel text="What happened" required />
        {CATEGORY_ROWS.map((row, index) => (
          <SegmentedButtons
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed, never reordered
            key={index}
            value={category}
            onValueChange={setCategory}
            buttons={row.map((c) => ({
              value: c.value,
              label: c.label,
              accessibilityLabel: c.label,
            }))}
          />
        ))}
        <HelperText type="error" visible={Boolean(categoryError)}>
          {categoryError ?? " "}
        </HelperText>

        <FieldLabel text="Severity" />
        <SegmentedButtons
          value={severity}
          onValueChange={setSeverity}
          buttons={SEVERITIES.map((s) => ({
            value: s.value,
            label: s.label,
            accessibilityLabel: `Severity ${s.label}`,
          }))}
        />
        <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.7 }}>
          High and critical reach the security desk immediately.
        </Text>

        <MobileTextField
          label="Where"
          value={location}
          onChangeText={setLocation}
          placeholder="Ward, gate, corridor…"
        />

        <MobileTextField
          label="What happened"
          value={description}
          onChangeText={setDescription}
          onBlur={() => setTouched(true)}
          multiline
          numberOfLines={5}
          error={Boolean(descriptionError)}
        />
        <HelperText type="error" visible={Boolean(descriptionError)}>
          {descriptionError ?? " "}
        </HelperText>

        {error && (
          <HelperText type="error" visible accessibilityRole="alert">
            {error}
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={submit}
          loading={busy}
          disabled={busy}
          accessibilityLabel="File incident"
        >
          {busy ? "Filing…" : "File incident"}
        </Button>
      </FormScrollView>
    </View>
  );
}

function FieldLabel({ text, required = false }: { text: string; required?: boolean }): ReactNode {
  return (
    <Text variant="labelLarge" style={{ color: COLORS.ink, marginTop: SPACING.xs }}>
      {text}
      {required ? " *" : ""}
    </Text>
  );
}
