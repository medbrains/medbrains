import { Group, Stack, Text } from "@mantine/core";
import type { LabB2bCreditSummary, LabReferralDoctor, LabReferralPayout } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DataTable } from "@/components";
import { Alert, Badge } from "@/components/ui";
import { labService } from "@/services/lab.service";

/**
 * Referral commission and outstanding client credit.
 *
 * Both are money and neither had a screen: `credit_used` was never shown
 * against `credit_limit`, and the word "payout" did not appear anywhere in the
 * web app. A referring doctor's commission and a client's outstanding balance
 * were computable and invisible.
 */
const money = (value: string | null | undefined) =>
  value == null ? "—" : `₹${Number(value).toLocaleString("en-IN")}`;

export function LabReferralCreditSection() {
  const { data: doctors = [], isError: doctorsFailed } = useQuery({
    queryKey: ["lab-referral-doctors"],
    queryFn: () => labService.listLabReferralDoctors(),
  });

  const { data: payouts = [], isError: payoutsFailed } = useQuery({
    queryKey: ["lab-referral-payouts"],
    queryFn: () => labService.listLabReferralPayouts(),
  });

  const { data: credit = [], isError: creditFailed } = useQuery({
    queryKey: ["lab-b2b-credit"],
    queryFn: () => labService.getLabB2bCreditSummary(),
  });

  const doctorName = (id: string) =>
    doctors.find((d: LabReferralDoctor) => d.id === id)?.name ?? "Unknown referrer";

  // Over limit is the number that matters: a client past their ceiling should
  // not be taking more work on credit, and nobody could see it before.
  const overLimit = useMemo(
    () =>
      credit.filter(
        (row: LabB2bCreditSummary) =>
          row.credit_available != null && Number(row.credit_available) < 0,
      ),
    [credit],
  );

  const unpaid = useMemo(
    () => payouts.filter((p: LabReferralPayout) => p.status !== "paid"),
    [payouts],
  );

  const creditColumns = [
    {
      key: "name",
      label: "Client",
      render: (row: LabB2bCreditSummary) => <Text fw={500}>{row.name}</Text>,
    },
    {
      key: "credit_limit",
      label: "Limit",
      render: (row: LabB2bCreditSummary) => <Text size="sm">{money(row.credit_limit)}</Text>,
    },
    {
      key: "credit_used",
      label: "Used",
      render: (row: LabB2bCreditSummary) => <Text size="sm">{money(row.credit_used)}</Text>,
    },
    {
      key: "credit_available",
      label: "Available",
      render: (row: LabB2bCreditSummary) => {
        const over = row.credit_available != null && Number(row.credit_available) < 0;
        return (
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" fw={over ? 600 : 400}>
              {money(row.credit_available)}
            </Text>
            {over && (
              <Badge tone="danger" size="sm">
                Over limit
              </Badge>
            )}
          </Group>
        );
      },
    },
    {
      key: "payment_terms_days",
      label: "Terms",
      render: (row: LabB2bCreditSummary) => (
        <Text size="sm" c="dimmed">
          {row.payment_terms_days != null ? `${row.payment_terms_days} days` : "—"}
        </Text>
      ),
    },
  ];

  const payoutColumns = [
    {
      key: "referral_doctor_id",
      label: "Referrer",
      render: (row: LabReferralPayout) => (
        <Text fw={500}>{doctorName(row.referral_doctor_id)}</Text>
      ),
    },
    {
      key: "period",
      label: "Period",
      render: (row: LabReferralPayout) => (
        <Text size="sm">
          {row.period_start} → {row.period_end}
        </Text>
      ),
    },
    {
      key: "order_count",
      label: "Orders",
      render: (row: LabReferralPayout) => <Text size="sm">{row.order_count}</Text>,
    },
    {
      key: "total_revenue",
      label: "Revenue",
      render: (row: LabReferralPayout) => <Text size="sm">{money(row.total_revenue)}</Text>,
    },
    {
      key: "commission_amount",
      label: "Commission",
      render: (row: LabReferralPayout) => (
        <Text size="sm" fw={500}>
          {money(row.commission_amount)}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: LabReferralPayout) => (
        <Badge tone={row.status === "paid" ? "success" : "warning"} size="sm">
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      {(creditFailed || payoutsFailed || doctorsFailed) && (
        <Alert tone="danger" title="Some figures could not be loaded">
          Do not read a missing row as a zero balance or a settled commission.
        </Alert>
      )}

      {overLimit.length > 0 && (
        <Alert tone="danger" title={`${overLimit.length} client(s) over their credit limit`}>
          These clients have used more credit than they were granted. Taking further work on credit
          adds to a balance already past its ceiling.
        </Alert>
      )}

      <Group justify="space-between">
        <Text fw={600}>Client credit</Text>
        <Text size="sm" c="dimmed">
          {credit.length} active client(s)
        </Text>
      </Group>
      <DataTable
        columns={creditColumns}
        data={credit}
        rowKey={(row: LabB2bCreditSummary) => row.id}
        emptyTitle={creditFailed ? "Credit could not be loaded" : "No active clients"}
        emptyDescription={
          creditFailed
            ? "The list failed to load — this is not a statement that nothing is owed."
            : "Referring clients with credit terms appear here."
        }
      />

      <Group justify="space-between">
        <Text fw={600}>Referral commission</Text>
        <Text size="sm" c="dimmed">
          {unpaid.length} period(s) unpaid
        </Text>
      </Group>
      <DataTable
        columns={payoutColumns}
        data={payouts}
        rowKey={(row: LabReferralPayout) => row.id}
        emptyTitle={payoutsFailed ? "Payouts could not be loaded" : "No commission periods"}
        emptyDescription={
          payoutsFailed
            ? "The list failed to load — this is not a statement that nothing is owed."
            : "Commission periods appear here once they are raised."
        }
      />
    </Stack>
  );
}
