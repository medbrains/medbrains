import { Stack, Text } from "@mantine/core";
import type { DueBill, PatientAdvance } from "@medbrains/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { fromPaise, rupees, toPaise } from "./collect-math";

interface DepositTenderProps {
  patientId: string | null;
  bills: DueBill[];
  amount: number;
  onApplied: () => void;
}

export const depositsKey = (patientId: string | null) => ["counter-advances", patientId] as const;

/** Usable deposits, oldest first. */
export const usableDeposits = (advances: PatientAdvance[]) =>
  advances.filter(
    (a) => (a.status === "active" || a.status === "partially_used") && Number(a.balance) > 0,
  );

interface Adjustment {
  advanceId: string;
  invoiceId: string;
  amount: number;
}

/** Spread `amount` over the bills, oldest first, from the deposits, oldest first. */
export function planDeposit(
  deposits: PatientAdvance[],
  bills: DueBill[],
  amount: number,
): Adjustment[] {
  const left = deposits.map((d) => toPaise(d.balance));
  let want = toPaise(amount);
  const plan: Adjustment[] = [];
  for (const bill of bills) {
    let owed = toPaise(bill.balance);
    for (let i = 0; i < deposits.length && owed > 0 && want > 0; i += 1) {
      const take = Math.min(left[i] ?? 0, owed, want);
      const deposit = deposits[i];
      if (take <= 0 || !deposit) continue;
      plan.push({ advanceId: deposit.id, invoiceId: bill.invoice_id, amount: fromPaise(take) });
      left[i] = (left[i] ?? 0) - take;
      owed -= take;
      want -= take;
    }
  }
  return plan;
}

/** Pay from the patient's deposit: each slice is the deposit's own adjustment. */
export function DepositTender({ patientId, bills, amount, onApplied }: DepositTenderProps) {
  const deposits = useQuery({
    queryKey: depositsKey(patientId),
    queryFn: () => billingService.listAdvances({ patient_id: patientId ?? "" }),
    enabled: Boolean(patientId),
  });
  const usable = usableDeposits(deposits.data ?? []);
  const plan = planDeposit(usable, bills, amount);
  const total = plan.reduce((sum, p) => sum + p.amount, 0);
  // Each adjustment is its own transaction on the server; one that fails
  // leaves the earlier ones applied, and the dues refresh to show it.
  const apply = useMutation({
    mutationFn: async () => {
      for (const step of plan) {
        await billingService.adjustAdvance(step.advanceId, {
          invoice_id: step.invoiceId,
          amount: step.amount,
          notes: "Applied at the collect desk",
        });
      }
    },
    onSettled: onApplied,
  });
  if (deposits.isError) {
    return (
      <Alert tone="danger" title="Deposits could not be read">
        {deposits.error.message}
      </Alert>
    );
  }
  if (!deposits.data) return <Text size="sm">Reading the patient&apos;s deposits…</Text>;
  return (
    <Stack gap="xs">
      <Text size="sm">
        {usable.length} deposit{usable.length === 1 ? "" : "s"} ·{" "}
        {rupees(usable.reduce((sum, d) => sum + Number(d.balance), 0))} available
      </Text>
      {apply.isError && (
        <Alert tone="danger" title="Not all of the deposit was applied">
          {apply.error.message}
        </Alert>
      )}
      <Button
        tone="primary"
        disabled={total <= 0}
        loading={apply.isPending}
        onClick={() => apply.mutate()}
      >
        Apply {rupees(total)} from deposit
      </Button>
    </Stack>
  );
}
