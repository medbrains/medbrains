/** One sale waiting at a simulated card machine, and what the card can do. */
import { Group } from "@mantine/core";
import type { SimulatedOutcome, SimulatedSale } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, NumberField, Table, toast } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";

export const SIM_SALES_KEY = ["simulated-sales"] as const;
const OUTCOMES: { outcome: SimulatedOutcome; label: string }[] = [
  { outcome: "approve", label: "Approve" },
  { outcome: "decline", label: "Decline" },
  { outcome: "timeout", label: "Time out" },
  { outcome: "offline", label: "Go offline" },
  { outcome: "upi", label: "Pay by UPI" },
  { outcome: "refuse_cancel", label: "PIN entered (refuse cancel)" },
  { outcome: "unknown", label: "Never answer" },
];

export function SimulatedSaleRow({ sale }: { sale: SimulatedSale }) {
  const queryClient = useQueryClient();
  const [part, setPart] = useState<number | string>("");
  const act = useMutation({
    mutationFn: (v: { outcome: SimulatedOutcome; approved_amount?: number }) =>
      paymentsService.actOnSimulatedSale(sale.transaction_id, v),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: SIM_SALES_KEY }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Table.Tr data-testid="simulated-sale">
      <Table.Td>{sale.terminal_label}</Table.Td>
      <Table.Td>₹{Number(sale.amount).toFixed(2)}</Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          {OUTCOMES.map((o) => (
            <Button
              key={o.outcome}
              size="xs"
              tone={o.outcome === "approve" ? "primary" : "secondary"}
              aria-label={`${o.label} ₹${Number(sale.amount).toFixed(2)} on ${sale.terminal_label}`}
              loading={act.isPending && act.variables?.outcome === o.outcome}
              onClick={() => act.mutate({ outcome: o.outcome })}
            >
              {o.label}
            </Button>
          ))}
          <NumberField
            aria-label="Approved part"
            placeholder="Part ₹"
            value={part}
            onChange={setPart}
            min={0}
            decimalScale={2}
            w={100}
          />
          <Button
            size="xs"
            tone="secondary"
            disabled={!(Number(part) > 0)}
            onClick={() => act.mutate({ outcome: "partial", approved_amount: Number(part) })}
          >
            Approve part
          </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
