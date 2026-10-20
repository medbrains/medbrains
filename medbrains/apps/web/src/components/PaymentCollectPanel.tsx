import { ActionIcon, Box, Button, Group, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type {
  CollectionReceipt,
  CollectRequest,
  CollectResult,
  PaymentMode,
  PosSaleView,
} from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { type KeyboardEvent, useMemo, useState } from "react";
import { billingService } from "@/services/billing.service";
import { CardTerminalPanel } from "./payments/CardTerminalPanel";
import { approvedRupees } from "./payments/cardSale";

/** Modes offered as one-key shortcuts, in shortcut order (1..n). */
const QUICK_MODES: { mode: PaymentMode; label: string }[] = [
  { mode: "cash", label: "Cash" },
  { mode: "upi", label: "UPI" },
  { mode: "card", label: "Card" },
  { mode: "cheque", label: "Cheque" },
];

const NON_CASH_NEEDS_REF: PaymentMode[] = ["upi", "card", "cheque", "bank_transfer"];

export interface PaymentLine {
  key: string;
  mode: PaymentMode;
  amount: number | string;
  reference: string;
  tendered: number | string;
  /** Taken on the card machine — already on the bill; the line is closed. */
  paidOnMachine: string | null;
  /** The machine's approved payment, which the collection takes over. */
  machineTxnId: string | null;
}

interface PaymentCollectPanelProps {
  patientId: string;
  invoiceId: string;
  /** Outstanding balance; the panel will not let the total exceed it. */
  balance: number;
  /** Called once the collection is recorded — every line, in one request. */
  onRecorded: (result: CollectResult) => void;
  /** Optional: print after a successful record (Enter = save + print). */
  onPrint?: (receipts: CollectionReceipt[]) => void;
  /** The counter (station) the money is taken at. */
  stationId?: string | null;
  /** The counter's free-text label, which day close tallies by. */
  counterId?: string;
  autoFocus?: boolean;
}

function num(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let lineSeq = 0;
export function makeLine(amount: number, mode: PaymentMode = "cash"): PaymentLine {
  lineSeq += 1;
  return {
    key: `line-${lineSeq}`,
    mode,
    amount,
    reference: "",
    tendered: amount,
    paidOnMachine: null,
    machineTxnId: null,
  };
}

/** A fresh idempotency key: one per collection attempt, kept across retries. */
function newAttemptKey(): string {
  return crypto.randomUUID();
}

/**
 * Every line as one collection: the hand-taken lines are posted, the card
 * machine's are taken over (already on the bill). One request, so a failure
 * posts nothing and a retry with the same key posts nothing twice.
 */
export function buildCollectRequest(
  bill: { patientId: string; invoiceId: string; stationId?: string | null; counterId?: string },
  lines: PaymentLine[],
  attemptKey: string,
): CollectRequest {
  const tenders = lines
    .filter((line) => line.machineTxnId || num(line.amount) > 0)
    .map((line) =>
      line.machineTxnId
        ? { mode: "card", gateway_transaction_id: line.machineTxnId }
        : {
            mode: line.mode,
            amount: num(line.amount),
            reference: line.reference.trim() || undefined,
          },
    );
  return {
    patient_id: bill.patientId,
    scope: "all",
    invoice_ids: [bill.invoiceId],
    tenders,
    station_id: bill.stationId ?? undefined,
    counter_id: bill.counterId?.trim() || undefined,
    idempotency_key: attemptKey,
  };
}

/**
 * Keyboard-first payment entry (audit #290). One line by default,
 * pre-filled to the balance; number keys 1–4 set the focused line's
 * mode, "+" adds a split line, Enter records every line. Cash lines
 * show change-due from the tendered amount. Recording multiple lines
 * posts several payments against the one invoice — a mixed-mode split.
 */
export function PaymentCollectPanel({
  patientId,
  invoiceId,
  balance,
  onRecorded,
  onPrint,
  stationId,
  counterId,
  autoFocus,
}: PaymentCollectPanelProps) {
  const [lines, setLines] = useState<PaymentLine[]>(() => [makeLine(balance)]);
  const [attemptKey, setAttemptKey] = useState(newAttemptKey);
  const [printOnSave, setPrintOnSave] = useState(Boolean(onPrint));

  const total = useMemo(() => lines.reduce((sum, line) => sum + num(line.amount), 0), [lines]);
  // What Record posts: the card machine's lines are on the bill already.
  const toRecord = useMemo(
    () => lines.reduce((sum, line) => sum + (line.paidOnMachine ? 0 : num(line.amount)), 0),
    [lines],
  );
  const remaining = balance - total;
  const overpaid = total > balance + 0.001;
  const hasMachineLine = lines.some((line) => line.machineTxnId);
  const canRecord = (toRecord > 0 || hasMachineLine) && !overpaid;

  const updateLine = (key: string, patch: Partial<PaymentLine>) =>
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const addLine = () => {
    if (remaining <= 0) return;
    setLines((prev) => [...prev, makeLine(remaining, "upi")]);
  };

  const removeLine = (key: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((line) => line.key !== key)));

  // The machine approved a card line: it is on the bill already. Anything
  // the card did not cover becomes a new line to take another way.
  const onCardApproved = (key: string, sale: PosSaleView) => {
    const covered = approvedRupees(sale);
    const asked = num(lines.find((line) => line.key === key)?.amount ?? 0);
    const rest = Math.round((asked - covered) * 100) / 100;
    const closed = lines.map((line) =>
      line.key === key
        ? {
            ...line,
            amount: covered,
            paidOnMachine: `${sale.terminal_label} ${sale.reference ?? ""}`,
            machineTxnId: sale.transaction_id,
          }
        : line,
    );
    const next = rest > 0 ? [...closed, makeLine(rest, "cash")] : closed;
    setLines(next);
    // The machine took it all: record the collection so it gets its receipt.
    if (next.every((line) => line.paidOnMachine || num(line.amount) <= 0)) {
      recordMutation.mutate(next);
    }
  };

  const recordMutation = useMutation({
    mutationFn: (current: PaymentLine[]) =>
      billingService.collectPayment(
        buildCollectRequest({ patientId, invoiceId, stationId, counterId }, current, attemptKey),
      ),
    onSuccess: (result) => {
      notifications.show({
        title: "Payment recorded",
        message: `₹${money(Number(result.total_amount))} across ${result.payments.length} ${
          result.payments.length === 1 ? "tender" : "tenders"
        }`,
        color: "success",
      });
      setAttemptKey(newAttemptKey());
      onRecorded(result);
      if (printOnSave && onPrint) onPrint(result.receipts);
    },
    onError: (error: Error) => {
      notifications.show({ title: "Payment failed", message: error.message, color: "danger" });
    },
  });

  // Number keys 1–4 set the focused line's mode, but only when the
  // cashier is not typing into a text field (so amount entry is safe).
  const onLineKeyDown = (event: KeyboardEvent<HTMLDivElement>, key: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (canRecord && !recordMutation.isPending) recordMutation.mutate(lines);
      return;
    }
    const target = event.target as HTMLElement;
    const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
    const quick = QUICK_MODES[Number(event.key) - 1];
    if (!typing && quick) {
      event.preventDefault();
      updateLine(key, { mode: quick.mode });
    }
  };

  return (
    <Stack gap="sm">
      {lines.map((line, lineIndex) => {
        const change =
          line.mode === "cash" ? Math.max(0, num(line.tendered) - num(line.amount)) : 0;
        const needsRef = NON_CASH_NEEDS_REF.includes(line.mode);
        return (
          <Box
            key={line.key}
            onKeyDown={(event) => onLineKeyDown(event, line.key)}
            style={{ borderTop: lineIndex > 0 ? "1px dashed var(--fc-rule, #e7ebe8)" : undefined }}
            pt={lineIndex > 0 ? "sm" : undefined}
          >
            {line.paidOnMachine ? (
              <Group justify="space-between" data-testid="line-paid-on-machine">
                <Text size="sm">Card · approved on {line.paidOnMachine}</Text>
                <Text size="sm" fw={700}>
                  ₹{money(num(line.amount))}
                </Text>
              </Group>
            ) : (
              <Stack gap="xs">
                <Group gap={6}>
                  {QUICK_MODES.map((quick, quickIndex) => (
                    <Button
                      key={quick.mode}
                      size="compact-xs"
                      variant={line.mode === quick.mode ? "filled" : "default"}
                      onClick={() => updateLine(line.key, { mode: quick.mode })}
                    >
                      {quickIndex + 1} · {quick.label}
                    </Button>
                  ))}
                  {lines.filter((other) => !other.paidOnMachine).length > 1 && (
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      size="sm"
                      aria-label="Remove split"
                      onClick={() => removeLine(line.key)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>
                <Group grow align="flex-start">
                  <NumberInput
                    label="Amount"
                    data-autofocus={autoFocus && lineIndex === 0 ? true : undefined}
                    value={line.amount}
                    onChange={(value) => updateLine(line.key, { amount: value })}
                    min={0}
                    decimalScale={2}
                  />
                  {line.mode === "cash" ? (
                    <NumberInput
                      label="Cash tendered"
                      value={line.tendered}
                      onChange={(value) => updateLine(line.key, { tendered: value })}
                      min={0}
                      decimalScale={2}
                    />
                  ) : (
                    <Stack gap={4}>
                      {line.mode === "card" && (
                        <CardTerminalPanel
                          amount={num(line.amount)}
                          invoiceId={invoiceId}
                          onApproved={(sale) => onCardApproved(line.key, sale)}
                          onUseOtherMode={() => updateLine(line.key, { mode: "cash" })}
                        />
                      )}
                      <TextInput
                        label={needsRef ? "Reference no." : "Reference (optional)"}
                        value={line.reference}
                        onChange={(event) =>
                          updateLine(line.key, { reference: event.currentTarget.value })
                        }
                      />
                    </Stack>
                  )}
                </Group>
                {line.mode === "cash" && (
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      Change due
                    </Text>
                    <Text size="sm" fw={700} c={change > 0 ? "copper" : undefined}>
                      ₹{money(change)}
                    </Text>
                  </Group>
                )}
              </Stack>
            )}
          </Box>
        );
      })}

      <Group justify="space-between">
        <Button
          size="compact-xs"
          variant="subtle"
          leftSection={<IconPlus size={14} />}
          disabled={remaining <= 0}
          onClick={addLine}
        >
          Split payment
        </Button>
        <Text size="xs" c={overpaid ? "danger" : "dimmed"}>
          {overpaid
            ? `Over by ₹${money(total - balance)}`
            : `Remaining ₹${money(Math.max(0, remaining))}`}
        </Text>
      </Group>

      {onPrint && (
        <Button
          size="compact-xs"
          variant={printOnSave ? "light" : "subtle"}
          color={printOnSave ? "primary" : "gray"}
          onClick={() => setPrintOnSave((value) => !value)}
        >
          {printOnSave ? "Will print receipt on save" : "Print receipt off"}
        </Button>
      )}

      <Button
        loading={recordMutation.isPending}
        disabled={!canRecord}
        onClick={() => recordMutation.mutate(lines)}
      >
        Record ₹{money(toRecord)}
        {printOnSave && onPrint ? " + print" : ""} · Enter
      </Button>
    </Stack>
  );
}
