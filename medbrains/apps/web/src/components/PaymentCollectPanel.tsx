import { ActionIcon, Box, Button, Group, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Payment, PaymentMode } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { type KeyboardEvent, useMemo, useState } from "react";
import { billingService } from "@/services/billing.service";

/** Modes offered as one-key shortcuts, in shortcut order (1..n). */
const QUICK_MODES: { mode: PaymentMode; label: string }[] = [
  { mode: "cash", label: "Cash" },
  { mode: "upi", label: "UPI" },
  { mode: "card", label: "Card" },
  { mode: "cheque", label: "Cheque" },
];

const NON_CASH_NEEDS_REF: PaymentMode[] = ["upi", "card", "cheque", "bank_transfer"];

interface PaymentLine {
  key: string;
  mode: PaymentMode;
  amount: number | string;
  reference: string;
  tendered: number | string;
}

interface PaymentCollectPanelProps {
  invoiceId: string;
  /** Outstanding balance; the panel will not let the total exceed it. */
  balance: number;
  /** Called after all lines record successfully, with the new payments. */
  onRecorded: (payments: Payment[]) => void;
  /** Optional: print after a successful record (Enter = save + print). */
  onPrint?: (payments: Payment[]) => void;
  /** Cash counter / shift to tag payments with, for day-close tally. */
  counterId?: string;
  shift?: string;
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
function makeLine(amount: number, mode: PaymentMode = "cash"): PaymentLine {
  lineSeq += 1;
  return { key: `line-${lineSeq}`, mode, amount, reference: "", tendered: amount };
}

/**
 * Keyboard-first payment entry (audit #290). One line by default,
 * pre-filled to the balance; number keys 1–4 set the focused line's
 * mode, "+" adds a split line, Enter records every line. Cash lines
 * show change-due from the tendered amount. Recording multiple lines
 * posts several payments against the one invoice — a mixed-mode split.
 */
export function PaymentCollectPanel({
  invoiceId,
  balance,
  onRecorded,
  onPrint,
  counterId,
  shift,
  autoFocus,
}: PaymentCollectPanelProps) {
  const [lines, setLines] = useState<PaymentLine[]>(() => [makeLine(balance)]);
  const [printOnSave, setPrintOnSave] = useState(Boolean(onPrint));

  const total = useMemo(() => lines.reduce((sum, line) => sum + num(line.amount), 0), [lines]);
  const remaining = balance - total;
  const overpaid = total > balance + 0.001;
  const canRecord = total > 0 && !overpaid;

  const updateLine = (key: string, patch: Partial<PaymentLine>) =>
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const addLine = () => {
    if (remaining <= 0) return;
    setLines((prev) => [...prev, makeLine(remaining, "upi")]);
  };

  const removeLine = (key: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((line) => line.key !== key)));

  const recordMutation = useMutation({
    mutationFn: async () => {
      const recorded: Payment[] = [];
      for (const line of lines) {
        const amount = num(line.amount);
        if (amount <= 0) continue;
        const payment = await billingService.recordPayment(invoiceId, {
          amount,
          mode: line.mode,
          reference_number: line.reference.trim() || undefined,
          counter_id: counterId?.trim() || undefined,
          shift: shift?.trim() || undefined,
        });
        recorded.push(payment);
      }
      return recorded;
    },
    onSuccess: (recorded) => {
      notifications.show({
        title: "Payment recorded",
        message: `₹${money(total)} across ${recorded.length} ${
          recorded.length === 1 ? "entry" : "entries"
        }`,
        color: "success",
      });
      onRecorded(recorded);
      if (printOnSave && onPrint) onPrint(recorded);
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
      if (canRecord && !recordMutation.isPending) recordMutation.mutate();
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
                {lines.length > 1 && (
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
                  <TextInput
                    label={needsRef ? "Reference no." : "Reference (optional)"}
                    value={line.reference}
                    onChange={(event) =>
                      updateLine(line.key, { reference: event.currentTarget.value })
                    }
                  />
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
        onClick={() => recordMutation.mutate()}
      >
        Record ₹{money(total)}
        {printOnSave && onPrint ? " + print" : ""} · Enter
      </Button>
    </Stack>
  );
}
