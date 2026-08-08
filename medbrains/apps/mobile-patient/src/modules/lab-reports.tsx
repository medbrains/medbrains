/**
 * Patient → lab reports.
 *
 * Everything reaching this screen has been verified by the lab, and anything
 * carrying an unacknowledged critical alert is withheld by the backend until a
 * clinician has been told. So the screen's job is not to decide what is safe to
 * show — it is to present what arrives without alarming anyone unnecessarily.
 *
 * A flagged value is marked, because hiding that a number is out of range would
 * be its own kind of dishonesty. It is marked in words as well as colour: "high"
 * reads the same to someone who cannot distinguish the badge.
 */

import type { Module } from "@medbrains/mobile-shell";
import { COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { FlatList, View } from "react-native";
import { Text } from "react-native-paper";
import type { PortalLabReport } from "../api/portal.js";
import { listPortalLabReports } from "../api/portal.js";
import { EntityRow } from "../components/entity-row.js";
import { ScreenHeader } from "../components/screen-header.js";
import { useFetch } from "../lib/use-fetch.js";

const MAX_ROWS = 200;

/** Anything the lab did not mark normal is worth the patient noticing. */
function isFlagged(flag: string | null): boolean {
  return flag !== null && flag !== "normal";
}

function LabReportsScreen(): ReactNode {
  const { data, loading, error, refetch } = useFetch(listPortalLabReports, []);
  const results = useMemo(() => (data ?? []).slice(0, MAX_ROWS), [data]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="RESULTS"
        title="Your results"
        description="Released by the laboratory."
      />

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {!loading && error && (
        <Empty
          title="Couldn't load your results"
          description={error}
          actionLabel="Try again"
          onAction={refetch}
        />
      )}

      {!loading && !error && results.length === 0 && (
        <Empty
          title="No results yet"
          description="Results appear here once the laboratory has checked them. Your doctor will contact you about anything urgent."
        />
      )}

      {!loading && !error && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(row) => `${row.order_id}-${row.parameter_name}-${row.reported_at}`}
          renderItem={({ item }) => <ResultRow result={item} />}
          contentContainerStyle={{ padding: SPACING.md }}
          ListFooterComponent={
            <Text
              variant="bodySmall"
              style={{ color: COLORS.ink, opacity: 0.7, marginTop: SPACING.sm }}
            >
              Talk to your doctor before acting on anything here.
            </Text>
          }
        />
      )}
    </View>
  );
}

function ResultRow({ result }: { result: PortalLabReport }): ReactNode {
  const flagged = isFlagged(result.flag);
  const value = `${result.value}${result.unit ? ` ${result.unit}` : ""}`;

  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <EntityRow
        title={`${result.parameter_name} · ${value}`}
        subtitle={`${result.test_name} · ${new Date(result.reported_at).toLocaleDateString()}${
          result.normal_range ? ` · usual range ${result.normal_range}` : ""
        }`}
        accent={flagged}
        // The word, not only the colour — never colour alone for meaning.
        badge={flagged ? { label: result.flag ?? "check", tone: "warn" } : undefined}
      />
    </View>
  );
}

export const labReportsModule: Module = {
  id: "lab-reports",
  displayName: "Results",
  icon: () => null,
  navigator: LabReportsScreen,
  requiredPermissions: [],
  appCodes: ["Mobile-Patient"],
  tags: ["patient", "lab", "results"],
};
