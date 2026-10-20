import { Stack, Text } from "@mantine/core";
import type {
  CapabilitiesView,
  DueBill,
  PaymentGatewayTransaction,
  PosSaleView,
  UpiQrResponse,
} from "@medbrains/types";
import { IconQrcode } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { LiveUpiQrPanel } from "@/components/LiveUpiQrPanel";
import { OnlineCheckoutPanel } from "@/components/OnlineCheckoutPanel";
import { UpiQrCode } from "@/components/UpiQrCode";
import { Alert, Button, Input } from "@/components/ui";
import { VirtualAccountPanel } from "@/components/VirtualAccountPanel";
import { paymentsService } from "@/services/payments.service";
import { CardTerminalPanel } from "../CardTerminalPanel";
import { approvedRupees } from "../cardSale";
import { CashTender } from "./CashTender";
import { rupees, type TenderPart } from "./collect-math";
import { DepositTender } from "./DepositTender";
import { LinkTender } from "./LinkTender";
import type { TenderTile } from "./tender-tiles";

export interface TenderBodyProps {
  tile: TenderTile;
  amount: number;
  patientId: string | null;
  patientName?: string;
  /** The one bill in scope, when there is exactly one. */
  invoiceId?: string;
  bills: DueBill[];
  isSale: boolean;
  canUseGateway: boolean;
  /** This counter's online provider and the hospital's fallback. */
  capabilities?: CapabilitiesView;
  stationId: string | null;
  tendered: number | string;
  onTendered: (value: number | string) => void;
  reference: string;
  onReference: (value: string) => void;
  /** A machine or gateway approved money: it is a part of this collection. */
  onApproved: (part: TenderPart) => void;
  onUseTile: (tile: TenderTile) => void;
  onMoneyPosted: () => void;
}

const fromCard = (sale: PosSaleView): TenderPart => ({
  id: sale.transaction_id,
  mode: sale.method === "upi" ? "upi" : "card",
  amount: approvedRupees(sale),
  reference: sale.reference ?? sale.rrn ?? sale.transaction_id,
  gatewayTransactionId: sale.transaction_id,
  label: sale.terminal_label,
});

const fromGateway = (txn: PaymentGatewayTransaction, label: string): TenderPart => ({
  id: txn.id,
  mode: txn.payment_method === "card" ? "card" : "upi",
  amount: Number(txn.amount),
  reference: txn.gateway_payment_id ?? txn.id,
  gatewayTransactionId: txn.id,
  label,
});

function UpiTender(props: TenderBodyProps) {
  const { amount, invoiceId, isSale, canUseGateway, capabilities } = props;
  const [qr, setQr] = useState<UpiQrResponse | null>(null);
  // Only a provider that makes dynamic QRs is asked for one; otherwise the
  // hospital's own UPI ID QR is shown without a warning about it.
  const live = Boolean(
    capabilities?.active?.configured && capabilities.active.capabilities.dynamic_qr,
  );
  const make = useMutation({
    mutationFn: () =>
      paymentsService.generateUpiQr({
        amount,
        invoice_id: isSale ? undefined : invoiceId,
        description: props.patientName ? `Payment for ${props.patientName}` : "Hospital payment",
        live,
        station_id: props.stationId ?? undefined,
      }),
    onSuccess: setQr,
  });
  return (
    <Stack gap="sm">
      {canUseGateway && !qr && (
        <Button
          tone="secondary"
          leftSection={<IconQrcode size={16} />}
          loading={make.isPending}
          disabled={amount <= 0}
          onClick={() => make.mutate()}
        >
          Show QR for {rupees(amount)}
        </Button>
      )}
      {make.isError && (
        <Alert tone="warning" title="QR not made" data-testid="alert-upi-qr-error">
          {make.error.message} Take the counter UPI and enter the UTR, or use another way.
        </Alert>
      )}
      {qr && qr.source !== "upi_id" && (
        <LiveUpiQrPanel
          qr={qr}
          amountText={rupees(qr.amount)}
          onCaptured={(txn) => props.onApproved(fromGateway(txn, "UPI QR"))}
          onRenew={() => {
            setQr(null);
            make.mutate();
          }}
        />
      )}
      {qr?.source === "upi_id" && (
        <Stack gap="xs" align="center">
          {qr.fallback_reason && (
            <Alert tone="warning" title="Showing the hospital's own UPI QR">
              {qr.fallback_reason}. It does not confirm itself — enter the UTR the patient shows.
            </Alert>
          )}
          <UpiQrCode value={qr.upi_uri ?? ""} />
          <Text size="xs" c="dimmed">
            VPA {qr.vpa}
          </Text>
        </Stack>
      )}
      {(!qr || qr.source === "upi_id") && (
        <Input
          label="UTR / reference"
          description="Paid to the counter's own UPI QR: the UTR from the patient's app"
          value={props.reference}
          onChange={(e) => props.onReference(e.currentTarget.value)}
        />
      )}
    </Stack>
  );
}

function CardTender(props: TenderBodyProps) {
  return (
    <Stack gap="sm">
      <CardTerminalPanel
        amount={props.amount}
        invoiceId={props.isSale ? undefined : props.invoiceId}
        disabled={props.amount <= 0}
        onApproved={(sale) => props.onApproved(fromCard(sale))}
        onUseOtherMode={() => props.onUseTile("cash")}
      />
      <Input
        label="Approval code"
        description="Only for a card run on a standalone machine: from the slip"
        value={props.reference}
        onChange={(e) => props.onReference(e.currentTarget.value)}
      />
    </Stack>
  );
}

function CreditTender({ isSale, invoiceId, patientId }: TenderBodyProps) {
  const navigate = useNavigate();
  if (isSale) {
    return (
      <Text size="sm" c="dimmed">
        The amount goes on the patient&apos;s account and is settled on their bill.
      </Text>
    );
  }
  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        Insurance and corporate credit are settled on the bill: pre-authorisation, the payer split
        and the claim.
      </Text>
      <Button
        tone="secondary"
        onClick={() =>
          navigate(invoiceId ? `/billing/invoices/${invoiceId}` : `/patients/${patientId}`)
        }
      >
        {invoiceId ? "Open the bill" : "Open the patient's bills"}
      </Button>
    </Stack>
  );
}

/** What to do for the chosen way of paying. */
export function TenderBody(props: TenderBodyProps) {
  switch (props.tile) {
    case "cash":
      return (
        <CashTender amount={props.amount} tendered={props.tendered} onTendered={props.onTendered} />
      );
    case "card":
      return <CardTender {...props} />;
    case "upi":
      return <UpiTender {...props} />;
    case "online":
      return (
        <Stack gap="sm">
          <OnlineCheckoutPanel
            amount={props.amount}
            formatAmount={rupees}
            invoiceId={props.invoiceId}
            patientName={props.patientName}
            stationId={props.stationId}
            providerLabel={props.capabilities?.active?.label}
            disabled={props.amount <= 0}
            fallbacks={["upi_qr", "cash"]}
            onCaptured={(txn) => props.onApproved(fromGateway(txn, "Online"))}
            onUseOtherMode={(mode) => props.onUseTile(mode === "upi_qr" ? "upi" : "cash")}
          />
          {props.invoiceId && (
            <VirtualAccountPanel
              invoiceId={props.invoiceId}
              amount={props.amount}
              patientName={props.patientName}
              onSettled={props.onMoneyPosted}
            />
          )}
        </Stack>
      );
    case "advance":
      return (
        <DepositTender
          patientId={props.patientId}
          bills={props.bills}
          amount={props.amount}
          onApplied={props.onMoneyPosted}
        />
      );
    case "credit":
      return <CreditTender {...props} />;
    case "link":
      return <LinkTender {...props} />;
  }
}
