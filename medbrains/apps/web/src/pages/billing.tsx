import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Card,
  Divider,
  Drawer,
  Grid,
  Group,
  Modal,
  NumberInput,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type {
  BillingAdvanceAdjustmentFormInput,
  BillingAdvanceFormInput,
  BillingAdvanceRefundFormInput,
  BillingChargeMasterFormInput,
  BillingCorporateEnrollmentFormInput,
  BillingCorporateFormInput,
  BillingCorporateUpdateFormInput,
  BillingCreateInvoiceFormInput,
  BillingCreditNoteFormInput,
  BillingCreditPatientFormInput,
  BillingDiscountFormInput,
  BillingInsuranceClaimFormInput,
  BillingInvoiceItemFormInput,
  BillingPackageFormInput,
  BillingPackageItemFormInput,
  BillingRatePlanFormInput,
  BillingRatePlanItemFormInput,
  BillingRefundFormInput,
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
  billingCreateInvoiceFormSchema,
  billingCreditNoteFormSchema,
  billingCreditPatientFormSchema,
  billingDiscountFormSchema,
  billingInsuranceClaimFormSchema,
  billingInvoiceItemFormSchema,
  billingPackageFormSchema,
  billingPackageItemFormSchema,
  billingRatePlanFormSchema,
  billingRatePlanItemFormSchema,
  billingRefundFormSchema,
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
  BadDebtWriteOff,
  BillingAuditEntry,
  // Concessions
  BillingPackage,
  BillingSummaryReport,
  ChargeMaster,
  ClinicalEventName,
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
  CreatePackageRequest,
  CreateRatePlanRequest,
  CreateRefundRequest,
  CreateTpaRateCardRequest,
  CreateWriteOffRequest,
  CreditAgingRow,
  CreditNote,
  // Phase 3
  CreditPatient,
  DayEndClose,
  DepartmentRevenueRow,
  DoctorRevenueRow,
  FieldAccessLevel,
  InsuranceClaim,
  InsurancePanelRow,
  Invoice,
  InvoiceDetailResponse,
  InvoiceDiscount,
  InvoicePrintData,
  PatientAdvance,
  RatePlan,
  ReceiptPrintData,
  RecordPaymentRequest,
  Refund,
  RefundAdvanceRequest,
  TenantSettingsRow,
  TpaRateCard,
  UpdateCorporateRequest,
  UpdateCreditPatientRequest,
} from "@medbrains/types";
import {
  billingInvoiceBalance,
  billingInvoiceBalanceSignal,
  billingInvoiceBalanceSignalLabel,
  billingInvoiceBalanceSignalLabelKey,
  billingInvoiceDisplayStatus,
  billingInvoiceIsPayable,
  billingInvoiceStatusLabelKey,
  billingInvoiceStatusSignal,
  P,
  PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  PATIENT_UHID_FIELD_ACCESS_KEY,
  billingInvoiceStatusLabel as sharedBillingInvoiceStatusLabel,
} from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
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
  IconListCheck,
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
  IconShieldHalf,
  IconTags,
  IconTransferIn,
  IconTrash,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  type Column,
  DataTable,
  DocumentActions,
  FormModal,
  OperationalSignal,
  PageHeader,
  PaymentCollectPanel,
  type SortState,
  useClinicalEmit,
  useProtectedFieldAccess,
} from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { PaymentModal, type PaymentModalSettlement } from "@/components/PaymentModal";
import { Alert, Badge, type BadgeTone, Button, IconButton, Table, toast } from "@/components/ui";
import {
  billingAdvancePurposeOptions,
  billingChargeSourceOptions,
  billingCreditPatientStatusOptions,
  billingDiscountTypeOptions,
  billingGstCategoryOptions,
  billingInsuranceClaimTypeOptions,
  billingInsuranceSchemeTypeOptions,
  billingIntegerOrFallback,
  billingNumberOrFallback,
  billingOptionalInteger,
  billingOptionalNumber,
  billingOptionalText,
  billingPaymentModeOptions,
  billingServiceCategoryOptions,
} from "@/forms/billing.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { statusColor } from "@/lib/status-colors";
import { billingService } from "@/services/billing.service";
import {
  buildCopyPrintHtml,
  copyPrintStyles,
  PRINT_COPY_PACKETS,
  printCopyRouteLabel,
} from "@/utils/printCopies";
import {
  BankReconTab,
  ConcessionsTab,
  ErpExportTab,
  FinancialMisTab,
  GstTdsTab,
  JournalEntriesTab,
} from "./billing/accounting-tabs";
import classes from "./billing.module.scss";
import {
  billingAdmissionFilterFromSearchParams,
  billingEncounterFilterFromSearchParams,
  billingHandoffActionFromSearchParams,
  billingInvoiceActionFromSearchParams,
  billingInvoicePaymentRoute,
} from "./billing-workspace";

const toBadgeTone = (color: string | undefined): BadgeTone => {
  switch (color) {
    case "primary":
      return "primary";
    case "success":
    case "green":
    case "teal":
    case "lime":
      return "success";
    case "warning":
    case "yellow":
    case "orange":
      return "warning";
    case "danger":
    case "red":
      return "danger";
    case "info":
    case "blue":
    case "cyan":
    case "indigo":
      return "info";
    case "violet":
    case "grape":
    case "pink":
      return "accent";
    default:
      return "neutral";
  }
};

const statusColors: Record<string, BadgeTone> = {
  draft: "neutral",
  issued: "primary",
  partially_paid: "warning",
  paid: "success",
  cancelled: "danger",
  refunded: "warning",
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

type BillingTranslate = ReturnType<typeof useTranslation>["t"];

function billingSignalLabel(t: BillingTranslate, key: string | null, fallback: string): string {
  return key ? t(key, { defaultValue: fallback }) : fallback;
}

function invoiceStatusLabel(t: BillingTranslate, status: string): string {
  return billingSignalLabel(
    t,
    billingInvoiceStatusLabelKey(status),
    sharedBillingInvoiceStatusLabel(status),
  );
}

function invoiceBalanceLabel(
  t: BillingTranslate,
  signal: ReturnType<typeof billingInvoiceBalanceSignal>,
) {
  return billingSignalLabel(
    t,
    billingInvoiceBalanceSignalLabelKey(signal),
    billingInvoiceBalanceSignalLabel(signal),
  );
}

function money(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface BillingDisplayAccess {
  amount: FieldAccessLevel;
  patientAddress: FieldAccessLevel;
  patientName: FieldAccessLevel;
  uhid: FieldAccessLevel;
}

function billingPatientNameText(
  patientName: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, patientName, "name");
  return displayValue === "—" ? "Patient" : displayValue;
}

function billingPatientIdentifierText(
  identifier: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, identifier, "identifier");
  return displayValue === "—" ? "No UHID" : displayValue;
}

function billingPatientAddressText(
  address: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, address, "text");
  return displayValue === "—" ? "No address" : displayValue;
}

function billingAmountText(
  value: number | string | null | undefined,
  access: FieldAccessLevel,
): string {
  const formatted = `₹${money(value)}`;
  return access === "edit" || access === "view"
    ? formatted
    : fieldAccessText(access, formatted, "amount");
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

function printInvoicePacket(data: InvoicePrintData, access: BillingDisplayAccess) {
  const rows = data.items
    .map(
      (item) => `
        <tr>
          <td>${escapeBillingPrintText(item.description)}</td>
          <td>${escapeBillingPrintText(item.quantity)}</td>
          <td>${escapeBillingPrintText(billingAmountText(item.unit_price, access.amount))}</td>
          <td>${escapeBillingPrintText(item.tax_percent)}%</td>
          <td>${escapeBillingPrintText(billingAmountText(item.total_price, access.amount))}</td>
        </tr>`,
    )
    .join("");
  const hsnRows = data.hsn_summary
    .map(
      (row) => `
        <tr>
          <td>${escapeBillingPrintText(row.hsn_code)}</td>
          <td>${escapeBillingPrintText(billingAmountText(row.taxable_amount, access.amount))}</td>
          <td>${escapeBillingPrintText(billingAmountText(row.cgst_amount, access.amount))}</td>
          <td>${escapeBillingPrintText(billingAmountText(row.sgst_amount, access.amount))}</td>
          <td>${escapeBillingPrintText(billingAmountText(row.igst_amount, access.amount))}</td>
          <td>${escapeBillingPrintText(billingAmountText(row.total_tax, access.amount))}</td>
        </tr>`,
    )
    .join("");
  const patientName = billingPatientNameText(
    data.patient_name ?? data.invoice.patient_id,
    access.patientName,
  );
  const patientAddress = billingPatientAddressText(data.patient_address, access.patientAddress);
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
        <strong>Patient:</strong> ${escapeBillingPrintText(patientName)}<br />
        ${escapeBillingPrintText(patientAddress)}
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
        Subtotal: ${escapeBillingPrintText(billingAmountText(data.invoice.subtotal, access.amount))}<br />
        Tax: ${escapeBillingPrintText(billingAmountText(data.invoice.tax_amount, access.amount))}<br />
        Paid: ${escapeBillingPrintText(billingAmountText(data.invoice.paid_amount, access.amount))}<br />
        <strong>Total: ${escapeBillingPrintText(billingAmountText(data.invoice.total_amount, access.amount))}</strong>
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

function printReceiptPacket(data: ReceiptPrintData, access: BillingDisplayAccess) {
  const patientName = billingPatientNameText(data.patient_name, access.patientName);
  const uhid = billingPatientIdentifierText(data.uhid, access.uhid);
  const content = `
    <section class="receipt-print">
      <h1>${escapeBillingPrintText(data.hospital_name ?? "Payment Receipt")}</h1>
      <div class="number">${escapeBillingPrintText(data.receipt_number ?? data.document_number)}</div>
      <dl>
        <dt>Patient</dt><dd>${escapeBillingPrintText(patientName)} (${escapeBillingPrintText(uhid)})</dd>
        <dt>Invoice</dt><dd>${escapeBillingPrintText(data.invoice_number)}</dd>
        <dt>Amount</dt><dd>${escapeBillingPrintText(billingAmountText(data.amount, access.amount))}</dd>
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
  return billingInvoiceBalance(invoice.total_amount, invoice.paid_amount);
}

function invoiceDisplayStatus(invoice: Invoice): Invoice["status"] {
  return billingInvoiceDisplayStatus(invoice.status, invoice.total_amount, invoice.paid_amount);
}

function invoiceIsPayable(invoice: Invoice): boolean {
  return billingInvoiceIsPayable(invoice.status, invoice.total_amount, invoice.paid_amount);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const canCreate = useHasPermission(P.BILLING.INVOICES_CREATE);
  const canPay = useHasPermission(P.BILLING.PAYMENTS_CREATE);
  const initialAction = billingInvoiceActionFromSearchParams(searchParams);
  const clearInvoiceAction = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };

  if (!invoiceId) {
    return (
      <ClinicalEventProvider moduleCode="billing" contextCode="billing-invoice-detail">
        <Stack>
          <PageHeader
            title="Invoice"
            subtitle="Invoice route is missing an invoice identifier."
            actions={
              <Button tone="ghost" onClick={() => navigate("/billing")}>
                Back to Billing
              </Button>
            }
          />
          <Alert tone="danger">Unable to open invoice without an invoice ID.</Alert>
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
            <Button tone="ghost" onClick={() => navigate("/billing")}>
              Back to Billing
            </Button>
          }
        />
        <InvoiceDetail
          invoiceId={invoiceId}
          canCreate={canCreate}
          canPay={canPay}
          initialAction={initialAction}
          onClearAction={clearInvoiceAction}
        />
      </Stack>
    </ClinicalEventProvider>
  );
}

function BillingPageInner() {
  const { t } = useTranslation("billing");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canCreate = useHasPermission(P.BILLING.INVOICES_CREATE);
  const canPay = useHasPermission(P.BILLING.PAYMENTS_CREATE);
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
  const [invoiceSort, setInvoiceSort] = useState<SortState | null>(null);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
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
  const admissionFilterId = billingAdmissionFilterFromSearchParams(searchParams);
  const encounterFilterId = billingEncounterFilterFromSearchParams(searchParams);
  const requestedStatus = searchParams.get("status");
  const filterStatus = isInvoiceStatus(requestedStatus) ? requestedStatus : null;
  const activeHandoff = billingHandoffActionFromSearchParams(searchParams);

  const setBillingParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };
  const clearBillingHandoff = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    next.delete("source");
    setSearchParams(next, { replace: true });
  };
  const clearPatientBillingFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("patient_id");
    next.delete("admission_id");
    next.delete("encounter_id");
    next.delete("action");
    next.delete("source");
    setSearchParams(next, { replace: true });
  };

  const setSelectedTab = (value: string | null) => {
    setBillingParam("tab", value && visibleBillingTabs.has(value) ? value : "invoices");
  };

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (filterStatus) params.status = filterStatus;
  if (patientFilterId) params.patient_id = patientFilterId;
  if (encounterFilterId) params.encounter_id = encounterFilterId;
  if (admissionFilterId) params.admission_id = admissionFilterId;
  if (invoiceSort) {
    params.sort = invoiceSort.key;
    params.order = invoiceSort.dir;
  }

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", params],
    queryFn: () => billingService.listInvoices(params),
  });
  const invoices = data?.invoices ?? [];
  const firstPayableInvoice = invoices.find(invoiceIsPayable);

  const cloneMutation = useMutation({
    mutationFn: (id: string) => billingService.cloneInvoice(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice duplicated as draft", { title: "Cloned" });
    },
    onError: () => toast.error("Failed to clone invoice", { title: "Error" }),
  });

  const columns = [
    {
      key: "invoice_number",
      label: "Invoice #",
      sortable: true,
      render: (row: Invoice) => <Text fw={600}>{row.invoice_number}</Text>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: Invoice) => {
        const displayStatus = invoiceDisplayStatus(row);
        const statusSignal = billingInvoiceStatusSignal(displayStatus);
        return (
          <Group gap={6}>
            <OperationalSignal
              label={invoiceStatusLabel(t, displayStatus)}
              shape={statusSignal.shape}
              size="xs"
              tone={statusSignal.tone}
            />
            {row.notes === "Auto-generated" && (
              <OperationalSignal label={t("auto")} shape="token" size="xs" tone="active" />
            )}
            {row.is_interim && (
              <OperationalSignal label={t("interim")} shape="token" size="xs" tone="blocked" />
            )}
            {row.corporate_id && (
              <OperationalSignal label={t("corporate")} shape="token" size="xs" tone="active" />
            )}
            {row.is_er_deferred && (
              <OperationalSignal label={t("erDeferred")} shape="diamond" size="xs" tone="risk" />
            )}
            {row.cloned_from_id && (
              <OperationalSignal label={t("cloned")} shape="token" size="xs" tone="neutral" />
            )}
          </Group>
        );
      },
    },
    {
      key: "total_amount",
      label: "Total",
      sortable: true,
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
              <Progress
                value={percent}
                size={4}
                color="warning"
                aria-label={t("billingSignals.paymentProgress")}
              />
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
        const balanceSignal = billingInvoiceBalanceSignal(balance, true);
        return (
          <OperationalSignal
            label={invoiceBalanceLabel(t, balanceSignal)}
            shape={balanceSignal.shape}
            size="xs"
            tone={balanceSignal.tone}
            value={`₹${money(balance)}`}
          />
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
            <IconButton
              tone="default"
              onClick={() => navigate(`/billing/invoices/${row.id}`)}
              aria-label={`Open invoice ${row.invoice_number}`}
            >
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
          {canCreate && (
            <Tooltip label="Clone">
              <IconButton
                tone="default"
                aria-label="Clone"
                onClick={() => cloneMutation.mutate(row.id)}
                loading={cloneMutation.isPending}
              >
                <IconCopy size={16} />
              </IconButton>
            </Tooltip>
          )}
          {activeHandoff === "payment" && canPay && invoiceIsPayable(row) && (
            <Tooltip label="Collect payment">
              <IconButton
                tone="default"
                onClick={() => navigate(`/billing/invoices/${row.id}?action=payment`)}
                aria-label={`Collect payment for invoice ${row.invoice_number}`}
              >
                <IconCash size={16} />
              </IconButton>
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
          <Group gap="xs">
            <Button
              tone="ghost"
              leftSection={<IconListCheck size={16} />}
              onClick={() => navigate("/billing/worklist")}
            >
              Worklist
            </Button>
            <Button
              tone="ghost"
              leftSection={<IconShieldHalf size={16} />}
              onClick={() => navigate("/billing/tpa-pipeline")}
            >
              TPA pipeline
            </Button>
            {canPay && (
              <Button
                tone="secondary"
                leftSection={<IconCash size={16} />}
                onClick={() => navigate("/billing/counter")}
              >
                Cashier counter
              </Button>
            )}
            {canCreate && (
              <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
                {t("button.newInvoice")}
              </Button>
            )}
          </Group>
        }
      />

      {patientFilterId && (
        <Stack gap="xs" mb="md">
          <PatientContextBanner patientId={patientFilterId} hideLoadingState variant="financial" />
          <Group justify="space-between" align="center">
            <PatientFlowNavigator
              patientId={patientFilterId}
              active="billing"
              activeEncounterId={encounterFilterId}
              activeAdmissionId={admissionFilterId}
              activeAdmissionStatus={admissionFilterId ? "admitted" : null}
              activeOrderContext={admissionFilterId ? "ipd" : encounterFilterId ? "opd" : null}
              compact
            />
            <Button
              tone="ghost"
              size="xs"
              leftSection={<IconX size={14} />}
              onClick={clearPatientBillingFilter}
            >
              {t("button.allBilling")}
            </Button>
          </Group>
          {activeHandoff && (
            <Alert
              tone={activeHandoff === "payment" ? "warning" : "success"}
              title={
                activeHandoff === "payment"
                  ? t("handoff.payment.title")
                  : t("handoff.dischargeBill.title")
              }
            >
              <Group justify="space-between" align="center" gap="sm">
                <Stack gap={6}>
                  <Text size="sm">
                    {activeHandoff === "payment"
                      ? t("handoff.payment.message")
                      : t("handoff.dischargeBill.message")}
                  </Text>
                  <Group gap={6}>
                    <OperationalSignal
                      label={t("billingSignals.filteredInvoices", { count: invoices.length })}
                      shape="token"
                      size="xs"
                      tone="active"
                    />
                    <OperationalSignal
                      label={
                        firstPayableInvoice
                          ? t("billingSignals.payableReady")
                          : t("billingSignals.noPayableInvoice")
                      }
                      shape={firstPayableInvoice ? "pill" : "diamond"}
                      size="xs"
                      tone={firstPayableInvoice ? "ready" : "blocked"}
                    />
                  </Group>
                </Stack>
                <Group gap="xs">
                  {activeHandoff === "payment" && firstPayableInvoice && canPay && (
                    <Button
                      tone="primary"
                      size="xs"
                      leftSection={<IconCash size={14} />}
                      onClick={() =>
                        navigate(`/billing/invoices/${firstPayableInvoice.id}?action=payment`)
                      }
                    >
                      {t("button.openPayableInvoice")}
                    </Button>
                  )}
                  {activeHandoff === "discharge_bill" && canCreate && (
                    <Button tone="primary" size="xs" onClick={openCreate}>
                      {t("button.newInvoice")}
                    </Button>
                  )}
                  <Button tone="ghost" size="xs" onClick={clearBillingHandoff}>
                    {t("button.dismiss")}
                  </Button>
                </Group>
              </Group>
            </Alert>
          )}
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
            data={invoices}
            loading={isLoading}
            page={page}
            totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
            onPageChange={setPage}
            sort={invoiceSort}
            onSortChange={(next) => {
              setInvoiceSort(next);
              setPage(1);
            }}
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

      <CreateInvoiceDrawer
        key={`${patientFilterId ?? "all-billing"}:${encounterFilterId ?? "all-encounters"}:${admissionFilterId ?? "all-admissions"}`}
        opened={createOpened}
        onClose={closeCreate}
        initialPatientId={patientFilterId ?? ""}
        initialEncounterId={encounterFilterId ?? ""}
        initialAdmissionId={admissionFilterId ?? ""}
      />
    </div>
  );
}

function CreateInvoiceDrawer({
  opened,
  onClose,
  initialPatientId,
  initialEncounterId,
  initialAdmissionId,
}: {
  opened: boolean;
  onClose: () => void;
  initialPatientId: string;
  initialEncounterId: string;
  initialAdmissionId: string;
}) {
  const { t } = useTranslation("billing");
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const invoiceDefaults: BillingCreateInvoiceFormInput = {
    patient_id: initialPatientId,
    encounter_id: initialEncounterId,
    admission_id: initialAdmissionId,
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BillingCreateInvoiceFormInput>({
    resolver: zodResolver(billingCreateInvoiceFormSchema),
    defaultValues: invoiceDefaults,
  });
  const invoiceFieldError = (field: keyof BillingCreateInvoiceFormInput) => {
    const message = errors[field]?.message;
    if (!message) return undefined;
    if (field === "patient_id") return t("validation.patientRequired");
    return t("validation.invalidField");
  };
  const createInvoiceErrorMessage = (error: Error) => {
    if (error.message === "billing.error.admissionNotFound") {
      return t("error.admissionNotFound");
    }
    if (error.message === "billing.error.admissionPatientMismatch") {
      return t("error.admissionPatientMismatch");
    }
    if (error.message === "billing.error.encounterAdmissionMismatch") {
      return t("error.encounterAdmissionMismatch");
    }
    return t("notification.createInvoiceFailed");
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateInvoiceRequest) => billingService.createInvoice(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", result.patient_id] });
      toast.success(t("notification.draftInvoiceCreated"), {
        title: t("notification.invoiceCreatedTitle"),
      });
      emit("billing.invoice.created", {
        admission_id: result.admission_id,
        encounter_id: result.encounter_id,
        invoice_id: result.id,
        patient_id: result.patient_id,
        total_amount: result.total_amount,
      });
      onClose();
      reset(invoiceDefaults);
    },
    onError: (error: Error) => {
      toast.error(createInvoiceErrorMessage(error), {
        title: t("notification.errorTitle"),
      });
    },
  });
  const patientId = watch("patient_id");
  const contextPatientId = patientId.trim().length >= 32 ? patientId.trim() : null;
  const closeDrawer = () => {
    reset(invoiceDefaults);
    onClose();
  };
  const submitInvoice = handleSubmit((values) => {
    createMutation.mutate({
      patient_id: values.patient_id.trim(),
      encounter_id: billingOptionalText(values.encounter_id),
      admission_id: billingOptionalText(values.admission_id),
      notes: billingOptionalText(values.notes),
    });
  });

  return (
    <FormModal
      opened={opened}
      onClose={closeDrawer}
      title={t("title.createInvoice")}
      variant="drawer"
      size="xl"
      onSubmit={submitInvoice}
      submitLabel={t("button.createDraftInvoice")}
      submitting={createMutation.isPending}
    >
      <Controller
        control={control}
        name="patient_id"
        render={({ field }) => (
          <PatientSearchSelect value={field.value} onChange={field.onChange} required />
        )}
      />
      {errors.patient_id?.message && (
        <Text size="xs" c="danger">
          {invoiceFieldError("patient_id")}
        </Text>
      )}
      {contextPatientId && (
        <PatientContextBanner patientId={contextPatientId} hideLoadingState variant="financial" />
      )}
      <TextInput
        label={t("label.encounterId")}
        error={invoiceFieldError("encounter_id")}
        {...register("encounter_id")}
      />
      <TextInput
        label={t("label.admissionId")}
        error={invoiceFieldError("admission_id")}
        {...register("admission_id")}
      />
      <Textarea
        label={t("label.notes")}
        error={invoiceFieldError("notes")}
        {...register("notes")}
      />
    </FormModal>
  );
}

// Cashiers work the invoice, not the clinical journey — the flow
// navigator above already covers cross-module navigation, so the
// action row keeps only billing moves (payment, discharge bill).
const BILLING_DETAIL_HIDDEN_ACTIONS = [
  "patient.edit",
  "patient.share",
  "patient.print_card",
  "opd.open_visit",
  "orders.medication",
  "orders.lab",
  "orders.radiology",
  "ipd.open_admission",
  "ipd.admit",
  "emergency.open_visit",
  "emergency.open_mlc",
  "camp.open_context",
  "pharmacy.dispense_order",
  "pharmacy.open_patient_queue",
  "mrd.open_case_sheet",
  "billing.open_ledger",
] as const;

function InvoiceDetail({
  invoiceId,
  canCreate,
  canPay,
  initialAction,
  onClearAction,
}: {
  invoiceId: string;
  canCreate: boolean;
  canPay: boolean;
  initialAction?: "payment" | null;
  onClearAction?: () => void;
}) {
  const { t } = useTranslation("billing");
  const emit = useClinicalEmit();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canPrintBillingDocs = useHasPermission(P.BILLING.RECEIPTS_PRINT);
  const amountAccess = useProtectedFieldAccess("billing.amount");
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const patientAddressAccess = useProtectedFieldAccess("patients.address");
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const billingDisplayAccess: BillingDisplayAccess = {
    amount: amountAccess,
    patientAddress: patientAddressAccess,
    patientName: patientNameAccess,
    uhid: uhidAccess,
  };
  const [addItemOpened, addItemHandlers] = useDisclosure(false);
  const [paymentOpened, { open: openPaymentPanel, close: closePaymentPanel }] =
    useDisclosure(false);
  const [gatewayOpened, gatewayHandlers] = useDisclosure(false);
  const [discountOpened, discountHandlers] = useDisclosure(false);
  const [copayOpened, copayHandlers] = useDisclosure(false);
  const itemDefaults: BillingInvoiceItemFormInput = {
    charge_code: "",
    description: "",
    source: "manual",
    quantity: 1,
    unit_price: 0,
    tax_percent: 0,
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
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", result.patient_id] });
      emit("billing.invoice.finalized", {
        admission_id: result.admission_id,
        encounter_id: result.encounter_id,
        invoice_id: result.id,
        invoice_number: result.invoice_number,
        patient_id: result.patient_id,
        status: result.status,
      });
      // Cashier flow: issuing is almost always followed by collecting —
      // land straight on the payment panel via the ?action=payment link.
      if (canPay && invoiceBalance(result) > 0) {
        navigate(billingInvoicePaymentRoute(invoiceId), { replace: true });
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => billingService.cancelInvoice(invoiceId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] }),
  });

  const closeZeroMutation = useMutation({
    mutationFn: () => billingService.closeZeroInvoice(invoiceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Zero-balance bill settled.", { title: "Invoice closed" });
    },
    onError: (error: Error) => {
      toast.error(error.message, { title: "Could not close" });
    },
  });

  const invoicePrintMutation = useMutation({
    mutationFn: () => billingService.getInvoicePrintData(invoiceId),
    onSuccess: (printData) => {
      printInvoicePacket(printData, billingDisplayAccess);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to prepare invoice packet", {
        title: "Invoice print failed",
      });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (item: AddInvoiceItemRequest) => billingService.addInvoiceItem(invoiceId, item),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      addItemHandlers.close();
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
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-context", inv.patient_id] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", inv.patient_id] });
      emit("billing.payment.received", {
        amount: variables.amount,
        admission_id: inv.admission_id,
        encounter_id: inv.encounter_id,
        invoice_id: result.invoice_id,
        mode: variables.mode,
        patient_id: inv.patient_id,
        payment_id: result.id,
      });
      closePaymentPanel();
      onClearAction?.();
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
      discountHandlers.close();
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
      printReceiptPacket(printData, billingDisplayAccess);
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      toast.success("Customer and office copies are ready to print", {
        title: "Receipt generated",
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to prepare receipt packet", {
        title: "Receipt print failed",
      });
    },
  });

  useEffect(() => {
    if (initialAction !== "payment" || !data) {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById("billing-payments")?.scrollIntoView({ block: "start" });
    });

    if (paymentOpened) {
      return;
    }

    const invoiceDetail = data as InvoiceDetailResponse;
    const invoice = invoiceDetail.invoice;
    const invoiceStatus = invoiceDisplayStatus(invoice);
    const invoiceBalanceAmount = invoiceBalance(invoice);
    const canOpenPaymentPanel =
      amountAccess === "edit" &&
      canPay &&
      (invoiceStatus === "issued" || invoiceStatus === "partially_paid") &&
      invoiceBalanceAmount > 0;

    if (!canOpenPaymentPanel) {
      return;
    }

    openPaymentPanel();
  }, [amountAccess, canPay, data, initialAction, openPaymentPanel, paymentOpened]);

  if (!data) return <Text c="dimmed">Loading...</Text>;

  const detail = data as InvoiceDetailResponse;
  const inv = detail.invoice;
  const displayStatus = invoiceDisplayStatus(inv);
  const invoiceSignal = billingInvoiceStatusSignal(displayStatus);
  const balance = invoiceBalance(inv);
  const balanceSignal = billingInvoiceBalanceSignal(balance, amountAccess !== "hidden");
  const balanceSignalLabel = invoiceBalanceLabel(t, balanceSignal);
  const completedEvents: ClinicalEventName[] = ["billing.invoice.created"];
  if (
    displayStatus === "issued" ||
    displayStatus === "partially_paid" ||
    displayStatus === "paid"
  ) {
    completedEvents.push("billing.invoice.finalized");
  }
  if (
    displayStatus === "partially_paid" ||
    displayStatus === "paid" ||
    detail.payments.length > 0
  ) {
    completedEvents.push("billing.payment.received");
  }
  const journeyContext: ClinicalJourneyContext = {
    patientId: inv.patient_id,
    activeEncounterId: inv.encounter_id,
    activeAdmissionId: inv.admission_id,
    activeAdmissionStatus: inv.admission_id ? "admitted" : null,
    activeInvoiceId: inv.id,
    activeOrderContext: inv.admission_id ? "ipd" : inv.encounter_id ? "opd" : null,
    completedEvents,
  };
  const canRecordPayment =
    amountAccess === "edit" &&
    canPay &&
    (displayStatus === "issued" || displayStatus === "partially_paid") &&
    balance > 0;
  const openPaymentForm = () => {
    if (paymentOpened) {
      closePaymentPanel();
      onClearAction?.();
      return;
    }
    navigate(billingInvoicePaymentRoute(invoiceId), { replace: true });
    openPaymentPanel();
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
    gatewayHandlers.close();
    onClearAction?.();
  };

  return (
    <Stack className={classes.invoiceWorkspace}>
      <Card withBorder className={classes.commandBar}>
        <Stack gap="xs">
          <PatientContextBanner patientId={inv.patient_id} hideLoadingState variant="financial" />
          <PatientFlowNavigator
            patientId={inv.patient_id}
            active="billing"
            activeEncounterId={inv.encounter_id}
            activeAdmissionId={inv.admission_id}
            activeInvoiceId={inv.id}
            activeOrderContext={inv.admission_id ? "ipd" : inv.encounter_id ? "opd" : null}
            completedEvents={completedEvents}
            compact
          />
          <Group justify="space-between" align="flex-start" gap="sm">
            <Stack gap={4}>
              <Group gap="xs">
                <Text fw={700}>{inv.invoice_number}</Text>
                <OperationalSignal
                  label={invoiceStatusLabel(t, displayStatus)}
                  shape={invoiceSignal.shape}
                  tone={invoiceSignal.tone}
                />
                {inv.is_interim && <Badge tone="accent">Interim #{inv.sequence_number}</Badge>}
                {inv.is_er_deferred && <Badge tone="danger">ER Deferred</Badge>}
              </Group>
              <Group gap="md">
                <Text size="sm">Total: {billingAmountText(inv.total_amount, amountAccess)}</Text>
                <Text size="sm">Paid: {billingAmountText(inv.paid_amount, amountAccess)}</Text>
                <Text
                  size="sm"
                  c={amountAccess === "hidden" ? undefined : balance > 0 ? "danger" : "success"}
                >
                  Balance: {billingAmountText(balance, amountAccess)}
                </Text>
              </Group>
              <PatientJourneyActions
                context={journeyContext}
                hiddenActionIds={BILLING_DETAIL_HIDDEN_ACTIONS}
                size="xs"
              />
            </Stack>
            <Group gap="xs" justify="flex-end">
              {canPay && displayStatus === "issued" && balance === 0 && (
                <Tooltip label="No money to collect — record this free / scheme bill as settled">
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconCheck size={14} />}
                    loading={closeZeroMutation.isPending}
                    onClick={() => closeZeroMutation.mutate()}
                  >
                    Close ₹0 bill
                  </Button>
                </Tooltip>
              )}
              {canPrintBillingDocs && (
                <Tooltip
                  label={
                    inv.status === "draft"
                      ? "Issue the invoice before printing"
                      : "Customer and office copies"
                  }
                >
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconPrinter size={14} />}
                    loading={invoicePrintMutation.isPending}
                    disabled={inv.status === "draft"}
                    onClick={() => invoicePrintMutation.mutate()}
                  >
                    Print packet
                  </Button>
                </Tooltip>
              )}
              {inv.status !== "draft" && (
                <DocumentActions templateCode="invoice_gst" sourceId={inv.id} />
              )}
              {canCreate && inv.status === "draft" && (
                <>
                  <Button
                    tone="primary"
                    size="xs"
                    leftSection={<IconCheck size={14} />}
                    loading={issueMutation.isPending}
                    onClick={() => issueMutation.mutate()}
                  >
                    Issue
                  </Button>
                  <Button
                    tone="subtle-danger"
                    size="xs"
                    leftSection={<IconX size={14} />}
                    loading={cancelMutation.isPending}
                    onClick={() =>
                      confirmDestructive({
                        title: "Cancel invoice",
                        message:
                          "Cancel this draft invoice? Its line items will no longer be billable from this draft.",
                        confirmLabel: "Cancel invoice",
                        onConfirm: () => cancelMutation.mutate(),
                      })
                    }
                  >
                    Cancel
                  </Button>
                </>
              )}
              {canRecordPayment && (
                <>
                  <Button
                    tone="primary"
                    size="xs"
                    leftSection={<IconCash size={14} />}
                    onClick={openPaymentForm}
                  >
                    {t("button.recordPayment")}
                  </Button>
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconCreditCard size={14} />}
                    onClick={gatewayHandlers.open}
                  >
                    {t("button.gateway")}
                  </Button>
                </>
              )}
            </Group>
          </Group>
        </Stack>
      </Card>

      {initialAction === "payment" && (
        <Alert tone={canRecordPayment ? "warning" : "neutral"} title={t("handoff.payment.title")}>
          <Group justify="space-between" align="center" gap="sm">
            <Text size="sm">
              {canRecordPayment
                ? t("handoff.invoicePayment.readyMessage")
                : t("handoff.invoicePayment.unavailableMessage")}
            </Text>
            <Group gap="xs">
              {canRecordPayment && (
                <Button
                  tone="primary"
                  size="xs"
                  leftSection={<IconCash size={14} />}
                  onClick={openPaymentForm}
                >
                  {t("button.recordPayment")}
                </Button>
              )}
              {onClearAction && (
                <Button tone="ghost" size="xs" onClick={onClearAction}>
                  {t("button.dismiss")}
                </Button>
              )}
            </Group>
          </Group>
        </Alert>
      )}

      <Grid align="flex-start" className={classes.workspaceGrid}>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack className={classes.workspaceMain}>
            <Card id="billing-summary" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>Invoice summary</Text>
                  {canPrintBillingDocs && (
                    <Group gap={4}>
                      {BILLING_INVOICE_PRINT_COPIES.map((copy) => (
                        <Badge key={copy.label} tone="accent">
                          {printCopyRouteLabel(copy)}
                        </Badge>
                      ))}
                    </Group>
                  )}
                </Group>
                {(Number(inv.cgst_amount ?? 0) > 0 ||
                  Number(inv.sgst_amount ?? 0) > 0 ||
                  Number(inv.igst_amount ?? 0) > 0) && (
                  <Group gap="xs">
                    <Badge tone="success" size="sm">
                      CGST: {billingAmountText(inv.cgst_amount, amountAccess)}
                    </Badge>
                    <Badge tone="success" size="sm">
                      SGST: {billingAmountText(inv.sgst_amount, amountAccess)}
                    </Badge>
                    <Badge tone="primary" size="sm">
                      IGST: {billingAmountText(inv.igst_amount, amountAccess)}
                    </Badge>
                    {Number(inv.cess_amount ?? 0) > 0 && (
                      <Badge tone="warning" size="sm">
                        Cess: {billingAmountText(inv.cess_amount, amountAccess)}
                      </Badge>
                    )}
                  </Group>
                )}
                {inv.is_interim && inv.billing_period_start && inv.billing_period_end && (
                  <Text size="xs" c="dimmed">
                    Period: {new Date(inv.billing_period_start).toLocaleDateString()} -{" "}
                    {new Date(inv.billing_period_end).toLocaleDateString()}
                  </Text>
                )}
                {copayOpened && (
                  <Box id="billing-copay">
                    <CopayBreakdown invoiceId={invoiceId} />
                  </Box>
                )}
              </Stack>
            </Card>

            <Card id="billing-items" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>Items</Text>
                  {canCreate && inv.status === "draft" && (
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={addItemHandlers.toggle}
                    >
                      {addItemOpened ? "Close" : "Add Item"}
                    </Button>
                  )}
                </Group>
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
                        <Table.Td>{billingAmountText(item.unit_price, amountAccess)}</Table.Td>
                        <Table.Td>{item.tax_percent}%</Table.Td>
                        <Table.Td>{billingAmountText(item.total_price, amountAccess)}</Table.Td>
                        {canCreate && inv.status === "draft" && (
                          <Table.Td>
                            <IconButton
                              tone="danger"
                              aria-label="Delete"
                              onClick={() =>
                                confirmDestructive({
                                  title: "Remove item",
                                  message: "Remove this line item from the invoice?",
                                  confirmLabel: "Remove item",
                                  onConfirm: () => removeItemMutation.mutate(item.id),
                                })
                              }
                            >
                              <IconTrash size={14} />
                            </IconButton>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                {canCreate && inv.status === "draft" && addItemOpened && (
                  <Stack
                    component="form"
                    gap="xs"
                    onSubmit={handleSubmitItem(handleAddInvoiceItem)}
                  >
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
                    <Button
                      tone="primary"
                      size="xs"
                      type="submit"
                      loading={addItemMutation.isPending}
                    >
                      Add
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Card>

            <Card id="billing-payments" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>{t("payments")}</Text>
                  {canRecordPayment && (
                    <Group gap="xs">
                      <Button
                        tone="primary"
                        size="xs"
                        leftSection={<IconCash size={14} />}
                        onClick={openPaymentForm}
                      >
                        {paymentOpened ? t("label.close") : t("button.recordPayment")}
                      </Button>
                      <Button
                        tone="secondary"
                        size="xs"
                        leftSection={<IconCreditCard size={14} />}
                        onClick={gatewayHandlers.open}
                      >
                        {t("button.gateway")}
                      </Button>
                    </Group>
                  )}
                </Group>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("label.amount")}</Table.Th>
                      <Table.Th>{t("label.mode")}</Table.Th>
                      <Table.Th>{t("label.reference")}</Table.Th>
                      <Table.Th>{t("label.date")}</Table.Th>
                      {canPrintBillingDocs && <Table.Th />}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {detail.payments.map((p) => (
                      <Table.Tr key={p.id}>
                        <Table.Td>{billingAmountText(p.amount, amountAccess)}</Table.Td>
                        <Table.Td>{p.mode}</Table.Td>
                        <Table.Td>{p.reference_number ?? "—"}</Table.Td>
                        <Table.Td>{new Date(p.created_at).toLocaleString()}</Table.Td>
                        {canPrintBillingDocs && (
                          <Table.Td>
                            <Tooltip label="Generate + print receipt packet">
                              <IconButton
                                tone="default"
                                aria-label="Generate + print receipt packet"
                                size="sm"
                                loading={receiptMutation.isPending}
                                onClick={() => receiptMutation.mutate(p.id)}
                              >
                                <IconReceipt size={14} />
                              </IconButton>
                            </Tooltip>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                {canRecordPayment && paymentOpened && (
                  <PaymentCollectPanel
                    invoiceId={invoiceId}
                    balance={balance}
                    onRecorded={(payments) => {
                      for (const payment of payments) {
                        emit("billing.payment.received", {
                          amount: Number(payment.amount),
                          admission_id: inv.admission_id,
                          encounter_id: inv.encounter_id,
                          invoice_id: payment.invoice_id,
                          mode: payment.mode,
                          patient_id: inv.patient_id,
                          payment_id: payment.id,
                        });
                      }
                      void queryClient.invalidateQueries({
                        queryKey: ["invoice-detail", invoiceId],
                      });
                      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
                      void queryClient.invalidateQueries({
                        queryKey: ["patient-context", inv.patient_id],
                      });
                      void queryClient.invalidateQueries({
                        queryKey: ["patient-invoices", inv.patient_id],
                      });
                      closePaymentPanel();
                      onClearAction?.();
                    }}
                    onPrint={
                      canPrintBillingDocs
                        ? (payments) => {
                            const last = payments.at(-1);
                            if (last) receiptMutation.mutate(last.id);
                          }
                        : undefined
                    }
                    autoFocus
                  />
                )}
                {canRecordPayment && (
                  <PaymentModal
                    opened={gatewayOpened}
                    onClose={gatewayHandlers.close}
                    amount={balance}
                    amountAccess={amountAccess}
                    invoiceId={invoiceId}
                    onSuccess={handleGatewayPaymentSuccess}
                  />
                )}
              </Stack>
            </Card>

            <Card id="billing-discounts" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>Discounts</Text>
                  {canCreate && inv.status === "draft" && (
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconDiscount2 size={14} />}
                      onClick={discountHandlers.toggle}
                    >
                      {discountOpened ? "Close" : "Add Discount"}
                    </Button>
                  )}
                </Group>
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
                            <Badge tone="neutral">{d.discount_type}</Badge>
                          </Table.Td>
                          <Table.Td>
                            {d.discount_type === "percentage"
                              ? `${d.discount_value}%`
                              : billingAmountText(d.discount_value, amountAccess)}
                          </Table.Td>
                          <Table.Td>{d.reason ?? "—"}</Table.Td>
                          {canCreate && (
                            <Table.Td>
                              <IconButton
                                tone="danger"
                                aria-label="Delete"
                                size="sm"
                                onClick={() =>
                                  confirmDestructive({
                                    title: "Remove discount",
                                    message:
                                      "Remove this discount from the invoice? Totals will be recalculated.",
                                    confirmLabel: "Remove discount",
                                    onConfirm: () => removeDiscountMutation.mutate(d.id),
                                  })
                                }
                              >
                                <IconTrash size={14} />
                              </IconButton>
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

                {canCreate && inv.status === "draft" && discountOpened && (
                  <Stack
                    component="form"
                    gap="xs"
                    onSubmit={handleSubmitDiscount(handleAddDiscount)}
                  >
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
                    <Button
                      tone="primary"
                      size="xs"
                      type="submit"
                      loading={addDiscountMutation.isPending}
                    >
                      Apply Discount
                    </Button>
                  </Stack>
                )}

                {inv.discount_amount !== "0" && inv.discount_amount !== "0.00" && (
                  <Text size="sm" fw={500} c="orange">
                    Total Discount: {billingAmountText(inv.discount_amount, amountAccess)}
                  </Text>
                )}
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Box className={classes.contextRail}>
            <Stack gap="sm">
              <Stack gap={2}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Billing workspace
                </Text>
                <Text size="sm" fw={700}>
                  {inv.invoice_number}
                </Text>
              </Stack>
              <Group gap="xs">
                <OperationalSignal
                  label={invoiceStatusLabel(t, displayStatus)}
                  shape={invoiceSignal.shape}
                  size="xs"
                  tone={invoiceSignal.tone}
                />
                <OperationalSignal
                  label={balanceSignalLabel}
                  shape={balanceSignal.shape}
                  size="xs"
                  tone={balanceSignal.tone}
                />
              </Group>
              <Divider />
              <SimpleGrid cols={{ base: 1, sm: 3, lg: 1 }}>
                <BillingSummaryMetric
                  label="Total"
                  value={billingAmountText(inv.total_amount, amountAccess)}
                />
                <BillingSummaryMetric
                  label="Paid"
                  value={billingAmountText(inv.paid_amount, amountAccess)}
                />
                <BillingSummaryMetric
                  label="Balance"
                  value={billingAmountText(balance, amountAccess)}
                  tone={amountAccess === "hidden" ? undefined : balance > 0 ? "danger" : "success"}
                />
              </SimpleGrid>
              <Divider />
              <Stack gap="xs">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Navigate
                </Text>
                <Button
                  tone="secondary"
                  size="xs"
                  component="a"
                  href="#billing-summary"
                  leftSection={<IconFileInvoice size={14} />}
                  fullWidth
                >
                  Summary
                </Button>
                <Button
                  tone="secondary"
                  size="xs"
                  component="a"
                  href="#billing-items"
                  leftSection={<IconTags size={14} />}
                  fullWidth
                >
                  Items
                </Button>
                <Button
                  tone="secondary"
                  size="xs"
                  component="a"
                  href="#billing-payments"
                  leftSection={<IconReceipt size={14} />}
                  fullWidth
                >
                  Payments
                </Button>
                <Button
                  tone="secondary"
                  size="xs"
                  component="a"
                  href="#billing-discounts"
                  leftSection={<IconDiscount2 size={14} />}
                  fullWidth
                >
                  Discounts
                </Button>
              </Stack>
              <Divider />
              <Stack gap="xs">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  {t("label.actions")}
                </Text>
                {canRecordPayment && (
                  <>
                    <Button
                      tone="primary"
                      size="xs"
                      leftSection={<IconCash size={14} />}
                      onClick={openPaymentForm}
                      fullWidth
                    >
                      {t("button.recordPayment")}
                    </Button>
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconCreditCard size={14} />}
                      onClick={gatewayHandlers.open}
                      fullWidth
                    >
                      {t("button.gateway")}
                    </Button>
                  </>
                )}
                {canCreate && inv.status === "draft" && (
                  <>
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={addItemHandlers.toggle}
                      fullWidth
                    >
                      Add Item
                    </Button>
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconDiscount2 size={14} />}
                      onClick={discountHandlers.toggle}
                      fullWidth
                    >
                      Add Discount
                    </Button>
                  </>
                )}
                <Button
                  tone="secondary"
                  size="xs"
                  leftSection={<IconShieldCheck size={14} />}
                  onClick={copayHandlers.toggle}
                  fullWidth
                >
                  {copayOpened ? "Close Co-pay" : "Calculate Co-pay"}
                </Button>
                <Button
                  tone="secondary"
                  size="xs"
                  leftSection={<IconFileInvoice size={14} />}
                  onClick={() => navigate(`/billing?tab=invoices&patient_id=${inv.patient_id}`)}
                  fullWidth
                >
                  Patient Ledger
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function BillingSummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  return (
    <Stack gap={1}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={700} c={tone}>
        {value}
      </Text>
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
    {
      key: "code",
      label: "Code",
      sortable: true,
      searchable: true,
      accessor: (row: ChargeMaster) => row.code,
      render: (row: ChargeMaster) => <Text fw={500}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      searchable: true,
      accessor: (row: ChargeMaster) => row.name,
      render: (row: ChargeMaster) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      searchable: true,
      accessor: (row: ChargeMaster) => row.category || "—",
      render: (row: ChargeMaster) => <Text size="sm">{row.category || "—"}</Text>,
    },
    {
      key: "base_price",
      label: "Price",
      sortable: true,
      sortValue: (row: ChargeMaster) => Number(row.base_price),
      accessor: (row: ChargeMaster) => row.base_price,
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
          <IconButton
            tone="danger"
            aria-label="Delete"
            onClick={() =>
              confirmDestructive({
                title: "Delete charge",
                message: `Delete charge "${row.name}" from the charge master? This cannot be undone.`,
                confirmLabel: "Delete charge",
                onConfirm: () => deleteMutation.mutate(row.id),
              })
            }
          >
            <IconTrash size={14} />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
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
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable
        columns={columns}
        data={charges}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search code, name or category"
        exportable
        exportFileName="charge-master"
      />
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
          tone="primary"
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
      sortable: true,
      searchable: true,
      accessor: (row: BillingPackage) => row.code,
      render: (row: BillingPackage) => <Text fw={500}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      searchable: true,
      accessor: (row: BillingPackage) => row.name,
      render: (row: BillingPackage) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "total_price",
      label: "Price",
      sortable: true,
      sortValue: (row: BillingPackage) => Number(row.total_price),
      accessor: (row: BillingPackage) => row.total_price,
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
          <IconButton
            tone="danger"
            aria-label="Delete"
            onClick={() =>
              confirmDestructive({
                title: "Delete package",
                message: `Delete package "${row.name}"? This cannot be undone.`,
                confirmLabel: "Delete package",
                onConfirm: () => deleteMutation.mutate(row.id),
              })
            }
          >
            <IconTrash size={14} />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
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
              <IconButton
                size="xs"
                tone="danger"
                aria-label="Delete"
                onClick={() => removePackageItem(index)}
              >
                <IconTrash size={12} />
              </IconButton>
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
              tone="secondary"
              size="xs"
              type="button"
              onClick={handleSubmitPackageItem(addPkgItem)}
            >
              + Item
            </Button>
          </Group>
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save Package
          </Button>
        </Stack>
      )}
      <DataTable
        columns={columns}
        data={packages}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search code or name"
        exportable
        exportFileName="billing-packages"
      />
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
    {
      key: "name",
      label: "Name",
      sortable: true,
      searchable: true,
      accessor: (row: RatePlan) => row.name,
      render: (row: RatePlan) => <Text fw={500}>{row.name}</Text>,
    },
    {
      key: "patient_category",
      label: "Category",
      sortable: true,
      searchable: true,
      accessor: (row: RatePlan) => row.patient_category ?? "All",
      render: (row: RatePlan) => <Text size="sm">{row.patient_category ?? "All"}</Text>,
    },
    {
      key: "is_default",
      label: "Default",
      render: (row: RatePlan) =>
        row.is_default ? (
          <Badge size="xs" tone="primary">
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
          <IconButton
            tone="danger"
            aria-label="Delete"
            onClick={() =>
              confirmDestructive({
                title: "Delete rate plan",
                message: `Delete rate plan "${row.name}"? This cannot be undone.`,
                confirmLabel: "Delete rate plan",
                onConfirm: () => deleteMutation.mutate(row.id),
              })
            }
          >
            <IconTrash size={14} />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
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
              <IconButton
                size="xs"
                tone="danger"
                aria-label="Delete"
                onClick={() => removeRatePlanItem(index)}
              >
                <IconTrash size={12} />
              </IconButton>
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
              tone="secondary"
              size="xs"
              type="button"
              onClick={handleSubmitRatePlanItem(addRpItem)}
            >
              + Override
            </Button>
          </Group>
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save Rate Plan
          </Button>
        </Stack>
      )}
      <DataTable
        columns={columns}
        data={plans}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search name or category"
        exportable
        exportFileName="rate-plans"
      />
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
      sortable: true,
      searchable: true,
      accessor: (row: BadDebtWriteOff) => row.write_off_number,
      render: (row: BadDebtWriteOff) => <Text fw={500}>{row.write_off_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      sortValue: (row: BadDebtWriteOff) => Number(row.amount),
      accessor: (row: BadDebtWriteOff) => row.amount,
      render: (row: BadDebtWriteOff) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      searchable: true,
      accessor: (row: BadDebtWriteOff) => row.reason,
      render: (row: BadDebtWriteOff) => <Text size="sm">{row.reason}</Text>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: BadDebtWriteOff) => row.status,
      render: (row: BadDebtWriteOff) => (
        <Badge
          tone={
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
              <IconButton
                tone="success"
                aria-label="Approve"
                size="sm"
                onClick={() =>
                  approveWriteOffMutation.mutate({ id: row.id, data: { approved: true } })
                }
              >
                <IconCheck size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label="Reject">
              <IconButton
                tone="danger"
                aria-label="Reject"
                size="sm"
                onClick={() =>
                  approveWriteOffMutation.mutate({ id: row.id, data: { approved: false } })
                }
              >
                <IconX size={14} />
              </IconButton>
            </Tooltip>
          </Group>
        ) : null,
    },
  ];

  const refundColumns = [
    {
      key: "refund_number",
      label: "Refund #",
      sortable: true,
      searchable: true,
      accessor: (row: Refund) => row.refund_number,
      render: (row: Refund) => <Text fw={500}>{row.refund_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      sortValue: (row: Refund) => Number(row.amount),
      accessor: (row: Refund) => row.amount,
      render: (row: Refund) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      searchable: true,
      accessor: (row: Refund) => row.reason,
      render: (row: Refund) => <Text size="sm">{row.reason}</Text>,
    },
    {
      key: "mode",
      label: "Mode",
      render: (row: Refund) => <Badge tone="neutral">{row.mode}</Badge>,
    },
    {
      key: "refunded_at",
      label: "Date",
      sortable: true,
      sortValue: (row: Refund) => new Date(row.refunded_at).getTime(),
      accessor: (row: Refund) => new Date(row.refunded_at).toLocaleDateString(),
      render: (row: Refund) => (
        <Text size="sm">{new Date(row.refunded_at).toLocaleDateString()}</Text>
      ),
    },
  ];

  const creditColumns = [
    {
      key: "credit_note_number",
      label: "CN #",
      sortable: true,
      searchable: true,
      accessor: (row: CreditNote) => row.credit_note_number,
      render: (row: CreditNote) => <Text fw={500}>{row.credit_note_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      sortValue: (row: CreditNote) => Number(row.amount),
      accessor: (row: CreditNote) => row.amount,
      render: (row: CreditNote) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      searchable: true,
      accessor: (row: CreditNote) => row.reason,
      render: (row: CreditNote) => <Text size="sm">{row.reason}</Text>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: CreditNote) => row.status,
      render: (row: CreditNote) => (
        <Badge
          tone={row.status === "active" ? "success" : row.status === "used" ? "primary" : "danger"}
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
            tone="secondary"
            size="compact-xs"
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
            tone="primary"
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
              <Button tone="primary" size="xs" type="submit" loading={refundMutation.isPending}>
                Process Refund
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={refundColumns}
        data={refunds}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search refund # or reason"
        exportable
        exportFileName="refunds"
      />

      <Text fw={600} mt="lg">
        Credit Notes
      </Text>
      {canCreate && (
        <>
          <Button
            tone="primary"
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
              <Button tone="primary" size="xs" type="submit" loading={creditMutation.isPending}>
                Issue Credit Note
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={creditColumns}
        data={creditNotes}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search CN # or reason"
        exportable
        exportFileName="credit-notes"
      />

      <Text fw={600} mt="lg">
        Write-Offs
      </Text>
      {canWriteOff && (
        <>
          <Button
            tone="primary"
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
              <Button tone="primary" size="xs" type="submit" loading={writeOffMutation.isPending}>
                Submit Write-Off
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={writeOffColumns}
        data={writeOffs}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search WO # or reason"
        exportable
        exportFileName="write-offs"
      />
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
      sortable: true,
      searchable: true,
      accessor: (row: TpaRateCard) => row.tpa_name,
      render: (row: TpaRateCard) => <Text fw={500}>{row.tpa_name}</Text>,
    },
    {
      key: "insurance_provider",
      label: "Provider",
      sortable: true,
      searchable: true,
      accessor: (row: TpaRateCard) => row.insurance_provider,
      render: (row: TpaRateCard) => <Text size="sm">{row.insurance_provider}</Text>,
    },
    {
      key: "scheme_type",
      label: "Scheme",
      sortable: true,
      accessor: (row: TpaRateCard) => row.scheme_type ?? "—",
      render: (row: TpaRateCard) => <Badge tone="neutral">{row.scheme_type ?? "—"}</Badge>,
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
        <Badge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Yes" : "No"}</Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: TpaRateCard) =>
        canCreate ? (
          <Tooltip label="Delete">
            <IconButton
              tone="danger"
              aria-label="Delete"
              size="sm"
              onClick={() =>
                confirmDestructive({
                  title: "Delete TPA rate card",
                  message:
                    "Delete this TPA rate card? Insurance billing will fall back to standard rates.",
                  confirmLabel: "Delete rate card",
                  onConfirm: () => deleteTpaMutation.mutate(row.id),
                })
              }
            >
              <IconTrash size={14} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  const claimStatusColors: Record<string, BadgeTone> = {
    initiated: "neutral",
    pre_auth_requested: "primary",
    pre_auth_approved: "success",
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
      sortable: true,
      searchable: true,
      accessor: (row: InsuranceClaim) => row.insurance_provider,
      render: (row: InsuranceClaim) => <Text fw={500}>{row.insurance_provider}</Text>,
    },
    {
      key: "claim_type",
      label: "Type",
      sortable: true,
      searchable: true,
      accessor: (row: InsuranceClaim) => row.claim_type,
      render: (row: InsuranceClaim) => <Badge tone="neutral">{row.claim_type}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: InsuranceClaim) => row.status.replace(/_/g, " "),
      render: (row: InsuranceClaim) => (
        <Badge tone={claimStatusColors[row.status] ?? "neutral"}>
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "pre_auth_amount",
      label: "Pre-Auth",
      sortable: true,
      sortValue: (row: InsuranceClaim) => Number(row.pre_auth_amount ?? 0),
      accessor: (row: InsuranceClaim) => (row.pre_auth_amount ? `₹${row.pre_auth_amount}` : "—"),
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
            tone="secondary"
            size="compact-xs"
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
            tone="primary"
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
              <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
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
        searchable
        searchPlaceholder="Search provider or claim type"
        exportable
        exportFileName="insurance-claims"
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
            tone="primary"
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
              <Button tone="primary" size="xs" type="submit" loading={tpaMutation.isPending}>
                Save TPA Rate Card
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={tpaColumns}
        data={tpaCards}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search TPA or provider"
        exportable
        exportFileName="tpa-rate-cards"
      />
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
            <Badge size="sm" tone="neutral">
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
              <Badge tone="neutral">{callbacks.length}</Badge>
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
                          tone={cb.verification_status === "verified" ? "success" : "warning"}
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
      toast.error("Failed to update setting", { title: "Error" });
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
      toast.success("Patient advance recorded", { title: "Advance created" });
      setShowForm(false);
      resetAdvance(advanceDefaults);
    },
    onError: () => toast.error("Failed to create advance", { title: "Error" }),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdjustAdvanceRequest }) =>
      billingService.adjustAdvance(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["advances"] });
      toast.success("Advance adjusted against invoice", { title: "Adjusted" });
      setAdjustId(null);
      resetAdjustment(adjustmentDefaults);
    },
    onError: () => toast.error("Failed to adjust advance", { title: "Error" }),
  });

  const refundMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RefundAdvanceRequest }) =>
      billingService.refundAdvance(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["advances"] });
      toast.success("Advance refunded", { title: "Refunded" });
      setRefundId(null);
      resetAdvanceRefund(advanceRefundDefaults);
    },
    onError: () => toast.error("Failed to refund advance", { title: "Error" }),
  });

  const columns = [
    {
      key: "advance_number",
      label: "Advance #",
      sortable: true,
      searchable: true,
      accessor: (row: PatientAdvance) => row.advance_number,
      render: (row: PatientAdvance) => <Text fw={600}>{row.advance_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      sortValue: (row: PatientAdvance) => Number(row.amount),
      accessor: (row: PatientAdvance) => row.amount,
      render: (row: PatientAdvance) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "balance",
      label: "Balance",
      sortable: true,
      sortValue: (row: PatientAdvance) => Number(row.balance),
      accessor: (row: PatientAdvance) => row.balance,
      render: (row: PatientAdvance) => (
        <Text size="sm" c={Number(row.balance) > 0 ? "success" : "dimmed"}>
          ₹{row.balance}
        </Text>
      ),
    },
    {
      key: "purpose",
      label: "Purpose",
      searchable: true,
      accessor: (row: PatientAdvance) => row.purpose,
      render: (row: PatientAdvance) => <Badge tone="neutral">{row.purpose}</Badge>,
    },
    {
      key: "payment_mode",
      label: "Mode",
      render: (row: PatientAdvance) => <Text size="sm">{row.payment_mode}</Text>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: PatientAdvance) => row.status.replace(/_/g, " "),
      render: (row: PatientAdvance) => (
        <Badge tone={toBadgeTone(statusColor(row.status))}>{row.status.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      sortable: true,
      sortValue: (row: PatientAdvance) => new Date(row.created_at).getTime(),
      accessor: (row: PatientAdvance) => new Date(row.created_at).toLocaleDateString(),
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
              <Button tone="secondary" size="compact-xs" onClick={() => setAdjustId(row.id)}>
                Adjust
              </Button>
            )}
            {canRefund && (
              <Button tone="secondary" size="compact-xs" onClick={() => setRefundId(row.id)}>
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
            tone="primary"
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
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save Advance
          </Button>
        </Stack>
      )}

      <DataTable
        columns={columns}
        data={advances}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search advance # or purpose"
        exportable
        exportFileName="patient-advances"
      />

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
          <Button tone="primary" type="submit" loading={adjustMutation.isPending}>
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
          <Button tone="primary" type="submit" loading={refundMutation.isPending}>
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
      toast.success("Corporate client created", { title: "Created" });
      setShowForm(false);
      reset(corporateDefaults);
    },
    onError: () => toast.error("Failed to create corporate client", { title: "Error" }),
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
      sortable: true,
      searchable: true,
      accessor: (row: CorporateClient) => row.code,
      render: (row: CorporateClient) => <Text fw={600}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      searchable: true,
      accessor: (row: CorporateClient) => row.name,
      render: (row: CorporateClient) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "gst_number",
      label: "GSTIN",
      searchable: true,
      accessor: (row: CorporateClient) => row.gst_number ?? "—",
      render: (row: CorporateClient) => <Text size="sm">{row.gst_number ?? "—"}</Text>,
    },
    {
      key: "credit_limit",
      label: "Credit Limit",
      sortable: true,
      sortValue: (row: CorporateClient) => Number(row.credit_limit),
      accessor: (row: CorporateClient) => row.credit_limit,
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
          <IconButton
            tone="default"
            aria-label="View Details"
            onClick={() => {
              setSelectedId(row.id);
              openDetail();
            }}
          >
            <IconEye size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
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
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save Client
          </Button>
        </Stack>
      )}

      <DataTable
        columns={columns}
        data={corporates}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search code, name or GSTIN"
        exportable
        exportFileName="corporate-clients"
      />

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
        <Badge size="lg" tone={corporate.is_active ? "success" : "danger"}>
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
          <Button tone="secondary" size="xs" onClick={toggleEdit}>
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
              <Button tone="primary" size="xs" type="submit" loading={updateMutation.isPending}>
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
            <Table.Th>Patient</Table.Th>
            <Table.Th>Employee ID</Table.Th>
            <Table.Th>Department</Table.Th>
            <Table.Th>Enrolled</Table.Th>
            {canUpdate && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {enrollments.map((e: CorporateEnrollment) => (
            <Table.Tr key={e.id}>
              <Table.Td>
                <PatientNameCell patientId={e.patient_id} showUhid={false} />
              </Table.Td>
              <Table.Td>{e.employee_id ?? "—"}</Table.Td>
              <Table.Td>{e.department ?? "—"}</Table.Td>
              <Table.Td>{new Date(e.enrolled_at).toLocaleDateString()}</Table.Td>
              {canUpdate && (
                <Table.Td>
                  <IconButton
                    tone="danger"
                    aria-label="Delete"
                    size="sm"
                    onClick={() => unenrollMutation.mutate(e.id)}
                  >
                    <IconTrash size={14} />
                  </IconButton>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {canUpdate && (
        <>
          <Button
            tone="secondary"
            size="xs"
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
              <Button tone="primary" size="xs" type="submit" loading={enrollMutation.isPending}>
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
                  <Badge tone={statusColors[inv.status] ?? "neutral"}>
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

// Indian currency note/coin denominations, high to low.
const CASH_DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

function todayIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
}

function DenominationGrid({
  counts,
  onChange,
}: {
  counts: Record<string, number>;
  onChange: (denom: number, count: number) => void;
}) {
  return (
    <Stack gap={4}>
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
        Cash denomination count
      </Text>
      <Table withTableBorder={false} verticalSpacing={2}>
        <Table.Tbody>
          {CASH_DENOMINATIONS.map((denom) => {
            const count = counts[String(denom)] ?? 0;
            return (
              <Table.Tr key={denom}>
                <Table.Td w={70}>
                  <Text size="sm" ff="monospace">
                    ₹{denom}
                  </Text>
                </Table.Td>
                <Table.Td w={110}>
                  <NumberInput
                    size="xs"
                    min={0}
                    value={count}
                    hideControls
                    onChange={(value) =>
                      onChange(denom, Math.max(0, Math.floor(Number(value) || 0)))
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" ff="monospace">
                    = ₹{money(denom * count)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function DayCloseTab() {
  const queryClient = useQueryClient();
  const canVerify = useHasPermission(P.BILLING.DAY_CLOSE_VERIFY);
  const [showForm, setShowForm] = useState(false);
  const [closeDate, setCloseDate] = useState(todayIso());
  const [counterId, setCounterId] = useState("");
  const [shift, setShift] = useState("");
  const [denomCounts, setDenomCounts] = useState<Record<string, number>>({});
  const [actualCard, setActualCard] = useState<number | string>(0);
  const [actualUpi, setActualUpi] = useState<number | string>(0);
  const [notes, setNotes] = useState("");
  const [verifyTarget, setVerifyTarget] = useState<DayEndClose | null>(null);
  const [verifyNotes, setVerifyNotes] = useState("");

  const countedCash = CASH_DENOMINATIONS.reduce(
    (sum, denom) => sum + denom * (denomCounts[String(denom)] ?? 0),
    0,
  );

  const resetForm = () => {
    setCloseDate(todayIso());
    setCounterId("");
    setShift("");
    setDenomCounts({});
    setActualCard(0);
    setActualUpi(0);
    setNotes("");
  };

  const { data: dayCloses = [], isLoading } = useQuery({
    queryKey: ["day-closes"],
    queryFn: () => billingService.listDayCloses(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDayCloseRequest) => billingService.createDayClose(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["day-closes"] });
      setShowForm(false);
      resetForm();
      toast.success("Tally recorded.", { title: "Day closed" });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Error" }),
  });

  const submitDayClose = () => {
    createMutation.mutate({
      close_date: closeDate.trim(),
      actual_cash: countedCash,
      notes: notes.trim() || undefined,
      counter_id: counterId.trim() || undefined,
      shift: shift.trim() || undefined,
      denominations: Object.fromEntries(
        Object.entries(denomCounts).filter(([, count]) => count > 0),
      ),
      actual_card: typeof actualCard === "number" ? actualCard : Number(actualCard) || 0,
      actual_upi: typeof actualUpi === "number" ? actualUpi : Number(actualUpi) || 0,
    });
  };

  const verifyMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      billingService.verifyDayClose(id, { verification_notes: note.trim() || undefined }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["day-closes"] });
      setVerifyTarget(null);
      setVerifyNotes("");
      if (result.status === "verified") {
        toast.success("Tally balanced and signed off.", { title: "Verified" });
      } else {
        toast.warning("Variance recorded for follow-up.", { title: "Logged as discrepancy" });
      }
    },
  });

  const varianceText = (value: string) => {
    const diff = Number(value);
    return (
      <Text size="sm" fw={600} c={diff === 0 ? "success" : "danger"} ff="monospace">
        {diff > 0 ? "+" : ""}₹{money(value)}
      </Text>
    );
  };

  const columns = [
    {
      key: "close_date",
      label: "Date",
      sortable: true,
      searchable: true,
      sortValue: (row: DayEndClose) => new Date(row.close_date).getTime(),
      accessor: (row: DayEndClose) => row.close_date,
      render: (row: DayEndClose) => (
        <Stack gap={0}>
          <Text fw={600} size="sm">
            {row.close_date}
          </Text>
          {(row.counter_id || row.shift) && (
            <Text size="xs" c="dimmed">
              {[row.counter_id, row.shift].filter(Boolean).join(" · ")}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "cash",
      label: "Cash (exp / act)",
      render: (row: DayEndClose) => (
        <Text size="sm" ff="monospace">
          ₹{money(row.expected_cash)} / ₹{money(row.actual_cash)}
        </Text>
      ),
    },
    {
      key: "cash_difference",
      label: "Cash Δ",
      render: (row: DayEndClose) => varianceText(row.cash_difference),
    },
    {
      key: "card_difference",
      label: "Card Δ",
      render: (row: DayEndClose) => varianceText(row.card_difference),
    },
    {
      key: "upi_difference",
      label: "UPI Δ",
      render: (row: DayEndClose) => varianceText(row.upi_difference),
    },
    {
      key: "total_collected",
      label: "Collected",
      sortable: true,
      sortValue: (row: DayEndClose) => Number(row.total_collected),
      accessor: (row: DayEndClose) => row.total_collected,
      render: (row: DayEndClose) => (
        <Text size="sm" ff="monospace">
          ₹{money(row.total_collected)}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: DayEndClose) => row.status,
      render: (row: DayEndClose) => (
        <Badge tone={toBadgeTone(statusColor(row.status))}>{row.status}</Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: DayEndClose) =>
        row.status === "open" && canVerify ? (
          <Button
            tone="secondary"
            size="compact-xs"
            leftSection={<IconCheck size={14} />}
            onClick={() => {
              setVerifyTarget(row);
              setVerifyNotes("");
            }}
          >
            Verify
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Group>
        <Button
          tone="primary"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) resetForm();
          }}
        >
          {showForm ? "Cancel" : "Create day close"}
        </Button>
      </Group>

      {showForm && (
        <Card withBorder>
          <Stack gap="sm">
            <Group grow>
              <TextInput
                label="Close date"
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.currentTarget.value)}
              />
              <TextInput
                label="Counter"
                placeholder="e.g. OPD-1"
                value={counterId}
                onChange={(e) => setCounterId(e.currentTarget.value)}
              />
              <TextInput
                label="Shift"
                placeholder="e.g. Morning"
                value={shift}
                onChange={(e) => setShift(e.currentTarget.value)}
              />
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <DenominationGrid
                counts={denomCounts}
                onChange={(denom, count) =>
                  setDenomCounts((prev) => ({ ...prev, [String(denom)]: count }))
                }
              />
              <Stack gap="sm">
                <Card withBorder bg="var(--fc-panel, #f7f8f6)">
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>
                      Counted cash
                    </Text>
                    <Text size="lg" fw={700} ff="monospace">
                      ₹{money(countedCash)}
                    </Text>
                  </Group>
                </Card>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Settlement report (card / UPI)
                </Text>
                <NumberInput
                  label="Card settled (POS batch)"
                  min={0}
                  decimalScale={2}
                  value={actualCard}
                  onChange={setActualCard}
                />
                <NumberInput
                  label="UPI settled (bank report)"
                  min={0}
                  decimalScale={2}
                  value={actualUpi}
                  onChange={setActualUpi}
                />
                <Textarea
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.currentTarget.value)}
                />
                <Button tone="primary" loading={createMutation.isPending} onClick={submitDayClose}>
                  Submit day close · counted ₹{money(countedCash)}
                </Button>
              </Stack>
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={dayCloses}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search by close date"
        exportable
        exportFileName="day-end-close"
      />

      <Modal
        opened={verifyTarget !== null}
        onClose={() => setVerifyTarget(null)}
        title="Verify day close"
        size="md"
      >
        {verifyTarget && (
          <Stack gap="sm">
            <Text size="sm">
              {verifyTarget.close_date}
              {verifyTarget.counter_id ? ` · ${verifyTarget.counter_id}` : ""} — cash variance{" "}
              <Text
                span
                fw={700}
                c={Number(verifyTarget.cash_difference) === 0 ? "success" : "danger"}
              >
                ₹{money(verifyTarget.cash_difference)}
              </Text>
              . Verifying balanced totals signs off; any variance is logged as a discrepancy.
            </Text>
            <Textarea
              label="Verification notes"
              placeholder="Explain any variance (denomination miscount, pending UPI, …)"
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button tone="ghost" onClick={() => setVerifyTarget(null)}>
                Cancel
              </Button>
              <Button
                tone="primary"
                loading={verifyMutation.isPending}
                onClick={() => verifyMutation.mutate({ id: verifyTarget.id, note: verifyNotes })}
              >
                Sign off
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
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
        <Badge size="sm" tone={toBadgeTone(statusColor(row.action))}>
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
      toast.success("Credit patient added", { title: "Created" });
    },
    onError: () => toast.error("Failed to create", { title: "Error" }),
  });

  const updateMut = useMutation({
    mutationFn: (data: { id: string; req: UpdateCreditPatientRequest }) =>
      billingService.updateCreditPatient(data.id, data.req),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-patients"] });
      close();
      setEditId(null);
      reset(creditPatientDefaults);
      toast.success("Credit patient updated", { title: "Updated" });
    },
    onError: () => toast.error("Update failed", { title: "Error" }),
  });

  const creditStatusColors: Record<string, BadgeTone> = {
    active: "success",
    overdue: "danger",
    suspended: "warning",
    closed: "neutral",
  };

  const columns = [
    {
      key: "patient_id",
      label: "Patient",
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (r: CreditPatient) => r.patient_id,
      fieldKind: "identifier",
      hiddenLabel: "Patient restricted",
      render: (r: CreditPatient) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "status",
      label: "Status",
      render: (r: CreditPatient) => (
        <Badge size="sm" tone={creditStatusColors[r.status] ?? "neutral"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "credit_limit",
      label: "Limit",
      fieldAccessKey: "billing.amount",
      accessor: (r: CreditPatient) => r.credit_limit,
      fieldKind: "money",
      render: (r: CreditPatient) => <Text size="sm">₹{r.credit_limit.toLocaleString()}</Text>,
    },
    {
      key: "current_balance",
      label: "Balance",
      fieldAccessKey: "billing.amount",
      accessor: (r: CreditPatient) => r.current_balance,
      fieldKind: "money",
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
              <IconButton
                tone="default"
                aria-label="Edit"
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
              </IconButton>
            ),
          },
        ]
      : []),
  ] satisfies Column<CreditPatient>[];

  const agingColumns = [
    {
      key: "patient_id",
      label: "Patient",
      fieldAccessKeys: PATIENT_NAME_FIELD_ACCESS_KEYS,
      accessor: (r: CreditAgingRow) => r.patient_name ?? r.patient_id,
      fieldKind: "name",
      hiddenLabel: "Patient restricted",
      render: (r: CreditAgingRow) =>
        r.patient_name ? (
          <Text size="sm">{r.patient_name}</Text>
        ) : (
          <PatientNameCell patientId={r.patient_id} showUhid={false} />
        ),
    },
    {
      key: "credit_limit",
      label: "Credit Limit",
      fieldAccessKey: "billing.amount",
      accessor: (r: CreditAgingRow) => r.credit_limit,
      fieldKind: "money",
      render: (r: CreditAgingRow) => <Text size="sm">₹{r.credit_limit.toLocaleString()}</Text>,
    },
    {
      key: "current_balance",
      label: "Balance",
      fieldAccessKey: "billing.amount",
      accessor: (r: CreditAgingRow) => r.current_balance,
      fieldKind: "money",
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
        <Badge size="sm" tone={creditStatusColors[r.status] ?? "neutral"}>
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
  ] satisfies Column<CreditAgingRow>[];

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
          <Button tone="secondary" onClick={() => setShowAging(!showAging)}>
            {showAging ? "Hide Aging" : "Show Aging Report"}
          </Button>
        </Group>
        {canManage && (
          <Button
            tone="primary"
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
          <Button tone="primary" type="submit" loading={createMut.isPending || updateMut.isPending}>
            {editId ? "Update" : "Create"}
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
