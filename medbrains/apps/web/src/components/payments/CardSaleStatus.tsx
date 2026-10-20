import { Group, Stack, Text, VisuallyHidden } from "@mantine/core";
import type { PosSaleView } from "@medbrains/types";
import { IconCheck, IconCircleDashed, IconClock, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Alert, type AlertTone, Button } from "@/components/ui";
import { canRetry, cardSaleSteps, type StepState } from "./cardSale";

interface CardSaleStatusProps {
  sale: PosSaleView;
  onCancel: () => void;
  onRetry: () => void;
  /** Offered when the card did not go through. */
  onUseOtherMode?: () => void;
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
  if (sale.is_final) return "danger";
  return "info";
}

/** Live status of a card sale at the machine: sent → waiting → result. */
export function CardSaleStatus({
  sale,
  onCancel,
  onRetry,
  onUseOtherMode,
  cancelling,
}: CardSaleStatusProps) {
  const steps = cardSaleSteps(sale.stage);
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
        </Text>
      </Alert>
      <Group gap="xs">
        {!sale.is_final && sale.stage !== "cancelling" && (
          <Button tone="danger-tertiary" size="xs" loading={cancelling} onClick={onCancel}>
            Cancel on machine
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
