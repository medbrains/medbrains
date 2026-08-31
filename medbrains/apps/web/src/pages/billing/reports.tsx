// Billing ReportsTab — revenue dashboard with charts, dept/doctor analytics, gateway recon.

import "@mantine/charts/styles.css";
import { BarChart } from "@mantine/charts";
import {
  Card,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import type {
  AgingBucket,
  BillingSummaryReport,
  DepartmentRevenueRow,
  DoctorRevenueRow,
  InsurancePanelRow,
} from "@medbrains/types";
import type { ReconSummary } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge, Table } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { paymentsService } from "@/services/payments.service";

// ── Helpers ──────────────────────────────────────────────

function fmtINR(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function fmtShort(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

// ── Summary Cards ────────────────────────────────────────

function ReportSummaryCards({ summary }: { summary: BillingSummaryReport }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }}>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">
          Total Invoiced
        </Text>
        <Text fw={700} size="lg">
          {fmtINR(summary.total_invoiced)}
        </Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">
          Total Collected
        </Text>
        <Text fw={700} size="lg" c="success">
          {fmtINR(summary.total_collected)}
        </Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">
          Outstanding
        </Text>
        <Text fw={700} size="lg" c="danger">
          {fmtINR(summary.total_outstanding)}
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
          {fmtINR(summary.total_refunded)}
        </Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">
          Total Discounts
        </Text>
        <Text fw={700} size="lg" c="violet">
          {fmtINR(summary.total_discounts)}
        </Text>
      </Card>
      {summary.payment_modes.map((pm) => (
        <Card key={pm.mode} withBorder p="sm">
          <Text size="xs" c="dimmed">
            {pm.mode} ({pm.count})
          </Text>
          <Text fw={700} size="lg">
            {fmtINR(pm.total)}
          </Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}

// ── Gateway Reconciliation Panel ─────────────────────────

function GatewayReconPanel({ recon }: { recon: ReconSummary }) {
  const totalTxns = recon.by_status.reduce((s, r) => s + r.txn_count, 0);
  const totalAmount = recon.by_status.reduce((s, r) => s + r.total_amount, 0);

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Gateway Reconciliation</Text>
        {recon.open_exceptions > 0 && (
          <Badge tone="danger">
            {recon.open_exceptions} exception{recon.open_exceptions > 1 ? "s" : ""}
          </Badge>
        )}
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="sm">
        <Card p="sm" withBorder>
          <Text size="xs" c="dimmed">
            Total Transactions
          </Text>
          <Text fw={700}>{totalTxns}</Text>
        </Card>
        <Card p="sm" withBorder>
          <Text size="xs" c="dimmed">
            Total Amount
          </Text>
          <Text fw={700}>{fmtINR(totalAmount)}</Text>
        </Card>
        {recon.by_status.map((row) => (
          <Card key={row.status} p="sm" withBorder>
            <Text size="xs" c="dimmed">
              {row.status.replace(/_/g, " ")}
            </Text>
            <Text fw={700}>
              {row.txn_count} / {fmtShort(row.total_amount)}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      {recon.by_status.length > 0 && (
        <Group gap="xs">
          {recon.by_status.map((row) => {
            const pct = totalTxns > 0 ? (row.txn_count / totalTxns) * 100 : 0;
            const color =
              row.status === "captured"
                ? "success"
                : row.status === "refunded"
                  ? "orange"
                  : row.status === "failed"
                    ? "danger"
                    : "blue";
            return (
              <Tooltip key={row.status} label={`${row.txn_count} txns — ${fmtINR(row.total_amount)}`}>
                <Progress
                  value={pct}
                  size="sm"
                  color={color}
                  style={{ flex: 1 }}
                />
              </Tooltip>
            );
          })}
        </Group>
      )}
    </Paper>
  );
}

// ── Main Reports Tab ─────────────────────────────────────

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

  const { data: gatewayRecon } = useQuery({
    queryKey: ["payment-recon-summary"],
    queryFn: () => paymentsService.getReconSummary(),
  });

  // ── Chart data ────────────────────────────────────────

  const deptChartData = useMemo(
    () =>
      [...deptRevenue]
        .sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue))
        .slice(0, 10)
        .map((r) => ({ department: r.department, Revenue: Number(r.total_revenue) })),
    [deptRevenue],
  );

  const doctorChartData = useMemo(
    () =>
      [...doctorRevenue]
        .sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue))
        .slice(0, 10)
        .map((r) => ({ doctor: r.doctor_name, Revenue: Number(r.total_revenue) })),
    [doctorRevenue],
  );

  const modeChartData = useMemo(() => {
    if (!summary) return [];
    return summary.payment_modes.map((pm) => ({
      mode: pm.mode,
      Amount: Number(pm.total),
    }));
  }, [summary]);

  return (
    <Stack gap="md">
      {/* Filters */}
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

      {/* Summary cards */}
      {summary && <ReportSummaryCards summary={summary} />}

      {/* Gateway Reconciliation */}
      {gatewayRecon && <GatewayReconPanel recon={gatewayRecon} />}

      {/* Today's Summary */}
      {daily && (
        <Paper withBorder p="md">
          <Text fw={600} mb="sm">
            Today&apos;s Summary
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <Card p="sm" withBorder>
              <Text size="xs" c="dimmed">
                Invoices Created
              </Text>
              <Text fw={700} size="lg">
                {daily.invoices_created}
              </Text>
            </Card>
            <Card p="sm" withBorder>
              <Text size="xs" c="dimmed">
                Invoices Issued
              </Text>
              <Text fw={700} size="lg">
                {daily.invoices_issued}
              </Text>
            </Card>
            <Card p="sm" withBorder>
              <Text size="xs" c="dimmed">
                Total Billed
              </Text>
              <Text fw={700} size="lg">
                {fmtINR(daily.total_billed)}
              </Text>
            </Card>
            <Card p="sm" withBorder>
              <Text size="xs" c="dimmed">
                Total Collected
              </Text>
              <Text fw={700} size="lg" c="success">
                {fmtINR(daily.total_collected)}
              </Text>
            </Card>
          </SimpleGrid>
        </Paper>
      )}

      {/* Department Revenue Chart (#3145) */}
      {deptChartData.length > 0 && (
        <Paper withBorder p="md">
          <Text fw={600} mb="sm">
            Department-wise Revenue
          </Text>
          <BarChart
            h={300}
            data={deptChartData}
            dataKey="department"
            series={[{ name: "Revenue", color: "blue.6" }]}
            tickLine="y"
            valueFormatter={(v) => fmtShort(v)}
          />
        </Paper>
      )}

      {/* Department Revenue Table (#3145) */}
      {deptRevenue.length > 0 && (
        <Paper withBorder p="md">
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
                  <Table.Td fw={600}>{fmtINR(d.total_revenue)}</Table.Td>
                  <Table.Td>{d.invoice_count}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Doctor Revenue Chart (#3146) */}
      {doctorChartData.length > 0 && (
        <Paper withBorder p="md">
          <Text fw={600} mb="sm">
            Doctor-wise Revenue
          </Text>
          <BarChart
            h={300}
            data={doctorChartData}
            dataKey="doctor"
            series={[{ name: "Revenue", color: "teal.6" }]}
            tickLine="y"
            valueFormatter={(v) => fmtShort(v)}
          />
        </Paper>
      )}

      {/* Doctor Revenue Table (#3146) */}
      {doctorRevenue.length > 0 && (
        <Paper withBorder p="md">
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
                  <Table.Td fw={600}>{fmtINR(d.total_revenue)}</Table.Td>
                  <Table.Td>{d.item_count}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Payment Mode Breakdown */}
      {modeChartData.length > 0 && (
        <Paper withBorder p="md">
          <Text fw={600} mb="sm">
            Revenue by Payment Mode
          </Text>
          <BarChart
            h={250}
            data={modeChartData}
            dataKey="mode"
            series={[{ name: "Amount", color: "violet.6" }]}
            tickLine="y"
            valueFormatter={(v) => fmtShort(v)}
          />
        </Paper>
      )}

      {/* Aging Analysis */}
      {aging.length > 0 && (
        <Paper withBorder p="md">
          <Text fw={600} mb="sm">
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
                  <Table.Td>{fmtINR(b.total_amount)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Collection Efficiency */}
      {efficiency && efficiency.months.length > 0 && (
        <Paper withBorder p="md">
          <Text fw={600} mb="sm">
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
                  <Table.Td>{fmtINR(m.invoiced)}</Table.Td>
                  <Table.Td>{fmtINR(m.collected)}</Table.Td>
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
        </Paper>
      )}

      {/* Insurance Panel */}
      {insurancePanel.length > 0 && (
        <Paper withBorder p="md">
          <Text fw={600} mb="sm">
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
                  <Table.Td>{fmtINR(row.total_claimed)}</Table.Td>
                  <Table.Td>{fmtINR(row.total_approved)}</Table.Td>
                  <Table.Td>{fmtINR(row.total_settled)}</Table.Td>
                  <Table.Td>
                    <Badge tone="warning">{row.pending_count}</Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Day-Close Reconciliation */}
      <Paper withBorder p="md">
        <Text fw={600} mb="sm">
          Day-Close Reconciliation
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
          <SimpleGrid cols={{ base: 2, sm: 4 }} mt="sm">
            <Card withBorder p="sm">
              <Text size="xs" c="dimmed">
                Expected Cash
              </Text>
              <Text fw={700}>{fmtINR(reconciliation.expected_cash)}</Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xs" c="dimmed">
                Actual Cash
              </Text>
              <Text fw={700}>{fmtINR(reconciliation.actual_cash)}</Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xs" c="dimmed">
                Cash Difference
              </Text>
              <Text
                fw={700}
                c={Number(reconciliation.cash_difference) === 0 ? "success" : "danger"}
              >
                {fmtINR(reconciliation.cash_difference)}
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
      </Paper>
    </Stack>
  );
}
