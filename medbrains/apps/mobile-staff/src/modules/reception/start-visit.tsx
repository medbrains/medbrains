/**
 * Reception → start an OPD visit for a registered patient.
 *
 * The missing link in the desk's own journey. A receptionist could register a
 * patient and then stop: the detail screen was read-only and said so in its
 * own doc comment — "admit / book appointment / open chart actions live as
 * outbound nav-out points in a future iteration". There was no way from a new
 * patient to a token, which is the entire point of registering one.
 *
 * One screen, because at a desk it is one act. Behind it the server opens the
 * encounter, puts the patient in the clinic's queue and issues the token the
 * waiting-room board reads — three records that are the hospital's business,
 * not a sequence somebody should complete by hand while a patient waits.
 *
 * # Accessibility
 *
 * Department and consultant are chosen from lists, not typed: a UUID in a text
 * field is not a choice anybody can make. Every option is a real button at
 * 44px with its selected state in its accessibility label as well as its
 * colour, and the token that comes back is announced rather than only shown,
 * because the number is the one thing the patient is about to be told.
 */

import { Badge, Card, COLORS, EcgLoader, FormScrollView, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Button, HelperText, Text } from "react-native-paper";
import type { StartedVisit } from "../../api/opd.js";
import { startOpdVisit } from "../../api/opd.js";
import type { PatientRow } from "../../api/patients.js";
import { listDepartments, listDoctors } from "../../api/references.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useFetch } from "../../lib/use-fetch.js";

/** WCAG 2.2 SC 2.5.8 and the mobile surface rules both put the floor at 44. */
const TAP_TARGET = 44;
/** A desk picks from the departments it sends people to, not from a directory. */
const MAX_OPTIONS = 40;

export interface StartVisitScreenProps {
  patient: PatientRow;
}

export function StartVisitScreen({ patient }: StartVisitScreenProps): ReactNode {
  const departments = useFetch(() => listDepartments(), []);
  const doctors = useFetch(() => listDoctors(), []);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [started, setStarted] = useState<StartedVisit | null>(null);

  const start = useCallback(async () => {
    if (!departmentId) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      setStarted(
        await startOpdVisit({
          department_id: departmentId,
          doctor_id: doctorId ?? undefined,
          patient_id: patient.id,
          visit_type: "walk_in",
        }),
      );
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "The visit could not be started.");
    } finally {
      setBusy(false);
    }
  }, [departmentId, doctorId, patient.id]);

  const fullName = `${patient.first_name} ${patient.last_name}`;

  return (
    <View style={{ backgroundColor: COLORS.canvas, flex: 1 }}>
      <ScreenHeader
        testID="screen-start-visit"
        eyebrow="OPD REGISTRATION"
        title={fullName}
        description={`UHID ${patient.uhid}`}
      />

      {started ? (
        <View style={{ padding: SPACING.md }} testID="start-visit-token">
          <Card eyebrow="TOKEN" title={String(started.queue.token_number)}>
            {/* Announced, not only shown: this number is what the patient is
                about to be told, and a receptionist reading it back should not
                have to squint at a card. */}
            <Text
              accessibilityLabel={`Token ${started.queue.token_number} issued for ${fullName}. They are now waiting.`}
              style={{ color: COLORS.ink }}
              variant="bodyMedium"
            >
              {fullName} is in the queue. Tell them token {started.queue.token_number}.
            </Text>
            <View style={{ flexDirection: "row", gap: SPACING.xs, marginTop: SPACING.sm }}>
              <Badge label={started.queue.status} tone="success" />
              <Badge label={started.queue.queue_date} monospace tone="info" />
            </View>
          </Card>
        </View>
      ) : (
        <FormScrollView testID="start-visit-form">
          {departments.loading || doctors.loading ? (
            <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
              <EcgLoader />
            </View>
          ) : null}

          {departments.error && (
            <HelperText type="error" visible accessibilityRole="alert">
              Departments could not be loaded, so a visit cannot be started here yet.
            </HelperText>
          )}

          <ChoiceGroup
            label="Department"
            onSelect={setDepartmentId}
            options={(departments.data ?? []).slice(0, MAX_OPTIONS).map((d) => ({
              id: d.id,
              label: d.name,
            }))}
            required
            selectedId={departmentId}
            testIDPrefix="start-visit-department"
          />

          <ChoiceGroup
            label="Consultant"
            hint="Leave unset to let the department assign the least-loaded doctor on duty."
            onSelect={setDoctorId}
            options={(doctors.data ?? []).slice(0, MAX_OPTIONS).map((d) => ({
              id: d.id,
              label: d.full_name,
            }))}
            selectedId={doctorId}
            testIDPrefix="start-visit-doctor"
          />

          {failure && (
            <HelperText type="error" visible accessibilityRole="alert">
              {failure}
            </HelperText>
          )}

          <Button
            accessibilityHint="Opens the visit, joins the OPD queue and issues a token"
            accessibilityLabel={`Start an OPD visit for ${fullName}`}
            disabled={busy || !departmentId}
            loading={busy}
            mode="contained"
            onPress={start}
            style={{ justifyContent: "center", minHeight: TAP_TARGET }}
            testID="start-visit-submit"
          >
            Start visit and issue token
          </Button>
        </FormScrollView>
      )}
    </View>
  );
}

/**
 * A list of choices as real buttons.
 *
 * Not a picker and not a text field. A department is a foreign key, and the
 * house rule is that a foreign key is chosen, never typed — a UUID in a
 * TextInput is not a choice a person can make, and a native picker hides the
 * options from a screen reader until it is open.
 */
function ChoiceGroup({
  hint,
  label,
  onSelect,
  options,
  required = false,
  selectedId,
  testIDPrefix,
}: {
  hint?: string;
  label: string;
  onSelect: (id: string) => void;
  options: ReadonlyArray<{ id: string; label: string }>;
  required?: boolean;
  selectedId: string | null;
  testIDPrefix: string;
}): ReactNode {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: SPACING.xs }}>
      <Text style={{ color: COLORS.ink }} variant="labelLarge">
        {label}
        {required ? " *" : ""}
      </Text>
      {hint ? (
        <Text style={{ color: COLORS.muted }} variant="bodySmall">
          {hint}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs }}>
        {options.map((option) => {
          const selected = option.id === selectedId;
          return (
            <Button
              // Selection is in the label, not only in the fill. Colour alone
              // is not a state (WCAG 2.2 1.4.1), and `selected` in the a11y
              // state is what a screen reader reads out.
              accessibilityLabel={`${option.label}${selected ? ", selected" : ""}`}
              accessibilityState={{ selected }}
              key={option.id}
              mode={selected ? "contained" : "outlined"}
              onPress={() => onSelect(option.id)}
              style={{ justifyContent: "center", minHeight: TAP_TARGET }}
              testID={`${testIDPrefix}-${option.id}`}
            >
              {option.label}
            </Button>
          );
        })}
      </View>
    </View>
  );
}
