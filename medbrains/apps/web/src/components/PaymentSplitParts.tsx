/**
 * Part payments before the last tender: "₹200 on card, the rest in cash".
 *
 * Each part is exact — card, UPI and credit never give change — and may not
 * exceed what is still due. The last tender is taken by the payment modal as
 * usual, against what is left.
 */
import { Group, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui";

export type PaymentSplitMode = "card" | "upi" | "credit";

export interface PaymentSplitPart {
  /** Client-side identity for the list; not sent anywhere. */
  id: string;
  mode: PaymentSplitMode;
  amount: number;
  reference?: string;
  /** Taken on the card machine: the money is in, so the part stays. */
  gateway_transaction_id?: string;
}

const MODE_LABELS: Record<PaymentSplitMode, string> = {
  card: "Card",
  upi: "UPI",
  credit: "Credit (patient account)",
};

interface PaymentSplitPartsProps {
  parts: readonly PaymentSplitPart[];
  due: number;
  modes: readonly PaymentSplitMode[];
  disabled?: boolean;
  formatAmount: (value: number) => string;
  onAdd: (part: PaymentSplitPart) => void;
  onRemove: (index: number) => void;
}

/** Why the part cannot be added yet, or null. */
export function splitPartProblem(part: Omit<PaymentSplitPart, "id">, due: number): string | null {
  if (!(part.amount > 0)) return "Enter the part amount.";
  if (part.amount > due + 1e-9) return "A part cannot be more than what is due.";
  if (part.mode !== "credit" && !part.reference?.trim()) {
    return part.mode === "card" ? "Enter the card approval code." : "Enter the UPI UTR.";
  }
  return null;
}

export function PaymentSplitParts({
  parts,
  due,
  modes,
  disabled,
  formatAmount,
  onAdd,
  onRemove,
}: PaymentSplitPartsProps) {
  const [mode, setMode] = useState<PaymentSplitMode>(modes[0] ?? "card");
  const [amount, setAmount] = useState<number | string>("");
  const [reference, setReference] = useState("");
  const draft = { mode, amount: Number(amount) || 0, reference };
  const problem = splitPartProblem(draft, due);

  return (
    <Stack gap="xs" data-testid="payment-split">
      <Text size="sm" fw={600}>
        Split the bill
      </Text>
      {parts.map((part, index) => (
        <Group key={part.id} justify="space-between">
          <Text size="sm">
            {MODE_LABELS[part.mode]} {formatAmount(part.amount)}
            {part.reference ? ` · ${part.reference}` : ""}
          </Text>
          {!part.gateway_transaction_id && (
            <IconButton
              size="sm"
              tone="danger"
              aria-label={`Remove ${MODE_LABELS[part.mode]} part`}
              onClick={() => onRemove(index)}
            >
              <IconX size={14} />
            </IconButton>
          )}
        </Group>
      ))}
      <Group align="flex-end" gap="xs" wrap="wrap">
        <Select
          label="Part by"
          w={170}
          data={modes.map((value) => ({ value, label: MODE_LABELS[value] }))}
          value={mode}
          onChange={(value) => setMode((value as PaymentSplitMode | null) ?? mode)}
          allowDeselect={false}
          disabled={disabled}
        />
        <NumberInput
          label="Part amount"
          w={130}
          min={0}
          decimalScale={2}
          prefix="₹"
          value={amount}
          onChange={setAmount}
          disabled={disabled}
        />
        {mode !== "credit" && (
          <TextInput
            label={mode === "card" ? "Approval code" : "UPI UTR"}
            w={160}
            value={reference}
            onChange={(event) => setReference(event.currentTarget.value)}
            disabled={disabled}
          />
        )}
        <Button
          tone="secondary"
          leftSection={<IconPlus size={14} />}
          disabled={disabled || Boolean(problem)}
          onClick={() => {
            onAdd({
              ...draft,
              id: crypto.randomUUID(),
              reference: draft.reference.trim() || undefined,
            });
            setAmount("");
            setReference("");
          }}
        >
          Add part
        </Button>
      </Group>
      {problem && amount !== "" && (
        <Text size="xs" c="dimmed">
          {problem}
        </Text>
      )}
    </Stack>
  );
}
