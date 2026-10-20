/**
 * The IPD billing desk's discharge checklist (#292): every department's
 * charges on the bill, every return and concession decided, then the final
 * bill — and what the advance leaves to collect or refund. The server refuses
 * to issue the final bill while anything here is open; this screen says why.
 */
import { Box, Group, List, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type FinalBillChecklist as Checklist, P } from "@medbrains/types";
import { IconAlertTriangle, IconCash, IconCircleCheck, IconFileInvoice } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCollect } from "@/components/payments/collect/collect-store";
import { useCanCollect } from "@/components/payments/collect/use-dues";
import { QueryError } from "@/components/QueryError";
import { Alert, Badge, Button, Card, ThemeIcon, toast } from "@/components/ui";
import { formatMoney } from "@/pages/patient-detail/shared";
import { billingService } from "@/services/billing.service";

const money = formatMoney;

function Item({ done, title, children }: { done: boolean; title: string; children?: ReactNode }) {
  return (
    <Group align="flex-start" wrap="nowrap" gap="sm" role="listitem" aria-label={title}>
      <ThemeIcon tone={done ? "success" : "warning"} size="sm" aria-label={done ? "Done" : "Open"}>
        {done ? <IconCircleCheck size={16} /> : <IconAlertTriangle size={16} />}
      </ThemeIcon>
      <Stack gap={2}>
        <Text fw={600} size="sm">
          {title}
        </Text>
        {children}
      </Stack>
    </Group>
  );
}

export function FinalBillChecklist({ admissionId }: { admissionId: string }) {
  const queryClient = useQueryClient();
  const canIssue = useHasPermission(P.BILLING.INVOICES_UPDATE);
  const canAdjust = useHasPermission(P.BILLING.ADVANCES_ADJUST);
  const canRefund = useHasPermission(P.BILLING.ADVANCES_REFUND);
  const canCollect = useCanCollect("ipd");
  const openCollect = useCollect((st) => st.open);
  const key = ["final-bill-checklist", admissionId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => billingService.getFinalBillChecklist(admissionId),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });
  const onError = (title: string) => (error: Error) => toast.error(error.message, { title });

  const issue = useMutation({
    mutationFn: (invoiceId: string) => billingService.issueInvoice(invoiceId),
    onSuccess: () => {
      refresh();
      toast.success("Apply the advance, then collect or refund the balance.", {
        title: "Final bill issued",
      });
    },
    onError: onError("Final bill not issued"),
  });
  const applyAdvance = useMutation({
    mutationFn: async (c: Checklist) => {
      let due = Number(c.invoice?.total_amount ?? 0) - Number(c.invoice?.paid_amount ?? 0);
      for (const a of c.advances) {
        const amount = Math.min(Number(a.balance), due);
        if (amount <= 0 || !c.invoice) break;
        await billingService.adjustAdvance(a.id, {
          invoice_id: c.invoice.id,
          amount,
          notes: "Discharge bill",
        });
        due -= amount;
      }
    },
    onSuccess: refresh,
    onError: onError("Advance not applied"),
  });
  const refund = useMutation({
    mutationFn: async (c: Checklist) => {
      for (const a of c.advances) {
        await billingService.refundAdvance(a.id, {
          amount: Number(a.balance),
          reason: "Refund at discharge",
        });
      }
    },
    onSuccess: () => {
      refresh();
      toast.success("The unused advance has been refunded.", { title: "Refunded" });
    },
    onError: onError("Refund not recorded"),
  });

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const c = query.data;
  if (!c) return null;
  const isDraft = c.invoice?.status === "draft";
  const isIssued = c.invoice !== null && !isDraft;
  const due = Number(c.invoice?.total_amount ?? 0) - Number(c.invoice?.paid_amount ?? 0);
  const net = Number(c.net_payable);

  return (
    <Box component="section" aria-label="Discharge bill checklist">
      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600}>Discharge bill checklist</Text>
            {c.invoice && (
              <Badge tone={isIssued ? "success" : "warning"}>
                {isIssued ? "Final bill issued" : "Draft"}
              </Badge>
            )}
          </Group>
          <Stack gap="sm" role="list">
            <Item
              done={c.invoice !== null && c.departments.length > 0}
              title="Charges by department"
            >
              {c.departments.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No charges on the bill yet.
                </Text>
              ) : (
                <List size="sm">
                  {c.departments.map((d) => (
                    <List.Item key={d.department}>
                      {d.department}: {money(d.amount)} ({d.lines} line{d.lines === 1 ? "" : "s"})
                    </List.Item>
                  ))}
                </List>
              )}
            </Item>
            <Item done={c.unbilled_orders.length === 0} title="Every order is on the bill">
              {c.unbilled_orders.length > 0 && (
                <List size="sm">
                  {c.unbilled_orders.map((o) => (
                    <List.Item key={o.order_id}>
                      {o.name} ({o.module}) — not charged
                    </List.Item>
                  ))}
                </List>
              )}
            </Item>
            <Item done={c.pending_returns === 0} title="Pharmacy returns decided">
              {c.pending_returns > 0 && (
                <Text size="sm">{c.pending_returns} waiting in Pharmacy → Returns</Text>
              )}
            </Item>
            <Item done={c.pending_concessions === 0} title="Concessions decided">
              {c.pending_concessions > 0 && (
                <Text size="sm">{c.pending_concessions} waiting in Billing → Concessions</Text>
              )}
            </Item>
            <Item done={Number(c.advance_balance) === 0} title="Advance applied">
              <Text size="sm">Advance held: {money(c.advance_balance)}</Text>
            </Item>
            <Item
              done={isIssued && net <= 0 && due <= 0}
              title={net < 0 ? "Refund due" : "Balance to collect"}
            >
              <Text size="sm">{money(Math.abs(net))}</Text>
            </Item>
          </Stack>
          {c.blockers.length > 0 && (
            <Alert tone="warning" title="The final bill can't be issued yet">
              {c.blockers.join("; ")}.
            </Alert>
          )}
          <Group justify="flex-end">
            {isDraft && canIssue && c.invoice && (
              <Button
                tone="primary"
                leftSection={<IconFileInvoice size={16} />}
                disabled={c.blockers.length > 0}
                loading={issue.isPending}
                onClick={() => c.invoice && issue.mutate(c.invoice.id)}
              >
                Issue final bill
              </Button>
            )}
            {isIssued && canAdjust && due > 0 && Number(c.advance_balance) > 0 && (
              <Button
                tone="secondary"
                loading={applyAdvance.isPending}
                onClick={() => applyAdvance.mutate(c)}
              >
                Apply advance
              </Button>
            )}
            {isIssued && canCollect && due > 0 && c.invoice && (
              <Button
                tone="primary"
                leftSection={<IconCash size={16} />}
                onClick={() =>
                  c.invoice &&
                  openCollect({
                    patientId: c.patient_id,
                    invoiceIds: [c.invoice.id],
                    focusLabel: "Final bill",
                    onCollected: refresh,
                  })
                }
              >
                Collect balance {money(due)}
              </Button>
            )}
            {isIssued && canRefund && due <= 0 && Number(c.advance_balance) > 0 && (
              <Button tone="secondary" loading={refund.isPending} onClick={() => refund.mutate(c)}>
                Refund {money(c.advance_balance)}
              </Button>
            )}
          </Group>
        </Stack>
      </Card>
    </Box>
  );
}
