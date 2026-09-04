/**
 * The first thing a patient sees: whether anything needs them.
 *
 * The portal opened on the Results tab, which asks somebody frightened to
 * search before it tells them anything. This answers first, from the records
 * they can already see — no new endpoint, and the same query keys as the tabs,
 * so it costs one fetch shared with them rather than four more.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { PortalAppointment, PortalInvoice, PortalLabReport } from "@medbrains/types";
import { IconAlertCircle, IconCalendar, IconFlask, IconReceipt } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import { portalDate } from "./portal-format";
import { portalWaiting } from "./portal-home";

export function PortalHome({ token, onGo }: { token: string; onGo: (tab: string) => void }) {
  const reports = useQuery({
    queryKey: ["portal-reports"],
    queryFn: () => portalService.getPortalLabReports(token),
    retry: false,
  });
  const appointments = useQuery({
    queryKey: ["portal-appointments"],
    queryFn: () => portalService.getPortalAppointments(token),
    retry: false,
  });
  const bills = useQuery({
    queryKey: ["portal-bills"],
    queryFn: () => portalService.getPortalBills(token),
    retry: false,
  });

  const loading = reports.isLoading || appointments.isLoading || bills.isLoading;
  const failed = reports.isError || appointments.isError || bills.isError;

  if (loading) {
    return (
      <Text size="sm" c="dimmed">
        Checking whether anything needs you…
      </Text>
    );
  }

  // A failed read must never become "nothing needs you today". A patient who
  // reads that stops looking.
  if (failed) {
    return (
      <Alert tone="warning" title="We could not check everything just now">
        Some of your records did not load, so this may not be the full picture. Please open the tabs
        below, or ask at reception.
      </Alert>
    );
  }

  const waiting = portalWaiting(
    {
      reports: (reports.data ?? []) as PortalLabReport[],
      appointments: (appointments.data ?? []) as PortalAppointment[],
      bills: (bills.data ?? []) as PortalInvoice[],
    },
    Date.now(),
  );

  if (waiting.nothingWaiting) {
    return (
      <Card>
        <Stack gap={4} p="md">
          <Text fw={600}>Nothing needs you today.</Text>
          <Text size="sm" c="dimmed">
            Your results, medicines, visits and bills are all below whenever you want them.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack gap="sm">
      {waiting.newResults.length > 0 && (
        <Card>
          <Group justify="space-between" wrap="nowrap" p="md">
            <Stack gap={2}>
              <Group gap="xs">
                <IconFlask size={16} />
                <Text fw={600}>
                  {waiting.newResults.length} new{" "}
                  {waiting.newResults.length === 1 ? "result" : "results"}
                </Text>
              </Group>
              <Text size="sm" c="dimmed">
                Most recent {portalDate(waiting.newResults[0]?.reported_at ?? "")}
              </Text>
            </Stack>
            {waiting.newResults.some((r) => r.flag) && (
              <Badge tone="warning" leftSection={<IconAlertCircle size={12} />}>
                Needs a look
              </Badge>
            )}
          </Group>
          <Group px="md" pb="md">
            <Button tone="primary" fullWidth onClick={() => onGo("reports")}>
              See your results
            </Button>
          </Group>
        </Card>
      )}

      {waiting.nextAppointment && (
        <Card>
          <Stack gap={2} p="md">
            <Group gap="xs">
              <IconCalendar size={16} />
              <Text fw={600}>
                Appointment on {portalDate(waiting.nextAppointment.appointment_date)}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {waiting.nextAppointment.department_name ?? "Your hospital will confirm the room"}
            </Text>
            <Button tone="secondary" fullWidth onClick={() => onGo("visits")}>
              See your visits
            </Button>
          </Stack>
        </Card>
      )}

      {waiting.amountOwed > 0 && (
        <Card>
          <Stack gap={2} p="md">
            <Group gap="xs">
              <IconReceipt size={16} />
              <Text fw={600}>₹{waiting.amountOwed.toFixed(2)} still to pay</Text>
            </Group>
            <Text size="sm" c="dimmed">
              You can settle this at the hospital billing counter.
            </Text>
            <Button tone="secondary" fullWidth onClick={() => onGo("bills")}>
              See your bills
            </Button>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
