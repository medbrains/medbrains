// Pharmacy-finance SupplierPaymentsTab — split from pharmacy-finance.tsx (pure move).

import { Card, Group, Stack, Text } from "@mantine/core";
import type { FieldAccessLevel } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";
import { financeAmountText } from "./shared";

interface SupplierPaymentRow {
  id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  gross_amount: string;
  net_payable: string;
  status: string;
  paid_at?: string | null;
}

export function SupplierPaymentsTab({
  canManage,
  amountAccess,
}: {
  canView: boolean;
  canManage: boolean;
  amountAccess: FieldAccessLevel;
}) {
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { data } = useQuery({
    queryKey: ["supplier-payments", overdueOnly],
    queryFn: () =>
      pharmacyFinanceService.listPharmacySupplierPayments({
        overdue_only: overdueOnly,
        limit: 100,
      }) as Promise<SupplierPaymentRow[]>,
  });

  return (
    <Stack>
      <Group>
        <Button
          tone={overdueOnly ? "primary" : "secondary"}
          onClick={() => setOverdueOnly((v) => !v)}
        >
          Overdue only
        </Button>
        {canManage && <Badge tone="primary">Manage payments</Badge>}
      </Group>
      <Stack gap="xs">
        {data?.map((row) => (
          <Card key={row.id} withBorder padding="sm">
            <Group justify="space-between">
              <Stack gap={2}>
                <Group gap="xs">
                  <Badge>{row.status}</Badge>
                  <Text fw={500}>{row.invoice_number}</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  Invoice {row.invoice_date} · Due {row.due_date}
                </Text>
              </Stack>
              <Text>
                Net {financeAmountText(amountAccess, row.net_payable)} (Gross{" "}
                {financeAmountText(amountAccess, row.gross_amount)})
              </Text>
            </Group>
          </Card>
        ))}
        {data?.length === 0 && <Text c="dimmed">No payments.</Text>}
      </Stack>
    </Stack>
  );
}

// ── Free Dispensing Tab ─────────────────────────────────────────────
