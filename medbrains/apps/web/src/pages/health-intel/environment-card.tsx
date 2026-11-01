import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { EnvironmentView } from "@medbrains/types";
import { Badge, Card } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { AIR_RULE, airLabel, HEAT_RULE, heatLabel } from "./labels";

interface EnvironmentCardProps {
  environment: EnvironmentView;
}

function Unavailable({ environment }: EnvironmentCardProps) {
  const isOff = environment.status === "off";
  return (
    <Stack gap={4} data-testid="health-intel-environment-unavailable">
      <Text fw={600}>{isOff ? "Turned off" : "Not available"}</Text>
      <Text size="sm" c="dimmed">
        {isOff
          ? "The weather and air-quality fetch is turned off in this hospital's settings."
          : (environment.reason ?? "No reading could be fetched.")}
      </Text>
      {environment.last_good_at && (
        <Text size="xs" c="dimmed">
          Last good reading {formatDateTime(environment.last_good_at)} — not shown, because it is
          not current.
        </Text>
      )}
    </Stack>
  );
}

/** Weather and air for the hospital's location, fetched by the server. */
export function EnvironmentCard({ environment }: EnvironmentCardProps) {
  const heat = environment.heat ? heatLabel(environment.heat.level) : null;
  const air = environment.air ? airLabel(environment.air.level) : null;
  return (
    <Card padding="md" withBorder data-testid="health-intel-environment">
      <Stack gap="sm">
        <Text fw={600}>Weather and air</Text>
        {environment.status !== "current" ? (
          <Unavailable environment={environment} />
        ) : (
          <>
            <Text size="xs" c="dimmed">
              As of {formatDateTime(environment.as_of)}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Stack gap={4}>
                <Group gap="xs">
                  <Text size="sm">Heat</Text>
                  {heat && <Badge tone={heat.tone}>{heat.label}</Badge>}
                </Group>
                <Text size="sm">
                  Now {environment.temperature_c ?? "—"} °C · forecast maximum{" "}
                  {environment.forecast_max_c ?? "—"} °C
                  {environment.forecast_max_on
                    ? ` on ${formatDate(environment.forecast_max_on)}`
                    : ""}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Group gap="xs">
                  <Text size="sm">Air quality</Text>
                  {air ? <Badge tone={air.tone}>{air.label}</Badge> : <Text size="sm">—</Text>}
                </Group>
                <Text size="sm">
                  PM2.5 {environment.pm2_5 ?? "—"} µg/m³ · PM10 {environment.pm10 ?? "—"} µg/m³
                </Text>
              </Stack>
            </SimpleGrid>
          </>
        )}
        <Text size="xs" c="dimmed">
          {HEAT_RULE} {AIR_RULE} Source: Open-Meteo, fetched by the server for the hospital&apos;s
          location.
        </Text>
      </Stack>
    </Card>
  );
}
