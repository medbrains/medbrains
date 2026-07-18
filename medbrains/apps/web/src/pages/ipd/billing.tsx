// IPD BillingTab — split from ipd.tsx (pure move).

import { DocumentActions } from "@/components";
import { Badge, Button, Table, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { BillingSummaryResponse, EstimatedCostResponse, IpTypeConfiguration, Receipt } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function BillingTab({ admissionId }: { admissionId: string }) {
  const billingQueryClient = useQueryClient();
  const { data: costData } = useQuery({
    queryKey: ["ipd-estimated-cost", admissionId],
    queryFn: () => ipdService.getEstimatedCost(admissionId),
  });
  const { data: noDues } = useQuery({
    queryKey: ["ipd-no-dues", admissionId],
    queryFn: () => ipdService.getNoDuesCertificate(admissionId),
  });
  const issueNoDues = useMutation({
    mutationFn: () => ipdService.issueNoDuesCertificate(admissionId, {}),
    onSuccess: () => {
      toast.success("No-Dues certificate issued — patient cleared for discharge.", {
        title: "Financial clearance",
      });
      void billingQueryClient.invalidateQueries({ queryKey: ["ipd-no-dues", admissionId] });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Cannot issue No-Dues" }),
  });
  const { data: summaryData } = useQuery({
    queryKey: ["ipd-billing-summary", admissionId],
    queryFn: () => ipdService.getAdmissionBillingSummary(admissionId),
  });
  const { data: advances } = useQuery({
    queryKey: ["ipd-advances", admissionId],
    queryFn: () => ipdService.getAdmissionAdvances(admissionId),
  });
  const { data: ipTypes } = useQuery({
    queryKey: ["ipd-ip-types"],
    queryFn: () => ipdService.listIpTypes(),
  });

  const cost = costData as EstimatedCostResponse | undefined;
  const billing = summaryData as BillingSummaryResponse | undefined;
  const ipTypeConfigs = (ipTypes ?? []) as IpTypeConfiguration[];
  const configWithThreshold = ipTypeConfigs.find(
    (c) => c.billing_alert_threshold != null && c.billing_alert_threshold > 0,
  );
  const alertThreshold = configWithThreshold?.billing_alert_threshold;
  const thresholdExceeded =
    billing && alertThreshold != null ? billing.total_charges > alertThreshold : false;

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>
          Billing
        </Text>
        <DocumentActions templateCode="ipd_consolidated_bill" sourceId={admissionId} size="sm" />
      </Group>
      <Card withBorder p="sm">
        <Group justify="space-between" align="center">
          <Stack gap={0}>
            <Text size="sm" fw={600}>
              No-Dues certificate
            </Text>
            <Text size="xs" c="dimmed">
              {noDues
                ? `Issued · balance ₹${noDues.balance}`
                : "Issue once the admission balance is settled"}
            </Text>
          </Stack>
          <Group gap="xs">
            {!noDues && (
              <Button
                size="sm"
                onClick={() => issueNoDues.mutate()}
                loading={issueNoDues.isPending}
              >
                Issue No-Dues
              </Button>
            )}
            {noDues && (
              <DocumentActions
                templateCode="no_dues_certificate"
                sourceId={admissionId}
                size="sm"
              />
            )}
          </Group>
        </Group>
      </Card>
      {thresholdExceeded && configWithThreshold && (
        <Card withBorder p="sm" bg="red.0" style={{ borderColor: "var(--mantine-color-red-4)" }}>
          <Group gap="xs">
            <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
            <Text size="sm" fw={600} c="red.8">
              Billing Alert: Total charges ({billing?.total_charges}) exceed threshold (
              {configWithThreshold.billing_alert_threshold})
            </Text>
          </Group>
        </Card>
      )}

      {cost && (
        <Card withBorder p="sm">
          <Text fw={600} mb="xs">
            Estimated Cost
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <div>
              <Text size="xs" c="dimmed">
                Daily Rate
              </Text>
              <Text fw={500}>{cost.daily_rate}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Nursing/day
              </Text>
              <Text fw={500}>{cost.nursing_charge}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Est. Days
              </Text>
              <Text fw={500}>{cost.estimated_days}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Deposit Required
              </Text>
              <Text fw={500}>{cost.deposit_required}</Text>
            </div>
          </SimpleGrid>
          <Group mt="xs">
            <Badge size="lg" tone="primary">
              Room: {cost.room_total}
            </Badge>
            <Badge size="lg" tone="success">
              Nursing: {cost.nursing_total}
            </Badge>
            <Badge size="lg" tone="primary" variant="filled">
              Total Est.: {cost.total_estimated}
            </Badge>
          </Group>
        </Card>
      )}

      {billing && (
        <Card withBorder p="sm">
          <Text fw={600} mb="xs">
            Charges Summary
          </Text>
          {billing.charges_by_dept.length > 0 ? (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Category</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {billing.charges_by_dept.map((d) => (
                  <Table.Tr key={d.department_name}>
                    <Table.Td>
                      <Text size="sm">{d.department_name}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Text size="sm">{d.total}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text size="sm" c="dimmed">
              No charges recorded yet.
            </Text>
          )}
          <Group mt="sm">
            <Badge size="lg">Charges: {billing.total_charges}</Badge>
            <Badge size="lg" tone="success">
              Payments: {billing.total_payments}
            </Badge>
            <Badge
              size="lg"
              tone={billing.outstanding_balance > 0 ? "danger" : "success"}
              variant="filled"
            >
              Outstanding: {billing.outstanding_balance}
            </Badge>
          </Group>
        </Card>
      )}

      <Card withBorder p="sm">
        <Text fw={600} mb="xs">
          Advance Payments
        </Text>
        {(advances ?? []).length > 0 ? (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Receipt #</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Date</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(advances ?? []).map((r: Receipt) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <Text size="sm">{r.receipt_number}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{String(r.amount)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{new Date(r.receipt_date).toLocaleDateString()}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed">
            No advance payments recorded.
          </Text>
        )}
      </Card>
    </Stack>
  );
}
