import { Group, Stack, Text } from "@mantine/core";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import type { PaymentTerminal, PosSaleView, PosTender } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCreditCard } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  type BadgeTone,
  Button,
  NumberField,
  SegmentedControl,
  Select,
} from "@/components/ui";
import { useCounterStation } from "@/hooks/useCounterStation";
import { pollUntil } from "@/lib/razorpay-checkout";
import { paymentsService } from "@/services/payments.service";
import { CardSaleStatus } from "./CardSaleStatus";
import { CARD_POLL, countersWithMachines, machineStatusLabel, TENDERS } from "./cardSale";
import { ResolveCardSaleModal } from "./ResolveCardSaleModal";

interface CardTerminalPanelProps {
  /** What is due; the card may take all of it or, when editable, a part. */
  amount: number;
  /** Let the cashier put only part of the bill on the card (a split). */
  editableAmount?: boolean;
  /** The bill; absent for a pharmacy counter sale not yet posted. */
  invoiceId?: string;
  disabled?: boolean;
  /** The machine approved the card; the money is already on the bill. */
  onApproved: (sale: PosSaleView) => void;
  onUseOtherMode?: () => void;
}

const STATUS_TONE: Record<PaymentTerminal["status"], BadgeTone> = {
  online: "success",
  offline: "danger",
  unknown: "neutral",
};

const rupees = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * "Card on terminal": send the amount to the card machine at this counter
 * and follow it live until the machine answers.
 */
export function CardTerminalPanel({
  amount,
  editableAmount,
  invoiceId,
  disabled,
  onApproved,
  onUseOtherMode,
}: CardTerminalPanelProps) {
  const canUse = useHasAnyPermission([P.BILLING.PAYMENTS_CREATE, P.PHARMACY.POS_CREATE]);
  const canResolve = useHasPermission(P.BILLING.PAYMENTS_RECONCILE);
  const [tender, setTender] = useState<PosTender>("either");
  const [resolving, setResolving] = useState(false);
  const [stationId, setStationId] = useCounterStation();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [charge, setCharge] = useState<number | string>(amount);
  const [sale, setSale] = useState<PosSaleView | null>(null);

  const machinesQuery = useQuery({
    queryKey: ["payment-terminals", "pos"],
    queryFn: () => paymentsService.listPaymentTerminals({ active_only: true }),
    enabled: canUse,
    staleTime: 15_000,
  });
  const machines = useMemo(
    () => (machinesQuery.data ?? []).filter((t) => t.kind === "pos"),
    [machinesQuery.data],
  );
  const counters = useMemo(() => countersWithMachines(machines), [machines]);
  const station =
    stationId && counters.some((c) => c.value === stationId)
      ? stationId
      : counters.length === 1
        ? (counters[0]?.value ?? null)
        : null;
  const here = machines.filter((t) => t.station_id === station);
  const terminal = here.length === 1 ? here[0] : here.find((t) => t.id === pickedId);
  const toCharge = editableAmount ? Number(charge) || 0 : amount;
  const queryClient = useQueryClient();
  // A card payment on this bill nobody knows the outcome of — from before a
  // reload, or another cashier's — is shown instead of charging again.
  const unresolvedKey = ["card-sales-unresolved", invoiceId] as const;
  const unresolvedQuery = useQuery({
    queryKey: unresolvedKey,
    queryFn: () => paymentsService.listUnresolvedCardSales(invoiceId ?? ""),
    enabled: canUse && Boolean(invoiceId) && sale === null,
  });
  const shown = sale ?? unresolvedQuery.data?.[0] ?? null;

  const run = useMutation({
    mutationFn: async (terminalId: string) => {
      const started = await paymentsService.posSale({
        terminal_id: terminalId,
        invoice_id: invoiceId,
        amount: toCharge,
        tender,
      });
      setSale(started);
      if (started.is_final) return started;
      const last = await pollUntil(
        async () => {
          const now = await paymentsService.getCardSale(started.transaction_id);
          setSale(now);
          return now;
        },
        (now) => now.is_final,
        CARD_POLL,
      );
      return last ?? started;
    },
    // Money held for finance is not on the bill: the panel says so and stops.
    onSuccess: (done) => {
      if (done.stage === "approved" && !done.held_for_finance) onApproved(done);
    },
    // A refusal may be the machine going offline: show its state again.
    onError: () => void machinesQuery.refetch(),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => paymentsService.cancelCardSale(id),
    onSuccess: setSale,
  });
  // A sale resolved while the panel still follows it is handed back by that follow-up.
  const onResolved = (done: PosSaleView) => {
    setSale(done);
    void queryClient.invalidateQueries({ queryKey: unresolvedKey });
    if (!run.isPending && done.stage === "approved" && !done.held_for_finance) onApproved(done);
  };

  if (!canUse) return null;
  if (machinesQuery.isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Looking for the card machines…
      </Text>
    );
  }
  if (machinesQuery.isError) {
    return (
      <Alert tone="warning" title="Card machines could not be loaded">
        Run the card on the machine by hand and enter its approval code below.
      </Alert>
    );
  }
  if (machines.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No card machine is set up at a counter — enter the approval code from the slip.
      </Text>
    );
  }

  const busy = run.isPending || (shown !== null && !shown.is_final);
  const offline = terminal?.status === "offline";
  return (
    <Stack gap="xs" data-testid="card-terminal-panel">
      {counters.length > 1 && (
        <Select
          label="Your counter"
          placeholder="Pick the counter you are at"
          data={counters}
          value={station}
          onChange={setStationId}
          disabled={busy}
          allowDeselect={false}
        />
      )}
      {here.length > 1 && (
        <Select
          label="Card machine"
          placeholder="Which machine?"
          data={here.map((t) => ({ value: t.id, label: `${t.label} · ${machineStatusLabel(t)}` }))}
          value={terminal?.id ?? null}
          onChange={setPickedId}
          disabled={busy}
          allowDeselect={false}
        />
      )}
      {terminal && (
        <Group gap="xs">
          <Text size="sm">{terminal.label}</Text>
          <Badge tone={STATUS_TONE[terminal.status]} data-testid="terminal-status">
            {machineStatusLabel(terminal)}
          </Badge>
        </Group>
      )}
      {terminal && offline && (
        <Alert tone="danger" title={`${terminal.label} is offline`}>
          <Stack gap={6}>
            <Text size="sm">Take the payment another way, or check the machine and its cable.</Text>
            {onUseOtherMode && (
              <Button tone="secondary" size="xs" onClick={onUseOtherMode}>
                Take it another way
              </Button>
            )}
          </Stack>
        </Alert>
      )}
      {editableAmount && !busy && sale?.stage !== "approved" && (
        <NumberField
          label="Amount on card"
          value={charge}
          onChange={setCharge}
          min={0}
          max={amount}
          decimalScale={2}
          prefix="₹"
        />
      )}
      {terminal && !offline && !busy && !shown && (
        <SegmentedControl
          aria-label="Pay with"
          data={TENDERS}
          value={tender}
          onChange={(v) => setTender(v as PosTender)}
          disabled={disabled}
        />
      )}
      {terminal && !offline && !busy && !shown && (
        <Button
          tone="primary"
          leftSection={<IconCreditCard size={16} />}
          disabled={disabled || toCharge <= 0 || toCharge > amount}
          onClick={() => run.mutate(terminal.id)}
        >
          Send {rupees(toCharge)} to {terminal.label}
        </Button>
      )}
      {unresolvedQuery.isError && (
        <Alert tone="warning" title="Earlier card payments could not be checked">
          Check the machine's last slip for this bill before charging the card again.
        </Alert>
      )}
      {run.isError && (
        <Alert tone="danger" title="Not sent to the card machine">
          {run.error.message}
        </Alert>
      )}
      {shown && (
        <CardSaleStatus
          sale={shown}
          cancelling={cancel.isPending}
          onCancel={() => cancel.mutate(shown.transaction_id)}
          onRetry={() => {
            setSale(null);
            if (terminal) run.mutate(terminal.id);
          }}
          onUseOtherMode={onUseOtherMode}
          onResolve={canResolve ? () => setResolving(true) : undefined}
        />
      )}
      {shown && resolving && (
        <ResolveCardSaleModal
          sale={shown}
          opened
          onClose={() => setResolving(false)}
          onResolved={onResolved}
        />
      )}
    </Stack>
  );
}
