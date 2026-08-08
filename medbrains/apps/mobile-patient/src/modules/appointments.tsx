/**
 * Patient → appointments.
 *
 * Split into what is still coming and what has already happened, because those
 * are two different questions. Someone opening this screen almost always wants
 * the first, so it is on top and the past is below it rather than interleaved
 * by date.
 */

import type { Module } from "@medbrains/mobile-shell";
import { COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { SectionList, View } from "react-native";
import { Text } from "react-native-paper";
import { listPortalAppointments } from "../api/portal.js";
import { EntityRow } from "../components/entity-row.js";
import { ScreenHeader } from "../components/screen-header.js";
import { useFetch } from "../lib/use-fetch.js";

const MAX_ROWS = 100;

/** A cancelled appointment is not something to turn up for. */
const CANCELLED = new Set(["cancelled", "no_show"]);

function AppointmentsScreen(): ReactNode {
  const { data, loading, error, refetch } = useFetch(listPortalAppointments, []);

  const sections = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = (data ?? []).slice(0, MAX_ROWS);
    const upcoming = rows.filter(
      (row) => row.appointment_date >= today && !CANCELLED.has(row.status),
    );
    // Oldest-first within upcoming: the next one is the one that matters.
    upcoming.sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
    // Set membership, not a nested scan over `upcoming` per row.
    const upcomingIds = new Set(upcoming.map((row) => row.id));
    const past = rows.filter((row) => !upcomingIds.has(row.id));

    return [
      ...(upcoming.length > 0 ? [{ title: "Coming up", data: upcoming }] : []),
      ...(past.length > 0 ? [{ title: "Earlier", data: past }] : []),
    ];
  }, [data]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="VISITS"
        title="Your appointments"
        description="Booked visits, newest first."
      />

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {!loading && error && (
        <Empty
          title="Couldn't load your appointments"
          description={error}
          actionLabel="Try again"
          onAction={refetch}
        />
      )}

      {!loading && !error && sections.length === 0 && (
        <Empty title="No appointments" description="You have no booked visits." />
      )}

      {!loading && !error && sections.length > 0 && (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text
              variant="labelMedium"
              style={{
                color: COLORS.brandDeep,
                paddingTop: SPACING.sm,
                paddingBottom: SPACING.xs,
              }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <View style={{ marginBottom: SPACING.sm }}>
              <EntityRow
                title={new Date(item.appointment_date).toLocaleDateString()}
                subtitle={item.department_name ?? "Department to be confirmed"}
                badge={{
                  label: item.status.replace("_", " "),
                  tone: CANCELLED.has(item.status) ? "alert" : "info",
                }}
              />
            </View>
          )}
          contentContainerStyle={{ padding: SPACING.md }}
        />
      )}
    </View>
  );
}

export const appointmentsModule: Module = {
  id: "appointments",
  displayName: "Appointments",
  icon: () => null,
  navigator: AppointmentsScreen,
  requiredPermissions: [],
  appCodes: ["Mobile-Patient"],
  tags: ["patient", "appointments", "visits"],
};
