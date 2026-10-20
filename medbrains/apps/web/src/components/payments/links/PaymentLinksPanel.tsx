import { Skeleton, Stack, Text } from "@mantine/core";
import { useHasAnyPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { COLLECT_PERMISSIONS, useCanCollect } from "@/components/payments/collect/use-dues";
import { Alert, Button } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";
import { LinkStatusCard } from "./LinkStatusCard";
import { isLive } from "./link-status";

/** Re-read while a link can still be paid, so a part paid shows up. */
const LIVE_POLL_MS = 10_000;

interface PaymentLinksPanelProps {
  patientId?: string;
  invoiceId?: string;
}

/** The payment links sent for a patient or a bill, newest first (#4871). */
export function PaymentLinksPanel({ patientId, invoiceId }: PaymentLinksPanelProps) {
  const canRead = useHasAnyPermission([...COLLECT_PERMISSIONS, P.BILLING.INVOICES_VIEW]);
  const canAct = useCanCollect();
  const links = useQuery({
    queryKey: ["payment-links", patientId ?? null, invoiceId ?? null],
    queryFn: () =>
      paymentsService.listPaymentLinks({ patient_id: patientId, invoice_id: invoiceId }),
    enabled: canRead && Boolean(patientId || invoiceId),
    refetchInterval: (q) => (q.state.data?.some(isLive) ? LIVE_POLL_MS : false),
  });
  if (!canRead) return null;
  if (links.isError) {
    return (
      <Alert tone="danger" title="Payment links could not be read">
        <Stack gap="xs">
          <Text size="sm">{links.error.message}</Text>
          <Button tone="secondary" size="xs" onClick={() => void links.refetch()}>
            Try again
          </Button>
        </Stack>
      </Alert>
    );
  }
  if (!links.data) return <Skeleton height={80} aria-label="Reading payment links" />;
  if (links.data.length === 0) return null;
  return (
    <Stack gap="xs" data-testid="payment-links-panel">
      <Text fw={600}>Payment links</Text>
      {links.data.map((link) => (
        <LinkStatusCard key={link.id} link={link} canAct={canAct} />
      ))}
    </Stack>
  );
}
