/**
 * Reception → patient detail. Read-only summary; admit / book
 * appointment / open chart actions live as outbound nav-out points
 * in a future iteration.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { Card, COLORS, SPACING } from "@medbrains/ui-mobile";
import type { PatientRow } from "../../api/patients.js";
import { ScreenHeader } from "../../components/screen-header.js";

export interface PatientDetailScreenProps {
  patient: PatientRow;
}

export function PatientDetailScreen({ patient }: PatientDetailScreenProps): ReactNode {
  const fullName = `${patient.prefix ? `${patient.prefix} ` : ""}${patient.first_name} ${patient.last_name}`;
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
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
