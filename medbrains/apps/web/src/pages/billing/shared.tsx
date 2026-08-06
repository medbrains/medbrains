// Shared billing helpers — pure formatting, status/label, print, and invoice utilities
// extracted from billing.tsx so tab components can be split into their own files.

import type {
  FieldAccessLevel,
  Invoice,
  InvoicePrintData,
  ReceiptPrintData,
} from "@medbrains/types";
import {
  billingInvoiceBalance,
  type billingInvoiceBalanceSignal,
  billingInvoiceBalanceSignalLabel,
  billingInvoiceBalanceSignalLabelKey,
  billingInvoiceDisplayStatus,
  billingInvoiceIsPayable,
  billingInvoiceStatusLabelKey,
  billingInvoiceStatusLabel as sharedBillingInvoiceStatusLabel,
} from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { QRCodeSVG } from "qrcode.react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { useTranslation } from "react-i18next";
import type { BadgeTone } from "@/components/ui";
import { buildCopyPrintHtml, copyPrintStyles, PRINT_COPY_PACKETS } from "@/utils/printCopies";

export const toBadgeTone = (color: string | undefined): BadgeTone => {
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

export const statusColors: Record<string, BadgeTone> = {
  draft: "neutral",
  issued: "primary",
  partially_paid: "warning",
  paid: "success",
  cancelled: "danger",
  refunded: "warning",
};

export const BILLING_INVOICE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const BILLING_TAB_VALUES = [
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

export function isBillingTab(value: string | null): value is (typeof BILLING_TAB_VALUES)[number] {
  return Boolean(value && (BILLING_TAB_VALUES as readonly string[]).includes(value));
}

export function isInvoiceStatus(
  value: string | null,
): value is (typeof BILLING_INVOICE_STATUS_OPTIONS)[number]["value"] {
  return Boolean(value && BILLING_INVOICE_STATUS_OPTIONS.some((option) => option.value === value));
}

export type BillingTranslate = ReturnType<typeof useTranslation>["t"];

export function billingSignalLabel(
  t: BillingTranslate,
  key: string | null,
  fallback: string,
): string {
  return key ? t(key, { defaultValue: fallback }) : fallback;
}

export function invoiceStatusLabel(t: BillingTranslate, status: string): string {
  return billingSignalLabel(
    t,
    billingInvoiceStatusLabelKey(status),
    sharedBillingInvoiceStatusLabel(status),
  );
}

export function invoiceBalanceLabel(
  t: BillingTranslate,
  signal: ReturnType<typeof billingInvoiceBalanceSignal>,
) {
  return billingSignalLabel(
    t,
    billingInvoiceBalanceSignalLabelKey(signal),
    billingInvoiceBalanceSignalLabel(signal),
  );
}

export function money(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface BillingDisplayAccess {
  amount: FieldAccessLevel;
  patientAddress: FieldAccessLevel;
  patientName: FieldAccessLevel;
  uhid: FieldAccessLevel;
}

export function billingPatientNameText(
  patientName: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, patientName, "name");
  return displayValue === "—" ? "Patient" : displayValue;
}

export function billingPatientIdentifierText(
  identifier: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, identifier, "identifier");
  return displayValue === "—" ? "No UHID" : displayValue;
}

export function billingPatientAddressText(
  address: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, address, "text");
  return displayValue === "—" ? "No address" : displayValue;
}

export function billingAmountText(
  value: number | string | null | undefined,
  access: FieldAccessLevel,
): string {
  const formatted = `₹${money(value)}`;
  return access === "edit" || access === "view"
    ? formatted
    : fieldAccessText(access, formatted, "amount");
}

export function escapeBillingPrintText(value: unknown): string {
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

export function billingPrintDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("en-IN");
}

export const BILLING_INVOICE_PRINT_COPIES = PRINT_COPY_PACKETS.billingInvoice;
export const BILLING_RECEIPT_PRINT_COPIES = PRINT_COPY_PACKETS.billingReceipt;

/**
 * The QR a patient can pay from.
 *
 * It encodes the UPI payment URI, not a link into this app, so the reader is
 * the patient's own banking app — no new route to build and nothing to log in
 * to. Any UPI app fills in payee, amount and the invoice reference from it.
 *
 * Rendered from `qrcode.react`, the same dependency the prescription print
 * uses, into static markup because this print path writes an HTML string into
 * a popup rather than mounting React.
 */
function invoicePayQrHtml(upiUri: string): string {
  const svg = renderToStaticMarkup(
    createElement(QRCodeSVG, {
      value: upiUri,
      size: 128,
      // A printed bill gets scanned off paper that has been folded and handled.
      level: "M",
    }),
  );
  return `
    <section class="pay-qr">
      ${svg}
      <div class="pay-qr-note">Scan with any UPI app to pay this bill</div>
    </section>
  `;
}

export function printInvoicePacket(
  data: InvoicePrintData,
  access: BillingDisplayAccess,
  /**
   * Omitted when the bill is settled, when amounts are masked for this user, or
   * when the UPI lookup failed — a payment QR must never be the reason a bill
   * cannot be printed.
   */
  upiUri?: string,
) {
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
      ${upiUri ? invoicePayQrHtml(upiUri) : ""}
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
          .pay-qr { margin-top: 18px; text-align: center; }
          .pay-qr-note { font-size: 11px; margin-top: 4px; }
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

export function printReceiptPacket(data: ReceiptPrintData, access: BillingDisplayAccess) {
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

export function invoiceBalance(invoice: Invoice): number {
  return billingInvoiceBalance(invoice.total_amount, invoice.paid_amount);
}

export function invoiceDisplayStatus(invoice: Invoice): Invoice["status"] {
  return billingInvoiceDisplayStatus(invoice.status, invoice.total_amount, invoice.paid_amount);
}

export function invoiceIsPayable(invoice: Invoice): boolean {
  return billingInvoiceIsPayable(invoice.status, invoice.total_amount, invoice.paid_amount);
}
