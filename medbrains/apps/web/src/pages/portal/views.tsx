/**
 * The four things a patient came to the portal for.
 *
 * Each is a list and nothing more. A portal that tries to interpret results
 * for a patient is a portal that will one day interpret one wrongly, so these
 * show what the record says and leave the reading to the clinician who ordered
 * it.
 */

import { Group, Stack, Text } from "@mantine/core";
import type {
  PortalAppointment,
  PortalInvoice,
  PortalLabReport,
  PortalPrescriptionItem,
} from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import { flagTone, isOutsideRange, portalDate } from "./portal-format";
import { PortalList } from "./portal-list";

export function PortalReports({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["portal-reports"],
    queryFn: () => portalService.getPortalLabReports(token),
    retry: false,
  });

  return (
    <PortalList
      query={query}
      empty="No results have been released to you yet. Results appear here once a pathologist has checked them."
    >
      {(rows: PortalLabReport[]) =>
        rows.map((row) => (
          <Card key={`${row.order_id}-${row.parameter_name}`}>
            <Stack gap={4} p="md">
              <Group justify="space-between" wrap="nowrap">
                <Text fw={600}>{row.parameter_name}</Text>
                {row.flag && <Badge tone={flagTone(row.flag)}>{row.flag}</Badge>}
              </Group>
              <Text size="xl" fw={700}>
                {row.value}
                {row.unit ? ` ${row.unit}` : ""}
              </Text>
              {row.normal_range && (
                <Text size="sm" c="dimmed">
                  Usual range {row.normal_range}
                </Text>
              )}
              <Text size="xs" c="dimmed">
                {row.test_name} · {portalDate(row.reported_at)}
              </Text>
              {isOutsideRange(row.flag) && (
                <Text size="xs">
                  A result outside the usual range is common and often not a problem. Your doctor
                  will go through it with you.
                </Text>
              )}
            </Stack>
          </Card>
        ))
      }
    </PortalList>
  );
}

export function PortalPrescriptions({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["portal-prescriptions"],
    queryFn: () => portalService.getPortalPrescriptions(token),
    retry: false,
  });

  return (
    <PortalList query={query} empty="No medicines have been prescribed to you here yet.">
      {(rows: PortalPrescriptionItem[]) =>
        // Keyed on the line's own values, not its position: a prescription
        // has no per-item id, and an index key makes React reuse the wrong row
        // when a list changes underneath it.
        rows.map((row) => (
          <Card key={`${row.prescription_id}-${row.drug_name}-${row.dosage}-${row.frequency}`}>
            <Stack gap={2} p="md">
              <Text fw={600}>{row.drug_name}</Text>
              <Text size="sm">
                {row.dosage} · {row.frequency} · {row.duration}
              </Text>
              <Text size="xs" c="dimmed">
                Prescribed {portalDate(row.prescribed_at)}
              </Text>
            </Stack>
          </Card>
        ))
      }
    </PortalList>
  );
}

export function PortalBills({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["portal-bills"],
    queryFn: () => portalService.getPortalBills(token),
    retry: false,
  });

  return (
    <PortalList query={query} empty="You have no bills here.">
      {(rows: PortalInvoice[]) =>
        rows.map((row) => (
          <Card key={row.id}>
            <Stack gap={4} p="md">
              <Group justify="space-between" wrap="nowrap">
                <Text fw={600}>{row.invoice_number}</Text>
                <Badge tone={Number(row.balance_due) > 0 ? "warning" : "success"}>
                  {Number(row.balance_due) > 0 ? "due" : "paid"}
                </Badge>
              </Group>
              <Text size="lg" fw={700}>
                {row.balance_due} due
              </Text>
              <Text size="xs" c="dimmed">
                {row.total_amount} total · {row.paid_amount} paid · {portalDate(row.created_at)}
              </Text>
            </Stack>
          </Card>
        ))
      }
    </PortalList>
  );
}

export function PortalAppointments({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["portal-appointments"],
    queryFn: () => portalService.getPortalAppointments(token),
    retry: false,
  });

  return (
    <PortalList query={query} empty="You have no visits recorded here.">
      {(rows: PortalAppointment[]) =>
        rows.map((row) => (
          <Card key={row.id}>
            <Group justify="space-between" p="md" wrap="nowrap">
              <Stack gap={2}>
                <Text fw={600}>{row.appointment_date}</Text>
                <Text size="sm" c="dimmed">
                  {row.department_name ?? "Department not recorded"}
                </Text>
              </Stack>
              <Badge tone="neutral">{row.status.replace(/_/g, " ")}</Badge>
            </Group>
          </Card>
        ))
      }
    </PortalList>
  );
}
