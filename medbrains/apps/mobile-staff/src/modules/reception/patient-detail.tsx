/**
 * Reception → patient detail.
 *
 * No longer read-only. It was a summary with no way out of it, which left the
 * desk's own journey broken in the middle: a receptionist could register a
 * patient and then had nothing to do with them. Starting the OPD visit is the
 * next thing that happens at a real desk, so it is the action on this screen.
 */

import { Card, COLORS, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";
import type { PatientRow } from "../../api/patients.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useHasPermission } from "../../lib/permissions.js";

/** WCAG 2.2 SC 2.5.8 and the mobile surface rules both put the floor at 44. */
const TAP_TARGET = 44;

export interface PatientDetailScreenProps {
  patient: PatientRow;
}

export function PatientDetailScreen({ patient }: PatientDetailScreenProps): ReactNode {
  const router = useModuleRouter();
  const canStartVisit = useHasPermission("opd.visit.create");
  const fullName = `${patient.prefix ? `${patient.prefix} ` : ""}${patient.first_name} ${patient.last_name}`;
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        testID="screen-patient-detail"
        eyebrow="PATIENT"
        title={fullName}
        description={`UHID ${patient.uhid}`}
      />
      <View style={{ padding: SPACING.md }}>
        <Card eyebrow="DEMOGRAPHICS" title="Profile">
          <Field label="UHID" value={patient.uhid} mono />
          <Field label="Gender" value={patient.gender} />
          <Field label="DOB" value={patient.date_of_birth ?? "—"} mono />
          <Field label="Phone" value={patient.phone ?? "—"} mono />
          <Field label="Registration type" value={patient.registration_type} />
          <Field label="Active" value={patient.is_active ? "yes" : "no"} />
        </Card>

        {canStartVisit && (
          <Button
            accessibilityHint="Opens the visit, joins the OPD queue and issues a token"
            accessibilityLabel={`Start an OPD visit for ${fullName}`}
            mode="contained"
            onPress={() => router.push("start-visit", patient)}
            style={{ justifyContent: "center", marginTop: SPACING.md, minHeight: TAP_TARGET }}
            testID="patient-start-visit"
          >
            Start OPD visit
          </Button>
        )}
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): ReactNode {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: SPACING.xs,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.rule,
      }}
    >
      <Text variant="bodyMedium" style={{ color: COLORS.brandDeep, opacity: 0.7 }}>
        {label}
      </Text>
      <Text
        variant="bodyMedium"
        style={{
          color: COLORS.ink,
          fontFamily: mono ? "JetBrainsMono-Regular" : undefined,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
