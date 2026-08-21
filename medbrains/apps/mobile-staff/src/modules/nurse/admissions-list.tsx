/**
 * Nurse → active admissions worklist. Pick a bed to enter the
 * bedside workspace.
 */

import { COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import type { AdmissionRow } from "../../api/ipd.js";
import { listActiveAdmissions } from "../../api/ipd.js";
import { EntityRow } from "../../components/entity-row.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useFetch } from "../../lib/use-fetch.js";

export function AdmissionsListScreen(): ReactNode {
  const router = useModuleRouter();
  const { data, loading, error, refetch } = useFetch(() => listActiveAdmissions());

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        testID="screen-admissions"
        eyebrow="NURSE"
        title="My shift"
        description="Tap a patient to open bedside MAR, vitals, I/O and risk actions."
      />
      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}
      {!loading && error && (
        <Empty
          title="Couldn't load admissions"
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      )}
      {!loading && !error && (data?.length ?? 0) === 0 && <Empty title="No active admissions" />}
      {!loading && !error && data && data.length > 0 && (
        <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
          {data.map((row) => (
            <AdmissionRowView
              key={row.id}
              row={row}
              onPress={() => router.push("patient-workspace", row)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function AdmissionRowView({ row, onPress }: { row: AdmissionRow; onPress: () => void }): ReactNode {
  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <EntityRow
        title={row.patient_name}
        subtitle={`UHID ${row.uhid}${row.bed_label ? ` \u00b7 BED ${row.bed_label}` : ""}`}
        badge={{ label: "active", tone: "success" }}
        onPress={onPress}
      />
    </View>
  );
}
