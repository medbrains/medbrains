// Billing ReportsTab — split from billing.tsx (pure move).

import { Card, Group, Progress, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import type {
  AgingBucket,
  BillingSummaryReport,
  DepartmentRevenueRow,
  DoctorRevenueRow,
  InsurancePanelRow,
} from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Table } from "@/components/ui";
import { billingService } from "@/services/billing.service";

function ReportSummaryCards({ summary }: { summary: BillingSummaryReport }) {
  return (
    <SimpleGrid cols={4}>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">
          Total Invoiced
        </Text>
        <Text fw={700} size="lg">
          ₹{summary.total_invoiced}
        </Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">
          Total Collected
        </Text>
        <Text fw={700} size="lg" c="success">
          ₹{summary.total_collected}
        </Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">
          Outstanding
        </Text>
        <Text fw={700} size="lg" c="danger">
          ₹{summary.total_outstanding}
        </Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">
          Invoices
        </Text>
        <Text fw={700} size="lg">
          {summary.invoice_count}
        </Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">
          Total Refunded
        </Text>
        <Text fw={700} size="lg" c="orange">
          ₹{summary.total_refunded}
        </Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">
          Total Discounts
        </Text>
        <Text fw={700} size="lg" c="violet">
          ₹{summary.total_discounts}
        </Text>
      </Card>
      {summary.payment_modes.map((pm) => (
        <Card key={pm.mode} withBorder p="sm">
          <Text size="xs" c="dimmed">
            {pm.mode} ({pm.count})
          </Text>
          <Text fw={700} size="lg">
            ₹{pm.total}
          </Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}

// ── Day Close Tab ─────────────────────────────────────────

export function ReportsTab() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [fromStr, setFromStr] = useState(() => thirtyDaysAgo.toISOString().slice(0, 10));
  const [toStr, setToStr] = useState(() => today.toISOString().slice(0, 10));
  const [reconDate, setReconDate] = useState(() => today.toISOString().slice(0, 10));

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["billing-report-summary", fromStr, toStr],
    queryFn: () => billingService.billingReportSummary(fromStr, toStr),
    enabled: !!fromStr && !!toStr,
  });

  const { data: deptRevenue = [] } = useQuery({
    queryKey: ["billing-report-dept", fromStr, toStr],
    queryFn: () => billingService.billingReportDepartmentRevenue(fromStr, toStr),
    enabled: !!fromStr && !!toStr,
  });

  const { data: aging = [] } = useQuery({
    queryKey: ["billing-report-aging"],
    queryFn: () => billingService.billingReportAging(),
  });

  const { data: efficiency } = useQuery({
    queryKey: ["billing-report-efficiency", fromStr, toStr],
    queryFn: () => billingService.billingReportCollectionEfficiency(fromStr, toStr),
    enabled: !!fromStr && !!toStr,
  });

  const todayStr = today.toISOString().slice(0, 10);
  const { data: daily } = useQuery({
    queryKey: ["billing-report-daily", todayStr],
    queryFn: () => billingService.billingReportDaily(todayStr),
  });

  const { data: doctorRevenue = [] } = useQuery({
    queryKey: ["billing-report-doctor-revenue", fromStr, toStr],
    queryFn: () => billingService.billingReportDoctorRevenue(fromStr, toStr),
    enabled: !!fromStr && !!toStr,
  });

  const { data: insurancePanel = [] } = useQuery({
    queryKey: ["billing-report-insurance-panel", fromStr, toStr],
    queryFn: () => billingService.billingReportInsurancePanel(fromStr, toStr),
    enabled: !!fromStr && !!toStr,
  });

  const { data: reconciliation } = useQuery({
    queryKey: ["billing-report-reconciliation", reconDate],
    queryFn: () => billingService.billingReportReconciliation(reconDate),
    enabled: !!reconDate,
  });

  return (
    <Stack>
      <Group>
        <TextInput
          label="From"
          type="date"
          value={fromStr}
          onChange={(e) => setFromStr(e.currentTarget.value)}
        />
        <TextInput
          label="To"
          type="date"
          value={toStr}
          onChange={(e) => setToStr(e.currentTarget.value)}
        />
      </Group>

      {summaryLoading && <Text c="dimmed">Loading reports...</Text>}

      {summary && <ReportSummaryCards summary={summary} />}

      {daily && (
        <>
          <Text fw={600} mt="md">
            Today&apos;s Summary
          </Text>
          <SimpleGrid cols={4}>
            <Card withBorder p="sm">
              <Text size="xs" c="dimmed">
                Invoices Created
              </Text>
              <Text fw={700} size="lg">
                {daily.invoices_created}
              </Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xs" c="dimmed">
                Invoices Issued
              </Text>
              <Text fw={700} size="lg">
                {daily.invoices_issued}
              </Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xs" c="dimmed">
                Total Billed
              </Text>
              <Text fw={700} size="lg">
                ₹{daily.total_billed}
              </Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xs" c="dimmed">
                Total Collected
              </Text>
              <Text fw={700} size="lg" c="success">
                ₹{daily.total_collected}
              </Text>
            </Card>
          </SimpleGrid>
        </>
      )}

      {aging.length > 0 && (
        <>
          <Text fw={600} mt="md">
            Aging Analysis
          </Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Bucket</Table.Th>
                <Table.Th>Count</Table.Th>
                <Table.Th>Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {aging.map((b: AgingBucket) => (
                <Table.Tr key={b.bucket}>
                  <Table.Td>
                    <Badge
                      tone={
                        b.bucket.includes("90")
                          ? "danger"
                          : b.bucket.includes("60")
                            ? "warning"
                            : b.bucket.includes("30")
                              ? "warning"
                              : "success"
                      }
                    >
                      {b.bucket}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{b.count}</Table.Td>
                  <Table.Td>₹{b.total_amount}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {deptRevenue.length > 0 && (
        <>
          <Text fw={600} mt="md">
            Department Revenue
          </Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Department</Table.Th>
                <Table.Th>Revenue</Table.Th>
                <Table.Th>Invoices</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {deptRevenue.map((d: DepartmentRevenueRow) => (
                <Table.Tr key={d.department}>
                  <Table.Td>{d.department}</Table.Td>
                  <Table.Td>₹{d.total_revenue}</Table.Td>
                  <Table.Td>{d.invoice_count}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {efficiency && efficiency.months.length > 0 && (
        <>
          <Text fw={600} mt="md">
            Collection Efficiency
          </Text>
          <Text size="sm" c="dimmed" mb="xs">
            Overall rate: {efficiency.overall_rate}%
          </Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Month</Table.Th>
                <Table.Th>Invoiced</Table.Th>
                <Table.Th>Collected</Table.Th>
                <Table.Th>Rate</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {efficiency.months.map((m) => (
                <Table.Tr key={m.month}>
                  <Table.Td>{m.month}</Table.Td>
                  <Table.Td>₹{m.invoiced}</Table.Td>
                  <Table.Td>₹{m.collected}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Progress
                        value={Number(m.rate)}
                        size="sm"
                        w={80}
                        color={
                          Number(m.rate) > 80
                            ? "success"
                            : Number(m.rate) > 50
                              ? "warning"
                              : "danger"
                        }
                      />
                      <Text size="xs">{m.rate}%</Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {doctorRevenue.length > 0 && (
        <>
          <Text fw={600} mt="md">
            Doctor Revenue
          </Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Doctor</Table.Th>
                <Table.Th>Revenue</Table.Th>
                <Table.Th>Items</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {doctorRevenue.map((d: DoctorRevenueRow) => (
                <Table.Tr key={d.doctor_id ?? "unassigned"}>
                  <Table.Td>{d.doctor_name}</Table.Td>
                  <Table.Td>₹{d.total_revenue}</Table.Td>
                  <Table.Td>{d.item_count}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {insurancePanel.length > 0 && (
        <>
          <Text fw={600} mt="md">
            Insurance Panel
          </Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Provider</Table.Th>
                <Table.Th>Claims</Table.Th>
                <Table.Th>Claimed</Table.Th>
                <Table.Th>Approved</Table.Th>
                <Table.Th>Settled</Table.Th>
                <Table.Th>Pending</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {insurancePanel.map((row: InsurancePanelRow) => (
                <Table.Tr key={row.insurance_provider}>
                  <Table.Td>{row.insurance_provider}</Table.Td>
                  <Table.Td>{row.total_claims}</Table.Td>
                  <Table.Td>₹{row.total_claimed}</Table.Td>
                  <Table.Td>₹{row.total_approved}</Table.Td>
                  <Table.Td>₹{row.total_settled}</Table.Td>
                  <Table.Td>
                    <Badge tone="warning">{row.pending_count}</Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      <Text fw={600} mt="md">
        Reconciliation
      </Text>
      <Group>
        <TextInput
          label="Date"
          type="date"
          value={reconDate}
          onChange={(e) => setReconDate(e.currentTarget.value)}
        />
      </Group>
      {reconciliation && (
        <SimpleGrid cols={4} mt="xs">
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              Expected Cash
            </Text>
            <Text fw={700}>₹{reconciliation.expected_cash}</Text>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              Actual Cash
            </Text>
            <Text fw={700}>₹{reconciliation.actual_cash}</Text>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              Cash Difference
            </Text>
            <Text fw={700} c={Number(reconciliation.cash_difference) === 0 ? "success" : "danger"}>
              ₹{reconciliation.cash_difference}
            </Text>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              Status
            </Text>
            <Badge
              tone={
                reconciliation.status === "verified"
                  ? "success"
                  : reconciliation.status === "discrepancy"
                    ? "danger"
                    : "primary"
              }
            >
              {reconciliation.status}
            </Badge>
          </Card>
        </SimpleGrid>
      )}
    </Stack>
  );
}
