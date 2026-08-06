/**
 * Reception → patient directory. Search by UHID / name / phone, tap
 * a row to view detail.
 */

import { COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { TextInput } from "react-native-paper";
import type { PatientRow } from "../../api/patients.js";
import { listPatients } from "../../api/patients.js";
import { EntityRow } from "../../components/entity-row.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useFetch } from "../../lib/use-fetch.js";

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
            <PatientRowView key={p.id} row={p} onPress={() => router.push("patient-detail", p)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function PatientRowView({ row, onPress }: { row: PatientRow; onPress: () => void }): ReactNode {
  const name = `${row.prefix ? `${row.prefix} ` : ""}${row.first_name} ${row.last_name}`;
  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <EntityRow
        title={name}
        subtitle={`UHID ${row.uhid}${row.phone ? ` \u00b7 ${row.phone}` : ""}`}
        badge={row.is_active ? undefined : { label: "inactive", tone: "alert" }}
        onPress={onPress}
      />
    </View>
  );
}
