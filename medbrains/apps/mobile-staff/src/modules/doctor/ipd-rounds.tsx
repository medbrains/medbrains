/**
 * Doctor IPD rounds worklist. This is a mobile clinical worklist, not
 * an admission-management screen.
 */

import { Badge, Card, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import type { AdmissionRow } from "../../api/ipd.js";
import { listActiveAdmissions } from "../../api/ipd.js";
import { EntityRow } from "../../components/entity-row.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useFetch } from "../../lib/use-fetch.js";

export function DoctorIpdRoundsScreen(): ReactNode {
  const router = useModuleRouter();
  const { data, loading, error, refetch } = useFetch(() => listActiveAdmissions());

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="DOCTOR"
        title="IPD rounds"
        description="Active admitted patients for ward review."
      />
      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}
      {!loading && error && (
        <Empty
          title="Couldn't load IPD rounds"
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      )}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <Empty title="No active admissions" description="No patients are currently on rounds." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
          {data.map((row) => (
            <RoundRow key={row.id} row={row} onPress={() => router.push("ipd-round-detail", row)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export function DoctorIpdRoundDetailScreen({ admission }: { admission: AdmissionRow }): ReactNode {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="ROUND"
        title={admission.patient_name}
        description={`UHID ${admission.uhid}${admission.bed_label ? ` · ${admission.bed_label}` : ""}`}
        trailing={<Badge label={admission.status} tone="success" />}
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
        <Card eyebrow="MINI EMR" title="Ward review context" pattern="clinical">
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            Use this as the mobile round landing point. Progress notes, diagnosis, prescription
            review, investigations and discharge planning stay under this patient context.
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
            <Badge label="IPD" tone="info" />
          </View>
        </Card>
        <ClinicalIntentCard
          title="Progress note"
          description="SOAP note, senior co-sign requirement and discharge readiness."
          tone="info"
        />
        <ClinicalIntentCard
          title="Diagnosis"
          description="ICD/SNOMED review for the current admission."
          tone="success"
        />
        <ClinicalIntentCard
          title="Prescription review"
          description="Medication reconciliation, MAR visibility and pharmacy status."
          tone="copper"
        />
        <ClinicalIntentCard
          title="Lab / radiology"
          description="Critical values, pending reports and DICOM review links."
          tone="warn"
        />
      </ScrollView>
    </View>
  );
}

function RoundRow({ row, onPress }: { row: AdmissionRow; onPress: () => void }): ReactNode {
  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <EntityRow
        title={row.patient_name}
        subtitle={`UHID ${row.uhid}${row.bed_label ? ` \u00b7 ${row.bed_label}` : ""}`}
        badge={{ label: "round", tone: "info" }}
        onPress={onPress}
      />
    </View>
  );
}

function ClinicalIntentCard({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: "info" | "success" | "warn" | "copper";
}): ReactNode {
  return (
    <Card title={title} tone={tone} accent>
      <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
        {description}
      </Text>
    </Card>
  );
}
