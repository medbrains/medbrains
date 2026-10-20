import { Group, Stack, Text, VisuallyHidden } from "@mantine/core";
import type { PosSaleView } from "@medbrains/types";
import { IconCheck, IconCircleDashed, IconClock, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Alert, type AlertTone, Button } from "@/components/ui";
import { canRetry, cardSaleSteps, needsResolving, type StepState } from "./cardSale";

interface CardSaleStatusProps {
  sale: PosSaleView;
  onCancel: () => void;
  onRetry: () => void;
  /** Offered when the card did not go through. */
  onUseOtherMode?: () => void;
  /** Offered to a supervisor (`billing.payments.reconcile`) when nobody knows the outcome. */
  onResolve?: () => void;
  cancelling: boolean;
}

const STEP_ICON: Record<StepState, ReactNode> = {
  done: <IconCheck size={16} aria-hidden />,
  current: <IconClock size={16} aria-hidden />,
  todo: <IconCircleDashed size={16} aria-hidden />,
  failed: <IconX size={16} aria-hidden />,
};

const STEP_WORD: Record<StepState, string> = {
  done: "done",
  current: "in progress",
  todo: "not yet",
  failed: "did not go through",
};

function toneOf(sale: PosSaleView): AlertTone {
  if (sale.stage === "approved") return sale.held_for_finance ? "warning" : "success";
  if (needsResolving(sale)) return "warning";
  if (sale.is_final) return "danger";
  return "info";
}

/** Live status of a card sale at the machine: sent → waiting → result. */
export function CardSaleStatus({
  sale,
  onCancel,
  onRetry,
  onUseOtherMode,
  onResolve,
  cancelling,
}: CardSaleStatusProps) {
  const steps = cardSaleSteps(sale.stage);
  const unresolved = needsResolving(sale);
  return (
    <Stack gap="xs" data-testid="card-sale-status">
      <Group gap="md" component="ol" aria-label="Card payment progress" m={0} p={0}>
        {steps.map((step) => (
          <Group
            key={step.label}
            gap={4}
            component="li"
            aria-current={step.state === "current" ? "step" : undefined}
            style={{ listStyle: "none" }}
          >
            {STEP_ICON[step.state]}
            <Text size="sm" fw={step.state === "current" ? 600 : 400}>
              {step.label}
            </Text>
            <VisuallyHidden>({STEP_WORD[step.state]})</VisuallyHidden>
          </Group>
        ))}
      </Group>
      <Alert tone={toneOf(sale)} title={sale.terminal_label}>
        <Text size="sm" role="status" aria-live="polite">
          {sale.message}
          {sale.stage === "approved" && sale.card_last4 ? ` · card ending ${sale.card_last4}` : ""}
          {sale.stage === "approved" && sale.auth_code ? ` · approval ${sale.auth_code}` : ""}
          {sale.stage === "approved" && sale.rrn ? ` · RRN ${sale.rrn}` : ""}
        </Text>
        {unresolved && !onResolve && (
          <Text size="sm" mt={4}>
            Do not charge the card again. A supervisor checks the machine's slip and resolves this.
          </Text>
        )}
      </Alert>
      <Group gap="xs">
        {!sale.is_final && sale.stage !== "cancelling" && sale.stage !== "unknown" && (
          <Button tone="danger-tertiary" size="xs" loading={cancelling} onClick={onCancel}>
            {sale.stage === "cancel_refused" ? "Try the cancel again" : "Cancel on machine"}
          </Button>
        )}
        {unresolved && onResolve && (
          <Button tone="secondary" size="xs" onClick={onResolve}>
            Resolve from the slip
          </Button>
        )}
        {canRetry(sale) && (
          <Button tone="primary" size="xs" onClick={onRetry}>
            Try the card again
          </Button>
        )}
        {canRetry(sale) && onUseOtherMode && (
          <Button tone="ghost" size="xs" onClick={onUseOtherMode}>
            Take it another way
          </Button>
        )}
      </Group>
    </Stack>
  );
}
