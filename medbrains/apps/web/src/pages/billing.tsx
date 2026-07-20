import { Stack } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ClinicalEventProvider, PageHeader } from "@/components";
import { Alert, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { InvoiceDetail } from "./billing/invoice-detail";
import { BillingPageInner } from "./billing/page-inner";
import { billingInvoiceActionFromSearchParams } from "./billing-workspace";

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
