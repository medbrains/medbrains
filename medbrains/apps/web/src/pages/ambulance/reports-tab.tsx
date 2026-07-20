// Ambulance ReportsTab — split from ambulance.tsx (pure move).

import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { ambulanceService } from "@/services/ambulance.service";

export function ReportsTab() {
  const { data: trips = [] } = useQuery({
    queryKey: ["ambulance-trips"],
    queryFn: () => ambulanceService.listAmbulanceTrips(),
  });

  const { data: ambulances = [] } = useQuery({
    queryKey: ["ambulances"],
    queryFn: () => ambulanceService.listAmbulances(),
  });

  const today = new Date().toISOString().split("T")[0] ?? "";
  const tripsToday = trips.filter((t) => t.requested_at.startsWith(today));
  const activeTrips = trips.filter((t) => !["completed", "cancelled"].includes(t.status));
  const completedTrips = trips.filter(
    (t) => t.status === "completed" && t.dispatched_at && t.pickup_arrived_at,
  );
  const avgResponseMin =
    completedTrips.length > 0
      ? Math.round(
          completedTrips.reduce((sum, trip) => {
            if (!trip.pickup_arrived_at || !trip.dispatched_at) return sum;
            return (
              sum +
              (new Date(trip.pickup_arrived_at).getTime() -
                new Date(trip.dispatched_at).getTime()) /
                60000
            );
          }, 0) / completedTrips.length,
        )
      : 0;
  const fleetUtil =
    ambulances.length > 0
      ? Math.round(
          (ambulances.filter((a) => a.status === "on_trip").length /
            ambulances.filter((a) => a.status !== "decommissioned").length) *
            100,
        )
      : 0;

  return (
    <Stack>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Trips Today
          </Text>
          <Text size="xl" fw={700}>
            {tripsToday.length}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Active Trips
          </Text>
          <Text size="xl" fw={700} c="blue">
            {activeTrips.length}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Avg Response Time
          </Text>
          <Text size="xl" fw={700} c={avgResponseMin <= 15 ? "green" : "orange"}>
            {avgResponseMin}m
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Fleet Utilization
          </Text>
          <Text size="xl" fw={700}>
            {fleetUtil}%
          </Text>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

// ── Main Page ───────────────────────────────────────────
