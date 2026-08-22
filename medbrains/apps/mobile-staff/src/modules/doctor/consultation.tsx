/**
 * Doctor → OPD consultation. The clinical record behind the token.
 *
 * This is the screen the Doctor module promised and did not have: its home
 * offered "Start consultation", "Prescription" and "Lab orders" and all three
 * pushed the queue list back at you. A menu entry that leads somewhere else is
 * worse than no menu entry, because the doctor goes looking twice.
 *
 * Four SOAP fields, nothing else. A handheld between two patients is not where
 * anyone authors a structured past-surgical history; the JSONB columns stay for
 * the web. What matters here is that the complaint, the examination, the
 * assessment and the plan get recorded before the next patient walks in.
 *
 * Obeys `docs/MOBILE-FORM-KEYBOARD-RULES.md` in full, and rule 3 is the reason
 * this screen looks the way it does: every field is multi-line prose, so the
 * return key belongs to the clinician for newlines and CANNOT be used to move
 * between fields. Traversal is the `FieldNavigator` bar above the keyboard.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import type { MobileStaffConsultationFormInput } from "@medbrains/schemas";
import { mobileStaffConsultationFormSchema } from "@medbrains/schemas";
import { P } from "@medbrains/types";
import type { FocusableField } from "@medbrains/ui-mobile";
import {
  Badge,
  Card,
  COLORS,
  EcgLoader,
  Empty,
  FieldNavigator,
  FormScrollView,
  MobileTextField,
  SPACING,
} from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Keyboard, View } from "react-native";
import { Button, HelperText, Snackbar, Text } from "react-native-paper";
import type { Consultation } from "../../api/consultation.js";
import { createConsultation, getConsultation, updateConsultation } from "../../api/consultation.js";
import type { WorklistToken } from "../../api/queue.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useHasPermission } from "../../lib/permissions.js";
import { useFetch } from "../../lib/use-fetch.js";

/** Traversal order, which is also reading order (WCAG 2.2 SC 2.4.3). */
const FIELDS = [
  { name: "chief_complaint", label: "Chief complaint", required: true },
  { name: "examination", label: "Examination", required: false },
  { name: "assessment", label: "Assessment", required: false },
  { name: "plan", label: "Plan", required: false },
] as const;

type FieldName = (typeof FIELDS)[number]["name"];

const EMPTY: MobileStaffConsultationFormInput = {
  chief_complaint: "",
  examination: "",
  assessment: "",
  plan: "",
};

/** The record as the form sees it. Server column names, clinician labels. */
function toForm(consultation: Consultation | null): MobileStaffConsultationFormInput {
  if (!consultation) return EMPTY;
  return {
    chief_complaint: consultation.chief_complaint ?? "",
    examination: consultation.examination ?? "",
    // `notes` is the column; "Assessment" is what a clinician calls it.
    assessment: consultation.notes ?? "",
    plan: consultation.plan ?? "",
  };
}

export interface ConsultationScreenProps {
  entry: WorklistToken;
}

export function ConsultationScreen({ entry }: ConsultationScreenProps): ReactNode {
  const canRecord = useHasPermission(P.OPD.VISIT_UPDATE);
  const encounterId = entry.encounter_id;

  const {
    data: existing,
    loading,
    error: loadError,
    refetch,
  } = useFetch(
    useCallback(
      async () => (encounterId ? await getConsultation(encounterId) : null),
      [encounterId],
    ),
  );

  if (!encounterId) {
    // A token issued before its encounter existed. Saying so beats a form that
    // cannot save and does not explain itself.
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
        <ScreenHeader
          testID="screen-consultation"
          eyebrow="CONSULTATION"
          title={entry.patient_name ?? "Unnamed patient"}
          description={`Token ${entry.number}`}
        />
        <Empty
          title="No visit to record against"
          description="This token has no OPD visit yet. Start the visit from reception, then the consultation can be written."
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
        <ScreenHeader
          testID="screen-consultation"
          eyebrow="CONSULTATION"
          title={entry.patient_name ?? "Unnamed patient"}
          description={`Token ${entry.number}`}
        />
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      </View>
    );
  }

  if (loadError) {
    // Not an empty form: a read that failed must never look like a patient with
    // no history. The doctor would write a second consultation over the first.
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
        <ScreenHeader
          testID="screen-consultation"
          eyebrow="CONSULTATION"
          title={entry.patient_name ?? "Unnamed patient"}
          description={`Token ${entry.number}`}
        />
        <Empty
          title="Couldn't load the consultation"
          description={loadError}
          actionLabel="Retry"
          onAction={refetch}
        />
      </View>
    );
  }

  return (
    <ConsultationForm
      canRecord={canRecord}
      encounterId={encounterId}
      entry={entry}
      existing={existing ?? null}
    />
  );
}

function ConsultationForm({
  canRecord,
  encounterId,
  entry,
  existing,
}: {
  canRecord: boolean;
  encounterId: string;
  entry: WorklistToken;
  existing: Consultation | null;
}): ReactNode {
  const [saved, setSaved] = useState<Consultation | null>(existing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const refs = useRef<Partial<Record<FieldName, FocusableField | null>>>({});

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<MobileStaffConsultationFormInput>({
    resolver: zodResolver(mobileStaffConsultationFormSchema),
    // Rule 6: do not shout while they type. Validate on submit, then keep the
    // message honest as they fix it.
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toForm(existing),
  });

  const focusIndex = (index: number) => {
    const field = FIELDS[index];
    if (!field) return;
    refs.current[field.name]?.focus();
    setFocused(index);
  };

  const submit = handleSubmit(async (values) => {
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const notes = {
        chief_complaint: values.chief_complaint.trim(),
        examination: values.examination.trim(),
        notes: values.assessment.trim(),
        plan: values.plan.trim(),
      };
      const written = saved
        ? await updateConsultation(encounterId, saved.id, notes)
        : await createConsultation(encounterId, notes);
      setSaved(written);
      // Rule 10: keep what was typed. Re-seeding from the server's answer means
      // the form now matches the record, so "unsaved" stops being claimed.
      reset(toForm(written));
      setToast("Consultation saved");
    } catch (err) {
      // Rule 10 again: the values stay on screen with the error. A failed write
      // on ward wifi should cost a retry, not a re-type.
      setError(err instanceof Error ? err.message : "Could not save the consultation");
    } finally {
      setBusy(false);
    }
  });

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        testID="screen-consultation"
        eyebrow="CONSULTATION"
        title={entry.patient_name ?? "Unnamed patient"}
        description={`UHID ${entry.uhid ?? "—"} · Token ${entry.number}`}
      />

      <FormScrollView testID="consultation-form">
        <Card eyebrow="VISIT" title={saved ? "Recorded" : "New consultation"}>
          <View style={{ flexDirection: "row", gap: SPACING.xs }}>
            <Badge label={`token ${entry.number}`} monospace />
            {/*
              The record's state, and the thing a test should anchor on. The
              snackbar below is the right feedback for a human and the wrong
              anchor for a spec: it dismisses itself after a couple of seconds,
              so asserting on it makes a passing save look like a failure.
            */}
            <View testID={saved ? "consultation-saved" : "consultation-unsaved"}>
              <Badge label={saved ? "saved" : "not saved"} tone={saved ? "success" : "warn"} />
            </View>
            {isDirty && <Badge label="unsaved edits" tone="warn" />}
          </View>
        </Card>

        <Card eyebrow="SOAP" title="Clinical note">
          <View style={{ gap: SPACING.sm }}>
            {FIELDS.map((field, index) => (
              <Controller
                key={field.name}
                control={control}
                name={field.name}
                render={({ field: { onChange, onBlur, value } }) => (
                  <MobileTextField
                    ref={(node: FocusableField | null) => {
                      refs.current[field.name] = node;
                    }}
                    testID={`field-${field.name}`}
                    label={field.label}
                    required={field.required}
                    errorText={errors[field.name]?.message}
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocused(index)}
                    onBlur={() => {
                      onBlur();
                      setFocused((current) => (current === index ? null : current));
                    }}
                    // Prose, so: multi-line, sentence case, and the return key
                    // stays a newline. Traversal is the navigator bar.
                    multiline
                    numberOfLines={3}
                    autoCapitalize="sentences"
                    keyboardType="default"
                  />
                )}
              />
            ))}
          </View>
        </Card>

        {error && (
          <HelperText type="error" visible accessibilityRole="alert">
            {error}
          </HelperText>
        )}

        {!canRecord && (
          <HelperText type="info" visible>
            You can read this consultation but not change it.
          </HelperText>
        )}

        {canRecord && (
          <Button
            testID="consultation-save"
            accessibilityLabel="Save this consultation"
            mode="contained"
            loading={busy}
            // Rule 6: disabled only while the write is in flight, never on
            // validity -- a greyed-out submit explains nothing and races the
            // resolver.
            disabled={busy}
            onPress={() => void submit()}
          >
            {saved ? "Save changes" : "Save consultation"}
          </Button>
        )}
      </FormScrollView>

      <FieldNavigator
        labels={FIELDS.map((field) => field.label)}
        index={focused}
        onFocusIndex={focusIndex}
        onDone={() => setFocused(null)}
        testID="consultation-field-navigator"
      />

      <Snackbar
        visible={toast !== null}
        onDismiss={() => setToast(null)}
        duration={2500}
        testID="consultation-toast"
      >
        <Text style={{ color: COLORS.canvas }}>{toast}</Text>
      </Snackbar>
    </View>
  );
}
