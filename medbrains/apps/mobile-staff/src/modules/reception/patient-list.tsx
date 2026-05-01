/**
 * Reception → patient directory. Search by UHID / name / phone, tap
 * a row to view detail.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { Badge, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import { listPatients } from "../../api/patients.js";
import type { PatientRow } from "../../api/patients.js";
import { useFetch } from "../../lib/use-fetch.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";

export function PatientListScreen(): ReactNode {
  const router = useModuleRouter();
  const [search, setSearch] = useState("");
  const { data, loading, error, refetch } = useFetch(
    () => listPatients({ search: search || undefined, per_page: 25 }),
    [search],
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="RECEPTION"
        title="Patient directory"
        description="Search by UHID, name, or phone."
      />
      <View style={{ padding: SPACING.md, paddingBottom: 0 }}>
        <TextInput
          mode="outlined"
          placeholder="Search…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>
      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}
      {!loading && error && (
        <Empty
          title="Couldn't load patients"
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      )}
      {!loading && !error && (data?.patients.length ?? 0) === 0 && (
        <Empty
          title="No patients"
          description={search ? "Try a different search." : "No patients in this tenant yet."}
        />
      )}
      {!loading && !error && data && data.patients.length > 0 && (
        <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
          {data.patients.map((p) => (
            <PatientRowView
              key={p.id}
              row={p}
              onPress={() => router.push("patient-detail", p)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function PatientRowView({
  row,
  onPress,
}: {
  row: PatientRow;
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
          {row.prefix ? `${row.prefix} ` : ""}
          {row.first_name} {row.last_name}
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
          {row.phone ? ` · ${row.phone}` : ""}
        </Text>
      </View>
      {!row.is_active && <Badge label="inactive" tone="alert" />}
    </View>
  );
}
