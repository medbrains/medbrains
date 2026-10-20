import { Group, Stack, Text } from "@mantine/core";
import type { DoctorPayoutSummaryRow, PayoutTdsRow, ReferralComplianceRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Input, SegmentedControl } from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { currentFinancialYear, errorText, monthStartIso, rupees, todayIso } from "./shared";

const summaryColumns = [
  { key: "doctor", label: "Doctor", render: (r: DoctorPayoutSummaryRow) => r.doctor_name },
  {
    key: "revenue",
    label: "Billed for their services",
    render: (r: DoctorPayoutSummaryRow) => rupees(r.revenue),
  },
  { key: "earned", label: "Earned", render: (r: DoctorPayoutSummaryRow) => rupees(r.earned) },
  { key: "paid", label: "Paid (net)", render: (r: DoctorPayoutSummaryRow) => rupees(r.paid) },
  { key: "tds", label: "TDS", render: (r: DoctorPayoutSummaryRow) => rupees(r.tds) },
  {
    key: "awaiting",
    label: "Approved, unpaid",
    render: (r: DoctorPayoutSummaryRow) => rupees(r.awaiting_payment),
  },
];

const tdsColumns = [
  { key: "payee", label: "Deductee", render: (r: PayoutTdsRow) => r.payee_name ?? "—" },
  { key: "pan", label: "PAN", render: (r: PayoutTdsRow) => r.payee_pan ?? "PANNOTAVBL" },
  {
    key: "section",
    label: "Section",
    render: (r: PayoutTdsRow) => `${r.tds_section ?? "—"} @ ${r.tds_rate ?? "—"}%`,
  },
  { key: "gross", label: "Paid", render: (r: PayoutTdsRow) => rupees(r.gross) },
  { key: "tds", label: "TDS", render: (r: PayoutTdsRow) => rupees(r.tds_amount) },
  { key: "quarter", label: "Quarter", render: (r: PayoutTdsRow) => r.quarter ?? "—" },
  {
    key: "challan",
    label: "Challan",
    render: (r: PayoutTdsRow) => r.challan_number ?? "Not deposited",
  },
];

const referralColumns = [
  { key: "partner", label: "Partner", render: (r: ReferralComplianceRow) => r.partner_name ?? "—" },
  {
    key: "kind",
    label: "Kind",
    render: (r: ReferralComplianceRow) => (
      <Badge tone={r.partner_kind === "individual" ? "warning" : "neutral"}>{r.partner_kind}</Badge>
    ),
  },
  {
    key: "period",
    label: "Period",
    render: (r: ReferralComplianceRow) => `${r.period_start} – ${r.period_end}`,
  },
  {
    key: "commission",
    label: "Commission",
    render: (r: ReferralComplianceRow) => rupees(r.commission),
  },
  { key: "tds", label: "TDS", render: (r: ReferralComplianceRow) => rupees(r.tds_amount) },
  {
    key: "who",
    label: "Prepared / approved",
    render: (r: ReferralComplianceRow) =>
      `${r.prepared_by_name ?? "—"} / ${r.approved_by_name ?? "—"}`,
  },
  { key: "status", label: "Status", render: (r: ReferralComplianceRow) => r.status },
];

function Failed({ error }: { error: unknown }) {
  return (
    <Alert tone="danger" title="The report could not be loaded">
      {errorText(error)} An empty report here would mean nothing loaded, not nothing happened.
    </Alert>
  );
}

/** Doctor-wise earnings, the TDS register and the referral compliance report. */
export function ReportsTab() {
  const [view, setView] = useState("summary");
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [fy, setFy] = useState(currentFinancialYear());
  const summary = useQuery({
    queryKey: ["doctor-payouts", "report", "summary", from, to],
    queryFn: () => doctorPayoutsService.getDoctorPayoutSummary(from, to),
    enabled: view === "summary",
  });
  const tds = useQuery({
    queryKey: ["doctor-payouts", "report", "tds", fy],
    queryFn: () => doctorPayoutsService.getPayoutTdsRegister(fy),
    enabled: view === "tds",
  });
  const referral = useQuery({
    queryKey: ["doctor-payouts", "report", "referral", fy],
    queryFn: () => doctorPayoutsService.getReferralCompliance(fy),
    enabled: view === "referral",
  });
  return (
    <Stack gap="md">
      <Group align="flex-end">
        <SegmentedControl
          value={view}
          onChange={setView}
          data={[
            { value: "summary", label: "Doctor-wise" },
            { value: "tds", label: "TDS register" },
            { value: "referral", label: "Referral compliance" },
          ]}
        />
        {view === "summary" ? (
          <>
            <Input
              type="date"
              label="From"
              value={from}
              onChange={(e) => setFrom(e.currentTarget.value)}
            />
            <Input
              type="date"
              label="To"
              value={to}
              onChange={(e) => setTo(e.currentTarget.value)}
            />
          </>
        ) : (
          <Input label="Financial year" value={fy} onChange={(e) => setFy(e.currentTarget.value)} />
        )}
      </Group>
      {view === "summary" &&
        (summary.isError ? (
          <Failed error={summary.error} />
        ) : (
          <DataTable
            columns={summaryColumns}
            data={summary.data ?? []}
            loading={summary.isLoading}
            rowKey={(r) => r.doctor_id}
            emptyTitle="No doctor earned in this period"
          />
        ))}
      {view === "tds" &&
        (tds.isError ? (
          <Failed error={tds.error} />
        ) : (
          <DataTable
            columns={tdsColumns}
            data={tds.data ?? []}
            loading={tds.isLoading}
            rowKey={(r) => r.statement_id}
            emptyTitle="No payouts in this year"
          />
        ))}
      {view === "referral" &&
        (referral.isError ? (
          <Failed error={referral.error} />
        ) : (
          <Stack gap="sm">
            <Alert
              tone={referral.data?.referral_enabled ? "warning" : "info"}
              title="Referral payouts"
            >
              {referral.data?.referral_enabled
                ? `Switched on${referral.data.referral_individuals_enabled ? ", including individual doctors" : ", organisations only"}. Each payout below was approved and taxed; the switch history is in Policy.`
                : "Switched off. IMC Reg 6.4 / NMC forbid commission for referrals, and such payments are not deductible (Apex Laboratories, 2022)."}
            </Alert>
            <Text size="sm" c="dimmed">
              {referral.data?.events.length ?? 0} recorded switch changes.
            </Text>
            <DataTable
              columns={referralColumns}
              data={referral.data?.rows ?? []}
              loading={referral.isLoading}
              rowKey={(r) => r.statement_id}
              emptyTitle="No referral payouts this year"
            />
          </Stack>
        ))}
    </Stack>
  );
}
