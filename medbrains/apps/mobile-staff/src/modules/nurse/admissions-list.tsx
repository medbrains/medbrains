/**
 * Nurse → active admissions worklist. Pick a bed to see its MAR
 * schedule.
 */

import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import { Badge, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import { listActiveAdmissions } from "../../api/ipd.js";
import type { AdmissionRow } from "../../api/ipd.js";
import { useFetch } from "../../lib/use-fetch.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";

export function AdmissionsListScreen(): ReactNode {
  const router = useModuleRouter();
  const { data, loading, error, refetch } = useFetch(() => listActiveAdmissions());

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="NURSE"
        title="Active admissions"
        description="Tap a patient to open their MAR schedule."
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
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <Empty title="No active admissions" />
      )}
      {!loading && !error && data && data.length > 0 && (
        <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
          {data.map((row) => (
            <AdmissionRowView
              key={row.id}
              row={row}
              onPress={() => router.push("mar", row)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function AdmissionRowView({
  row,
  onPress,
}: {
  row: AdmissionRow;
  onPress: () => void;
}): ReactNode {
  return (
    <View
      onTouchEnd={onPress}
      style={{
        backgroundColor: COLORS.canvas,
        borderWidth: 1,
        borderColor: COLORS.rule,
        padding: SPACING.md,
        borderRadius: 8,
        marginBottom: SPACING.sm,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1, paddingRight: SPACING.sm }}>
        <Text variant="titleMedium" style={{ color: COLORS.ink, fontWeight: "600" }}>
          {row.patient_name}
        </Text>
        <Text
          variant="bodySmall"
          style={{
            color: COLORS.brandDeep,
            opacity: 0.7,
            fontFamily: "JetBrainsMono-Regular",
            marginTop: 2,
          }}
        >
          UHID {row.uhid}
          {row.bed_label ? ` · BED ${row.bed_label}` : ""}
        </Text>
      </View>
      <Badge label="active" tone="success" />
    </View>
  );
}
