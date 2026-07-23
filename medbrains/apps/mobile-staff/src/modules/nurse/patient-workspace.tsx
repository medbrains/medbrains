/**
 * Nurse bedside workspace. One selected admission becomes the working
 * patient context; nursing tasks branch from here instead of living as
 * unrelated top-level menu entries.
 */

import { P } from "@medbrains/types";
import { Badge, Card, COLORS, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Button, Text } from "react-native-paper";
import type { AdmissionRow } from "../../api/ipd.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useHasAny, useHasPermission } from "../../lib/permissions.js";

export interface PatientWorkspaceScreenProps {
  admission: AdmissionRow;
}

export type BedsideActionMode = "vitals" | "io" | "pain" | "fall-risk";

interface BedsideAction {
  id: BedsideActionMode | "mar" | "handover";
  label: string;
  description: string;
  permissions: readonly string[];
  tone?: "info" | "success" | "warn" | "copper";
}

const ACTIONS: readonly BedsideAction[] = [
  {
    id: "mar",
    label: "MAR",
    description: "Administer, hold, or refuse scheduled medication.",
    permissions: [P.IPD.MAR_LIST, P.NURSE.MAR_VIEW],
    tone: "copper",
  },
  {
    id: "handover",
    label: "SBAR handover",
    description: "Hand this patient to the next shift, or accept one addressed to you.",
    permissions: [P.NURSE.HANDOFF_RECORD],
    tone: "warn",
  },
  {
    id: "vitals",
    label: "Vitals",
    description: "BP, pulse, SpO2, temperature, respiration, weight.",
    permissions: [P.NURSE.VITALS_RECORD],
    tone: "info",
  },
  {
    id: "io",
    label: "Intake / output",
    description: "Record fluid balance for the current shift.",
    permissions: [P.NURSE.INTAKE_OUTPUT_RECORD],
    tone: "success",
  },
  {
    id: "pain",
    label: "Pain score",
    description: "Numeric pain score with intervention and recheck notes.",
    permissions: [P.NURSE.PAIN_RECORD],
    tone: "warn",
  },
  {
    id: "fall-risk",
    label: "Fall risk",
    description: "Morse-style score with risk level and interventions.",
    permissions: [P.NURSE.FALL_RISK_RECORD],
    tone: "info",
  },
];

export function PatientWorkspaceScreen({ admission }: PatientWorkspaceScreenProps): ReactNode {
  const router = useModuleRouter();
  const canViewAdmission = useHasPermission(P.IPD.ADMISSIONS_VIEW);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="BED"
        title={admission.patient_name}
        description={`UHID ${admission.uhid}${admission.bed_label ? ` · ${admission.bed_label}` : ""}`}
        trailing={<Badge label={admission.status} tone="success" />}
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
        <Card eyebrow="PATIENT CONTEXT" title="Bedside chart" pattern="clinical">
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            Work in one selected admission context. MAR, vitals, I/O and risk screens write against
            this encounter for auditability.
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: SPACING.xs,
              flexWrap: "wrap",
              marginTop: SPACING.sm,
            }}
          >
            <Badge label={`encounter ${admission.encounter_id.slice(0, 8)}`} monospace />
            {canViewAdmission && <Badge label="IPD visible" tone="info" />}
          </View>
        </Card>

        {ACTIONS.map((action) => (
          <WorkspaceActionRow
            key={action.id}
            action={action}
            onPress={() => {
              if (action.id === "mar") {
                router.push("mar", admission);
              } else if (action.id === "handover") {
                router.push("handover", admission);
              } else {
                router.push("bedside-action", { admission, mode: action.id });
              }
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function WorkspaceActionRow({
  action,
  onPress,
}: {
  action: BedsideAction;
  onPress: () => void;
}): ReactNode {
  const allowed = useHasAny(action.permissions);
  if (!allowed) return null;

  return (
    <Card title={action.label} tone={action.tone ?? "neutral"} accent>
      <Text variant="bodyMedium" style={{ color: COLORS.ink, marginBottom: SPACING.sm }}>
        {action.description}
      </Text>
      <Button mode="contained" onPress={onPress}>
        Open
      </Button>
    </Card>
  );
}
