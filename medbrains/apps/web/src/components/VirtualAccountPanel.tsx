import { Alert, CopyButton, Group, Loader, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBuildingBank, IconCheck, IconCopy } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";

interface VaReceiver {
  entity?: string;
  account_number?: string;
  ifsc?: string;
  name?: string;
  address?: string;
}

/** RazorpayX stores the VA receivers (bank account + UPI VPA) in txn.notes. */
function parseReceivers(notes: unknown): VaReceiver[] {
  if (Array.isArray(notes)) return notes as VaReceiver[];
  if (notes && typeof notes === "object") {
    const maybe = (notes as { receivers?: unknown }).receivers;
    if (Array.isArray(maybe)) return maybe as VaReceiver[];
  }
  return [];
}

interface Props {
  invoiceId: string;
  amount: number;
  patientName?: string;
  onSettled?: () => void;
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <TextInput
      label={label}
      value={value}
      readOnly
      styles={{ input: { fontFamily: "monospace" } }}
      rightSection={
        <CopyButton value={value}>
          {({ copied, copy }) => (
            <Button tone="ghost" size="compact-xs" onClick={copy} aria-label={`Copy ${label}`}>
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </Button>
          )}
        </CopyButton>
      }
    />
  );
}

export function VirtualAccountPanel({ invoiceId, amount, patientName, onSettled }: Props) {
  const [txnId, setTxnId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => paymentsService.createVirtualAccount({ invoice_id: invoiceId, amount }),
    onSuccess: (res) => setTxnId(res.transaction_id),
    onError: (err: Error) =>
      notifications.show({
        title: "Virtual account failed",
        message: err.message,
        color: "danger",
      }),
  });

  const { data } = useQuery({
    queryKey: ["va-status", txnId],
    queryFn: () => paymentsService.getPaymentStatus(txnId as string),
    enabled: Boolean(txnId),
    refetchInterval: (query) => {
      const st = query.state.data?.transaction.status;
      if (st === "captured") {
        onSettled?.();
        return false;
      }
      if (st === "failed") return false;
      return 4000;
    },
  });

  const txn = data?.transaction;
  const receivers = parseReceivers(txn?.notes);
  const bank = receivers.find((r) => r.account_number);
  const vpa = receivers.find((r) => r.address)?.address;
  const minted = txn?.status === "created" || txn?.status === "captured";
  const paid = txn?.status === "captured";
  const upiUri = vpa
    ? `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(
        patientName ?? "Hospital",
      )}&am=${amount}&cu=INR`
    : null;

  if (!txnId) {
    return (
      <Button
        fullWidth
        tone="secondary"
        leftSection={<IconBuildingBank size={16} />}
        loading={createMutation.isPending}
        onClick={() => createMutation.mutate()}
      >
        Generate bank virtual account
      </Button>
    );
  }

  if (!minted) {
    return (
      <Group gap="xs">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Generating virtual account…
        </Text>
      </Group>
    );
  }

  return (
    <Stack gap="sm">
      {paid ? (
        <Alert color="success" icon={<IconCheck size={16} />}>
          Payment received and reconciled to this bill.
        </Alert>
      ) : (
        <Alert color="primary" icon={<IconBuildingBank size={16} />}>
          Patient can pay to this account or UPI ID from any bank app — it auto-reconciles.
        </Alert>
      )}

      {bank && (
        <>
          {bank.name && <CopyField label="Beneficiary" value={bank.name} />}
          {bank.account_number && <CopyField label="Account number" value={bank.account_number} />}
          {bank.ifsc && <CopyField label="IFSC" value={bank.ifsc} />}
        </>
      )}

      {vpa && (
        <Stack gap={6} align="center">
          <CopyField label="UPI ID" value={vpa} />
          {upiUri && (
            <img
              src={`https://chart.googleapis.com/chart?cht=qr&chs=180x180&chl=${encodeURIComponent(
                upiUri,
              )}`}
              alt="UPI virtual-account QR"
              width={180}
              height={180}
              style={{ borderRadius: 4, border: "1px solid var(--mb-border-subtle)" }}
            />
          )}
        </Stack>
      )}

      {!paid && (
        <Group gap="xs" justify="center">
          <Loader size="xs" />
          <Badge tone="warning" size="sm">
            Waiting for payment…
          </Badge>
        </Group>
      )}
    </Stack>
  );
}
