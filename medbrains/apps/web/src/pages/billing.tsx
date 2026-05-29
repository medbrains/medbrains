import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  BillingAdvanceAdjustmentFormInput,
  BillingAdvanceFormInput,
  BillingAdvanceRefundFormInput,
  BillingChargeMasterFormInput,
  BillingCorporateEnrollmentFormInput,
  BillingCorporateFormInput,
  BillingCorporateUpdateFormInput,
  BillingCreditNoteFormInput,
  BillingCreditPatientFormInput,
  BillingDayCloseFormInput,
  BillingDiscountFormInput,
  BillingErpExportFormInput,
  BillingGstrFormInput,
  BillingInsuranceClaimFormInput,
  BillingInvoiceItemFormInput,
  BillingJournalEntryFormInput,
  BillingJournalLineFormInput,
  BillingPackageFormInput,
  BillingPackageItemFormInput,
  BillingPaymentFormInput,
  BillingRatePlanFormInput,
  BillingRatePlanItemFormInput,
  BillingRefundFormInput,
  BillingTdsFormInput,
  BillingTpaRateCardFormInput,
  BillingWriteOffFormInput,
} from "@medbrains/schemas";
import {
  billingAdvanceAdjustmentFormSchema,
  billingAdvanceFormSchema,
  billingAdvanceRefundFormSchema,
  billingChargeMasterFormSchema,
  billingCorporateEnrollmentFormSchema,
  billingCorporateFormSchema,
  billingCorporateUpdateFormSchema,
  billingCreditNoteFormSchema,
  billingCreditPatientFormSchema,
  billingDayCloseFormSchema,
  billingDiscountFormSchema,
  billingErpExportFormSchema,
  billingGstrFormSchema,
  billingInsuranceClaimFormSchema,
  billingInvoiceItemFormSchema,
  billingJournalEntryFormSchema,
  billingPackageFormSchema,
  billingPackageItemFormSchema,
  billingPaymentFormSchema,
  billingRatePlanFormSchema,
  billingRatePlanItemFormSchema,
  billingRefundFormSchema,
  billingTdsFormSchema,
  billingTpaRateCardFormSchema,
  billingWriteOffFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AddDiscountRequest,
  AddInvoiceItemRequest,
  AdjustAdvanceRequest,
  AgingBucket,
  ApproveWriteOffRequest,
  AutoConcessionRule,
  BadDebtWriteOff,
  BankTransaction,
  BillingAuditEntry,
  // Concessions
  BillingConcession,
  BillingPackage,
  BillingSummaryReport,
  ChargeMaster,
  ClinicalJourneyContext,
  CopayCalculation,
  CorporateClient,
  CorporateEnrollment,
  CreateAdvanceRequest,
  CreateChargeMasterRequest,
  CreateCorporateRequest,
  CreateCreditNoteRequest,
  CreateCreditPatientRequest,
  CreateDayCloseRequest,
  CreateEnrollmentRequest,
  CreateInsuranceClaimRequest,
  CreateInvoiceRequest,
  CreateJournalEntryRequest,
  CreatePackageRequest,
  CreateRatePlanRequest,
  CreateRefundRequest,
  CreateTdsRequest,
  CreateTpaRateCardRequest,
  CreateWriteOffRequest,
  CreditAgingRow,
  CreditNote,
  // Phase 3
  CreditPatient,
  DayEndClose,
  DepartmentRevenueRow,
  DoctorRevenueRow,
  ErFastInvoiceRequest,
  ErpExportLog,
  ErpExportRequest,
  GenerateGstrRequest,
  GlAccount,
  GstReturnSummary,
  HsnSummaryRow,
  ImportBankTransactionsRequest,
  InsuranceClaim,
  InsurancePanelRow,
  Invoice,
  InvoiceDetailResponse,
  InvoiceDiscount,
  InvoicePrintData,
  JournalEntry,
  PatientAdvance,
  ProfitLossDeptRow,
  RatePlan,
  ReceiptPrintData,
  RecordPaymentRequest,
  Refund,
  RefundAdvanceRequest,
  TdsDeduction,
  TenantSettingsRow,
  TpaRateCard,
  UpdateCorporateRequest,
  UpdateCreditPatientRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAmbulance,
  IconBuildingBank,
  IconCalendarCheck,
  IconCash,
  IconChartBar,
  IconCheck,
  IconClipboardList,
  IconCoin,
  IconCopy,
  IconCreditCard,
  IconDatabase,
  IconDiscount,
  IconDiscount2,
  IconEye,
  IconFileInvoice,
  IconMoneybag,
  IconPackage,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconRefresh,
  IconReportMoney,
  IconScale,
  IconSettings,
  IconShieldCheck,
  IconTags,
  IconTransferIn,
  IconTrash,
  IconUpload,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  type Column,
  DataTable,
  PageHeader,
  StatusDot,
  useClinicalEmit,
} from "../components";
import { EmployeeSearchSelect } from "../components/EmployeeSearchSelect";
import { PatientContextBanner } from "../components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "../components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "../components/Patient/PatientJourneyActions";
import { PatientNameCell } from "../components/PatientNameCell";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { PaymentModal, type PaymentModalSettlement } from "../components/PaymentModal";
import {
  billingAdvancePurposeOptions,
  billingChargeSourceOptions,
  billingCreditPatientStatusOptions,
  billingDiscountTypeOptions,
  billingErpExportTypeOptions,
  billingErpTargetSystemOptions,
  billingGstCategoryOptions,
  billingGstrReturnTypeOptions,
  billingInsuranceClaimTypeOptions,
  billingInsuranceSchemeTypeOptions,
  billingIntegerOrFallback,
  billingNumberOrFallback,
  billingOptionalInteger,
  billingOptionalNumber,
  billingOptionalText,
  billingPaymentModeOptions,
  billingServiceCategoryOptions,
  billingTdsQuarterOptions,
  billingTdsSectionOptions,
} from "../forms/billing.form";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { billingService } from "../services/billing.service";
import { buildCopyPrintHtml, copyPrintStyles, PRINT_COPY_PACKETS } from "../utils/printCopies";

const statusColors: Record<string, string> = {
  draft: "slate",
  issued: "primary",
  partially_paid: "warning",
  paid: "success",
  cancelled: "danger",
  refunded: "orange",
};

const BILLING_INVOICE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const BILLING_TAB_VALUES = [
  "invoices",
  "charge-master",
  "packages",
  "rate-plans",
  "refunds",
  "insurance",
  "advances",
  "corporate",
  "reports",
  "day-close",
  "audit-log",
  "credit-patients",
  "gst-tds",
  "journal",
  "bank-recon",
  "financial-mis",
  "erp-export",
  "concessions",
  "settings",
] as const;

function isBillingTab(value: string | null): value is (typeof BILLING_TAB_VALUES)[number] {
  return Boolean(value && (BILLING_TAB_VALUES as readonly string[]).includes(value));
}

function isInvoiceStatus(
  value: string | null,
): value is (typeof BILLING_INVOICE_STATUS_OPTIONS)[number]["value"] {
  return Boolean(value && BILLING_INVOICE_STATUS_OPTIONS.some((option) => option.value === value));
}

function money(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeBillingPrintText(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

function billingPrintDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("en-IN");
}

const BILLING_INVOICE_PRINT_COPIES = PRINT_COPY_PACKETS.billingInvoice;
const BILLING_RECEIPT_PRINT_COPIES = PRINT_COPY_PACKETS.billingReceipt;

function printInvoicePacket(data: InvoicePrintData) {
  const rows = data.items
    .map(
      (item) => `
        <tr>
          <td>${escapeBillingPrintText(item.description)}</td>
          <td>${escapeBillingPrintText(item.quantity)}</td>
          <td>₹${money(item.unit_price)}</td>
          <td>${escapeBillingPrintText(item.tax_percent)}%</td>
          <td>₹${money(item.total_price)}</td>
        </tr>`,
    )
    .join("");
  const hsnRows = data.hsn_summary
    .map(
      (row) => `
        <tr>
          <td>${escapeBillingPrintText(row.hsn_code)}</td>
          <td>₹${money(row.taxable_amount)}</td>
          <td>₹${money(row.cgst_amount)}</td>
          <td>₹${money(row.sgst_amount)}</td>
          <td>₹${money(row.igst_amount)}</td>
          <td>₹${money(row.total_tax)}</td>
        </tr>`,
    )
    .join("");
  const content = `
    <section class="billing-print">
      <header>
        <div>
          <h1>${escapeBillingPrintText(data.hospital_name ?? "Hospital Invoice")}</h1>
          <div>${escapeBillingPrintText(data.hospital_address)}</div>
          <div>${data.hospital_gstin ? `GSTIN ${escapeBillingPrintText(data.hospital_gstin)}` : ""}</div>
        </div>
        <div class="doc-number">
          <strong>${escapeBillingPrintText(data.invoice.invoice_number)}</strong><br />
          ${billingPrintDate(data.invoice.created_at)}
        </div>
      </header>
      <section class="patient">
        <strong>Patient:</strong> ${escapeBillingPrintText(data.patient_name ?? data.invoice.patient_id)}<br />
        ${escapeBillingPrintText(data.patient_address)}
      </section>
      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Rate</th><th>Tax</th><th>Total</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${
        hsnRows
          ? `<table class="hsn"><thead><tr><th>HSN</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total tax</th></tr></thead><tbody>${hsnRows}</tbody></table>`
          : ""
      }
      <div class="totals">
        Subtotal: ₹${money(data.invoice.subtotal)}<br />
        Tax: ₹${money(data.invoice.tax_amount)}<br />
        Paid: ₹${money(data.invoice.paid_amount)}<br />
        <strong>Total: ₹${money(data.invoice.total_amount)}</strong>
      </div>
    </section>
  `;
  const printWindow = window.open("", "_blank", "width=800,height=900");
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice ${escapeBillingPrintText(data.invoice.invoice_number)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 24px; color: #101918; font-size: 13px; }
          header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
          h1 { font-size: 20px; margin: 0 0 6px; }
          .doc-number { text-align: right; }
          .patient { border: 1px solid #d8e0de; padding: 10px 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border-bottom: 1px solid #d8e0de; padding: 8px; text-align: left; }
          th { background: #eef5f3; }
          .hsn { font-size: 11px; }
          .totals { margin-top: 18px; text-align: right; line-height: 1.8; }
          ${copyPrintStyles()}
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${buildCopyPrintHtml(content, BILLING_INVOICE_PRINT_COPIES)}
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function printReceiptPacket(data: ReceiptPrintData) {
  const content = `
    <section class="receipt-print">
      <h1>${escapeBillingPrintText(data.hospital_name ?? "Payment Receipt")}</h1>
      <div class="number">${escapeBillingPrintText(data.receipt_number ?? data.document_number)}</div>
      <dl>
        <dt>Patient</dt><dd>${escapeBillingPrintText(data.patient_name)} (${escapeBillingPrintText(data.uhid)})</dd>
        <dt>Invoice</dt><dd>${escapeBillingPrintText(data.invoice_number)}</dd>
        <dt>Amount</dt><dd>₹${money(data.amount)}</dd>
        <dt>Mode</dt><dd>${escapeBillingPrintText(data.payment_mode)}</dd>
        <dt>Reference</dt><dd>${escapeBillingPrintText(data.reference_number ?? "—")}</dd>
        <dt>Paid at</dt><dd>${billingPrintDate(data.paid_at)}</dd>
        <dt>Received by</dt><dd>${escapeBillingPrintText(data.received_by ?? "—")}</dd>
      </dl>
      ${data.is_reprint ? `<div class="duplicate">Duplicate / reprint</div>` : ""}
    </section>
  `;
  const printWindow = window.open("", "_blank", "width=480,height=700");
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt ${escapeBillingPrintText(data.receipt_number ?? data.document_number)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 16px; color: #101918; font-size: 12px; }
          .receipt-print { border: 1px solid #d8e0de; padding: 14px; }
          h1 { font-size: 16px; margin: 0 0 6px; text-align: center; }
          .number { text-align: center; font-weight: 700; margin-bottom: 12px; }
          dl { display: grid; grid-template-columns: 90px 1fr; gap: 6px 10px; margin: 0; }
          dt { color: #53615f; font-weight: 700; }
          dd { margin: 0; }
          .duplicate { margin-top: 12px; color: #b45309; font-weight: 700; text-align: center; }
          ${copyPrintStyles()}
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${buildCopyPrintHtml(content, BILLING_RECEIPT_PRINT_COPIES)}
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function invoiceBalance(invoice: Invoice): number {
  const total = Number(invoice.total_amount);
  const paid = Number(invoice.paid_amount);
  return Math.max(0, (Number.isFinite(total) ? total : 0) - (Number.isFinite(paid) ? paid : 0));
}

function invoiceDisplayStatus(invoice: Invoice): Invoice["status"] {
  const paid = Number(invoice.paid_amount);
  const balance = invoiceBalance(invoice);
  if (invoice.status === "issued" && Number.isFinite(paid) && paid > 0 && balance > 0) {
    return "partially_paid";
  }
  if (invoice.status !== "cancelled" && balance <= 0 && Number(invoice.total_amount) > 0) {
    return "paid";
  }
  return invoice.status;
}

export function BillingPage() {
  useRequirePermission(P.BILLING.INVOICES_LIST);

  return (
    <ClinicalEventProvider moduleCode="billing" contextCode="billing-invoices">
      <BillingPageInner />
    </ClinicalEventProvider>
  );
}

export function BillingInvoiceDetailPage() {
  useRequirePermission(P.BILLING.INVOICES_VIEW);

  const navigate = useNavigate();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const canCreate = useHasPermission(P.BILLING.INVOICES_CREATE);
  const canPay = useHasPermission(P.BILLING.PAYMENTS_CREATE);

  if (!invoiceId) {
    return (
      <ClinicalEventProvider moduleCode="billing" contextCode="billing-invoice-detail">
        <Stack>
          <PageHeader
            title="Invoice"
            subtitle="Invoice route is missing an invoice identifier."
            actions={
              <Button variant="subtle" onClick={() => navigate("/billing")}>
                Back to Billing
              </Button>
            }
          />
          <Alert color="danger">Unable to open invoice without an invoice ID.</Alert>
        </Stack>
      </ClinicalEventProvider>
    );
  }

  return (
    <ClinicalEventProvider moduleCode="billing" contextCode="billing-invoice-detail">
      <Stack>
        <PageHeader
          title="Invoice detail"
          subtitle="Charges, discounts, copay, payments, receipts, and audit context."
          actions={
            <Button variant="subtle" onClick={() => navigate("/billing")}>
              Back to Billing
            </Button>
          }
        />
        <InvoiceDetail invoiceId={invoiceId} canCreate={canCreate} canPay={canPay} />
      </Stack>
    </ClinicalEventProvider>
  );
}

function BillingPageInner() {
  const { t } = useTranslation("billing");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canCreate = useHasPermission(P.BILLING.INVOICES_CREATE);
  const canDayClose = useHasPermission(P.BILLING.DAY_CLOSE_CREATE);
  const canWriteOff = useHasPermission(P.BILLING.WRITE_OFF_CREATE);
  const canAudit = useHasPermission(P.BILLING.AUDIT_VIEW);
  // Phase 3 permissions
  const canCredit = useHasPermission(P.BILLING.CREDIT_LIST);
  const canJournal = useHasPermission(P.BILLING.JOURNAL_LIST);
  const canBankRecon = useHasPermission(P.BILLING.BANK_RECON_LIST);
  const canTds = useHasPermission(P.BILLING.TDS_LIST);
  const canGst = useHasPermission(P.BILLING.GST_RETURNS_LIST);
  const canErp = useHasPermission(P.BILLING.ERP_EXPORT);
  const canConcessions = useHasPermission(P.BILLING.CONCESSIONS_LIST);
  const canApproveConcessions = useHasPermission(P.BILLING.CONCESSIONS_APPROVE);

  const [page, setPage] = useState(1);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [erInvoiceOpened, { open: openErInvoice, close: closeErInvoice }] = useDisclosure(false);
  const visibleBillingTabs = new Set<string>([
    "invoices",
    "charge-master",
    "packages",
    "rate-plans",
    "refunds",
    "insurance",
    "advances",
    "corporate",
    "reports",
    ...(canDayClose ? ["day-close"] : []),
    ...(canAudit ? ["audit-log"] : []),
    ...(canCredit ? ["credit-patients"] : []),
    ...(canGst ? ["gst-tds"] : []),
    ...(canJournal ? ["journal"] : []),
    ...(canBankRecon ? ["bank-recon"] : []),
    "financial-mis",
    ...(canErp ? ["erp-export"] : []),
    ...(canConcessions ? ["concessions"] : []),
    "settings",
  ]);
  const requestedTab = searchParams.get("tab");
  const selectedTab =
    isBillingTab(requestedTab) && visibleBillingTabs.has(requestedTab) ? requestedTab : "invoices";
  const patientFilterId = searchParams.get("patient_id")?.trim() || null;
  const requestedStatus = searchParams.get("status");
  const filterStatus = isInvoiceStatus(requestedStatus) ? requestedStatus : null;

  const setBillingParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const setSelectedTab = (value: string | null) => {
    setBillingParam("tab", value && visibleBillingTabs.has(value) ? value : "invoices");
  };

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (filterStatus) params.status = filterStatus;
  if (patientFilterId) params.patient_id = patientFilterId;

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", params],
    queryFn: () => billingService.listInvoices(params),
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => billingService.cloneInvoice(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      notifications.show({
        title: "Cloned",
        message: "Invoice duplicated as draft",
        color: "success",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to clone invoice", color: "danger" }),
  });

  const columns = [
    {
      key: "invoice_number",
      label: "Invoice #",
      render: (row: Invoice) => <Text fw={600}>{row.invoice_number}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: Invoice) => {
        const displayStatus = invoiceDisplayStatus(row);
        return (
          <Group gap={6}>
            <StatusDot
              color={statusColors[displayStatus] ?? "slate"}
              label={displayStatus.replace(/_/g, " ")}
            />
            {row.notes === "Auto-generated" && (
              <Badge size="xs" color="primary" variant="light">
                Auto
              </Badge>
            )}
            {row.is_interim && (
              <Badge size="xs" color="violet" variant="light">
                Interim
              </Badge>
            )}
            {row.corporate_id && (
              <Badge size="xs" color="info" variant="light">
                Corporate
              </Badge>
            )}
            {row.is_er_deferred && (
              <Badge size="xs" color="danger" variant="light">
                ER Deferred
              </Badge>
            )}
            {row.cloned_from_id && (
              <Badge size="xs" color="violet" variant="light">
                Cloned
              </Badge>
            )}
          </Group>
        );
      },
    },
    {
      key: "total_amount",
      label: "Total",
      fieldAccessKey: "billing.amount",
      accessor: (row: Invoice) => row.total_amount,
      fieldKind: "money",
      render: (row: Invoice) => <Text size="sm">₹{money(row.total_amount)}</Text>,
    },
    {
      key: "paid_amount",
      label: "Paid",
      fieldAccessKey: "billing.amount",
      accessor: (row: Invoice) => row.paid_amount,
      fieldKind: "money",
      render: (row: Invoice) => {
        const paid = Number(row.paid_amount);
        const total = Number(row.total_amount);
        const percent = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0;
        return (
          <Stack gap={2}>
            <Text size="sm" fw={paid > 0 ? 600 : 400}>
              ₹{money(row.paid_amount)}
            </Text>
            {paid > 0 && paid < total && (
              <Progress value={percent} size={4} color="warning" aria-label="Payment progress" />
            )}
          </Stack>
        );
      },
    },
    {
      key: "balance",
      label: "Balance",
      fieldAccessKey: "billing.amount",
      accessor: invoiceBalance,
      fieldKind: "money",
      render: (row: Invoice) => {
        const balance = invoiceBalance(row);
        return (
          <Text size="sm" c={balance > 0 ? "danger" : "success"}>
            ₹{money(balance)}
          </Text>
        );
      },
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: Invoice) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      requiredPermissions: [P.BILLING.INVOICES_VIEW],
      render: (row: Invoice) => (
        <Group gap={4}>
          <Tooltip label="View">
            <ActionIcon
              variant="subtle"
              onClick={() => navigate(`/billing/invoices/${row.id}`)}
              aria-label={`Open invoice ${row.invoice_number}`}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {canCreate && (
            <Tooltip label="Clone">
              <ActionIcon
                variant="subtle"
                color="violet"
                onClick={() => cloneMutation.mutate(row.id)}
                loading={cloneMutation.isPending}
              >
                <IconCopy size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ] satisfies Column<Invoice>[];

  return (
    <div>
      <PageHeader
        title={t("title.billing")}
        subtitle={t("subtitle.invoicesAndPayments")}
        icon={<IconReceipt size={20} stroke={1.5} />}
        color="orange"
        actions={
          canCreate ? (
            <Group gap="xs">
              <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
                New Invoice
              </Button>
              <Button
                variant="light"
                color="danger"
                leftSection={<IconAmbulance size={16} />}
                onClick={openErInvoice}
              >
                ER Fast Invoice
              </Button>
            </Group>
          ) : undefined
        }
      />

      {patientFilterId && (
        <Stack gap="xs" mb="md">
          <PatientContextBanner patientId={patientFilterId} hideLoadingState />
          <Group justify="space-between" align="center">
            <PatientFlowNavigator patientId={patientFilterId} active="billing" compact />
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconX size={14} />}
              onClick={() => setBillingParam("patient_id", null)}
            >
              All billing
            </Button>
          </Group>
        </Stack>
      )}

      <Tabs value={selectedTab} onChange={setSelectedTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="invoices" leftSection={<IconFileInvoice size={14} />}>
            {t("invoices")}
          </Tabs.Tab>
          <Tabs.Tab value="charge-master" leftSection={<IconTags size={14} />}>
            {t("chargeMaster")}
          </Tabs.Tab>
          <Tabs.Tab value="packages" leftSection={<IconPackage size={14} />}>
            {t("packages")}
          </Tabs.Tab>
          <Tabs.Tab value="rate-plans" leftSection={<IconCreditCard size={14} />}>
            {t("ratePlans")}
          </Tabs.Tab>
          <Tabs.Tab value="refunds" leftSection={<IconRefresh size={14} />}>
            {t("refunds&Credits")}
          </Tabs.Tab>
          <Tabs.Tab value="insurance" leftSection={<IconShieldCheck size={14} />}>
            {t("insuranceClaims")}
          </Tabs.Tab>
          <Tabs.Tab value="advances" leftSection={<IconWallet size={14} />}>
            {t("advances")}
          </Tabs.Tab>
          <Tabs.Tab value="corporate" leftSection={<IconBuildingBank size={14} />}>
            {t("corporate")}
          </Tabs.Tab>
          <Tabs.Tab value="reports" leftSection={<IconChartBar size={14} />}>
            {t("reports")}
          </Tabs.Tab>
          {canDayClose && (
            <Tabs.Tab value="day-close" leftSection={<IconCalendarCheck size={14} />}>
              {t("dayClose")}
            </Tabs.Tab>
          )}
          {canAudit && (
            <Tabs.Tab value="audit-log" leftSection={<IconClipboardList size={14} />}>
              {t("auditLog")}
            </Tabs.Tab>
          )}
          {canCredit && (
            <Tabs.Tab value="credit-patients" leftSection={<IconMoneybag size={14} />}>
              {t("creditPatients")}
            </Tabs.Tab>
          )}
          {canGst && (
            <Tabs.Tab value="gst-tds" leftSection={<IconReportMoney size={14} />}>
              {t("gst&Tds")}
            </Tabs.Tab>
          )}
          {canJournal && (
            <Tabs.Tab value="journal" leftSection={<IconScale size={14} />}>
              {t("journalEntries")}
            </Tabs.Tab>
          )}
          {canBankRecon && (
            <Tabs.Tab value="bank-recon" leftSection={<IconTransferIn size={14} />}>
              {t("bankRecon")}
            </Tabs.Tab>
          )}
          <Tabs.Tab value="financial-mis" leftSection={<IconCoin size={14} />}>
            {t("financialMis")}
          </Tabs.Tab>
          {canErp && (
            <Tabs.Tab value="erp-export" leftSection={<IconDatabase size={14} />}>
              {t("erpExport")}
            </Tabs.Tab>
          )}
          {canConcessions && (
            <Tabs.Tab value="concessions" leftSection={<IconDiscount size={14} />}>
              Concessions
            </Tabs.Tab>
          )}
          <Tabs.Tab value="settings" leftSection={<IconSettings size={14} />}>
            {t("settings")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="invoices">
          <Group mb="md">
            <Select
              placeholder="Status"
              data={BILLING_INVOICE_STATUS_OPTIONS}
              value={filterStatus}
              onChange={(value) => {
                setPage(1);
                setBillingParam("status", value);
              }}
              clearable
              w={180}
            />
          </Group>
          <DataTable
            columns={columns}
            data={data?.invoices ?? []}
            loading={isLoading}
            page={page}
            totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
            onPageChange={setPage}
            rowKey={(row) => row.id}
            virtualized="auto"
            virtualizeAt={40}
            virtualRowHeight={58}
            tableMaxHeight="calc(100vh - 360px)"
          />
        </Tabs.Panel>

        <Tabs.Panel value="charge-master">
          <ChargeMasterTab canCreate={canCreate} />
        </Tabs.Panel>

        <Tabs.Panel value="packages">
          <PackagesTab canCreate={canCreate} />
        </Tabs.Panel>

        <Tabs.Panel value="rate-plans">
          <RatePlansTab canCreate={canCreate} />
        </Tabs.Panel>

        <Tabs.Panel value="refunds">
          <RefundsCreditsTab canCreate={canCreate} canWriteOff={canWriteOff} />
        </Tabs.Panel>

        <Tabs.Panel value="insurance">
          <InsuranceClaimsTab canCreate={canCreate} canWriteOff={canWriteOff} />
        </Tabs.Panel>

        <Tabs.Panel value="advances">
          <AdvancesTab />
        </Tabs.Panel>

        <Tabs.Panel value="corporate">
          <CorporateTab />
        </Tabs.Panel>

        <Tabs.Panel value="reports">
          <ReportsTab />
        </Tabs.Panel>

        {canDayClose && (
          <Tabs.Panel value="day-close">
            <DayCloseTab />
          </Tabs.Panel>
        )}

        {canAudit && (
          <Tabs.Panel value="audit-log">
            <AuditLogTab />
          </Tabs.Panel>
        )}

        {canCredit && (
          <Tabs.Panel value="credit-patients">
            <CreditPatientsTab />
          </Tabs.Panel>
        )}

        {canGst && (
          <Tabs.Panel value="gst-tds">
            <GstTdsTab canTds={canTds} />
          </Tabs.Panel>
        )}

        {canJournal && (
          <Tabs.Panel value="journal">
            <JournalEntriesTab />
          </Tabs.Panel>
        )}

        {canBankRecon && (
          <Tabs.Panel value="bank-recon">
            <BankReconTab />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="financial-mis">
          <FinancialMisTab />
        </Tabs.Panel>

        {canErp && (
          <Tabs.Panel value="erp-export">
            <ErpExportTab />
          </Tabs.Panel>
        )}

        {canConcessions && (
          <Tabs.Panel value="concessions">
            <ConcessionsTab canApprove={canApproveConcessions} />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="settings">
          <BillingSettingsTab />
        </Tabs.Panel>
      </Tabs>

      <CreateInvoiceDrawer opened={createOpened} onClose={closeCreate} />
      <ErFastInvoiceModal opened={erInvoiceOpened} onClose={closeErInvoice} />
    </div>
  );
}

function CreateInvoiceDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [notes, setNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: CreateInvoiceRequest) => billingService.createInvoice(data),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      notifications.show({
        title: "Invoice created",
        message: "Draft invoice created",
        color: "success",
      });
      emit("invoice.created", { patient_id: variables.patient_id });
      onClose();
      setPatientId("");
      setEncounterId("");
      setNotes("");
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create invoice", color: "danger" });
    },
  });
  const contextPatientId = patientId.trim().length >= 32 ? patientId.trim() : null;

  return (
    <Drawer opened={opened} onClose={onClose} title="Create Invoice" position="right" size="xl">
      <Stack>
        <TextInput
          label="Patient ID"
          required
          value={patientId}
          onChange={(e) => setPatientId(e.currentTarget.value)}
        />
        <PatientContextBanner patientId={contextPatientId} hideLoadingState />
        <TextInput
          label="Encounter ID"
          value={encounterId}
          onChange={(e) => setEncounterId(e.currentTarget.value)}
        />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Button
          onClick={() =>
            createMutation.mutate({
              patient_id: patientId,
              encounter_id: encounterId || undefined,
              notes: notes || undefined,
            })
          }
          loading={createMutation.isPending}
        >
          Create Draft Invoice
        </Button>
      </Stack>
    </Drawer>
  );
}

function InvoiceDetail({
  invoiceId,
  canCreate,
  canPay,
}: {
  invoiceId: string;
  canCreate: boolean;
  canPay: boolean;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const canPrintBillingDocs = useHasPermission(P.BILLING.RECEIPTS_PRINT);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showGateway, setShowGateway] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showCopay, setShowCopay] = useState(false);
  const itemDefaults: BillingInvoiceItemFormInput = {
    charge_code: "",
    description: "",
    source: "manual",
    quantity: 1,
    unit_price: 0,
    tax_percent: 0,
  };
  const paymentDefaults: BillingPaymentFormInput = {
    amount: 0,
    mode: "cash",
    reference_number: "",
  };
  const discountDefaults: BillingDiscountFormInput = {
    discount_type: "percentage",
    discount_value: 0,
    reason: "",
  };
  const {
    control: itemControl,
    register: registerItem,
    reset: resetItem,
    handleSubmit: handleSubmitItem,
    formState: { errors: itemErrors },
  } = useForm<BillingInvoiceItemFormInput>({
    resolver: zodResolver(billingInvoiceItemFormSchema),
    defaultValues: itemDefaults,
  });
  const {
    control: paymentControl,
    register: registerPayment,
    reset: resetPayment,
    handleSubmit: handleSubmitPayment,
    formState: { errors: paymentErrors },
  } = useForm<BillingPaymentFormInput>({
    resolver: zodResolver(billingPaymentFormSchema),
    defaultValues: paymentDefaults,
  });
  const {
    control: discountControl,
    register: registerDiscount,
    reset: resetDiscount,
    handleSubmit: handleSubmitDiscount,
    formState: { errors: discountErrors },
  } = useForm<BillingDiscountFormInput>({
    resolver: zodResolver(billingDiscountFormSchema),
    defaultValues: discountDefaults,
  });

  const { data } = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: () => billingService.getInvoice(invoiceId),
  });

  const issueMutation = useMutation({
    mutationFn: () => billingService.issueInvoice(invoiceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      emit("invoice.issued", { invoice_id: invoiceId });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => billingService.cancelInvoice(invoiceId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] }),
  });

  const invoicePrintMutation = useMutation({
    mutationFn: () => billingService.getInvoicePrintData(invoiceId),
    onSuccess: (printData) => {
      printInvoicePacket(printData);
    },
    onError: (error) => {
      notifications.show({
        title: "Invoice print failed",
        message: error instanceof Error ? error.message : "Unable to prepare invoice packet",
        color: "danger",
      });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (item: AddInvoiceItemRequest) => billingService.addInvoiceItem(invoiceId, item),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      setShowAddItem(false);
      resetItem(itemDefaults);
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => billingService.removeInvoiceItem(invoiceId, itemId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] }),
  });

  const payMutation = useMutation({
    mutationFn: (pay: RecordPaymentRequest) => billingService.recordPayment(invoiceId, pay),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-context", inv.patient_id] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", inv.patient_id] });
      emit("payment.recorded", {
        invoice_id: invoiceId,
        amount: variables.amount,
        mode: variables.mode,
      });
      setShowPayment(false);
      resetPayment(paymentDefaults);
    },
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ["invoice-discounts", invoiceId],
    queryFn: () => billingService.listInvoiceDiscounts(invoiceId),
  });

  const addDiscountMutation = useMutation({
    mutationFn: (d: AddDiscountRequest) => billingService.addDiscount(invoiceId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-discounts", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      setShowDiscount(false);
      resetDiscount(discountDefaults);
    },
  });

  const removeDiscountMutation = useMutation({
    mutationFn: (discId: string) => billingService.removeDiscount(invoiceId, discId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-discounts", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
    },
  });

  const receiptMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const receipt = await billingService.generateReceipt(invoiceId, paymentId);
      const printData = await billingService.getReceiptPrintData(paymentId);
      return { printData, receipt };
    },
    onSuccess: ({ printData }) => {
      printReceiptPacket(printData);
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      notifications.show({
        title: "Receipt generated",
        message: "Customer and office copies are ready to print",
        color: "success",
      });
    },
    onError: (error) => {
      notifications.show({
        title: "Receipt print failed",
        message: error instanceof Error ? error.message : "Unable to prepare receipt packet",
        color: "danger",
      });
    },
  });

  if (!data) return <Text c="dimmed">Loading...</Text>;

  const detail = data as InvoiceDetailResponse;
  const inv = detail.invoice;
  const displayStatus = invoiceDisplayStatus(inv);
  const balance = invoiceBalance(inv);
  const journeyContext: ClinicalJourneyContext = {
    patientId: inv.patient_id,
    activeEncounterId: inv.encounter_id,
    activeOrderContext: inv.encounter_id ? "opd" : null,
  };
  const canRecordPayment =
    canPay && (displayStatus === "issued" || displayStatus === "partially_paid") && balance > 0;
  const openPaymentForm = () => {
    if (showPayment) {
      setShowPayment(false);
      return;
    }
    resetPayment({ ...paymentDefaults, amount: balance });
    setShowPayment(true);
  };
  const handleAddInvoiceItem = (values: BillingInvoiceItemFormInput) => {
    addItemMutation.mutate({
      charge_code: values.charge_code.trim(),
      description: values.description.trim(),
      source: values.source,
      quantity: billingIntegerOrFallback(values.quantity, 1),
      unit_price: billingNumberOrFallback(values.unit_price, 0),
      tax_percent: billingNumberOrFallback(values.tax_percent, 0),
    });
  };
  const handleRecordPayment = (values: BillingPaymentFormInput) => {
    payMutation.mutate({
      amount: billingNumberOrFallback(values.amount, 0),
      mode: values.mode,
      reference_number: billingOptionalText(values.reference_number),
    });
  };
  const handleAddDiscount = (values: BillingDiscountFormInput) => {
    addDiscountMutation.mutate({
      discount_type: values.discount_type,
      discount_value: billingNumberOrFallback(values.discount_value, 0),
      reason: billingOptionalText(values.reason),
    });
  };
  const handleGatewayPaymentSuccess = (_paymentId: string, settlement: PaymentModalSettlement) => {
    if (settlement.source === "manual") {
      payMutation.mutate({
        amount: settlement.amount,
        mode: settlement.mode,
        reference_number: settlement.reference_number,
      });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    setShowGateway(false);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700} size="lg">
          {inv.invoice_number}
        </Text>
        <Badge color={statusColors[displayStatus] ?? "slate"} variant="light" size="lg">
          {displayStatus.replace(/_/g, " ")}
        </Badge>
      </Group>
      <Group>
        <Text size="sm">Total: ₹{money(inv.total_amount)}</Text>
        <Text size="sm">Paid: ₹{money(inv.paid_amount)}</Text>
        <Text size="sm" c={balance > 0 ? "danger" : "success"}>
          Balance: ₹{money(balance)}
        </Text>
      </Group>
      {canPrintBillingDocs && (
        <Group gap="xs">
          <Tooltip
            label={
              inv.status === "draft"
                ? "Issue the invoice before printing"
                : "Customer and office copies"
            }
          >
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPrinter size={14} />}
              loading={invoicePrintMutation.isPending}
              disabled={inv.status === "draft"}
              onClick={() => invoicePrintMutation.mutate()}
            >
              Print invoice packet
            </Button>
          </Tooltip>
          {BILLING_INVOICE_PRINT_COPIES.map((copy) => (
            <Badge key={copy.label} color="violet" variant="light">
              {copy.label} · {copy.printerProfile}
            </Badge>
          ))}
        </Group>
      )}
      <PatientContextBanner patientId={inv.patient_id} hideLoadingState />
      <PatientFlowNavigator
        patientId={inv.patient_id}
        active="billing"
        activeEncounterId={inv.encounter_id}
        compact
      />
      <Card withBorder padding="sm">
        <Group justify="space-between" gap="sm" align="center">
          <Stack gap={2}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Patient handoff
            </Text>
            <Text size="xs" c="dimmed">
              Move from billing to clinical context, pharmacy, or follow-up without re-searching.
            </Text>
          </Stack>
          <PatientJourneyActions
            context={journeyContext}
            hiddenActionIds={["billing.open_ledger"]}
            size="xs"
          />
        </Group>
      </Card>
      {(Number(inv.cgst_amount ?? 0) > 0 ||
        Number(inv.sgst_amount ?? 0) > 0 ||
        Number(inv.igst_amount ?? 0) > 0) && (
        <Group gap="xs">
          <Badge variant="light" color="teal" size="sm">
            CGST: ₹{inv.cgst_amount}
          </Badge>
          <Badge variant="light" color="teal" size="sm">
            SGST: ₹{inv.sgst_amount}
          </Badge>
          <Badge variant="light" color="primary" size="sm">
            IGST: ₹{inv.igst_amount}
          </Badge>
          {Number(inv.cess_amount ?? 0) > 0 && (
            <Badge variant="light" color="orange" size="sm">
              Cess: ₹{inv.cess_amount}
            </Badge>
          )}
        </Group>
      )}
      {inv.is_interim && (
        <Group gap="xs">
          <Badge color="violet" variant="light">
            Interim #{inv.sequence_number}
          </Badge>
          {inv.billing_period_start && inv.billing_period_end && (
            <Text size="xs" c="dimmed">
              Period: {new Date(inv.billing_period_start).toLocaleDateString()} –{" "}
              {new Date(inv.billing_period_end).toLocaleDateString()}
            </Text>
          )}
        </Group>
      )}

      {canCreate && inv.status === "draft" && (
        <Group>
          <Button size="xs" color="primary" onClick={() => issueMutation.mutate()}>
            Issue Invoice
          </Button>
          <Button size="xs" color="danger" variant="light" onClick={() => cancelMutation.mutate()}>
            Cancel
          </Button>
        </Group>
      )}

      <Group>
        <Button
          size="xs"
          variant="light"
          color="teal"
          leftSection={<IconShieldCheck size={14} />}
          onClick={() => setShowCopay(!showCopay)}
        >
          {showCopay ? "Hide Co-pay" : "Calculate Co-pay"}
        </Button>
      </Group>
      {showCopay && <CopayBreakdown invoiceId={invoiceId} />}

      <Text fw={600} mt="md">
        Items
      </Text>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Description</Table.Th>
            <Table.Th>Qty</Table.Th>
            <Table.Th>Price</Table.Th>
            <Table.Th>Tax</Table.Th>
            <Table.Th>Total</Table.Th>
            {canCreate && inv.status === "draft" && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {detail.items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>{item.description}</Table.Td>
              <Table.Td>{item.quantity}</Table.Td>
              <Table.Td>₹{item.unit_price}</Table.Td>
              <Table.Td>{item.tax_percent}%</Table.Td>
              <Table.Td>₹{item.total_price}</Table.Td>
              {canCreate && inv.status === "draft" && (
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="danger"
                    onClick={() => removeItemMutation.mutate(item.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {canCreate && inv.status === "draft" && (
        <>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowAddItem(!showAddItem)}
          >
            Add Item
          </Button>
          {showAddItem && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitItem(handleAddInvoiceItem)}>
              <Group grow>
                <TextInput
                  label="Charge Code"
                  required
                  error={itemErrors.charge_code?.message}
                  {...registerItem("charge_code")}
                />
                <Controller
                  control={itemControl}
                  name="source"
                  render={({ field }) => (
                    <Select
                      label="Source"
                      data={billingChargeSourceOptions}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? "manual")}
                      error={itemErrors.source?.message}
                    />
                  )}
                />
              </Group>
              <TextInput
                label="Description"
                required
                error={itemErrors.description?.message}
                {...registerItem("description")}
              />
              <Group grow>
                <Controller
                  control={itemControl}
                  name="quantity"
                  render={({ field }) => (
                    <NumberInput
                      label="Qty"
                      min={1}
                      value={field.value}
                      onChange={field.onChange}
                      error={itemErrors.quantity?.message}
                    />
                  )}
                />
                <Controller
                  control={itemControl}
                  name="unit_price"
                  render={({ field }) => (
                    <NumberInput
                      label="Unit Price"
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={itemErrors.unit_price?.message}
                    />
                  )}
                />
                <Controller
                  control={itemControl}
                  name="tax_percent"
                  render={({ field }) => (
                    <NumberInput
                      label="Tax %"
                      min={0}
                      max={100}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={itemErrors.tax_percent?.message}
                    />
                  )}
                />
              </Group>
              <Button size="xs" type="submit" loading={addItemMutation.isPending}>
                Add
              </Button>
            </Stack>
          )}
        </>
      )}

      <Text fw={600} mt="md">
        Payments
      </Text>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Amount</Table.Th>
            <Table.Th>Mode</Table.Th>
            <Table.Th>Reference</Table.Th>
            <Table.Th>Date</Table.Th>
            {canPrintBillingDocs && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {detail.payments.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>₹{p.amount}</Table.Td>
              <Table.Td>{p.mode}</Table.Td>
              <Table.Td>{p.reference_number ?? "—"}</Table.Td>
              <Table.Td>{new Date(p.created_at).toLocaleString()}</Table.Td>
              {canPrintBillingDocs && (
                <Table.Td>
                  <Tooltip label="Generate + print receipt packet">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      loading={receiptMutation.isPending}
                      onClick={() => receiptMutation.mutate(p.id)}
                    >
                      <IconReceipt size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {canRecordPayment && (
        <>
          <Group gap="xs">
            <Button size="xs" leftSection={<IconCash size={14} />} onClick={openPaymentForm}>
              Record Payment
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconCreditCard size={14} />}
              onClick={() => setShowGateway(true)}
            >
              Pay via Gateway
            </Button>
          </Group>
          {showPayment && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitPayment(handleRecordPayment)}>
              <Controller
                control={paymentControl}
                name="amount"
                render={({ field }) => (
                  <NumberInput
                    label="Amount"
                    required
                    min={0.01}
                    max={balance}
                    decimalScale={2}
                    value={field.value}
                    onChange={field.onChange}
                    error={paymentErrors.amount?.message}
                  />
                )}
              />
              <Controller
                control={paymentControl}
                name="mode"
                render={({ field }) => (
                  <Select
                    label="Mode"
                    data={billingPaymentModeOptions}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "cash")}
                    error={paymentErrors.mode?.message}
                  />
                )}
              />
              <TextInput
                label="Reference #"
                error={paymentErrors.reference_number?.message}
                {...registerPayment("reference_number")}
              />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Outstanding: ₹{money(balance)}
                </Text>
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => resetPayment({ ...paymentDefaults, amount: balance })}
                >
                  Use balance
                </Button>
              </Group>
              <Button size="xs" type="submit" loading={payMutation.isPending}>
                Save Payment
              </Button>
            </Stack>
          )}
          <PaymentModal
            opened={showGateway}
            onClose={() => setShowGateway(false)}
            amount={balance}
            invoiceId={invoiceId}
            onSuccess={handleGatewayPaymentSuccess}
          />
        </>
      )}

      <Text fw={600} mt="md">
        Discounts
      </Text>
      {discounts.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Value</Table.Th>
              <Table.Th>Reason</Table.Th>
              {canCreate && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {discounts.map((d: InvoiceDiscount) => (
              <Table.Tr key={d.id}>
                <Table.Td>
                  <Badge variant="light">{d.discount_type}</Badge>
                </Table.Td>
                <Table.Td>
                  {d.discount_type === "percentage"
                    ? `${d.discount_value}%`
                    : `₹${d.discount_value}`}
                </Table.Td>
                <Table.Td>{d.reason ?? "—"}</Table.Td>
                {canCreate && (
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      size="sm"
                      onClick={() => removeDiscountMutation.mutate(d.id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No discounts applied
        </Text>
      )}

      {canCreate && inv.status === "draft" && (
        <>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconDiscount2 size={14} />}
            onClick={() => setShowDiscount(!showDiscount)}
          >
            Add Discount
          </Button>
          {showDiscount && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitDiscount(handleAddDiscount)}>
              <Group grow>
                <Controller
                  control={discountControl}
                  name="discount_type"
                  render={({ field }) => (
                    <Select
                      label="Type"
                      data={billingDiscountTypeOptions}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? "percentage")}
                      error={discountErrors.discount_type?.message}
                    />
                  )}
                />
                <Controller
                  control={discountControl}
                  name="discount_value"
                  render={({ field }) => (
                    <NumberInput
                      label="Value"
                      required
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={discountErrors.discount_value?.message}
                    />
                  )}
                />
              </Group>
              <TextInput
                label="Reason"
                error={discountErrors.reason?.message}
                {...registerDiscount("reason")}
              />
              <Button size="xs" type="submit" loading={addDiscountMutation.isPending}>
                Apply Discount
              </Button>
            </Stack>
          )}
        </>
      )}

      {inv.discount_amount !== "0" && inv.discount_amount !== "0.00" && (
        <Text size="sm" fw={500} c="orange">
          Total Discount: ₹{inv.discount_amount}
        </Text>
      )}
    </Stack>
  );
}

function ChargeMasterTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const chargeDefaults: BillingChargeMasterFormInput = {
    code: "",
    name: "",
    category: "consultation",
    base_price: 0,
    tax_percent: 0,
    hsn_sac_code: "",
    gst_category: undefined,
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingChargeMasterFormInput>({
    resolver: zodResolver(billingChargeMasterFormSchema),
    defaultValues: chargeDefaults,
  });

  const { data: charges = [], isLoading } = useQuery({
    queryKey: ["charge-master"],
    queryFn: () => billingService.listChargeMaster(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateChargeMasterRequest) => billingService.createChargeMaster(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["charge-master"] });
      setShowForm(false);
      reset(chargeDefaults);
    },
  });

  const handleCreateCharge = (values: BillingChargeMasterFormInput) => {
    createMutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      category: values.category,
      base_price: billingNumberOrFallback(values.base_price, 0),
      tax_percent: billingNumberOrFallback(values.tax_percent, 0),
      hsn_sac_code: billingOptionalText(values.hsn_sac_code),
      gst_category: values.gst_category,
    });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => billingService.deleteChargeMaster(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["charge-master"] }),
  });

  const columns = [
    { key: "code", label: "Code", render: (row: ChargeMaster) => <Text fw={500}>{row.code}</Text> },
    {
      key: "name",
      label: "Name",
      render: (row: ChargeMaster) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "category",
      label: "Category",
      render: (row: ChargeMaster) => <Text size="sm">{row.category || "—"}</Text>,
    },
    {
      key: "base_price",
      label: "Price",
      render: (row: ChargeMaster) => <Text size="sm">₹{row.base_price}</Text>,
    },
    {
      key: "hsn_sac_code",
      label: "HSN/SAC",
      render: (row: ChargeMaster) => <Text size="sm">{row.hsn_sac_code ?? "—"}</Text>,
    },
    {
      key: "gst_category",
      label: "GST Cat.",
      render: (row: ChargeMaster) => <Text size="sm">{row.gst_category ?? "—"}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: ChargeMaster) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    {
      key: "actions",
      label: "",
      render: (row: ChargeMaster) =>
        canCreate ? (
          <ActionIcon variant="subtle" color="danger" onClick={() => deleteMutation.mutate(row.id)}>
            <IconTrash size={14} />
          </ActionIcon>
        ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowForm(!showForm)}
          >
            Add Charge
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateCharge)}>
          <Group grow>
            <TextInput label="Code" required error={errors.code?.message} {...register("code")} />
            <TextInput label="Name" required error={errors.name?.message} {...register("name")} />
          </Group>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                label="Category"
                required
                data={billingServiceCategoryOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "consultation")}
                error={errors.category?.message}
                searchable
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="base_price"
              render={({ field }) => (
                <NumberInput
                  label="Base Price"
                  required
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.base_price?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="tax_percent"
              render={({ field }) => (
                <NumberInput
                  label="Tax %"
                  min={0}
                  max={100}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.tax_percent?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label="HSN/SAC Code"
              placeholder="e.g. 999312"
              error={errors.hsn_sac_code?.message}
              {...register("hsn_sac_code")}
            />
            <Controller
              control={control}
              name="gst_category"
              render={({ field }) => (
                <Select
                  label="GST Category"
                  data={billingGstCategoryOptions}
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  error={errors.gst_category?.message}
                  clearable
                />
              )}
            />
          </Group>
          <Button size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={charges} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Packages Tab ────────────────────────────────────────

// ── Co-pay Calculation Breakdown ──────────────────────────

function CopayBreakdown({ invoiceId }: { invoiceId: string }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["copay-calculation", invoiceId],
    queryFn: () => billingService.calculateCopay({ invoice_id: invoiceId }),
    enabled: false,
  });

  const calculateMutation = useMutation({
    mutationFn: () => billingService.calculateCopay({ invoice_id: invoiceId }),
    onSuccess: () => refetch(),
  });

  const copay = data as CopayCalculation | undefined;

  return (
    <Card withBorder p="sm">
      {!copay && !isLoading && (
        <Button
          size="xs"
          onClick={() => calculateMutation.mutate()}
          loading={calculateMutation.isPending}
        >
          Calculate Co-pay
        </Button>
      )}
      {(isLoading || calculateMutation.isPending) && (
        <Text size="sm" c="dimmed">
          Calculating...
        </Text>
      )}
      {copay && (
        <SimpleGrid cols={5}>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Invoice Amount
            </Text>
            <Text size="sm" fw={700}>
              {"\u20B9"}
              {copay.invoice_amount.toFixed(2)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Insurance Coverage
            </Text>
            <Text size="sm" fw={700} c="success">
              {"\u20B9"}
              {copay.insurance_coverage.toFixed(2)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Co-pay
            </Text>
            <Text size="sm" fw={700}>
              {"\u20B9"}
              {copay.copay_amount.toFixed(2)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Deductible
            </Text>
            <Text size="sm" fw={700}>
              {"\u20B9"}
              {copay.deductible.toFixed(2)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Patient Responsibility
            </Text>
            <Text size="sm" fw={700} c="danger">
              {"\u20B9"}
              {copay.patient_responsibility.toFixed(2)}
            </Text>
          </Stack>
        </SimpleGrid>
      )}
    </Card>
  );
}

// ── ER Fast Invoice Modal ─────────────────────────────────

function ErFastInvoiceModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const emit = useClinicalEmit();
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ErFastInvoiceRequest>({
    defaultValues: {
      emergency_visit_id: "",
      patient_id: "",
      notes: "",
    },
  });
  const emergencyVisitId = watch("emergency_visit_id");
  const patientId = watch("patient_id");

  const createMutation = useMutation({
    mutationFn: (data: ErFastInvoiceRequest) => billingService.erFastInvoice(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      notifications.show({
        title: "ER Invoice Created",
        message: `Invoice ${(result as Invoice).invoice_number} created`,
        color: "success",
      });
      emit("invoice.created", { invoice_id: (result as Invoice).id });
      onClose();
      reset();
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to create ER invoice",
        color: "danger",
      });
    },
  });
  const submitFastInvoice = handleSubmit((values) => {
    createMutation.mutate({
      emergency_visit_id: values.emergency_visit_id.trim(),
      patient_id: values.patient_id.trim(),
      notes: values.notes?.trim() || null,
    });
  });

  return (
    <Drawer
      opened={opened}
      onClose={() => {
        onClose();
        reset();
      }}
      title="ER Fast Invoice"
      position="right"
      size="xl"
    >
      <Stack component="form" onSubmit={submitFastInvoice}>
        <Alert color="danger" variant="light" title="Emergency Department Fast Billing">
          <Text size="sm">
            Creates an invoice with standard ER charges for the specified emergency visit.
            Additional charges can be added later.
          </Text>
        </Alert>
        <TextInput
          label="Emergency Visit ID"
          placeholder="Enter emergency visit UUID"
          error={errors.emergency_visit_id?.message}
          {...register("emergency_visit_id", { required: "Emergency visit is required" })}
          required
        />
        <Controller
          control={control}
          name="patient_id"
          rules={{ required: "Patient is required" }}
          render={({ field }) => (
            <PatientSearchSelect
              value={field.value}
              onChange={field.onChange}
              error={errors.patient_id?.message}
              required
            />
          )}
        />
        <Textarea label="Notes" {...register("notes")} />
        <Button
          type="submit"
          color="danger"
          loading={createMutation.isPending}
          disabled={!emergencyVisitId.trim() || !patientId.trim()}
          leftSection={<IconAmbulance size={16} />}
        >
          Create ER Invoice
        </Button>
      </Stack>
    </Drawer>
  );
}

function PackagesTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const packageDefaults: BillingPackageFormInput = {
    code: "",
    name: "",
    description: "",
    total_price: 0,
    discount_percent: 0,
    items: [],
  };
  const packageItemDefaults: BillingPackageItemFormInput = {
    charge_code: "",
    description: "",
    quantity: 1,
    unit_price: 0,
  };
  const {
    control: packageControl,
    register: registerPackage,
    reset: resetPackage,
    handleSubmit: handleSubmitPackage,
    formState: { errors: packageErrors },
  } = useForm<BillingPackageFormInput>({
    resolver: zodResolver(billingPackageFormSchema),
    defaultValues: packageDefaults,
  });
  const {
    control: packageItemControl,
    register: registerPackageItem,
    reset: resetPackageItem,
    handleSubmit: handleSubmitPackageItem,
    formState: { errors: packageItemErrors },
  } = useForm<BillingPackageItemFormInput>({
    resolver: zodResolver(billingPackageItemFormSchema),
    defaultValues: packageItemDefaults,
  });
  const {
    fields: packageItems,
    append: appendPackageItem,
    remove: removePackageItem,
  } = useFieldArray({ control: packageControl, name: "items" });

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["billing-packages"],
    queryFn: () => billingService.listPackages(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePackageRequest) => billingService.createPackage(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing-packages"] });
      setShowForm(false);
      resetPackage(packageDefaults);
      resetPackageItem(packageItemDefaults);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => billingService.deletePackage(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["billing-packages"] }),
  });

  const addPkgItem = (values: BillingPackageItemFormInput) => {
    appendPackageItem({
      charge_code: values.charge_code.trim(),
      description: values.description.trim(),
      quantity: billingIntegerOrFallback(values.quantity, 1),
      unit_price: billingNumberOrFallback(values.unit_price, 0),
    });
    resetPackageItem(packageItemDefaults);
  };

  const handleCreatePackage = (values: BillingPackageFormInput) => {
    createMutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      description: billingOptionalText(values.description),
      total_price: billingNumberOrFallback(values.total_price, 0),
      discount_percent: billingNumberOrFallback(values.discount_percent, 0),
      items: values.items.map((item) => ({
        charge_code: item.charge_code.trim(),
        description: item.description.trim(),
        quantity: billingIntegerOrFallback(item.quantity, 1),
        unit_price: billingNumberOrFallback(item.unit_price, 0),
      })),
    });
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: BillingPackage) => <Text fw={500}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      render: (row: BillingPackage) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "total_price",
      label: "Price",
      render: (row: BillingPackage) => <Text size="sm">₹{row.total_price}</Text>,
    },
    {
      key: "discount_percent",
      label: "Discount",
      render: (row: BillingPackage) => <Text size="sm">{row.discount_percent}%</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: BillingPackage) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    {
      key: "actions",
      label: "",
      render: (row: BillingPackage) =>
        canCreate ? (
          <ActionIcon variant="subtle" color="danger" onClick={() => deleteMutation.mutate(row.id)}>
            <IconTrash size={14} />
          </ActionIcon>
        ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowForm(!showForm)}
          >
            Add Package
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack component="form" gap="xs" onSubmit={handleSubmitPackage(handleCreatePackage)}>
          <Group grow>
            <TextInput
              label="Code"
              required
              error={packageErrors.code?.message}
              {...registerPackage("code")}
            />
            <TextInput
              label="Name"
              required
              error={packageErrors.name?.message}
              {...registerPackage("name")}
            />
          </Group>
          <Group grow>
            <Controller
              control={packageControl}
              name="total_price"
              render={({ field }) => (
                <NumberInput
                  label="Total Price"
                  required
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={packageErrors.total_price?.message}
                />
              )}
            />
            <Controller
              control={packageControl}
              name="discount_percent"
              render={({ field }) => (
                <NumberInput
                  label="Discount %"
                  min={0}
                  max={100}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={packageErrors.discount_percent?.message}
                />
              )}
            />
          </Group>
          <Textarea
            label="Description"
            error={packageErrors.description?.message}
            {...registerPackage("description")}
          />
          <Text fw={500} size="sm" mt="xs">
            Package Items ({packageItems.length})
          </Text>
          {packageErrors.items?.message && (
            <Text size="xs" c="danger">
              {packageErrors.items.message}
            </Text>
          )}
          {packageItems.map((item, index) => (
            <Group key={item.id} gap="xs">
              <Text size="xs" c="dimmed">
                {item.charge_code} — {item.description} x{item.quantity} @ ₹{item.unit_price}
              </Text>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="danger"
                onClick={() => removePackageItem(index)}
              >
                <IconTrash size={12} />
              </ActionIcon>
            </Group>
          ))}
          <Group grow>
            <TextInput
              size="xs"
              placeholder="Charge Code"
              error={packageItemErrors.charge_code?.message}
              {...registerPackageItem("charge_code")}
            />
            <TextInput
              size="xs"
              placeholder="Description"
              error={packageItemErrors.description?.message}
              {...registerPackageItem("description")}
            />
            <Controller
              control={packageItemControl}
              name="quantity"
              render={({ field }) => (
                <NumberInput
                  size="xs"
                  placeholder="Qty"
                  min={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={packageItemErrors.quantity?.message}
                />
              )}
            />
            <Controller
              control={packageItemControl}
              name="unit_price"
              render={({ field }) => (
                <NumberInput
                  size="xs"
                  placeholder="Price"
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={packageItemErrors.unit_price?.message}
                />
              )}
            />
            <Button
              size="xs"
              type="button"
              variant="light"
              onClick={handleSubmitPackageItem(addPkgItem)}
            >
              + Item
            </Button>
          </Group>
          <Button size="xs" type="submit" loading={createMutation.isPending}>
            Save Package
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={packages} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Rate Plans Tab ──────────────────────────────────────

function RatePlansTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const ratePlanDefaults: BillingRatePlanFormInput = {
    name: "",
    description: "",
    patient_category: "",
    items: [],
  };
  const ratePlanItemDefaults: BillingRatePlanItemFormInput = {
    charge_code: "",
    override_price: 0,
  };
  const {
    control: ratePlanControl,
    register: registerRatePlan,
    reset: resetRatePlan,
    handleSubmit: handleSubmitRatePlan,
    formState: { errors: ratePlanErrors },
  } = useForm<BillingRatePlanFormInput>({
    resolver: zodResolver(billingRatePlanFormSchema),
    defaultValues: ratePlanDefaults,
  });
  const {
    control: ratePlanItemControl,
    register: registerRatePlanItem,
    reset: resetRatePlanItem,
    handleSubmit: handleSubmitRatePlanItem,
    formState: { errors: ratePlanItemErrors },
  } = useForm<BillingRatePlanItemFormInput>({
    resolver: zodResolver(billingRatePlanItemFormSchema),
    defaultValues: ratePlanItemDefaults,
  });
  const {
    fields: ratePlanItems,
    append: appendRatePlanItem,
    remove: removeRatePlanItem,
  } = useFieldArray({ control: ratePlanControl, name: "items" });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["rate-plans"],
    queryFn: () => billingService.listRatePlans(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateRatePlanRequest) => billingService.createRatePlan(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rate-plans"] });
      setShowForm(false);
      resetRatePlan(ratePlanDefaults);
      resetRatePlanItem(ratePlanItemDefaults);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => billingService.deleteRatePlan(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rate-plans"] }),
  });

  const addRpItem = (values: BillingRatePlanItemFormInput) => {
    appendRatePlanItem({
      charge_code: values.charge_code.trim(),
      override_price: billingNumberOrFallback(values.override_price, 0),
    });
    resetRatePlanItem(ratePlanItemDefaults);
  };

  const handleCreateRatePlan = (values: BillingRatePlanFormInput) => {
    createMutation.mutate({
      name: values.name.trim(),
      description: billingOptionalText(values.description),
      patient_category: billingOptionalText(values.patient_category),
      items: values.items.map((item) => ({
        charge_code: item.charge_code.trim(),
        override_price: billingNumberOrFallback(item.override_price, 0),
      })),
    });
  };

  const columns = [
    { key: "name", label: "Name", render: (row: RatePlan) => <Text fw={500}>{row.name}</Text> },
    {
      key: "patient_category",
      label: "Category",
      render: (row: RatePlan) => <Text size="sm">{row.patient_category ?? "All"}</Text>,
    },
    {
      key: "is_default",
      label: "Default",
      render: (row: RatePlan) =>
        row.is_default ? (
          <Badge size="xs" color="primary">
            Default
          </Badge>
        ) : null,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: RatePlan) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    {
      key: "actions",
      label: "",
      render: (row: RatePlan) =>
        canCreate ? (
          <ActionIcon variant="subtle" color="danger" onClick={() => deleteMutation.mutate(row.id)}>
            <IconTrash size={14} />
          </ActionIcon>
        ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowForm(!showForm)}
          >
            Add Rate Plan
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack component="form" gap="xs" onSubmit={handleSubmitRatePlan(handleCreateRatePlan)}>
          <Group grow>
            <TextInput
              label="Name"
              required
              error={ratePlanErrors.name?.message}
              {...registerRatePlan("name")}
            />
            <Controller
              control={ratePlanControl}
              name="patient_category"
              render={({ field }) => (
                <Select
                  label="Patient Category"
                  data={[
                    { value: "general", label: "General" },
                    { value: "insurance", label: "Insurance" },
                    { value: "corporate", label: "Corporate" },
                    { value: "staff", label: "Staff" },
                  ]}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={ratePlanErrors.patient_category?.message}
                  clearable
                />
              )}
            />
          </Group>
          <Textarea
            label="Description"
            error={ratePlanErrors.description?.message}
            {...registerRatePlan("description")}
          />
          <Text fw={500} size="sm" mt="xs">
            Price Overrides ({ratePlanItems.length})
          </Text>
          {ratePlanErrors.items?.message && (
            <Text size="xs" c="danger">
              {ratePlanErrors.items.message}
            </Text>
          )}
          {ratePlanItems.map((item, index) => (
            <Group key={item.id} gap="xs">
              <Text size="xs" c="dimmed">
                {item.charge_code} → ₹{item.override_price}
              </Text>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="danger"
                onClick={() => removeRatePlanItem(index)}
              >
                <IconTrash size={12} />
              </ActionIcon>
            </Group>
          ))}
          <Group grow>
            <TextInput
              size="xs"
              placeholder="Charge Code"
              error={ratePlanItemErrors.charge_code?.message}
              {...registerRatePlanItem("charge_code")}
            />
            <Controller
              control={ratePlanItemControl}
              name="override_price"
              render={({ field }) => (
                <NumberInput
                  size="xs"
                  placeholder="Override Price"
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={ratePlanItemErrors.override_price?.message}
                />
              )}
            />
            <Button
              size="xs"
              type="button"
              variant="light"
              onClick={handleSubmitRatePlanItem(addRpItem)}
            >
              + Override
            </Button>
          </Group>
          <Button size="xs" type="submit" loading={createMutation.isPending}>
            Save Rate Plan
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={plans} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Refunds & Credits Tab ───────────────────────────────

function RefundsCreditsTab({
  canCreate,
  canWriteOff,
}: {
  canCreate: boolean;
  canWriteOff: boolean;
}) {
  const queryClient = useQueryClient();
  const canApproveWriteOff = useHasPermission(P.BILLING.WRITE_OFF_APPROVE);
  const [showRefund, setShowRefund] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [showWriteOff, setShowWriteOff] = useState(false);
  const refundDefaults: BillingRefundFormInput = {
    invoice_id: "",
    amount: 0,
    reason: "",
    mode: "cash",
    reference_number: "",
  };
  const creditDefaults: BillingCreditNoteFormInput = {
    invoice_id: "",
    amount: 0,
    reason: "",
  };
  const writeOffDefaults: BillingWriteOffFormInput = {
    invoice_id: "",
    amount: 0,
    reason: "",
    notes: "",
  };
  const {
    control: refundControl,
    register: registerRefund,
    reset: resetRefund,
    handleSubmit: handleSubmitRefund,
    formState: { errors: refundErrors },
  } = useForm<BillingRefundFormInput>({
    resolver: zodResolver(billingRefundFormSchema),
    defaultValues: refundDefaults,
  });
  const {
    control: creditControl,
    register: registerCredit,
    reset: resetCredit,
    handleSubmit: handleSubmitCredit,
    formState: { errors: creditErrors },
  } = useForm<BillingCreditNoteFormInput>({
    resolver: zodResolver(billingCreditNoteFormSchema),
    defaultValues: creditDefaults,
  });
  const {
    control: writeOffControl,
    register: registerWriteOff,
    reset: resetWriteOff,
    handleSubmit: handleSubmitWriteOff,
    formState: { errors: writeOffErrors },
  } = useForm<BillingWriteOffFormInput>({
    resolver: zodResolver(billingWriteOffFormSchema),
    defaultValues: writeOffDefaults,
  });

  const { data: refunds = [] } = useQuery({
    queryKey: ["refunds"],
    queryFn: () => billingService.listRefunds(),
  });

  const { data: creditNotes = [] } = useQuery({
    queryKey: ["credit-notes"],
    queryFn: () => billingService.listCreditNotes(),
  });

  const refundMutation = useMutation({
    mutationFn: (data: CreateRefundRequest) => billingService.createRefund(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["refunds"] });
      setShowRefund(false);
      resetRefund(refundDefaults);
    },
  });

  const creditMutation = useMutation({
    mutationFn: (data: CreateCreditNoteRequest) => billingService.createCreditNote(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
      setShowCredit(false);
      resetCredit(creditDefaults);
    },
  });

  const applyMutation = useMutation({
    mutationFn: ({ noteId, invoiceId }: { noteId: string; invoiceId: string }) =>
      billingService.applyCreditNote(noteId, invoiceId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["credit-notes"] }),
  });

  const { data: writeOffs = [] } = useQuery({
    queryKey: ["write-offs"],
    queryFn: () => billingService.listWriteOffs(),
  });

  const writeOffMutation = useMutation({
    mutationFn: (data: CreateWriteOffRequest) => billingService.createWriteOff(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["write-offs"] });
      setShowWriteOff(false);
      resetWriteOff(writeOffDefaults);
    },
  });

  const handleCreateRefund = (values: BillingRefundFormInput) => {
    refundMutation.mutate({
      invoice_id: values.invoice_id.trim(),
      amount: billingNumberOrFallback(values.amount, 0),
      reason: values.reason.trim(),
      mode: values.mode,
      reference_number: billingOptionalText(values.reference_number),
    });
  };

  const handleCreateCreditNote = (values: BillingCreditNoteFormInput) => {
    creditMutation.mutate({
      invoice_id: values.invoice_id.trim(),
      amount: billingNumberOrFallback(values.amount, 0),
      reason: values.reason.trim(),
    });
  };

  const handleCreateWriteOff = (values: BillingWriteOffFormInput) => {
    writeOffMutation.mutate({
      invoice_id: values.invoice_id.trim(),
      amount: billingNumberOrFallback(values.amount, 0),
      reason: values.reason.trim(),
      notes: billingOptionalText(values.notes),
    });
  };

  const approveWriteOffMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveWriteOffRequest }) =>
      billingService.approveWriteOff(id, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["write-offs"] }),
  });

  const writeOffColumns = [
    {
      key: "write_off_number",
      label: "WO #",
      render: (row: BadDebtWriteOff) => <Text fw={500}>{row.write_off_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      render: (row: BadDebtWriteOff) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      render: (row: BadDebtWriteOff) => <Text size="sm">{row.reason}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: BadDebtWriteOff) => (
        <Badge
          variant="light"
          color={
            row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: BadDebtWriteOff) =>
        row.status === "pending" && canApproveWriteOff ? (
          <Group gap={4}>
            <Tooltip label="Approve">
              <ActionIcon
                color="success"
                variant="light"
                size="sm"
                onClick={() =>
                  approveWriteOffMutation.mutate({ id: row.id, data: { approved: true } })
                }
              >
                <IconCheck size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Reject">
              <ActionIcon
                color="danger"
                variant="light"
                size="sm"
                onClick={() =>
                  approveWriteOffMutation.mutate({ id: row.id, data: { approved: false } })
                }
              >
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null,
    },
  ];

  const refundColumns = [
    {
      key: "refund_number",
      label: "Refund #",
      render: (row: Refund) => <Text fw={500}>{row.refund_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      render: (row: Refund) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      render: (row: Refund) => <Text size="sm">{row.reason}</Text>,
    },
    {
      key: "mode",
      label: "Mode",
      render: (row: Refund) => <Badge variant="light">{row.mode}</Badge>,
    },
    {
      key: "refunded_at",
      label: "Date",
      render: (row: Refund) => (
        <Text size="sm">{new Date(row.refunded_at).toLocaleDateString()}</Text>
      ),
    },
  ];

  const creditColumns = [
    {
      key: "credit_note_number",
      label: "CN #",
      render: (row: CreditNote) => <Text fw={500}>{row.credit_note_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      render: (row: CreditNote) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      render: (row: CreditNote) => <Text size="sm">{row.reason}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: CreditNote) => (
        <Badge
          variant="light"
          color={row.status === "active" ? "success" : row.status === "used" ? "primary" : "danger"}
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: CreditNote) =>
        row.status === "active" && canCreate ? (
          <Button
            size="compact-xs"
            variant="light"
            onClick={() => {
              const invoiceId = prompt("Enter Invoice ID to apply credit note:");
              if (invoiceId) applyMutation.mutate({ noteId: row.id, invoiceId });
            }}
          >
            Apply
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Text fw={600}>Refunds</Text>
      {canCreate && (
        <>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowRefund(!showRefund)}
          >
            Create Refund
          </Button>
          {showRefund && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitRefund(handleCreateRefund)}>
              <Group grow>
                <TextInput
                  label="Invoice ID"
                  required
                  error={refundErrors.invoice_id?.message}
                  {...registerRefund("invoice_id")}
                />
                <Controller
                  control={refundControl}
                  name="amount"
                  render={({ field }) => (
                    <NumberInput
                      label="Amount"
                      required
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={refundErrors.amount?.message}
                    />
                  )}
                />
              </Group>
              <TextInput
                label="Reason"
                required
                error={refundErrors.reason?.message}
                {...registerRefund("reason")}
              />
              <Controller
                control={refundControl}
                name="mode"
                render={({ field }) => (
                  <Select
                    label="Mode"
                    data={billingPaymentModeOptions}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "cash")}
                    error={refundErrors.mode?.message}
                  />
                )}
              />
              <TextInput
                label="Reference #"
                error={refundErrors.reference_number?.message}
                {...registerRefund("reference_number")}
              />
              <Button size="xs" type="submit" loading={refundMutation.isPending}>
                Process Refund
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable columns={refundColumns} data={refunds} rowKey={(row) => row.id} />

      <Text fw={600} mt="lg">
        Credit Notes
      </Text>
      {canCreate && (
        <>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowCredit(!showCredit)}
          >
            Create Credit Note
          </Button>
          {showCredit && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitCredit(handleCreateCreditNote)}>
              <TextInput
                label="Invoice ID"
                required
                error={creditErrors.invoice_id?.message}
                {...registerCredit("invoice_id")}
              />
              <Controller
                control={creditControl}
                name="amount"
                render={({ field }) => (
                  <NumberInput
                    label="Amount"
                    required
                    min={0}
                    decimalScale={2}
                    value={field.value}
                    onChange={field.onChange}
                    error={creditErrors.amount?.message}
                  />
                )}
              />
              <TextInput
                label="Reason"
                required
                error={creditErrors.reason?.message}
                {...registerCredit("reason")}
              />
              <Button size="xs" type="submit" loading={creditMutation.isPending}>
                Issue Credit Note
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable columns={creditColumns} data={creditNotes} rowKey={(row) => row.id} />

      <Text fw={600} mt="lg">
        Write-Offs
      </Text>
      {canWriteOff && (
        <>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowWriteOff(!showWriteOff)}
          >
            Request Write-Off
          </Button>
          {showWriteOff && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitWriteOff(handleCreateWriteOff)}>
              <TextInput
                label="Invoice ID"
                required
                error={writeOffErrors.invoice_id?.message}
                {...registerWriteOff("invoice_id")}
              />
              <Controller
                control={writeOffControl}
                name="amount"
                render={({ field }) => (
                  <NumberInput
                    label="Amount"
                    required
                    min={0}
                    decimalScale={2}
                    value={field.value}
                    onChange={field.onChange}
                    error={writeOffErrors.amount?.message}
                  />
                )}
              />
              <TextInput
                label="Reason"
                required
                error={writeOffErrors.reason?.message}
                {...registerWriteOff("reason")}
              />
              <Textarea
                label="Notes"
                error={writeOffErrors.notes?.message}
                {...registerWriteOff("notes")}
              />
              <Button size="xs" type="submit" loading={writeOffMutation.isPending}>
                Submit Write-Off
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable columns={writeOffColumns} data={writeOffs} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Insurance Claims Tab ────────────────────────────────

function InsuranceClaimsTab({
  canCreate,
  canWriteOff: _cwo,
}: {
  canCreate: boolean;
  canWriteOff: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showTpa, setShowTpa] = useState(false);
  const insuranceClaimDefaults: BillingInsuranceClaimFormInput = {
    invoice_id: "",
    patient_id: "",
    insurance_provider: "",
    policy_number: "",
    claim_type: "cashless",
    pre_auth_amount: "",
    scheme_type: "",
    tpa_name: "",
    co_pay_percent: "",
    deductible_amount: "",
    member_id: "",
    scheme_card_number: "",
    notes: "",
  };
  const tpaRateCardDefaults: BillingTpaRateCardFormInput = {
    tpa_name: "",
    insurance_provider: "",
    scheme_type: "",
    rate_plan_id: "",
    valid_from: "",
    valid_to: "",
    is_active: true,
  };
  const {
    control: claimControl,
    register: registerClaim,
    reset: resetClaim,
    handleSubmit: handleSubmitClaim,
    formState: { errors: claimErrors },
  } = useForm<BillingInsuranceClaimFormInput>({
    resolver: zodResolver(billingInsuranceClaimFormSchema),
    defaultValues: insuranceClaimDefaults,
  });
  const {
    control: tpaControl,
    register: registerTpa,
    reset: resetTpa,
    handleSubmit: handleSubmitTpa,
    formState: { errors: tpaErrors },
  } = useForm<BillingTpaRateCardFormInput>({
    resolver: zodResolver(billingTpaRateCardFormSchema),
    defaultValues: tpaRateCardDefaults,
  });
  const [detailClaim, setDetailClaim] = useState<InsuranceClaim | null>(null);

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["insurance-claims"],
    queryFn: () => billingService.listInsuranceClaims(),
  });

  const { data: nhcxCallbacks = [] } = useQuery({
    queryKey: ["nhcx-callbacks", detailClaim?.id],
    queryFn: () => billingService.listNhcxCallbacks({ matched_id: detailClaim?.id }),
    enabled: !!detailClaim,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateInsuranceClaimRequest) => billingService.createInsuranceClaim(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] });
      setShowForm(false);
      resetClaim(insuranceClaimDefaults);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      billingService.updateInsuranceClaim(id, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] }),
  });

  const { data: tpaCards = [] } = useQuery({
    queryKey: ["tpa-rate-cards"],
    queryFn: () => billingService.listTpaRateCards(),
  });

  const tpaMutation = useMutation({
    mutationFn: (data: CreateTpaRateCardRequest) => billingService.createTpaRateCard(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tpa-rate-cards"] });
      setShowTpa(false);
      resetTpa(tpaRateCardDefaults);
    },
  });

  const deleteTpaMutation = useMutation({
    mutationFn: (id: string) => billingService.deleteTpaRateCard(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tpa-rate-cards"] }),
  });

  const tpaColumns = [
    {
      key: "tpa_name",
      label: "TPA Name",
      render: (row: TpaRateCard) => <Text fw={500}>{row.tpa_name}</Text>,
    },
    {
      key: "insurance_provider",
      label: "Provider",
      render: (row: TpaRateCard) => <Text size="sm">{row.insurance_provider}</Text>,
    },
    {
      key: "scheme_type",
      label: "Scheme",
      render: (row: TpaRateCard) => <Badge variant="light">{row.scheme_type ?? "—"}</Badge>,
    },
    {
      key: "valid_from",
      label: "Valid From",
      render: (row: TpaRateCard) => <Text size="sm">{row.valid_from ?? "—"}</Text>,
    },
    {
      key: "valid_to",
      label: "Valid To",
      render: (row: TpaRateCard) => <Text size="sm">{row.valid_to ?? "—"}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: TpaRateCard) => (
        <Badge color={row.is_active ? "success" : "slate"}>{row.is_active ? "Yes" : "No"}</Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: TpaRateCard) =>
        canCreate ? (
          <Tooltip label="Delete">
            <ActionIcon
              color="danger"
              variant="subtle"
              size="sm"
              onClick={() => deleteTpaMutation.mutate(row.id)}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        ) : null,
    },
  ];

  const claimStatusColors: Record<string, string> = {
    initiated: "slate",
    pre_auth_requested: "primary",
    pre_auth_approved: "teal",
    pre_auth_rejected: "danger",
    claim_submitted: "primary",
    claim_approved: "success",
    claim_rejected: "danger",
    settled: "success",
    partially_settled: "warning",
  };

  const handleCreateInsuranceClaim = (values: BillingInsuranceClaimFormInput) => {
    const payload: CreateInsuranceClaimRequest = {
      invoice_id: values.invoice_id.trim(),
      patient_id: values.patient_id.trim(),
      insurance_provider: values.insurance_provider.trim(),
      policy_number: billingOptionalText(values.policy_number),
      claim_type: values.claim_type,
      pre_auth_amount: billingOptionalNumber(values.pre_auth_amount),
      tpa_name: billingOptionalText(values.tpa_name),
      notes: billingOptionalText(values.notes),
      scheme_type: values.scheme_type || undefined,
      co_pay_percent: billingOptionalNumber(values.co_pay_percent),
      deductible_amount: billingOptionalNumber(values.deductible_amount),
      member_id: billingOptionalText(values.member_id),
      scheme_card_number: billingOptionalText(values.scheme_card_number),
    };
    createMutation.mutate(payload);
  };

  const handleCreateTpaRateCard = (values: BillingTpaRateCardFormInput) => {
    const payload: CreateTpaRateCardRequest = {
      tpa_name: values.tpa_name.trim(),
      insurance_provider: values.insurance_provider.trim(),
      rate_plan_id: billingOptionalText(values.rate_plan_id),
      scheme_type: values.scheme_type || undefined,
      valid_from: billingOptionalText(values.valid_from),
      valid_to: billingOptionalText(values.valid_to),
      is_active: values.is_active,
    };
    tpaMutation.mutate(payload);
  };

  const columns = [
    {
      key: "insurance_provider",
      label: "Provider",
      render: (row: InsuranceClaim) => <Text fw={500}>{row.insurance_provider}</Text>,
    },
    {
      key: "claim_type",
      label: "Type",
      render: (row: InsuranceClaim) => <Badge variant="light">{row.claim_type}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: InsuranceClaim) => (
        <Badge variant="light" color={claimStatusColors[row.status] ?? "slate"}>
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "pre_auth_amount",
      label: "Pre-Auth",
      render: (row: InsuranceClaim) => (
        <Text size="sm">{row.pre_auth_amount ? `₹${row.pre_auth_amount}` : "—"}</Text>
      ),
    },
    {
      key: "approved_amount",
      label: "Approved",
      render: (row: InsuranceClaim) => (
        <Text size="sm">{row.approved_amount ? `₹${row.approved_amount}` : "—"}</Text>
      ),
    },
    {
      key: "settled_amount",
      label: "Settled",
      render: (row: InsuranceClaim) => (
        <Text size="sm">{row.settled_amount ? `₹${row.settled_amount}` : "—"}</Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: InsuranceClaim) =>
        canCreate && row.status === "initiated" ? (
          <Button
            size="compact-xs"
            variant="light"
            onClick={() => updateMutation.mutate({ id: row.id, status: "pre_auth_requested" })}
          >
            Request Pre-Auth
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) resetClaim(insuranceClaimDefaults);
            }}
          >
            New Claim
          </Button>
          {showForm && (
            <Stack
              component="form"
              gap="xs"
              onSubmit={handleSubmitClaim(handleCreateInsuranceClaim)}
            >
              <Group grow>
                <TextInput
                  label="Invoice ID"
                  required
                  error={claimErrors.invoice_id?.message}
                  {...registerClaim("invoice_id")}
                />
                <TextInput
                  label="Patient ID"
                  required
                  error={claimErrors.patient_id?.message}
                  {...registerClaim("patient_id")}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Insurance Provider"
                  required
                  error={claimErrors.insurance_provider?.message}
                  {...registerClaim("insurance_provider")}
                />
                <TextInput
                  label="Policy Number"
                  error={claimErrors.policy_number?.message}
                  {...registerClaim("policy_number")}
                />
              </Group>
              <Group grow>
                <Controller
                  control={claimControl}
                  name="claim_type"
                  render={({ field }) => (
                    <Select
                      label="Claim Type"
                      data={billingInsuranceClaimTypeOptions}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? "cashless")}
                      error={claimErrors.claim_type?.message}
                    />
                  )}
                />
                <Controller
                  control={claimControl}
                  name="pre_auth_amount"
                  render={({ field }) => (
                    <NumberInput
                      label="Pre-Auth Amount"
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={claimErrors.pre_auth_amount?.message}
                    />
                  )}
                />
              </Group>
              <Group grow>
                <Controller
                  control={claimControl}
                  name="scheme_type"
                  render={({ field }) => (
                    <Select
                      label="Scheme Type"
                      data={billingInsuranceSchemeTypeOptions}
                      value={field.value || null}
                      onChange={(value) => field.onChange(value ?? "")}
                      error={claimErrors.scheme_type?.message}
                      clearable
                      searchable
                    />
                  )}
                />
                <TextInput
                  label="TPA Name"
                  error={claimErrors.tpa_name?.message}
                  {...registerClaim("tpa_name")}
                />
              </Group>
              <Group grow>
                <Controller
                  control={claimControl}
                  name="co_pay_percent"
                  render={({ field }) => (
                    <NumberInput
                      label="Co-Pay %"
                      min={0}
                      max={100}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={claimErrors.co_pay_percent?.message}
                    />
                  )}
                />
                <Controller
                  control={claimControl}
                  name="deductible_amount"
                  render={({ field }) => (
                    <NumberInput
                      label="Deductible Amount"
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={claimErrors.deductible_amount?.message}
                    />
                  )}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Member ID"
                  error={claimErrors.member_id?.message}
                  {...registerClaim("member_id")}
                />
                <TextInput
                  label="Scheme Card Number"
                  error={claimErrors.scheme_card_number?.message}
                  {...registerClaim("scheme_card_number")}
                />
              </Group>
              <Textarea
                label="Notes"
                error={claimErrors.notes?.message}
                {...registerClaim("notes")}
              />
              <Button size="xs" type="submit" loading={createMutation.isPending}>
                Create Claim
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={columns}
        data={claims}
        loading={isLoading}
        rowKey={(row) => row.id}
        onRowClick={(row) => setDetailClaim(row)}
      />

      <ClaimDetailDrawer
        claim={detailClaim}
        callbacks={nhcxCallbacks}
        onClose={() => setDetailClaim(null)}
      />

      <Text fw={600} mt="lg">
        TPA Rate Cards
      </Text>
      {canCreate && (
        <>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setShowTpa(!showTpa);
              if (showTpa) resetTpa(tpaRateCardDefaults);
            }}
          >
            Add TPA Rate Card
          </Button>
          {showTpa && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitTpa(handleCreateTpaRateCard)}>
              <Group grow>
                <TextInput
                  label="TPA Name"
                  required
                  error={tpaErrors.tpa_name?.message}
                  {...registerTpa("tpa_name")}
                />
                <TextInput
                  label="Insurance Provider"
                  required
                  error={tpaErrors.insurance_provider?.message}
                  {...registerTpa("insurance_provider")}
                />
              </Group>
              <Group grow>
                <Controller
                  control={tpaControl}
                  name="scheme_type"
                  render={({ field }) => (
                    <Select
                      label="Scheme Type"
                      data={billingInsuranceSchemeTypeOptions}
                      value={field.value || null}
                      onChange={(value) => field.onChange(value ?? "")}
                      error={tpaErrors.scheme_type?.message}
                      clearable
                      searchable
                    />
                  )}
                />
                <TextInput
                  label="Rate Plan ID"
                  error={tpaErrors.rate_plan_id?.message}
                  {...registerTpa("rate_plan_id")}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Valid From"
                  type="date"
                  error={tpaErrors.valid_from?.message}
                  {...registerTpa("valid_from")}
                />
                <TextInput
                  label="Valid To"
                  type="date"
                  error={tpaErrors.valid_to?.message}
                  {...registerTpa("valid_to")}
                />
              </Group>
              <Controller
                control={tpaControl}
                name="is_active"
                render={({ field }) => (
                  <Switch
                    label="Active rate card"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Button size="xs" type="submit" loading={tpaMutation.isPending}>
                Save TPA Rate Card
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable columns={tpaColumns} data={tpaCards} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Billing Settings Tab ────────────────────────────────

const AUTO_BILLING_KEYS = [
  {
    key: "auto_charge_opd",
    label: "OPD Consultation",
    description: "Auto-charge when an OPD visit is completed",
  },
  {
    key: "auto_charge_lab",
    label: "Lab Tests",
    description: "Auto-charge when a lab order is completed",
  },
  {
    key: "auto_charge_pharmacy",
    label: "Pharmacy Dispensing",
    description: "Auto-charge when a pharmacy order is dispensed",
  },
  {
    key: "auto_charge_radiology",
    label: "Radiology Exams",
    description: "Auto-charge when a radiology order is completed",
  },
  {
    key: "auto_charge_ipd_room",
    label: "IPD Room Charges",
    description: "Auto-charge room/bed fees on patient discharge",
  },
] as const;

interface NhcxCallbackRow {
  id: string;
  received_at: string;
  correlation_id: string | null;
  sender_code: string | null;
  callback_type: string | null;
  verification_status: string;
  decrypted_payload: unknown;
}

function ClaimDetailDrawer({
  claim,
  callbacks,
  onClose,
}: {
  claim: InsuranceClaim | null;
  callbacks: NhcxCallbackRow[];
  onClose: () => void;
}) {
  return (
    <Drawer
      opened={!!claim}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        claim ? (
          <Group gap="xs">
            <Text fw={600}>{claim.insurance_provider}</Text>
            <Badge size="sm" variant="light">
              {claim.claim_number ?? claim.id.slice(0, 8)}
            </Badge>
          </Group>
        ) : (
          "Claim"
        )
      }
    >
      {claim && (
        <Stack gap="md">
          <SimpleGrid cols={2} spacing="xs">
            <Text size="xs" c="dimmed">
              Status
            </Text>
            <Text size="sm">{claim.status.replace(/_/g, " ")}</Text>
            <Text size="xs" c="dimmed">
              Type
            </Text>
            <Text size="sm">{claim.claim_type}</Text>
            <Text size="xs" c="dimmed">
              Pre-auth
            </Text>
            <Text size="sm">{claim.pre_auth_amount ? `₹${claim.pre_auth_amount}` : "—"}</Text>
            <Text size="xs" c="dimmed">
              Approved
            </Text>
            <Text size="sm">{claim.approved_amount ? `₹${claim.approved_amount}` : "—"}</Text>
            <Text size="sm" c="dimmed">
              Settled
            </Text>
            <Text size="sm">{claim.settled_amount ? `₹${claim.settled_amount}` : "—"}</Text>
            <Text size="xs" c="dimmed">
              TPA
            </Text>
            <Text size="sm">{claim.tpa_name ?? "—"}</Text>
            <Text size="xs" c="dimmed">
              Submitted
            </Text>
            <Text size="sm">
              {claim.submitted_at ? new Date(claim.submitted_at).toLocaleString() : "—"}
            </Text>
          </SimpleGrid>

          <Card withBorder padding="sm" radius="md">
            <Text fw={600} size="sm" mb="xs">
              NHCX exchange
            </Text>
            {claim.nhcx_correlation_id ? (
              <Stack gap={4}>
                <Group gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" style={{ minWidth: 140 }}>
                    Correlation ID
                  </Text>
                  <Text size="xs" ff="monospace">
                    {claim.nhcx_correlation_id}
                  </Text>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" style={{ minWidth: 140 }}>
                    API call ID
                  </Text>
                  <Text size="xs" ff="monospace">
                    {claim.nhcx_api_call_id ?? "—"}
                  </Text>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" style={{ minWidth: 140 }}>
                    Recipient code
                  </Text>
                  <Text size="xs" ff="monospace">
                    {claim.nhcx_recipient_code ?? "—"}
                  </Text>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" style={{ minWidth: 140 }}>
                    Last response at
                  </Text>
                  <Text size="xs">
                    {claim.nhcx_response_at
                      ? new Date(claim.nhcx_response_at).toLocaleString()
                      : "—"}
                  </Text>
                </Group>
                {claim.nhcx_response_payload != null && (
                  <Card withBorder padding="xs" radius="sm" mt="xs" bg="gray.0">
                    <Text size="xs" c="dimmed" mb={4}>
                      Decrypted response payload
                    </Text>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 11,
                        maxHeight: 220,
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}
                    >
                      {JSON.stringify(claim.nhcx_response_payload, null, 2)}
                    </pre>
                  </Card>
                )}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Not yet exchanged with NHCX gateway.
              </Text>
            )}
          </Card>

          <Card withBorder padding="sm" radius="md">
            <Group justify="space-between" mb="xs">
              <Text fw={600} size="sm">
                Webhook callbacks
              </Text>
              <Badge variant="light">{callbacks.length}</Badge>
            </Group>
            {callbacks.length === 0 ? (
              <Text size="sm" c="dimmed">
                No callbacks received yet.
              </Text>
            ) : (
              <Table verticalSpacing={4} fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>When</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Sender</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {callbacks.map((cb) => (
                    <Table.Tr key={cb.id}>
                      <Table.Td>{new Date(cb.received_at).toLocaleString()}</Table.Td>
                      <Table.Td>{cb.callback_type ?? "—"}</Table.Td>
                      <Table.Td>{cb.sender_code ?? "—"}</Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          variant="light"
                          color={cb.verification_status === "verified" ? "green" : "orange"}
                        >
                          {cb.verification_status}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </Stack>
      )}
    </Drawer>
  );
}

function BillingSettingsTab() {
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["tenant-settings", "billing"],
    queryFn: () => billingService.getTenantSettings("billing"),
  });

  const settingsMap = new Map(settings.map((s: TenantSettingsRow) => [s.key, s.value]));

  const updateMutation = useMutation({
    mutationFn: (data: { category: string; key: string; value: unknown }) =>
      billingService.updateTenantSetting(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-settings", "billing"] });
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to update setting", color: "danger" });
    },
  });

  const isEnabled = (key: string) =>
    settingsMap.get(key) === true || settingsMap.get(key) === "true";

  const toggle = (key: string) => {
    const current = isEnabled(key);
    updateMutation.mutate({ category: "billing", key, value: !current });
  };

  const getStrVal = (key: string) => {
    const v = settingsMap.get(key);
    return typeof v === "string" ? v : "";
  };

  const updateStr = (key: string, value: string) => {
    updateMutation.mutate({ category: "billing", key, value });
  };

  if (isLoading) return <Text c="dimmed">Loading settings...</Text>;

  return (
    <Stack>
      <Text fw={600}>GST Configuration</Text>
      <Text size="sm" c="dimmed">
        Configure GST details for tax computation on invoices. CGST/SGST applies for intra-state
        transactions, IGST for inter-state.
      </Text>
      <Group grow>
        <TextInput
          label="GSTIN"
          placeholder="e.g. 33AABCU9603R1ZM"
          defaultValue={getStrVal("gst_number")}
          onBlur={(e) => updateStr("gst_number", e.currentTarget.value)}
        />
        <TextInput
          label="State Code"
          placeholder="e.g. 33 (Tamil Nadu)"
          defaultValue={getStrVal("gst_state_code")}
          onBlur={(e) => updateStr("gst_state_code", e.currentTarget.value)}
        />
        <Select
          label="Default GST Type"
          data={[
            { value: "cgst_sgst", label: "CGST + SGST (Intra-State)" },
            { value: "igst", label: "IGST (Inter-State)" },
            { value: "exempt", label: "Exempt" },
          ]}
          value={getStrVal("default_gst_type") || "exempt"}
          onChange={(v) => {
            if (v) updateStr("default_gst_type", v);
          }}
        />
      </Group>

      <Text fw={600} mt="lg">
        Advance Settings
      </Text>
      <Switch
        label="Auto-adjust advance on invoice payment"
        description="Automatically apply available patient advance deposits when recording payments"
        checked={isEnabled("auto_adjust_advance")}
        onChange={() => toggle("auto_adjust_advance")}
        disabled={updateMutation.isPending}
      />

      <Text fw={600} mt="lg">
        Auto-Billing
      </Text>
      <Text size="sm" c="dimmed">
        When enabled, invoices are automatically created or updated when services are completed.
        Charges use the Charge Master and Rate Plans for pricing.
      </Text>
      {AUTO_BILLING_KEYS.map(({ key, label, description }) => (
        <Switch
          key={key}
          label={label}
          description={description}
          checked={isEnabled(key)}
          onChange={() => toggle(key)}
          disabled={updateMutation.isPending}
        />
      ))}
    </Stack>
  );
}

// ── Advances Tab ────────────────────────────────────────

const advanceStatusColors: Record<string, string> = {
  active: "success",
  partially_used: "warning",
  fully_used: "primary",
  refunded: "orange",
};

function AdvancesTab() {
  const canCreate = useHasPermission(P.BILLING.ADVANCES_CREATE);
  const canAdjust = useHasPermission(P.BILLING.ADVANCES_ADJUST);
  const canRefund = useHasPermission(P.BILLING.ADVANCES_REFUND);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const advanceDefaults: BillingAdvanceFormInput = {
    patient_id: "",
    encounter_id: "",
    amount: 0,
    payment_mode: "cash",
    reference_number: "",
    purpose: "general",
    notes: "",
  };
  const adjustmentDefaults: BillingAdvanceAdjustmentFormInput = {
    invoice_id: "",
    amount: 0,
    notes: "",
  };
  const advanceRefundDefaults: BillingAdvanceRefundFormInput = {
    amount: 0,
    reason: "",
    mode: "cash",
    reference_number: "",
  };
  const {
    control: advanceControl,
    register: registerAdvance,
    reset: resetAdvance,
    handleSubmit: handleSubmitAdvance,
    formState: { errors: advanceErrors },
  } = useForm<BillingAdvanceFormInput>({
    resolver: zodResolver(billingAdvanceFormSchema),
    defaultValues: advanceDefaults,
  });
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const {
    control: adjustmentControl,
    register: registerAdjustment,
    reset: resetAdjustment,
    handleSubmit: handleSubmitAdjustment,
    formState: { errors: adjustmentErrors },
  } = useForm<BillingAdvanceAdjustmentFormInput>({
    resolver: zodResolver(billingAdvanceAdjustmentFormSchema),
    defaultValues: adjustmentDefaults,
  });
  const [refundId, setRefundId] = useState<string | null>(null);
  const {
    control: advanceRefundControl,
    register: registerAdvanceRefund,
    reset: resetAdvanceRefund,
    handleSubmit: handleSubmitAdvanceRefund,
    formState: { errors: advanceRefundErrors },
  } = useForm<BillingAdvanceRefundFormInput>({
    resolver: zodResolver(billingAdvanceRefundFormSchema),
    defaultValues: advanceRefundDefaults,
  });

  const { data: advances = [], isLoading } = useQuery({
    queryKey: ["advances"],
    queryFn: () => billingService.listAdvances(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateAdvanceRequest) => billingService.createAdvance(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["advances"] });
      notifications.show({
        title: "Advance created",
        message: "Patient advance recorded",
        color: "success",
      });
      setShowForm(false);
      resetAdvance(advanceDefaults);
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to create advance", color: "danger" }),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdjustAdvanceRequest }) =>
      billingService.adjustAdvance(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["advances"] });
      notifications.show({
        title: "Adjusted",
        message: "Advance adjusted against invoice",
        color: "success",
      });
      setAdjustId(null);
      resetAdjustment(adjustmentDefaults);
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to adjust advance", color: "danger" }),
  });

  const refundMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RefundAdvanceRequest }) =>
      billingService.refundAdvance(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["advances"] });
      notifications.show({ title: "Refunded", message: "Advance refunded", color: "success" });
      setRefundId(null);
      resetAdvanceRefund(advanceRefundDefaults);
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to refund advance", color: "danger" }),
  });

  const columns = [
    {
      key: "advance_number",
      label: "Advance #",
      render: (row: PatientAdvance) => <Text fw={600}>{row.advance_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      render: (row: PatientAdvance) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "balance",
      label: "Balance",
      render: (row: PatientAdvance) => (
        <Text size="sm" c={Number(row.balance) > 0 ? "success" : "dimmed"}>
          ₹{row.balance}
        </Text>
      ),
    },
    {
      key: "purpose",
      label: "Purpose",
      render: (row: PatientAdvance) => <Badge variant="light">{row.purpose}</Badge>,
    },
    {
      key: "payment_mode",
      label: "Mode",
      render: (row: PatientAdvance) => <Text size="sm">{row.payment_mode}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: PatientAdvance) => (
        <Badge variant="light" color={advanceStatusColors[row.status] ?? "slate"}>
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: PatientAdvance) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: PatientAdvance) => {
        if (Number(row.balance) <= 0) return null;
        return (
          <Group gap={4}>
            {canAdjust && (
              <Button size="compact-xs" variant="light" onClick={() => setAdjustId(row.id)}>
                Adjust
              </Button>
            )}
            {canRefund && (
              <Button
                size="compact-xs"
                variant="light"
                color="orange"
                onClick={() => setRefundId(row.id)}
              >
                Refund
              </Button>
            )}
          </Group>
        );
      },
    },
  ];

  const handleCreateAdvance = (values: BillingAdvanceFormInput) => {
    createMutation.mutate({
      patient_id: values.patient_id.trim(),
      encounter_id: billingOptionalText(values.encounter_id),
      amount: billingNumberOrFallback(values.amount, 0),
      payment_mode: values.payment_mode,
      reference_number: billingOptionalText(values.reference_number),
      purpose: values.purpose,
      notes: billingOptionalText(values.notes),
    });
  };

  const handleAdjustAdvance = (values: BillingAdvanceAdjustmentFormInput) => {
    if (!adjustId) return;
    adjustMutation.mutate({
      id: adjustId,
      data: {
        invoice_id: values.invoice_id.trim(),
        amount: billingNumberOrFallback(values.amount, 0),
        notes: billingOptionalText(values.notes),
      },
    });
  };

  const handleRefundAdvance = (values: BillingAdvanceRefundFormInput) => {
    if (!refundId) return;
    refundMutation.mutate({
      id: refundId,
      data: {
        amount: billingNumberOrFallback(values.amount, 0),
        reason: values.reason.trim(),
        mode: values.mode,
        reference_number: billingOptionalText(values.reference_number),
      },
    });
  };

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowForm(!showForm)}
          >
            Collect Advance
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack component="form" gap="xs" onSubmit={handleSubmitAdvance(handleCreateAdvance)}>
          <Group grow>
            <TextInput
              label="Patient ID"
              required
              error={advanceErrors.patient_id?.message}
              {...registerAdvance("patient_id")}
            />
            <TextInput
              label="Encounter ID"
              error={advanceErrors.encounter_id?.message}
              {...registerAdvance("encounter_id")}
            />
          </Group>
          <Group grow>
            <Controller
              control={advanceControl}
              name="amount"
              render={({ field }) => (
                <NumberInput
                  label="Amount"
                  required
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={advanceErrors.amount?.message}
                />
              )}
            />
            <Controller
              control={advanceControl}
              name="payment_mode"
              render={({ field }) => (
                <Select
                  label="Payment Mode"
                  data={billingPaymentModeOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "cash")}
                  error={advanceErrors.payment_mode?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={advanceControl}
              name="purpose"
              render={({ field }) => (
                <Select
                  label="Purpose"
                  data={billingAdvancePurposeOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "general")}
                  error={advanceErrors.purpose?.message}
                />
              )}
            />
            <TextInput
              label="Reference #"
              error={advanceErrors.reference_number?.message}
              {...registerAdvance("reference_number")}
            />
          </Group>
          <Textarea
            label="Notes"
            error={advanceErrors.notes?.message}
            {...registerAdvance("notes")}
          />
          <Button size="xs" type="submit" loading={createMutation.isPending}>
            Save Advance
          </Button>
        </Stack>
      )}

      <DataTable columns={columns} data={advances} loading={isLoading} rowKey={(row) => row.id} />

      <Drawer
        opened={adjustId !== null}
        onClose={() => setAdjustId(null)}
        title="Adjust Advance Against Invoice"
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleSubmitAdjustment(handleAdjustAdvance)}>
          <TextInput
            label="Invoice ID"
            required
            error={adjustmentErrors.invoice_id?.message}
            {...registerAdjustment("invoice_id")}
          />
          <Controller
            control={adjustmentControl}
            name="amount"
            render={({ field }) => (
              <NumberInput
                label="Amount"
                required
                min={0}
                decimalScale={2}
                value={field.value}
                onChange={field.onChange}
                error={adjustmentErrors.amount?.message}
              />
            )}
          />
          <Textarea
            label="Notes"
            error={adjustmentErrors.notes?.message}
            {...registerAdjustment("notes")}
          />
          <Button type="submit" loading={adjustMutation.isPending}>
            Apply Adjustment
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={refundId !== null}
        onClose={() => setRefundId(null)}
        title="Refund Advance"
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleSubmitAdvanceRefund(handleRefundAdvance)}>
          <Controller
            control={advanceRefundControl}
            name="amount"
            render={({ field }) => (
              <NumberInput
                label="Refund Amount"
                required
                min={0}
                decimalScale={2}
                value={field.value}
                onChange={field.onChange}
                error={advanceRefundErrors.amount?.message}
              />
            )}
          />
          <TextInput
            label="Reason"
            required
            error={advanceRefundErrors.reason?.message}
            {...registerAdvanceRefund("reason")}
          />
          <Controller
            control={advanceRefundControl}
            name="mode"
            render={({ field }) => (
              <Select
                label="Refund Mode"
                data={billingPaymentModeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "cash")}
                error={advanceRefundErrors.mode?.message}
              />
            )}
          />
          <TextInput
            label="Reference #"
            error={advanceRefundErrors.reference_number?.message}
            {...registerAdvanceRefund("reference_number")}
          />
          <Button type="submit" loading={refundMutation.isPending}>
            Process Refund
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Corporate Tab ───────────────────────────────────────

function CorporateTab() {
  const canCreate = useHasPermission(P.BILLING.CORPORATE_CREATE);
  const canUpdate = useHasPermission(P.BILLING.CORPORATE_UPDATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const corporateDefaults: BillingCorporateFormInput = {
    code: "",
    name: "",
    gst_number: "",
    billing_address: "",
    contact_email: "",
    contact_phone: "",
    credit_limit: "",
    credit_days: 30,
    agreed_discount_percent: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingCorporateFormInput>({
    resolver: zodResolver(billingCorporateFormSchema),
    defaultValues: corporateDefaults,
  });

  const { data: corporates = [], isLoading } = useQuery({
    queryKey: ["corporates"],
    queryFn: () => billingService.listCorporates(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCorporateRequest) => billingService.createCorporate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["corporates"] });
      notifications.show({
        title: "Created",
        message: "Corporate client created",
        color: "success",
      });
      setShowForm(false);
      reset(corporateDefaults);
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Failed to create corporate client",
        color: "danger",
      }),
  });

  const handleCreateCorporate = (values: BillingCorporateFormInput) => {
    const payload: CreateCorporateRequest = {
      code: values.code.trim(),
      name: values.name.trim(),
      gst_number: billingOptionalText(values.gst_number),
      billing_address: billingOptionalText(values.billing_address),
      contact_email: billingOptionalText(values.contact_email),
      contact_phone: billingOptionalText(values.contact_phone),
      credit_limit: billingOptionalNumber(values.credit_limit),
      credit_days: billingOptionalInteger(values.credit_days),
      agreed_discount_percent: billingOptionalNumber(values.agreed_discount_percent),
    };
    createMutation.mutate(payload);
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: CorporateClient) => <Text fw={600}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      render: (row: CorporateClient) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "gst_number",
      label: "GSTIN",
      render: (row: CorporateClient) => <Text size="sm">{row.gst_number ?? "—"}</Text>,
    },
    {
      key: "credit_limit",
      label: "Credit Limit",
      render: (row: CorporateClient) => <Text size="sm">₹{row.credit_limit}</Text>,
    },
    {
      key: "credit_days",
      label: "Credit Days",
      render: (row: CorporateClient) => <Text size="sm">{row.credit_days}</Text>,
    },
    {
      key: "discount",
      label: "Discount %",
      render: (row: CorporateClient) => <Text size="sm">{row.agreed_discount_percent}%</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: CorporateClient) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    {
      key: "actions",
      label: "",
      render: (row: CorporateClient) => (
        <Tooltip label="View Details">
          <ActionIcon
            variant="subtle"
            onClick={() => {
              setSelectedId(row.id);
              openDetail();
            }}
          >
            <IconEye size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) reset(corporateDefaults);
            }}
          >
            Add Corporate Client
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateCorporate)}>
          <Group grow>
            <TextInput
              label="Code"
              required
              placeholder="e.g. CORP-001"
              error={errors.code?.message}
              {...register("code")}
            />
            <TextInput label="Name" required error={errors.name?.message} {...register("name")} />
          </Group>
          <Group grow>
            <TextInput
              label="GST Number"
              error={errors.gst_number?.message}
              {...register("gst_number")}
            />
            <TextInput
              label="Contact Email"
              error={errors.contact_email?.message}
              {...register("contact_email")}
            />
            <TextInput
              label="Contact Phone"
              error={errors.contact_phone?.message}
              {...register("contact_phone")}
            />
          </Group>
          <Textarea
            label="Billing Address"
            error={errors.billing_address?.message}
            {...register("billing_address")}
          />
          <Group grow>
            <Controller
              control={control}
              name="credit_limit"
              render={({ field }) => (
                <NumberInput
                  label="Credit Limit (₹)"
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.credit_limit?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="credit_days"
              render={({ field }) => (
                <NumberInput
                  label="Credit Days"
                  min={0}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.credit_days?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="agreed_discount_percent"
              render={({ field }) => (
                <NumberInput
                  label="Agreed Discount %"
                  min={0}
                  max={100}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.agreed_discount_percent?.message}
                />
              )}
            />
          </Group>
          <Button size="xs" type="submit" loading={createMutation.isPending}>
            Save Client
          </Button>
        </Stack>
      )}

      <DataTable columns={columns} data={corporates} loading={isLoading} rowKey={(row) => row.id} />

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="Corporate Client Detail"
        position="right"
        size="lg"
      >
        {selectedId && <CorporateDetail corporateId={selectedId} canUpdate={canUpdate} />}
      </Drawer>
    </Stack>
  );
}

function CorporateDetail({ corporateId, canUpdate }: { corporateId: string; canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const [showEnroll, setShowEnroll] = useState(false);
  const [editing, setEditing] = useState(false);
  const enrollmentDefaults: BillingCorporateEnrollmentFormInput = {
    patient_id: "",
    employee_id: "",
    department: "",
  };
  const corporateUpdateDefaults: BillingCorporateUpdateFormInput = {
    name: "",
    gst_number: "",
    billing_address: "",
    contact_email: "",
    contact_phone: "",
    credit_limit: "",
    credit_days: "",
    agreed_discount_percent: "",
    is_active: true,
  };
  const {
    control: enrollmentControl,
    register: registerEnrollment,
    reset: resetEnrollment,
    handleSubmit: handleSubmitEnrollment,
    formState: { errors: enrollmentErrors },
  } = useForm<BillingCorporateEnrollmentFormInput>({
    resolver: zodResolver(billingCorporateEnrollmentFormSchema),
    defaultValues: enrollmentDefaults,
  });
  const {
    control: updateControl,
    register: registerUpdate,
    reset: resetUpdate,
    handleSubmit: handleSubmitUpdate,
    formState: { errors: updateErrors },
  } = useForm<BillingCorporateUpdateFormInput>({
    resolver: zodResolver(billingCorporateUpdateFormSchema),
    defaultValues: corporateUpdateDefaults,
  });

  const { data: corporate } = useQuery({
    queryKey: ["corporate", corporateId],
    queryFn: () => billingService.getCorporate(corporateId),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["corporate-enrollments", corporateId],
    queryFn: () => billingService.listCorporateEnrollments(corporateId),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["corporate-invoices", corporateId],
    queryFn: () => billingService.listCorporateInvoices(corporateId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCorporateRequest) => billingService.updateCorporate(corporateId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["corporate", corporateId] });
      void queryClient.invalidateQueries({ queryKey: ["corporates"] });
      setEditing(false);
      resetUpdate(corporateUpdateDefaults);
    },
  });

  const enrollMutation = useMutation({
    mutationFn: (data: CreateEnrollmentRequest) =>
      billingService.createCorporateEnrollment(corporateId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["corporate-enrollments", corporateId] });
      setShowEnroll(false);
      resetEnrollment(enrollmentDefaults);
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: (enrollmentId: string) =>
      billingService.deleteCorporateEnrollment(corporateId, enrollmentId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["corporate-enrollments", corporateId] }),
  });

  if (!corporate) return <Text c="dimmed">Loading...</Text>;

  const handleUpdateCorporate = (values: BillingCorporateUpdateFormInput) => {
    const payload: UpdateCorporateRequest = {
      name: values.name.trim(),
      gst_number: billingOptionalText(values.gst_number),
      billing_address: billingOptionalText(values.billing_address),
      contact_email: billingOptionalText(values.contact_email),
      contact_phone: billingOptionalText(values.contact_phone),
      credit_limit: billingOptionalNumber(values.credit_limit),
      credit_days: billingOptionalInteger(values.credit_days),
      agreed_discount_percent: billingOptionalNumber(values.agreed_discount_percent),
      is_active: values.is_active,
    };
    updateMutation.mutate(payload);
  };

  const handleEnrollCorporatePatient = (values: BillingCorporateEnrollmentFormInput) => {
    const payload: CreateEnrollmentRequest = {
      patient_id: values.patient_id.trim(),
      employee_id: billingOptionalText(values.employee_id),
      department: billingOptionalText(values.department),
    };
    enrollMutation.mutate(payload);
  };

  const toggleEdit = () => {
    if (editing) {
      resetUpdate(corporateUpdateDefaults);
      setEditing(false);
      return;
    }
    resetUpdate({
      name: corporate.name,
      gst_number: corporate.gst_number ?? "",
      billing_address: corporate.billing_address ?? "",
      contact_email: corporate.contact_email ?? "",
      contact_phone: corporate.contact_phone ?? "",
      credit_limit: Number(corporate.credit_limit),
      credit_days: corporate.credit_days,
      agreed_discount_percent: Number(corporate.agreed_discount_percent),
      is_active: corporate.is_active,
    });
    setEditing(true);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700} size="lg">
          {corporate.name}
        </Text>
        <Badge size="lg" variant="light" color={corporate.is_active ? "success" : "danger"}>
          {corporate.is_active ? "Active" : "Inactive"}
        </Badge>
      </Group>

      <SimpleGrid cols={2}>
        <Text size="sm">
          Code: <b>{corporate.code}</b>
        </Text>
        <Text size="sm">GSTIN: {corporate.gst_number ?? "—"}</Text>
        <Text size="sm">Credit Limit: ₹{corporate.credit_limit}</Text>
        <Text size="sm">Credit Days: {corporate.credit_days}</Text>
        <Text size="sm">Discount: {corporate.agreed_discount_percent}%</Text>
        <Text size="sm">Email: {corporate.contact_email ?? "—"}</Text>
      </SimpleGrid>

      {canUpdate && (
        <>
          <Button size="xs" variant="light" onClick={toggleEdit}>
            {editing ? "Cancel Edit" : "Edit Client"}
          </Button>
          {editing && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitUpdate(handleUpdateCorporate)}>
              <Group grow>
                <TextInput
                  label="Name"
                  required
                  error={updateErrors.name?.message}
                  {...registerUpdate("name")}
                />
                <TextInput
                  label="GST Number"
                  error={updateErrors.gst_number?.message}
                  {...registerUpdate("gst_number")}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Contact Email"
                  error={updateErrors.contact_email?.message}
                  {...registerUpdate("contact_email")}
                />
                <TextInput
                  label="Contact Phone"
                  error={updateErrors.contact_phone?.message}
                  {...registerUpdate("contact_phone")}
                />
              </Group>
              <Textarea
                label="Billing Address"
                error={updateErrors.billing_address?.message}
                {...registerUpdate("billing_address")}
              />
              <Group grow>
                <Controller
                  control={updateControl}
                  name="credit_limit"
                  render={({ field }) => (
                    <NumberInput
                      label="Credit Limit"
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={updateErrors.credit_limit?.message}
                    />
                  )}
                />
                <Controller
                  control={updateControl}
                  name="credit_days"
                  render={({ field }) => (
                    <NumberInput
                      label="Credit Days"
                      min={0}
                      value={field.value}
                      onChange={field.onChange}
                      error={updateErrors.credit_days?.message}
                    />
                  )}
                />
                <Controller
                  control={updateControl}
                  name="agreed_discount_percent"
                  render={({ field }) => (
                    <NumberInput
                      label="Discount %"
                      min={0}
                      max={100}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={updateErrors.agreed_discount_percent?.message}
                    />
                  )}
                />
                <Controller
                  control={updateControl}
                  name="is_active"
                  render={({ field }) => (
                    <Switch
                      label="Active"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.currentTarget.checked)}
                    />
                  )}
                />
              </Group>
              <Button size="xs" type="submit" loading={updateMutation.isPending}>
                Save Changes
              </Button>
            </Stack>
          )}
        </>
      )}

      <Text fw={600} mt="md">
        Enrollments ({enrollments.length})
      </Text>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Patient ID</Table.Th>
            <Table.Th>Employee ID</Table.Th>
            <Table.Th>Department</Table.Th>
            <Table.Th>Enrolled</Table.Th>
            {canUpdate && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {enrollments.map((e: CorporateEnrollment) => (
            <Table.Tr key={e.id}>
              <Table.Td>{e.patient_id}</Table.Td>
              <Table.Td>{e.employee_id ?? "—"}</Table.Td>
              <Table.Td>{e.department ?? "—"}</Table.Td>
              <Table.Td>{new Date(e.enrolled_at).toLocaleDateString()}</Table.Td>
              {canUpdate && (
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="danger"
                    size="sm"
                    onClick={() => unenrollMutation.mutate(e.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {canUpdate && (
        <>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowEnroll(!showEnroll)}
          >
            Enroll Patient
          </Button>
          {showEnroll && (
            <Stack
              component="form"
              gap="xs"
              onSubmit={handleSubmitEnrollment(handleEnrollCorporatePatient)}
            >
              <Group grow>
                <Controller
                  control={enrollmentControl}
                  name="patient_id"
                  render={({ field }) => (
                    <PatientSearchSelect
                      value={field.value}
                      onChange={(id) => field.onChange(id)}
                      required
                      error={enrollmentErrors.patient_id?.message}
                    />
                  )}
                />
                <Controller
                  control={enrollmentControl}
                  name="employee_id"
                  render={({ field }) => (
                    <EmployeeSearchSelect
                      value={field.value}
                      onChange={(id) => field.onChange(id ?? "")}
                    />
                  )}
                />
                <TextInput
                  label="Department"
                  error={enrollmentErrors.department?.message}
                  {...registerEnrollment("department")}
                />
              </Group>
              <Button size="xs" type="submit" loading={enrollMutation.isPending}>
                Enroll
              </Button>
            </Stack>
          )}
        </>
      )}

      <Text fw={600} mt="md">
        Corporate Invoices ({invoices.length})
      </Text>
      {invoices.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Invoice #</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {invoices.map((inv: Invoice) => (
              <Table.Tr key={inv.id}>
                <Table.Td>{inv.invoice_number}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={statusColors[inv.status] ?? "slate"}>
                    {inv.status.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>₹{inv.total_amount}</Table.Td>
                <Table.Td>{new Date(inv.created_at).toLocaleDateString()}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No invoices found
        </Text>
      )}
    </Stack>
  );
}

// ── Reports Tab ─────────────────────────────────────────

function ReportsTab() {
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
                      variant="light"
                      color={
                        b.bucket.includes("90")
                          ? "danger"
                          : b.bucket.includes("60")
                            ? "orange"
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
                    <Badge color="warning" variant="light">
                      {row.pending_count}
                    </Badge>
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
              color={
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

function DayCloseTab() {
  const queryClient = useQueryClient();
  const canVerify = useHasPermission(P.BILLING.DAY_CLOSE_VERIFY);
  const [showForm, setShowForm] = useState(false);
  const today = new Date();
  const dayCloseDefaults: BillingDayCloseFormInput = {
    close_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}`,
    actual_cash: 0,
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingDayCloseFormInput>({
    resolver: zodResolver(billingDayCloseFormSchema),
    defaultValues: dayCloseDefaults,
  });

  const { data: dayCloses = [], isLoading } = useQuery({
    queryKey: ["day-closes"],
    queryFn: () => billingService.listDayCloses(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDayCloseRequest) => billingService.createDayClose(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["day-closes"] });
      setShowForm(false);
      reset(dayCloseDefaults);
      notifications.show({ title: "Success", message: "Day close created", color: "success" });
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Failed to create day close",
        color: "danger",
      }),
  });

  const handleCreateDayClose = (values: BillingDayCloseFormInput) => {
    const payload: CreateDayCloseRequest = {
      close_date: values.close_date.trim(),
      actual_cash: billingNumberOrFallback(values.actual_cash, 0),
      notes: billingOptionalText(values.notes),
    };
    createMutation.mutate(payload);
  };

  const verifyMutation = useMutation({
    mutationFn: (id: string) => billingService.verifyDayClose(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["day-closes"] });
      notifications.show({ title: "Verified", message: "Day close verified", color: "success" });
    },
  });

  const dayCloseStatusColors: Record<string, string> = {
    open: "primary",
    verified: "success",
    discrepancy: "danger",
  };

  const columns = [
    {
      key: "close_date",
      label: "Date",
      render: (row: DayEndClose) => <Text fw={500}>{row.close_date}</Text>,
    },
    {
      key: "expected_cash",
      label: "Expected Cash",
      render: (row: DayEndClose) => <Text size="sm">₹{row.expected_cash}</Text>,
    },
    {
      key: "actual_cash",
      label: "Actual Cash",
      render: (row: DayEndClose) => <Text size="sm">₹{row.actual_cash}</Text>,
    },
    {
      key: "cash_difference",
      label: "Difference",
      render: (row: DayEndClose) => {
        const diff = Number(row.cash_difference);
        return (
          <Text size="sm" fw={600} c={diff === 0 ? "success" : "danger"}>
            ₹{row.cash_difference}
          </Text>
        );
      },
    },
    {
      key: "total_collected",
      label: "Total Collected",
      render: (row: DayEndClose) => <Text size="sm">₹{row.total_collected}</Text>,
    },
    {
      key: "invoices_count",
      label: "Invoices",
      render: (row: DayEndClose) => <Text size="sm">{row.invoices_count}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: DayEndClose) => (
        <Badge color={dayCloseStatusColors[row.status] ?? "slate"} variant="light">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: DayEndClose) =>
        row.status === "open" && canVerify ? (
          <Button
            size="compact-xs"
            variant="light"
            color="success"
            leftSection={<IconCheck size={14} />}
            onClick={() => verifyMutation.mutate(row.id)}
          >
            Verify
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Button
        size="xs"
        leftSection={<IconPlus size={14} />}
        onClick={() => {
          setShowForm(!showForm);
          if (showForm) reset(dayCloseDefaults);
        }}
      >
        Create Day Close
      </Button>
      {showForm && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateDayClose)}>
          <Group grow>
            <TextInput
              label="Close Date"
              type="date"
              required
              error={errors.close_date?.message}
              {...register("close_date")}
            />
            <Controller
              control={control}
              name="actual_cash"
              render={({ field }) => (
                <NumberInput
                  label="Actual Cash"
                  required
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.actual_cash?.message}
                />
              )}
            />
          </Group>
          <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />
          <Button size="xs" type="submit" loading={createMutation.isPending}>
            Submit Day Close
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={dayCloses} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────

function AuditLogTab() {
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState<string | null>(null);

  const params: Record<string, string> = { page: String(page), per_page: "30" };
  if (filterAction) params.action = filterAction;

  const { data, isLoading } = useQuery({
    queryKey: ["billing-audit-log", params],
    queryFn: () => billingService.listBillingAuditLog(params),
  });

  const actionColors: Record<string, string> = {
    invoice_created: "primary",
    invoice_issued: "teal",
    invoice_cancelled: "danger",
    payment_recorded: "success",
    payment_voided: "orange",
    refund_created: "orange",
    discount_applied: "violet",
    discount_removed: "slate",
    advance_collected: "info",
    advance_adjusted: "warning",
    advance_refunded: "danger",
    credit_note_created: "primary",
    credit_note_applied: "primary",
    claim_created: "primary",
    claim_updated: "primary",
    day_closed: "teal",
    write_off_created: "orange",
    write_off_approved: "success",
    invoice_cloned: "violet",
  };

  const columns = [
    {
      key: "created_at",
      label: "Time",
      render: (row: BillingAuditEntry) => (
        <Text size="sm">{new Date(row.created_at).toLocaleString()}</Text>
      ),
    },
    {
      key: "action",
      label: "Action",
      render: (row: BillingAuditEntry) => (
        <Badge size="sm" variant="light" color={actionColors[row.action] ?? "slate"}>
          {row.action.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "entity_type",
      label: "Entity",
      render: (row: BillingAuditEntry) => <Text size="sm">{row.entity_type}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      render: (row: BillingAuditEntry) => (
        <Text size="sm">{row.amount ? `₹${row.amount}` : "—"}</Text>
      ),
    },
    {
      key: "performed_by",
      label: "By",
      render: (row: BillingAuditEntry) => <Text size="sm">{row.performed_by ?? "—"}</Text>,
    },
  ];

  return (
    <Stack>
      <Group>
        <Select
          placeholder="Filter by action"
          data={[
            "invoice_created",
            "invoice_issued",
            "invoice_cancelled",
            "payment_recorded",
            "payment_voided",
            "refund_created",
            "discount_applied",
            "advance_collected",
            "advance_adjusted",
            "credit_note_created",
            "claim_created",
            "day_closed",
            "write_off_created",
            "write_off_approved",
            "invoice_cloned",
          ].map((a) => ({ value: a, label: a.replace(/_/g, " ") }))}
          value={filterAction}
          onChange={setFilterAction}
          clearable
          w={220}
        />
      </Group>
      <DataTable
        columns={columns}
        data={data?.entries ?? []}
        loading={isLoading}
        page={page}
        totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
        onPageChange={setPage}
        rowKey={(row) => row.id}
      />
    </Stack>
  );
}

/* ─── Credit Patients Tab ────────────────────────────────────────── */

function CreditPatientsTab() {
  const canManage = useHasPermission(P.BILLING.CREDIT_MANAGE);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAging, setShowAging] = useState(false);
  const queryClient = useQueryClient();
  const creditPatientDefaults: BillingCreditPatientFormInput = {
    patient_id: "",
    credit_limit: 0,
    notes: "",
    status: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingCreditPatientFormInput>({
    resolver: zodResolver(billingCreditPatientFormSchema),
    defaultValues: creditPatientDefaults,
  });

  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;

  const { data: allCreditPatients, isLoading } = useQuery({
    queryKey: ["credit-patients", params],
    queryFn: () => billingService.listCreditPatients(params),
  });

  const creditPatients = allCreditPatients ?? [];

  const { data: agingRaw } = useQuery({
    queryKey: ["credit-aging"],
    queryFn: () => billingService.reportCreditAging(),
    enabled: showAging,
  });
  const agingData = agingRaw ?? [];

  const createMut = useMutation({
    mutationFn: (data: CreateCreditPatientRequest) => billingService.createCreditPatient(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-patients"] });
      close();
      reset(creditPatientDefaults);
      notifications.show({ title: "Created", message: "Credit patient added", color: "success" });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to create", color: "danger" }),
  });

  const updateMut = useMutation({
    mutationFn: (data: { id: string; req: UpdateCreditPatientRequest }) =>
      billingService.updateCreditPatient(data.id, data.req),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-patients"] });
      close();
      setEditId(null);
      reset(creditPatientDefaults);
      notifications.show({ title: "Updated", message: "Credit patient updated", color: "success" });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Update failed", color: "danger" }),
  });

  const creditStatusColors: Record<string, string> = {
    active: "success",
    overdue: "danger",
    suspended: "orange",
    closed: "slate",
  };

  const columns = [
    {
      key: "patient_id",
      label: "Patient ID",
      render: (r: CreditPatient) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "status",
      label: "Status",
      render: (r: CreditPatient) => (
        <Badge size="sm" color={creditStatusColors[r.status] ?? "slate"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "credit_limit",
      label: "Limit",
      render: (r: CreditPatient) => <Text size="sm">₹{r.credit_limit.toLocaleString()}</Text>,
    },
    {
      key: "current_balance",
      label: "Balance",
      render: (r: CreditPatient) => (
        <Text size="sm" c={r.current_balance > r.credit_limit * 0.8 ? "danger" : undefined}>
          ₹{r.current_balance.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "overdue_since",
      label: "Overdue Since",
      render: (r: CreditPatient) => (
        <Text size="sm">
          {r.overdue_since ? new Date(r.overdue_since).toLocaleDateString() : "—"}
        </Text>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            render: (r: CreditPatient) => (
              <ActionIcon
                variant="subtle"
                onClick={() => {
                  setEditId(r.id);
                  reset({
                    patient_id: r.patient_id,
                    credit_limit: r.credit_limit,
                    notes: r.notes ?? "",
                    status: r.status,
                  });
                  open();
                }}
              >
                <IconPencil size={16} />
              </ActionIcon>
            ),
          },
        ]
      : []),
  ];

  const agingColumns = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r: CreditAgingRow) => <Text size="sm">{r.patient_name ?? r.patient_id}</Text>,
    },
    {
      key: "credit_limit",
      label: "Credit Limit",
      render: (r: CreditAgingRow) => <Text size="sm">₹{r.credit_limit.toLocaleString()}</Text>,
    },
    {
      key: "current_balance",
      label: "Balance",
      render: (r: CreditAgingRow) => (
        <Text size="sm" fw={600}>
          ₹{r.current_balance.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "utilization",
      label: "Utilization",
      render: (r: CreditAgingRow) => {
        const pct = r.credit_limit > 0 ? (r.current_balance / r.credit_limit) * 100 : 0;
        return (
          <Progress
            value={pct}
            size="sm"
            color={pct > 90 ? "danger" : pct > 70 ? "orange" : "success"}
          />
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r: CreditAgingRow) => (
        <Badge size="sm" color={creditStatusColors[r.status] ?? "slate"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "days_overdue",
      label: "Days Overdue",
      render: (r: CreditAgingRow) => (
        <Text size="sm" c={r.days_overdue && r.days_overdue > 30 ? "danger" : undefined}>
          {r.days_overdue ?? "—"}
        </Text>
      ),
    },
    {
      key: "overdue_since",
      label: "Overdue Since",
      render: (r: CreditAgingRow) => (
        <Text size="sm">
          {r.overdue_since ? new Date(r.overdue_since).toLocaleDateString() : "—"}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Status"
            data={["active", "overdue", "suspended", "closed"].map((s) => ({ value: s, label: s }))}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
          <Button variant="light" onClick={() => setShowAging(!showAging)}>
            {showAging ? "Hide Aging" : "Show Aging Report"}
          </Button>
        </Group>
        {canManage && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditId(null);
              reset(creditPatientDefaults);
              open();
            }}
          >
            Add Credit Patient
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={creditPatients}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil(creditPatients.length / 20) || 1}
        onPageChange={setPage}
        rowKey={(r) => r.id}
      />

      {showAging && agingData.length > 0 && (
        <Card withBorder mt="md">
          <Title order={5} mb="sm">
            Credit Aging Report
          </Title>
          <DataTable
            columns={agingColumns}
            data={agingData}
            loading={false}
            page={1}
            totalPages={1}
            onPageChange={() => {}}
            rowKey={(r) => r.patient_id}
          />
        </Card>
      )}

      <Drawer
        opened={opened}
        onClose={() => {
          close();
          setEditId(null);
          reset(creditPatientDefaults);
        }}
        title={editId ? "Edit Credit Patient" : "Add Credit Patient"}
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={handleSubmit((values) => {
            if (editId) {
              updateMut.mutate({
                id: editId,
                req: {
                  credit_limit: billingNumberOrFallback(values.credit_limit, 0),
                  notes: billingOptionalText(values.notes),
                  ...(values.status ? { status: values.status } : {}),
                },
              });
              return;
            }
            createMut.mutate({
              patient_id: values.patient_id.trim(),
              credit_limit: billingNumberOrFallback(values.credit_limit, 0),
              notes: billingOptionalText(values.notes),
            });
          })}
        >
          {!editId && (
            <TextInput
              label="Patient ID"
              error={errors.patient_id?.message}
              {...register("patient_id")}
              required
            />
          )}
          <Controller
            control={control}
            name="credit_limit"
            render={({ field }) => (
              <NumberInput
                label="Credit Limit (₹)"
                value={field.value}
                onChange={field.onChange}
                error={errors.credit_limit?.message}
                min={0}
                required
              />
            )}
          />
          <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />
          {editId && (
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  label="Status"
                  data={billingCreditPatientStatusOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.status?.message}
                  clearable
                />
              )}
            />
          )}
          <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
            {editId ? "Update" : "Create"}
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

/* ─── GST & TDS Tab ──────────────────────────────────────────────── */

function GstTdsTab({ canTds }: { canTds: boolean }) {
  const canManageGst = useHasPermission(P.BILLING.GST_RETURNS_MANAGE);
  const canManageTds = useHasPermission(P.BILLING.TDS_MANAGE);
  const [view, setView] = useState("gstr");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { value: "gstr", label: "GST Returns" },
          ...(canTds ? [{ value: "tds", label: "TDS Management" }] : []),
          { value: "hsn", label: "HSN Summary" },
        ]}
      />
      {view === "gstr" && <GstrSubView canManage={canManageGst} />}
      {view === "tds" && canTds && <TdsSubView canManage={canManageTds} />}
      {view === "hsn" && <HsnSubView />}
    </Stack>
  );
}

function GstrSubView({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const gstrDefaults: BillingGstrFormInput = {
    return_type: "GSTR-1",
    period: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingGstrFormInput>({
    resolver: zodResolver(billingGstrFormSchema),
    defaultValues: gstrDefaults,
  });
  const [genOpened, { open: openGen, close: closeGen }] = useDisclosure(false);

  const { data: gstrSummaries, isLoading } = useQuery({
    queryKey: ["gstr-summaries"],
    queryFn: () => billingService.listGstrSummaries(),
  });

  const generateMut = useMutation({
    mutationFn: (data: GenerateGstrRequest) => billingService.generateGstrSummary(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gstr-summaries"] });
      closeGen();
      reset(gstrDefaults);
      notifications.show({ title: "Generated", message: "GSTR summary created", color: "success" });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to generate", color: "danger" }),
  });

  const fileMut = useMutation({
    mutationFn: (id: string) => billingService.fileGstr(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gstr-summaries"] });
      notifications.show({ title: "Filed", message: "GSTR marked as filed", color: "success" });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Filing failed", color: "danger" }),
  });

  const gstrStatusColors: Record<string, string> = {
    draft: "slate",
    validated: "primary",
    filed: "success",
    accepted: "teal",
    error: "danger",
  };

  const columns = [
    {
      key: "return_type",
      label: "Type",
      render: (r: GstReturnSummary) => <Badge size="sm">{r.return_type}</Badge>,
    },
    {
      key: "period",
      label: "Period",
      render: (r: GstReturnSummary) => <Text size="sm">{r.period}</Text>,
    },
    {
      key: "filing_status",
      label: "Status",
      render: (r: GstReturnSummary) => (
        <Badge size="sm" color={gstrStatusColors[r.filing_status] ?? "slate"}>
          {r.filing_status}
        </Badge>
      ),
    },
    {
      key: "total_taxable",
      label: "Taxable",
      render: (r: GstReturnSummary) => <Text size="sm">₹{r.total_taxable.toLocaleString()}</Text>,
    },
    {
      key: "cgst",
      label: "CGST",
      render: (r: GstReturnSummary) => <Text size="sm">₹{r.total_cgst.toLocaleString()}</Text>,
    },
    {
      key: "sgst",
      label: "SGST",
      render: (r: GstReturnSummary) => <Text size="sm">₹{r.total_sgst.toLocaleString()}</Text>,
    },
    {
      key: "igst",
      label: "IGST",
      render: (r: GstReturnSummary) => <Text size="sm">₹{r.total_igst.toLocaleString()}</Text>,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            render: (r: GstReturnSummary) =>
              r.filing_status === "validated" ? (
                <Button size="xs" variant="light" onClick={() => fileMut.mutate(r.id)}>
                  File
                </Button>
              ) : (
                <Text size="sm">—</Text>
              ),
          },
        ]
      : []),
  ];

  const handleGenerateGstr = (values: BillingGstrFormInput) => {
    generateMut.mutate({
      return_type: values.return_type,
      period: values.period.trim(),
    });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>GST Return Summaries</Text>
        {canManage && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(gstrDefaults);
              openGen();
            }}
          >
            Generate Summary
          </Button>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={gstrSummaries ?? []}
        loading={isLoading}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={genOpened}
        onClose={() => {
          closeGen();
          reset(gstrDefaults);
        }}
        title="Generate GSTR Summary"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(handleGenerateGstr)}>
          <Controller
            control={control}
            name="return_type"
            render={({ field }) => (
              <Select
                label="Return Type"
                data={billingGstrReturnTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "GSTR-1")}
                error={errors.return_type?.message}
              />
            )}
          />
          <TextInput
            label="Period (e.g. 2026-03)"
            error={errors.period?.message}
            {...register("period")}
            required
          />
          <Button type="submit" loading={generateMut.isPending}>
            Generate
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function TdsSubView({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [opened, { open, close }] = useDisclosure(false);
  const tdsDefaults: BillingTdsFormInput = {
    invoice_id: "",
    deductee_name: "",
    deductee_pan: "",
    tds_section: "194J",
    tds_rate: 10,
    base_amount: 0,
    deducted_date: new Date().toISOString().slice(0, 10),
    financial_year: "2025-26",
    quarter: "Q4",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BillingTdsFormInput>({
    resolver: zodResolver(billingTdsFormSchema),
    defaultValues: tdsDefaults,
  });
  const watchedTds = watch();
  const estimatedTds = Math.round(
    (billingNumberOrFallback(watchedTds.base_amount, 0) *
      billingNumberOrFallback(watchedTds.tds_rate, 0)) /
      100,
  );

  const { data: tdsItems, isLoading } = useQuery({
    queryKey: ["tds-deductions"],
    queryFn: () => billingService.listTdsDeductions(),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateTdsRequest) => billingService.createTdsDeduction(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tds-deductions"] });
      close();
      reset(tdsDefaults);
      notifications.show({ title: "Created", message: "TDS deduction recorded", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed", color: "danger" }),
  });

  const depositMut = useMutation({
    mutationFn: (args: { id: string; challan: string }) =>
      billingService.depositTds(args.id, {
        challan_number: args.challan,
        challan_date: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tds-deductions"] });
      notifications.show({ title: "Deposited", message: "TDS challan recorded", color: "success" });
    },
  });

  const certMut = useMutation({
    mutationFn: (args: { id: string; cert: string }) =>
      billingService.issueTdsCertificate(args.id, {
        certificate_number: args.cert,
        certificate_date: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tds-deductions"] });
      notifications.show({ title: "Issued", message: "Certificate recorded", color: "success" });
    },
  });

  const tdsStatusColors: Record<string, string> = {
    deducted: "primary",
    deposited: "teal",
    certificate_issued: "success",
  };

  const columns = [
    {
      key: "deductee_name",
      label: "Deductee",
      render: (r: TdsDeduction) => <Text size="sm">{r.deductee_name}</Text>,
    },
    {
      key: "deductee_pan",
      label: "PAN",
      render: (r: TdsDeduction) => (
        <Text size="sm" ff="monospace">
          {r.deductee_pan}
        </Text>
      ),
    },
    {
      key: "tds_section",
      label: "Section",
      render: (r: TdsDeduction) => (
        <Badge size="sm" variant="outline">
          {r.tds_section}
        </Badge>
      ),
    },
    {
      key: "tds_rate",
      label: "Rate %",
      render: (r: TdsDeduction) => <Text size="sm">{r.tds_rate}%</Text>,
    },
    {
      key: "base_amount",
      label: "Base",
      render: (r: TdsDeduction) => <Text size="sm">₹{r.base_amount.toLocaleString()}</Text>,
    },
    {
      key: "tds_amount",
      label: "TDS",
      render: (r: TdsDeduction) => (
        <Text size="sm" fw={600}>
          ₹{r.tds_amount.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: TdsDeduction) => (
        <Badge size="sm" color={tdsStatusColors[r.status] ?? "slate"}>
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "fy",
      label: "FY / Q",
      render: (r: TdsDeduction) => (
        <Text size="sm">
          {r.financial_year} {r.quarter}
        </Text>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            render: (r: TdsDeduction) => (
              <Group gap={4}>
                {r.status === "deducted" && (
                  <Tooltip label="Deposit">
                    <ActionIcon
                      variant="subtle"
                      color="teal"
                      onClick={() => depositMut.mutate({ id: r.id, challan: `CH-${Date.now()}` })}
                    >
                      <IconCheck size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
                {r.status === "deposited" && (
                  <Tooltip label="Issue Certificate">
                    <ActionIcon
                      variant="subtle"
                      color="success"
                      onClick={() => certMut.mutate({ id: r.id, cert: `CERT-${Date.now()}` })}
                    >
                      <IconShieldCheck size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            ),
          },
        ]
      : []),
  ];

  const handleCreateTds = (values: BillingTdsFormInput) => {
    const payload: CreateTdsRequest = {
      invoice_id: billingOptionalText(values.invoice_id),
      deductee_name: values.deductee_name.trim(),
      deductee_pan: values.deductee_pan.trim().toUpperCase(),
      tds_section: values.tds_section,
      tds_rate: billingNumberOrFallback(values.tds_rate, 0),
      base_amount: billingNumberOrFallback(values.base_amount, 0),
      deducted_date: values.deducted_date.trim(),
      financial_year: values.financial_year.trim(),
      quarter: values.quarter,
    };
    createMut.mutate(payload);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>TDS Deductions</Text>
        {canManage && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(tdsDefaults);
              open();
            }}
          >
            Record TDS
          </Button>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={tdsItems ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((tdsItems?.length ?? 0) / 20) || 1}
        onPageChange={setPage}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={opened}
        onClose={() => {
          close();
          reset(tdsDefaults);
        }}
        title="Record TDS Deduction"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateTds)}>
          <TextInput
            label="Invoice ID"
            error={errors.invoice_id?.message}
            {...register("invoice_id")}
          />
          <TextInput
            label="Deductee Name"
            error={errors.deductee_name?.message}
            {...register("deductee_name")}
            required
          />
          <TextInput
            label="PAN"
            error={errors.deductee_pan?.message}
            {...register("deductee_pan")}
            required
            maxLength={10}
          />
          <Controller
            control={control}
            name="tds_section"
            render={({ field }) => (
              <Select
                label="Section"
                data={billingTdsSectionOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "194J")}
                error={errors.tds_section?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="tds_rate"
            render={({ field }) => (
              <NumberInput
                label="TDS Rate %"
                value={field.value}
                onChange={field.onChange}
                error={errors.tds_rate?.message}
                min={0}
                max={100}
              />
            )}
          />
          <Controller
            control={control}
            name="base_amount"
            render={({ field }) => (
              <NumberInput
                label="Base Amount"
                value={field.value}
                onChange={field.onChange}
                error={errors.base_amount?.message}
                min={0}
              />
            )}
          />
          <Text size="sm" c="dimmed">
            Estimated TDS: ₹{estimatedTds.toLocaleString()}
          </Text>
          <TextInput
            label="Deducted Date"
            type="date"
            error={errors.deducted_date?.message}
            {...register("deducted_date")}
            required
          />
          <TextInput
            label="Financial Year"
            placeholder="2025-26"
            error={errors.financial_year?.message}
            {...register("financial_year")}
          />
          <Controller
            control={control}
            name="quarter"
            render={({ field }) => (
              <Select
                label="Quarter"
                data={billingTdsQuarterOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "Q4")}
                error={errors.quarter?.message}
              />
            )}
          />
          <Button type="submit" loading={createMut.isPending}>
            Record
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function HsnSubView() {
  const [period, setPeriod] = useState("");
  const { data: hsnRows, isLoading } = useQuery({
    queryKey: ["hsn-summary", period],
    queryFn: () => billingService.reportHsnSummary(period),
    enabled: period.length >= 7,
  });

  const columns = [
    {
      key: "hsn_code",
      label: "HSN Code",
      render: (r: HsnSummaryRow) => (
        <Text size="sm" ff="monospace">
          {r.hsn_code}
        </Text>
      ),
    },
    {
      key: "item_count",
      label: "Items",
      render: (r: HsnSummaryRow) => <Text size="sm">{r.item_count}</Text>,
    },
    {
      key: "taxable_amount",
      label: "Taxable Amount",
      render: (r: HsnSummaryRow) => <Text size="sm">₹{r.taxable_amount.toLocaleString()}</Text>,
    },
    {
      key: "cgst_amount",
      label: "CGST",
      render: (r: HsnSummaryRow) => <Text size="sm">₹{r.cgst_amount.toLocaleString()}</Text>,
    },
    {
      key: "sgst_amount",
      label: "SGST",
      render: (r: HsnSummaryRow) => <Text size="sm">₹{r.sgst_amount.toLocaleString()}</Text>,
    },
    {
      key: "igst_amount",
      label: "IGST",
      render: (r: HsnSummaryRow) => <Text size="sm">₹{r.igst_amount.toLocaleString()}</Text>,
    },
    {
      key: "total_tax",
      label: "Total Tax",
      render: (r: HsnSummaryRow) => (
        <Text size="sm" fw={600}>
          ₹{r.total_tax.toLocaleString()}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      <Group>
        <TextInput
          label="Period (YYYY-MM)"
          placeholder="2026-03"
          value={period}
          onChange={(e) => setPeriod(e.currentTarget.value)}
          w={180}
        />
      </Group>
      {hsnRows && (
        <DataTable
          columns={columns}
          data={hsnRows}
          loading={isLoading}
          page={1}
          totalPages={1}
          onPageChange={() => {}}
          rowKey={(r) => r.hsn_code}
        />
      )}
    </Stack>
  );
}

/* ─── Journal Entries Tab ────────────────────────────────────────── */

function JournalEntriesTab() {
  const canCreate = useHasPermission(P.BILLING.JOURNAL_CREATE);
  const canPost = useHasPermission(P.BILLING.JOURNAL_POST);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const queryClient = useQueryClient();
  const journalLineDefaults: BillingJournalLineFormInput = {
    account_id: "",
    department_id: "",
    debit_amount: 0,
    credit_amount: 0,
    narration: "",
  };
  const journalDefaults: BillingJournalEntryFormInput = {
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    reference_type: "",
    reference_id: "",
    lines: [{ ...journalLineDefaults }, { ...journalLineDefaults }],
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BillingJournalEntryFormInput>({
    resolver: zodResolver(billingJournalEntryFormSchema),
    defaultValues: journalDefaults,
  });
  const {
    fields: journalLines,
    append: appendJournalLine,
    remove: removeJournalLine,
  } = useFieldArray({
    control,
    name: "lines",
  });

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (statusFilter) params.status = statusFilter;

  const { data: jeItems, isLoading } = useQuery({
    queryKey: ["journal-entries", params],
    queryFn: () => billingService.listJournalEntries(params),
  });

  const { data: glAccounts } = useQuery({
    queryKey: ["gl-accounts"],
    queryFn: () => billingService.listGlAccounts(),
    enabled: opened,
  });

  const glOptions = (glAccounts ?? []).map((a: GlAccount) => ({
    value: a.id,
    label: `${a.code} — ${a.name}`,
  }));

  const watchedLines = watch("lines");
  const totalDebit = watchedLines.reduce(
    (sum, line) => sum + billingNumberOrFallback(line.debit_amount, 0),
    0,
  );
  const totalCredit = watchedLines.reduce(
    (sum, line) => sum + billingNumberOrFallback(line.credit_amount, 0),
    0,
  );
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const createMut = useMutation({
    mutationFn: (data: CreateJournalEntryRequest) => billingService.createJournalEntry(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      close();
      reset(journalDefaults);
      notifications.show({ title: "Created", message: "Journal entry created", color: "success" });
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Failed — ensure debits equal credits",
        color: "danger",
      }),
  });

  const postMut = useMutation({
    mutationFn: (id: string) => billingService.postJournalEntry(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      notifications.show({
        title: "Posted",
        message: "Journal entry posted to ledger",
        color: "success",
      });
    },
    onError: () => notifications.show({ title: "Error", message: "Post failed", color: "danger" }),
  });

  const reverseMut = useMutation({
    mutationFn: (id: string) => billingService.reverseJournalEntry(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      notifications.show({
        title: "Reversed",
        message: "Reversal entry created",
        color: "success",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Reversal failed", color: "danger" }),
  });

  const jeStatusColors: Record<string, string> = {
    draft: "slate",
    posted: "success",
    reversed: "danger",
  };

  const columns = [
    {
      key: "entry_number",
      label: "JE #",
      render: (r: JournalEntry) => (
        <Text size="sm" fw={600}>
          {r.entry_number}
        </Text>
      ),
    },
    {
      key: "entry_date",
      label: "Date",
      render: (r: JournalEntry) => (
        <Text size="sm">{new Date(r.entry_date).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "entry_type",
      label: "Type",
      render: (r: JournalEntry) => (
        <Badge size="sm" variant="light">
          {r.entry_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: JournalEntry) => (
        <Badge size="sm" color={jeStatusColors[r.status] ?? "slate"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "total_debit",
      label: "Debit",
      render: (r: JournalEntry) => <Text size="sm">₹{r.total_debit.toLocaleString()}</Text>,
    },
    {
      key: "total_credit",
      label: "Credit",
      render: (r: JournalEntry) => <Text size="sm">₹{r.total_credit.toLocaleString()}</Text>,
    },
    {
      key: "description",
      label: "Description",
      render: (r: JournalEntry) => (
        <Text size="sm" lineClamp={1}>
          {r.description ?? "—"}
        </Text>
      ),
    },
    ...(canPost
      ? [
          {
            key: "actions",
            label: "",
            render: (r: JournalEntry) => (
              <Group gap={4}>
                {r.status === "draft" && (
                  <Tooltip label="Post to ledger">
                    <ActionIcon
                      variant="subtle"
                      color="success"
                      onClick={() => postMut.mutate(r.id)}
                    >
                      <IconCheck size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
                {r.status === "posted" && (
                  <Tooltip label="Reverse entry">
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      onClick={() => reverseMut.mutate(r.id)}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            ),
          },
        ]
      : []),
  ];

  const handleCreateJournalEntry = (values: BillingJournalEntryFormInput) => {
    createMut.mutate({
      entry_date: values.entry_date.trim(),
      description: billingOptionalText(values.description),
      reference_type: billingOptionalText(values.reference_type),
      reference_id: billingOptionalText(values.reference_id),
      lines: values.lines.map((line) => ({
        account_id: line.account_id.trim(),
        department_id: billingOptionalText(line.department_id),
        debit_amount: billingNumberOrFallback(line.debit_amount, 0),
        credit_amount: billingNumberOrFallback(line.credit_amount, 0),
        narration: billingOptionalText(line.narration),
      })),
    });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Select
          placeholder="Status"
          data={["draft", "posted", "reversed"].map((s) => ({ value: s, label: s }))}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          w={160}
        />
        {canCreate && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(journalDefaults);
              open();
            }}
          >
            New Journal Entry
          </Button>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={jeItems ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((jeItems?.length ?? 0) / 20) || 1}
        onPageChange={setPage}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={opened}
        onClose={() => {
          close();
          reset(journalDefaults);
        }}
        title="Create Journal Entry"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateJournalEntry)}>
          <TextInput
            label="Entry Date"
            type="date"
            error={errors.entry_date?.message}
            {...register("entry_date")}
            required
          />
          <Textarea
            label="Description"
            error={errors.description?.message}
            {...register("description")}
          />

          <Group justify="space-between">
            <Text fw={600}>Lines</Text>
            <Button
              size="xs"
              variant="light"
              onClick={() => appendJournalLine({ ...journalLineDefaults })}
            >
              Add Line
            </Button>
          </Group>

          {journalLines.map((line, idx) => (
            <Card key={line.id} withBorder p="xs">
              <Group>
                <Controller
                  control={control}
                  name={`lines.${idx}.account_id`}
                  render={({ field }) => (
                    <Select
                      placeholder="Account"
                      data={glOptions}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? "")}
                      error={errors.lines?.[idx]?.account_id?.message}
                      searchable
                      style={{ flex: 1 }}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`lines.${idx}.debit_amount`}
                  render={({ field }) => (
                    <NumberInput
                      placeholder="Debit"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.lines?.[idx]?.debit_amount?.message}
                      min={0}
                      w={120}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`lines.${idx}.credit_amount`}
                  render={({ field }) => (
                    <NumberInput
                      placeholder="Credit"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.lines?.[idx]?.credit_amount?.message}
                      min={0}
                      w={120}
                    />
                  )}
                />
                {journalLines.length > 2 && (
                  <ActionIcon
                    variant="subtle"
                    color="danger"
                    onClick={() => removeJournalLine(idx)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
            </Card>
          ))}

          <Group justify="space-between">
            <Text size="sm">Total Debit: ₹{totalDebit.toLocaleString()}</Text>
            <Text size="sm">Total Credit: ₹{totalCredit.toLocaleString()}</Text>
          </Group>
          {!balanced && totalDebit > 0 && (
            <Alert color="danger" title="Unbalanced">
              Debits must equal credits before saving.
            </Alert>
          )}
          {errors.lines?.message && (
            <Alert color="danger" title="Journal validation">
              {errors.lines.message}
            </Alert>
          )}

          <Button type="submit" loading={createMut.isPending} disabled={!balanced}>
            Create Journal Entry
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

/* ─── Bank Reconciliation Tab ────────────────────────────────────── */

function BankReconTab() {
  const canManage = useHasPermission(P.BILLING.BANK_RECON_MANAGE);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [importOpened, { open: openImport, close: closeImport }] = useDisclosure(false);
  const queryClient = useQueryClient();

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (statusFilter) params.recon_status = statusFilter;

  const { data: bankTxns, isLoading } = useQuery({
    queryKey: ["bank-transactions", params],
    queryFn: () => billingService.listBankTransactions(params),
  });

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [importTxns, setImportTxns] = useState<ImportBankTransactionsRequest["transactions"]>([]);

  const [manualTxn, setManualTxn] = useState({
    transaction_date: "",
    description: "",
    debit_amount: 0,
    credit_amount: 0,
    reference_number: "",
  });

  const importMut = useMutation({
    mutationFn: () => billingService.importBankTransactions({ transactions: importTxns }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      closeImport();
      notifications.show({
        title: "Imported",
        message: "Bank transactions imported",
        color: "success",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Import failed", color: "danger" }),
  });

  const autoReconMut = useMutation({
    mutationFn: () => billingService.autoReconcile(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      notifications.show({
        title: "Auto-Reconciled",
        message: `${res.matched_count ?? 0} transactions matched`,
        color: "success",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Auto-reconcile failed", color: "danger" }),
  });

  // TPA recon (priority #4) — matches unmatched credits to insurance_claims
  // by reference / claim_number / amount-window heuristics.
  const autoMatchTpaMut = useMutation({
    mutationFn: () => billingService.autoMatchBankTransactions(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["insurance-receivables-aging"] });
      notifications.show({
        title: "TPA Auto-match",
        message: `${res.matched} matched · ${res.variance_flagged} variance · ${res.still_unmatched} unmatched`,
        color: "success",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "TPA auto-match failed", color: "danger" }),
  });

  const { data: insAging = [] } = useQuery({
    queryKey: ["insurance-receivables-aging"],
    queryFn: () => billingService.listInsuranceReceivablesAging(),
  });

  const reconStatusColors: Record<string, string> = {
    unmatched: "orange",
    matched: "success",
    discrepancy: "danger",
    excluded: "slate",
  };

  const columns = [
    {
      key: "transaction_date",
      label: "Date",
      render: (r: BankTransaction) => (
        <Text size="sm">{new Date(r.transaction_date).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "bank_name",
      label: "Bank",
      render: (r: BankTransaction) => <Text size="sm">{r.bank_name}</Text>,
    },
    {
      key: "description",
      label: "Description",
      render: (r: BankTransaction) => (
        <Text size="sm" lineClamp={1}>
          {r.description}
        </Text>
      ),
    },
    {
      key: "debit_amount",
      label: "Debit",
      render: (r: BankTransaction) => (
        <Text size="sm">{r.debit_amount ? `₹${r.debit_amount.toLocaleString()}` : "—"}</Text>
      ),
    },
    {
      key: "credit_amount",
      label: "Credit",
      render: (r: BankTransaction) => (
        <Text size="sm">{r.credit_amount ? `₹${r.credit_amount.toLocaleString()}` : "—"}</Text>
      ),
    },
    {
      key: "reference_number",
      label: "Reference",
      render: (r: BankTransaction) => (
        <Text size="sm" ff="monospace">
          {r.reference_number ?? "—"}
        </Text>
      ),
    },
    {
      key: "recon_status",
      label: "Status",
      render: (r: BankTransaction) => (
        <Badge size="sm" color={reconStatusColors[r.recon_status] ?? "slate"}>
          {r.recon_status}
        </Badge>
      ),
    },
  ];

  const addManualTxn = () => {
    if (!manualTxn.transaction_date || !manualTxn.description || !bankName) return;
    setImportTxns([
      ...importTxns,
      {
        bank_name: bankName,
        account_number: accountNumber,
        transaction_date: manualTxn.transaction_date,
        description: manualTxn.description,
        debit_amount: manualTxn.debit_amount,
        credit_amount: manualTxn.credit_amount,
        reference_number: manualTxn.reference_number,
      },
    ]);
    setManualTxn({
      transaction_date: "",
      description: "",
      debit_amount: 0,
      credit_amount: 0,
      reference_number: "",
    });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Status"
            data={["unmatched", "matched", "discrepancy", "excluded"].map((s) => ({
              value: s,
              label: s,
            }))}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
        </Group>
        <Group>
          {canManage && (
            <>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => autoReconMut.mutate()}
                loading={autoReconMut.isPending}
              >
                Auto-Reconcile
              </Button>
              <Button
                variant="light"
                color="grape"
                leftSection={<IconRefresh size={16} />}
                onClick={() => autoMatchTpaMut.mutate()}
                loading={autoMatchTpaMut.isPending}
              >
                TPA Auto-match
              </Button>
              <Button leftSection={<IconUpload size={16} />} onClick={openImport}>
                Import Transactions
              </Button>
            </>
          )}
        </Group>
      </Group>

      {insAging.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="xs">
            Insurance Receivables Aging (per payer)
          </Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>TPA</Table.Th>
                <Table.Th ta="right">Claims</Table.Th>
                <Table.Th ta="right">0-30 days</Table.Th>
                <Table.Th ta="right">30-60</Table.Th>
                <Table.Th ta="right">60-90</Table.Th>
                <Table.Th ta="right">90+</Table.Th>
                <Table.Th ta="right">Total Outstanding</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {insAging.map((b) => (
                <Table.Tr key={b.tpa_name ?? "—"}>
                  <Table.Td>{b.tpa_name ?? "—"}</Table.Td>
                  <Table.Td ta="right">{b.claim_count}</Table.Td>
                  <Table.Td ta="right">₹{Number(b.bucket_0_30).toLocaleString()}</Table.Td>
                  <Table.Td ta="right">₹{Number(b.bucket_30_60).toLocaleString()}</Table.Td>
                  <Table.Td ta="right">₹{Number(b.bucket_60_90).toLocaleString()}</Table.Td>
                  <Table.Td ta="right" c="red">
                    ₹{Number(b.bucket_90_plus).toLocaleString()}
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>
                    ₹{Number(b.total_outstanding).toLocaleString()}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={bankTxns ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((bankTxns?.length ?? 0) / 20) || 1}
        onPageChange={setPage}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={importOpened}
        onClose={closeImport}
        title="Import Bank Transactions"
        position="right"
        size="lg"
      >
        <Stack>
          <TextInput
            label="Bank Name"
            value={bankName}
            onChange={(e) => setBankName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Account Number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.currentTarget.value)}
            required
          />

          <Card withBorder>
            <Text fw={600} mb="sm">
              Add Transaction
            </Text>
            <Stack gap="xs">
              <TextInput
                label="Date"
                type="date"
                value={manualTxn.transaction_date}
                onChange={(e) =>
                  setManualTxn({ ...manualTxn, transaction_date: e.currentTarget.value })
                }
              />
              <TextInput
                label="Description"
                value={manualTxn.description}
                onChange={(e) => setManualTxn({ ...manualTxn, description: e.currentTarget.value })}
              />
              <Group grow>
                <NumberInput
                  label="Debit"
                  value={manualTxn.debit_amount}
                  onChange={(v) => setManualTxn({ ...manualTxn, debit_amount: Number(v) })}
                  min={0}
                />
                <NumberInput
                  label="Credit"
                  value={manualTxn.credit_amount}
                  onChange={(v) => setManualTxn({ ...manualTxn, credit_amount: Number(v) })}
                  min={0}
                />
              </Group>
              <TextInput
                label="Reference #"
                value={manualTxn.reference_number}
                onChange={(e) =>
                  setManualTxn({ ...manualTxn, reference_number: e.currentTarget.value })
                }
              />
              <Button size="xs" variant="light" onClick={addManualTxn}>
                Add to Batch
              </Button>
            </Stack>
          </Card>

          {importTxns.length > 0 && (
            <Text size="sm">{importTxns.length} transaction(s) in batch</Text>
          )}

          <Button
            onClick={() => importMut.mutate()}
            loading={importMut.isPending}
            disabled={importTxns.length === 0}
          >
            Import {importTxns.length} Transaction(s)
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

/* ─── Financial MIS Tab ──────────────────────────────────────────── */

function FinancialMisTab() {
  const [dateFrom, setDateFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: misData } = useQuery({
    queryKey: ["financial-mis", dateFrom, dateTo],
    queryFn: () => billingService.reportFinancialMis(dateFrom, dateTo),
    enabled: Boolean(dateFrom && dateTo),
  });

  const { data: plRows, isLoading: plLoading } = useQuery({
    queryKey: ["profit-loss", dateFrom, dateTo],
    queryFn: () => billingService.reportProfitLoss(dateFrom, dateTo),
    enabled: Boolean(dateFrom && dateTo),
  });

  const plColumns = [
    {
      key: "department_name",
      label: "Department",
      render: (r: ProfitLossDeptRow) => (
        <Text size="sm" fw={500}>
          {r.department_name ?? "Unassigned"}
        </Text>
      ),
    },
    {
      key: "revenue",
      label: "Revenue",
      render: (r: ProfitLossDeptRow) => (
        <Text size="sm" c="success">
          ₹{r.revenue.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "expenses",
      label: "Expenses",
      render: (r: ProfitLossDeptRow) => (
        <Text size="sm" c="danger">
          ₹{r.expenses.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "profit",
      label: "Profit/Loss",
      render: (r: ProfitLossDeptRow) => (
        <Text size="sm" fw={600} c={r.profit >= 0 ? "success" : "danger"}>
          ₹{r.profit.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "margin",
      label: "Margin %",
      render: (r: ProfitLossDeptRow) => {
        const margin = r.revenue > 0 ? ((r.revenue - r.expenses) / r.revenue) * 100 : 0;
        return <Text size="sm">{margin.toFixed(1)}%</Text>;
      },
    },
  ];

  return (
    <Stack>
      <Group>
        <TextInput
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.currentTarget.value)}
        />
        <TextInput
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.currentTarget.value)}
        />
      </Group>

      {misData && (
        <SimpleGrid cols={4}>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed">
              Total Revenue
            </Text>
            <Text size="xl" fw={700} c="success">
              ₹{misData.total_revenue.toLocaleString()}
            </Text>
          </Card>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed">
              Total Collections
            </Text>
            <Text size="xl" fw={700} c="teal">
              ₹{misData.total_collections.toLocaleString()}
            </Text>
          </Card>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed">
              Collection Rate
            </Text>
            <Text size="xl" fw={700}>
              {Number(misData.collection_rate).toFixed(1)}%
            </Text>
            <Progress
              value={Number(misData.collection_rate)}
              size="sm"
              mt="xs"
              color={Number(misData.collection_rate) >= 80 ? "success" : "orange"}
            />
          </Card>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed">
              Outstanding
            </Text>
            <Text size="xl" fw={700} c="orange">
              ₹{misData.total_outstanding.toLocaleString()}
            </Text>
          </Card>
        </SimpleGrid>
      )}

      {misData && (
        <Card withBorder>
          <Title order={5} mb="sm">
            Financial Summary
          </Title>
          <SimpleGrid cols={4}>
            <div>
              <Text size="xs" c="dimmed">
                Refunds
              </Text>
              <Text fw={600}>₹{misData.total_refunds.toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Write-Offs
              </Text>
              <Text fw={600}>₹{misData.total_write_offs.toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Advances
              </Text>
              <Text fw={600}>₹{misData.total_advances.toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Period
              </Text>
              <Text fw={600}>
                {misData.period_from} → {misData.period_to}
              </Text>
            </div>
          </SimpleGrid>
        </Card>
      )}

      <Title order={5}>Profit & Loss by Department</Title>
      <DataTable
        columns={plColumns}
        data={plRows ?? []}
        loading={plLoading}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        rowKey={(r) => r.department_name ?? r.department_id ?? "unknown"}
      />
    </Stack>
  );
}

/* ─── ERP Export Tab ─────────────────────────────────────────────── */

function ErpExportTab() {
  const erpExportDefaults: BillingErpExportFormInput = {
    target_system: "tally",
    export_type: "invoices",
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    date_to: new Date().toISOString().slice(0, 10),
  };
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingErpExportFormInput>({
    resolver: zodResolver(billingErpExportFormSchema),
    defaultValues: erpExportDefaults,
  });
  const queryClient = useQueryClient();

  const { data: erpExports, isLoading } = useQuery({
    queryKey: ["erp-exports"],
    queryFn: () => billingService.listErpExports(),
  });

  const exportMut = useMutation({
    mutationFn: (data: ErpExportRequest) => billingService.exportToErp(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["erp-exports"] });
      notifications.show({ title: "Exported", message: "Data exported to ERP", color: "success" });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Export failed", color: "danger" }),
  });

  const handleExportToErp = (values: BillingErpExportFormInput) => {
    exportMut.mutate({
      target_system: values.target_system,
      export_type: values.export_type,
      date_from: billingOptionalText(values.date_from),
      date_to: billingOptionalText(values.date_to),
    });
  };

  const erpStatusColors: Record<string, string> = {
    pending: "warning",
    exported: "success",
    failed: "danger",
    acknowledged: "teal",
  };

  const columns = [
    {
      key: "target_system",
      label: "System",
      render: (r: ErpExportLog) => <Badge size="sm">{r.target_system}</Badge>,
    },
    {
      key: "export_type",
      label: "Type",
      render: (r: ErpExportLog) => <Text size="sm">{r.export_type}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r: ErpExportLog) => (
        <Badge size="sm" color={erpStatusColors[r.status] ?? "slate"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "record_count",
      label: "Records",
      render: (r: ErpExportLog) => <Text size="sm">{r.record_ids?.length ?? 0}</Text>,
    },
    {
      key: "created_at",
      label: "Exported At",
      render: (r: ErpExportLog) => <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text>,
    },
    {
      key: "error_message",
      label: "Error",
      render: (r: ErpExportLog) => (
        <Text size="sm" c="danger" lineClamp={1}>
          {r.error_message ?? "—"}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      <Card withBorder>
        <Text fw={600} mb="sm">
          Export to ERP
        </Text>
        <Group component="form" align="end" onSubmit={handleSubmit(handleExportToErp)}>
          <Controller
            control={control}
            name="target_system"
            render={({ field }) => (
              <Select
                label="Target System"
                data={billingErpTargetSystemOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "tally")}
                error={errors.target_system?.message}
                w={180}
              />
            )}
          />
          <Controller
            control={control}
            name="export_type"
            render={({ field }) => (
              <Select
                label="Export Type"
                data={billingErpExportTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "invoices")}
                error={errors.export_type?.message}
                w={200}
              />
            )}
          />
          <TextInput
            label="From"
            type="date"
            error={errors.date_from?.message}
            {...register("date_from")}
            w={160}
          />
          <TextInput
            label="To"
            type="date"
            error={errors.date_to?.message}
            {...register("date_to")}
            w={160}
          />
          <Button
            leftSection={<IconDatabase size={16} />}
            type="submit"
            loading={exportMut.isPending}
          >
            Export
          </Button>
        </Group>
      </Card>

      <Title order={5}>Export History</Title>
      <DataTable
        columns={columns}
        data={erpExports ?? []}
        loading={isLoading}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        rowKey={(r) => r.id}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Concessions Tab
// ══════════════════════════════════════════════════════════

function ConcessionsTab({ canApprove }: { canApprove: boolean }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "rules">("list");

  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["billing", "concessions", params],
    queryFn: () =>
      billingService.listConcessions(Object.keys(params).length > 0 ? params : undefined),
  });

  const { data: rulesData } = useQuery({
    queryKey: ["billing", "concessions", "auto-rules"],
    queryFn: () => billingService.getAutoConcessionRules(),
    enabled: view === "rules",
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => billingService.approveConcession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "concessions"] });
      notifications.show({ title: "Approved", message: "Concession approved", color: "success" });
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => billingService.rejectConcession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "concessions"] });
      notifications.show({ title: "Rejected", message: "Concession rejected", color: "danger" });
    },
  });

  const [rulesDraft, setRulesDraft] = useState("");
  const saveRulesMut = useMutation({
    mutationFn: () => {
      const parsed = JSON.parse(rulesDraft) as AutoConcessionRule[];
      return billingService.updateAutoConcessionRules({ rules: parsed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "concessions", "auto-rules"] });
      notifications.show({
        title: "Saved",
        message: "Auto-concession rules updated",
        color: "success",
      });
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Invalid JSON or save failed",
        color: "danger",
      }),
  });

  const statusColors: Record<string, string> = {
    pending: "warning",
    approved: "success",
    rejected: "danger",
    auto_applied: "teal",
  };

  const columns = [
    {
      key: "concession_type",
      label: "Type",
      render: (r: BillingConcession) => <Text size="sm">{r.concession_type}</Text>,
    },
    {
      key: "original_amount",
      label: "Original",
      render: (r: BillingConcession) => (
        <Text size="sm">{Number(r.original_amount).toFixed(2)}</Text>
      ),
    },
    {
      key: "concession_amount",
      label: "Discount",
      render: (r: BillingConcession) => (
        <Text size="sm" c="danger">
          -{Number(r.concession_amount).toFixed(2)}
        </Text>
      ),
    },
    {
      key: "final_amount",
      label: "Final",
      render: (r: BillingConcession) => (
        <Text size="sm" fw={600}>
          {Number(r.final_amount).toFixed(2)}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: BillingConcession) => (
        <Badge size="sm" color={statusColors[r.status] ?? "slate"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      render: (r: BillingConcession) => (
        <Text size="sm" lineClamp={1}>
          {r.reason ?? r.auto_rule ?? "—"}
        </Text>
      ),
    },
    {
      key: "source_module",
      label: "Source",
      render: (r: BillingConcession) => <Text size="sm">{r.source_module ?? "manual"}</Text>,
    },
    {
      key: "created_at",
      label: "Date",
      render: (r: BillingConcession) => (
        <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r: BillingConcession) =>
        r.status === "pending" && canApprove ? (
          <Group gap={4}>
            <Tooltip label="Approve">
              <ActionIcon variant="subtle" color="success" onClick={() => approveMut.mutate(r.id)}>
                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Reject">
              <ActionIcon variant="subtle" color="danger" onClick={() => rejectMut.mutate(r.id)}>
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null,
    },
  ];

  return (
    <Stack>
      <SegmentedControl
        data={[
          { value: "list", label: "Pending Concessions" },
          { value: "rules", label: "Auto-Concession Rules" },
        ]}
        value={view}
        onChange={(v) => setView(v as "list" | "rules")}
        w={360}
      />

      {view === "list" && (
        <>
          <Group>
            <Select
              placeholder="Filter by status"
              data={[
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "auto_applied", label: "Auto-Applied" },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              w={200}
            />
          </Group>
          <DataTable
            columns={columns}
            data={data?.concessions ?? []}
            loading={isLoading}
            page={1}
            totalPages={Math.ceil((data?.total ?? 0) / 20)}
            onPageChange={() => {}}
            rowKey={(r) => r.id}
          />
        </>
      )}

      {view === "rules" && (
        <Card withBorder>
          <Text fw={600} mb="sm">
            Auto-Concession Rules
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            Define rules as JSON array. Each rule: name, concession_type, percent, reason,
            is_active, applicable_modules[], patient_categories[].
          </Text>
          <Textarea
            minRows={10}
            value={rulesDraft || JSON.stringify(rulesData?.rules ?? [], null, 2)}
            onChange={(e) => setRulesDraft(e.currentTarget.value)}
            mb="md"
            styles={{ input: { fontFamily: "JetBrains Mono, monospace", fontSize: 13 } }}
          />
          <Button onClick={() => saveRulesMut.mutate()} loading={saveRulesMut.isPending}>
            Save Rules
          </Button>
        </Card>
      )}
    </Stack>
  );
}
