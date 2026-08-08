/**
 * A doctor's own clinic for today.
 *
 * The list is filtered by the signed-in doctor rather than by a picker. A
 * doctor checking their phone between rounds wants their own clinic, and there
 * is no reason for the app to offer anyone else's.
 *
 * It leads with the next patient because that is the question being asked. The
 * full list underneath is context for it, not the point of the screen.
 */

import { useAuthStore } from "@medbrains/mobile-shell";
import { Badge, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { FlatList, View } from "react-native";
import { Text } from "react-native-paper";
import type { AppointmentRow } from "../../api/opd.js";
import { listMyAppointments } from "../../api/opd.js";
import { EntityRow } from "../../components/entity-row.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { byClinicTime, isStillToCome, nextPatient, remainingCount } from "../../lib/clinic-day.js";
import { useFetch } from "../../lib/use-fetch.js";

/** A day's clinic; more than this is a data problem, not a workload. */
const MAX_ROWS = 100;

export function MyClinicScreen(): ReactNode {
  const doctorId = useAuthStore((state) => state.identity?.userId ?? "");
  const today = new Date().toISOString().slice(0, 10);

  const { data, loading, error, refetch } = useFetch(
    () => listMyAppointments(doctorId, today),
    [doctorId, today],
  );

  const appointments = useMemo(() => byClinicTime(data ?? []).slice(0, MAX_ROWS), [data]);
  const next = useMemo(() => nextPatient(appointments), [appointments]);
  const remaining = useMemo(() => remainingCount(appointments), [appointments]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="CLINIC"
        title="Today"
        description="Your appointments, earliest first."
        trailing={remaining > 0 ? <Badge tone="info" label={`${remaining} left`} /> : undefined}
      />

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {!loading && error && (
        <Empty
          title="Couldn't load your clinic"
          description={error}
          actionLabel="Try again"
          onAction={refetch}
        />
      )}

      {!loading && !error && appointments.length === 0 && (
        <Empty title="Nothing booked today" description="No appointments on your list." />
      )}

      {!loading && !error && appointments.length > 0 && (
        <>
          <View style={{ padding: SPACING.md, gap: 2 }}>
            <Text variant="labelMedium" style={{ color: COLORS.brandDeep }}>
              {next ? "Next" : "Clinic finished"}
            </Text>
            <Text variant="titleLarge" style={{ color: COLORS.ink, fontWeight: "700" }}>
              {next
                ? `${next.start_time ?? "No time"} · ${next.patient_name ?? "Patient"}`
                : "Everyone has been seen"}
            </Text>
          </View>
          <FlatList
            data={appointments}
            keyExtractor={(appointment) => appointment.id}
            renderItem={({ item }) => <AppointmentCard appointment={item} />}
            contentContainerStyle={{ padding: SPACING.md }}
          />
        </>
      )}
    </View>
  );
}

function AppointmentCard({ appointment }: { appointment: AppointmentRow }): ReactNode {
  const open = isStillToCome(appointment);

  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <EntityRow
        title={appointment.patient_name ?? "Patient"}
        subtitle={`${appointment.start_time ?? "No time set"}${
          appointment.reason ? ` · ${appointment.reason}` : ""
        }`}
        // Only what is still to come is emphasised; the rest is history.
        accent={false}
        badge={{
          label: appointment.status.replace(/_/g, " "),
          tone: open ? "info" : "neutral",
        }}
      />
    </View>
  );
}
