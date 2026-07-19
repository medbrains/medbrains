// PATIENT BillingTab — split from patient-detail.tsx (pure move).

import { Card, Group, Loader, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import type { AdmissionRow, PatientInvoiceRow } from "@medbrains/types";
import { IconAlertTriangle, IconPrinter } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, type BadgeTone, Button, IconButton, Table } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";
import { escapeHtml, formatDate, formatMoney } from "./shared";

const INVOICE_STATUS_COLORS: Record<string, BadgeTone> = {
  draft: "neutral",
  issued: "primary",
  partially_paid: "warning",
  paid: "success",
  cancelled: "danger",
  refunded: "warning",
};

export function BillingTab({ patientId }: { patientId: string }) {
  const [printingInvoiceId, setPrintingInvoiceId] = useState<string | null>(null);
  const [printingPatientLedger, setPrintingPatientLedger] = useState(false);
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["patient-invoices", patientId],
    queryFn: () => patientDetailService.listPatientInvoices(patientId),
  });
  const { data: activeAdmissions } = useQuery({
    queryKey: ["patient-admissions", patientId, "admitted"],
    queryFn: () => patientDetailService.listPatientAdmissions(patientId, "admitted"),
  });
  const activeAdmission: AdmissionRow | undefined = activeAdmissions?.admissions[0];
  const { data: ipdBilling } = useQuery({
    queryKey: ["patient-active-ipd-billing", activeAdmission?.id],
    queryFn: () => patientDetailService.getAdmissionBillingSummary(activeAdmission?.id ?? ""),
    enabled: Boolean(activeAdmission?.id),
  });

  const totals = useMemo(() => {
    if (!invoices) return { total: 0, paid: 0, balance: 0 };
    return invoices.reduce(
      (acc, inv) => ({
        total: acc.total + parseFloat(inv.total_amount),
        paid: acc.paid + parseFloat(inv.paid_amount),
        balance: acc.balance + parseFloat(inv.balance),
      }),
      { total: 0, paid: 0, balance: 0 },
    );
  }, [invoices]);
  const pendingInvoices = useMemo(
    () => (invoices ?? []).filter((inv) => parseFloat(inv.balance) > 0.004),
    [invoices],
  );

  async function handlePrintInvoice(invoiceId: string) {
    setPrintingInvoiceId(invoiceId);
    try {
      const data = await patientDetailService.getInvoicePrintData(invoiceId);
      const rows = data.items
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.description)}</td>
              <td>${escapeHtml(item.quantity)}</td>
              <td>${formatMoney(item.unit_price)}</td>
              <td>${escapeHtml(item.tax_percent)}%</td>
              <td>${formatMoney(item.total_price)}</td>
            </tr>`,
        )
        .join("");
      const html = `
        <html>
          <head>
            <title>Invoice ${escapeHtml(data.invoice.invoice_number)}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #101918; }
              header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
              h1 { font-size: 20px; margin: 0 0 6px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th, td { border-bottom: 1px solid #d8e0de; padding: 8px; text-align: left; }
              th { background: #eef5f3; }
              .totals { margin-top: 18px; text-align: right; line-height: 1.8; }
            </style>
          </head>
          <body>
            <header>
              <div>
                <h1>${escapeHtml(data.hospital_name ?? "Hospital Invoice")}</h1>
                <div>${escapeHtml(data.hospital_address)}</div>
                <div>${data.hospital_gstin ? `GSTIN ${escapeHtml(data.hospital_gstin)}` : ""}</div>
              </div>
              <div>
                <strong>${escapeHtml(data.invoice.invoice_number)}</strong><br />
                ${formatDate(data.invoice.created_at)}
              </div>
            </header>
            <section>
              <strong>Patient:</strong> ${escapeHtml(data.patient_name ?? patientId)}<br />
              ${escapeHtml(data.patient_address)}
            </section>
            <table>
              <thead>
                <tr><th>Item</th><th>Qty</th><th>Rate</th><th>Tax</th><th>Total</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="totals">
              Subtotal: ${formatMoney(data.invoice.subtotal)}<br />
              Tax: ${formatMoney(data.invoice.tax_amount)}<br />
              Paid: ${formatMoney(data.invoice.paid_amount)}<br />
              <strong>Total: ${formatMoney(data.invoice.total_amount)}</strong>
            </div>
            <script>window.print();window.close();</script>
          </body>
        </html>`;
      const printWindow = window.open("", "_blank");
      printWindow?.document.write(html);
      printWindow?.document.close();
    } finally {
      setPrintingInvoiceId(null);
    }
  }

  function handlePrintPatientLedger() {
    setPrintingPatientLedger(true);
    try {
      const rows = (invoices ?? [])
        .map(
          (inv) => `
            <tr>
              <td>${escapeHtml(inv.invoice_number)}</td>
              <td>${escapeHtml(inv.status.replace(/_/g, " "))}</td>
              <td>${formatMoney(inv.total_amount)}</td>
              <td>${formatMoney(inv.paid_amount)}</td>
              <td>${formatMoney(inv.balance)}</td>
              <td>${formatDate(inv.created_at)}</td>
            </tr>`,
        )
        .join("");
      const ipdOutstanding = activeAdmission
        ? `<p><strong>Active IPD:</strong> ${escapeHtml(
            activeAdmission.ward_name ?? "ward not assigned",
          )} · Outstanding ${formatMoney(ipdBilling?.outstanding_balance)}</p>`
        : "";
      const html = `
        <html>
          <head>
            <title>Patient billing ledger</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #101918; }
              h1 { font-size: 20px; margin: 0 0 8px; }
              .summary { display: flex; gap: 18px; margin: 18px 0; }
              .summary div { border: 1px solid #d8e0de; padding: 10px 12px; min-width: 140px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th, td { border-bottom: 1px solid #d8e0de; padding: 8px; text-align: left; }
              th { background: #eef5f3; }
            </style>
          </head>
          <body>
            <h1>Patient billing ledger</h1>
            <p><strong>Patient ID:</strong> ${escapeHtml(patientId)}</p>
            ${ipdOutstanding}
            <section class="summary">
              <div>Total<br /><strong>${formatMoney(totals.total)}</strong></div>
              <div>Paid<br /><strong>${formatMoney(totals.paid)}</strong></div>
              <div>Balance<br /><strong>${formatMoney(totals.balance)}</strong></div>
            </section>
            <table>
              <thead>
                <tr><th>Invoice</th><th>Status</th><th>Total</th><th>Paid</th><th>Balance</th><th>Date</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <script>window.print();window.close();</script>
          </body>
        </html>`;
      const printWindow = window.open("", "_blank");
      printWindow?.document.write(html);
      printWindow?.document.close();
    } finally {
      setPrintingPatientLedger(false);
    }
  }

  if (isLoading) return <Loader size="sm" />;

  if ((!invoices || invoices.length === 0) && !activeAdmission) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No invoices found.
      </Text>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          Central billing ledger, camp charges, pharmacy invoices, and IPD balances are summarized
          here.
        </Text>
        <Button
          tone="secondary"
          size="xs"
          leftSection={<IconPrinter size={14} />}
          onClick={handlePrintPatientLedger}
          loading={printingPatientLedger}
        >
          Print ledger
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed">
            Total Billed
          </Text>
          <Text size="lg" fw={700}>
            {formatMoney(totals.total)}
          </Text>
        </Card>
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed">
            Paid
          </Text>
          <Text size="lg" fw={700} c="success">
            {formatMoney(totals.paid)}
          </Text>
        </Card>
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed">
            Balance
          </Text>
          <Text size="lg" fw={700} c={totals.balance > 0 ? "danger" : "success"}>
            {formatMoney(totals.balance)}
          </Text>
        </Card>
      </SimpleGrid>
      {(activeAdmission || pendingInvoices.length > 0) && (
        <Alert
          tone={pendingInvoices.length > 0 ? "warning" : "info"}
          icon={<IconAlertTriangle size={16} />}
        >
          <Stack gap={2}>
            {pendingInvoices.length > 0 && (
              <Text size="sm">
                {pendingInvoices.length} invoice{pendingInvoices.length === 1 ? "" : "s"} pending
                payment or closure in central billing.
              </Text>
            )}
            {activeAdmission && (
              <Text size="sm">
                Active IPD admission {activeAdmission.ward_name ?? "ward not assigned"} has
                outstanding {formatMoney(ipdBilling?.outstanding_balance)}.
              </Text>
            )}
          </Stack>
        </Alert>
      )}

      {invoices && invoices.length > 0 ? (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Invoice #</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Items</Table.Th>
              <Table.Th ta="right">Amount</Table.Th>
              <Table.Th ta="right">Paid</Table.Th>
              <Table.Th ta="right">Balance</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Print</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {invoices.map((inv: PatientInvoiceRow) => (
              <Table.Tr key={inv.id}>
                <Table.Td>
                  <Text size="sm" fw={500} ff="monospace">
                    {inv.invoice_number}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge tone={INVOICE_STATUS_COLORS[inv.status] ?? "neutral"} size="sm">
                    {inv.status.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ta="center">
                    {inv.item_count ?? 0}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="sm">{formatMoney(inv.total_amount)}</Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="sm" c="success">
                    {formatMoney(inv.paid_amount)}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="sm" c={parseFloat(inv.balance) > 0 ? "danger" : undefined}>
                    {formatMoney(inv.balance)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDate(inv.created_at)}</Text>
                </Table.Td>
                <Table.Td>
                  <Tooltip label="Print invoice">
                    <IconButton
                      onClick={() => void handlePrintInvoice(inv.id)}
                      loading={printingInvoiceId === inv.id}
                      aria-label={`Print invoice ${inv.invoice_number}`}
                    >
                      <IconPrinter size={16} />
                    </IconButton>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text c="dimmed" ta="center" py="md">
          No standalone invoices found. Active IPD balances still appear above.
        </Text>
      )}
    </Stack>
  );
}

// ── Appointments Tab ───────────────────────────────────────
