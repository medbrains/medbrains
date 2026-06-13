import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { Invoice } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconAmbulance,
  IconBedFlat,
  IconReceipt,
  IconWallet,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo } from "react";
import { useNavigate } from "react-router";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { billingService } from "@/services/billing.service";
import { ipdService } from "@/services/ipd.service";
import { billingInvoicePaymentRoute } from "./billing-workspace";

function money(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  return (Number.isFinite(parsed) ? parsed : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function invoiceBalance(invoice: Invoice): number {
  return Number(invoice.total_amount) - Number(invoice.paid_amount);
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

function ageBadge(days: number): ReactNode {
  const color = days >= 7 ? "danger" : days >= 3 ? "warning" : "slate";
  return (
    <Badge size="xs" variant="light" color={color} ff="monospace">
      {days === 0 ? "today" : `${days}d`}
    </Badge>
  );
}

interface WorklistRow {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  ageDays: number;
  onClick: () => void;
}

function QueueCard({
  title,
  icon,
  rows,
  isLoading,
  emptyLabel,
  accent,
}: {
  title: string;
  icon: ReactNode;
  rows: WorklistRow[];
  isLoading: boolean;
  emptyLabel: string;
  accent: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <Card withBorder padding="sm" style={{ flex: "1 1 320px", minWidth: 300 }}>
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap={8}>
            {icon}
            <Title order={6}>{title}</Title>
            <Badge size="sm" variant="light" color={accent}>
              {rows.length}
            </Badge>
          </Group>
          {total > 0 && (
            <Text size="sm" fw={700} ff="monospace">
              ₹{money(total)}
            </Text>
          )}
        </Group>
        {isLoading && <Text c="dimmed">Loading…</Text>}
        {!isLoading && rows.length === 0 && (
          <Text c="dimmed" size="sm">
            {emptyLabel}
          </Text>
        )}
        {rows.map((row) => (
          <Card
            key={row.id}
            withBorder
            padding="xs"
            className="clickable-card"
            onClick={row.onClick}
          >
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" fw={600} truncate>
                    {row.title}
                  </Text>
                  {ageBadge(row.ageDays)}
                </Group>
                <Text size="xs" c="dimmed" truncate>
                  {row.subtitle}
                </Text>
              </Stack>
              {row.amount > 0 && (
                <Text size="sm" fw={600} ff="monospace" style={{ whiteSpace: "nowrap" }}>
                  ₹{money(row.amount)}
                </Text>
              )}
            </Group>
          </Card>
        ))}
      </Stack>
    </Card>
  );
}

export function BillingWorklistPage() {
  useRequirePermission(P.BILLING.INVOICES_LIST);
  const navigate = useNavigate();
  const canViewDischarge = useHasPermission(P.IPD.DISCHARGE_TAT_VIEW);
  const canViewAdvances = useHasPermission(P.BILLING.ADVANCES_LIST);

  const issuedQuery = useQuery({
    queryKey: ["worklist-issued"],
    queryFn: () => billingService.listInvoices({ status: "issued", per_page: "200" }),
  });
  const partialQuery = useQuery({
    queryKey: ["worklist-partial"],
    queryFn: () => billingService.listInvoices({ status: "partially_paid", per_page: "200" }),
  });
  const dischargeQuery = useQuery({
    queryKey: ["worklist-discharges"],
    queryFn: () => ipdService.expectedDischarges({ hours: 72 }),
    enabled: canViewDischarge,
  });
  const advancesQuery = useQuery({
    queryKey: ["worklist-advances"],
    queryFn: () => billingService.listAdvances(),
    enabled: canViewAdvances,
  });

  const collectable = useMemo(
    () =>
      [...(issuedQuery.data?.invoices ?? []), ...(partialQuery.data?.invoices ?? [])].filter(
        (invoice) => invoiceBalance(invoice) > 0,
      ),
    [issuedQuery.data, partialQuery.data],
  );

  const invoiceRow = (invoice: Invoice): WorklistRow => ({
    id: invoice.id,
    title: invoice.invoice_number,
    subtitle: `Balance ₹${money(invoiceBalance(invoice))} of ₹${money(invoice.total_amount)}`,
    amount: invoiceBalance(invoice),
    ageDays: daysSince(invoice.issued_at ?? invoice.created_at),
    onClick: () => navigate(billingInvoicePaymentRoute(invoice.id)),
  });

  const byAgeDesc = (a: WorklistRow, b: WorklistRow) => b.ageDays - a.ageDays;

  const issuedUnpaid = collectable
    .filter((invoice) => !invoice.is_er_deferred)
    .map(invoiceRow)
    .sort(byAgeDesc);

  const erDeferred = collectable
    .filter((invoice) => invoice.is_er_deferred)
    .map(invoiceRow)
    .sort(byAgeDesc);

  const dischargePending: WorklistRow[] = (dischargeQuery.data ?? [])
    .map((row) => ({
      id: row.admission_id,
      title: row.patient_name ?? row.uhid ?? "Patient",
      subtitle: `${row.ward ?? "Ward"} · bed ${row.bed_number ?? "—"} · ${row.days_admitted}d admitted`,
      amount: 0,
      ageDays: row.days_admitted,
      onClick: () => navigate(`/billing?admission_id=${row.admission_id}`),
    }))
    .sort(byAgeDesc);

  const refundsDue: WorklistRow[] = (advancesQuery.data ?? [])
    .filter(
      (advance) =>
        Number(advance.balance) > 0 &&
        (advance.status === "active" || advance.status === "partially_used"),
    )
    .map((advance) => ({
      id: advance.id,
      title: advance.advance_number,
      subtitle: `Balance to return ₹${money(advance.balance)}`,
      amount: Number(advance.balance),
      ageDays: daysSince(advance.created_at),
      onClick: () => navigate(`/billing?patient_id=${advance.patient_id}&tab=advances`),
    }))
    .sort(byAgeDesc);

  return (
    <Stack>
      <PageHeader
        title="Pending bills worklist"
        subtitle="Money waiting — sorted oldest first so nothing slips."
        icon={<IconReceipt size={20} stroke={1.5} />}
        color="orange"
      />
      <Group align="flex-start" gap="md" wrap="wrap">
        <QueueCard
          title="Issued · unpaid"
          icon={<IconReceipt size={16} />}
          accent="warning"
          rows={issuedUnpaid}
          isLoading={issuedQuery.isLoading || partialQuery.isLoading}
          emptyLabel="No collectable invoices."
        />
        <QueueCard
          title="ER deferred"
          icon={<IconAmbulance size={16} />}
          accent="danger"
          rows={erDeferred}
          isLoading={issuedQuery.isLoading || partialQuery.isLoading}
          emptyLabel="No deferred ER bills."
        />
        {canViewDischarge && (
          <QueueCard
            title="Discharge pending"
            icon={<IconBedFlat size={16} />}
            accent="primary"
            rows={dischargePending}
            isLoading={dischargeQuery.isLoading}
            emptyLabel="No discharges expected in 72h."
          />
        )}
        {canViewAdvances && (
          <QueueCard
            title="Advance refunds due"
            icon={<IconWallet size={16} />}
            accent="copper"
            rows={refundsDue}
            isLoading={advancesQuery.isLoading}
            emptyLabel="No advances with a balance to return."
          />
        )}
      </Group>
      {collectable.length === 0 &&
        dischargePending.length === 0 &&
        refundsDue.length === 0 &&
        !issuedQuery.isLoading && (
          <Group gap={8} c="dimmed">
            <IconAlertTriangle size={16} />
            <Text size="sm">Nothing pending — all caught up.</Text>
          </Group>
        )}
    </Stack>
  );
}
