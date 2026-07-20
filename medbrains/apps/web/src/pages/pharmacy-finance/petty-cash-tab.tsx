// Pharmacy-finance PettyCashTab — split from pharmacy-finance.tsx (pure move).

import { Card, Group, Stack, Text } from "@mantine/core";
import type { FieldAccessLevel } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button } from "@/components/ui";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";
import { canViewFinanceAmount, financeAmountText } from "./shared";

interface PettyCashRow {
  id: string;
  category: string;
  amount: string;
  paid_to: string;
  status: string;
  created_at: string;
}

export function PettyCashTab({
  canRecord,
  amountAccess,
}: {
  canRecord: boolean;
  amountAccess: FieldAccessLevel;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["petty-cash"],
    queryFn: () => pharmacyFinanceService.listPettyCash({ limit: 100 }) as Promise<PettyCashRow[]>,
  });
  const decide = useMutation({
    mutationFn: (vars: { id: string; approved: boolean }) =>
      pharmacyFinanceService.decidePettyCash(vars.id, { approved: vars.approved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["petty-cash"] }),
  });
  const canDecideVoucher = canRecord && canViewFinanceAmount(amountAccess);

  return (
    <Stack gap="xs">
      {canRecord && !canViewFinanceAmount(amountAccess) && (
        <Alert tone="warning">Petty cash approval needs billing amount view access.</Alert>
      )}
      {data?.map((row) => (
        <Card key={row.id} withBorder padding="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <Badge
                tone={
                  row.status === "approved"
                    ? "success"
                    : row.status === "rejected"
                      ? "danger"
                      : "warning"
                }
              >
                {row.status}
              </Badge>
              <Text fw={500}>{row.category}</Text>
              <Text>{financeAmountText(amountAccess, row.amount)}</Text>
              <Text c="dimmed">→ {row.paid_to}</Text>
            </Group>
            {row.status === "pending" && canDecideVoucher && (
              <Group>
                <Button
                  size="xs"
                  tone="primary"
                  onClick={() => decide.mutate({ id: row.id, approved: true })}
                >
                  Approve
                </Button>
                <Button
                  size="xs"
                  tone="subtle-danger"
                  onClick={() => decide.mutate({ id: row.id, approved: false })}
                >
                  Reject
                </Button>
              </Group>
            )}
          </Group>
        </Card>
      ))}
      {data?.length === 0 && <Text c="dimmed">No vouchers.</Text>}
    </Stack>
  );
}

// ── Supplier Payments Tab ───────────────────────────────────────────
