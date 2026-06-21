import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconRepeat } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, toast } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";

interface Props {
  prescriptionId: string;
  pharmacyOrderId: string;
}

/**
 * Refill / repeat panel — a repeatable Rx (`repeats_allowed > 0`) can be
 * re-dispensed without a doctor re-issue, within count + interval. Shows
 * used/remaining/next-eligible and a gated "Dispense repeat" action.
 */
export function RepeatPanel({ prescriptionId, pharmacyOrderId }: Props) {
  const canView = useHasPermission(P.PHARMACY_IMPROVEMENTS.REPEATS_VIEW);
  const canDispense = useHasPermission(P.PHARMACY_IMPROVEMENTS.REPEATS_DISPENSE);
  const queryClient = useQueryClient();

  const { data: eligibility, isLoading } = useQuery({
    queryKey: ["repeat-eligibility", prescriptionId],
    queryFn: () => pharmacyService.checkRepeatEligibility(prescriptionId),
    enabled: canView,
  });

  const repeatMutation = useMutation({
    mutationFn: () =>
      pharmacyService.dispenseRepeat(prescriptionId, { pharmacy_order_id: pharmacyOrderId }),
    onSuccess: () => {
      toast.success("Repeat dispensed", { title: "Refill" });
      queryClient.invalidateQueries({ queryKey: ["repeat-eligibility", prescriptionId] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Repeat failed" }),
  });

  if (!canView || isLoading || !eligibility || eligibility.repeats_allowed <= 0) return null;

  const { repeats_allowed, repeats_used, remaining, next_eligible_at, is_eligible_now } =
    eligibility;

  return (
    <Card padding="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Group gap="xs">
            <IconRepeat size={16} />
            <Text fw={600} size="sm">
              Repeat prescription
            </Text>
            <Badge tone={remaining > 0 ? "info" : "neutral"} size="sm">
              {repeats_used}/{repeats_allowed} used · {remaining} left
            </Badge>
          </Group>
          {!is_eligible_now && remaining > 0 && next_eligible_at && (
            <Text size="xs" c="dimmed">
              Next eligible {new Date(next_eligible_at).toLocaleDateString()}
            </Text>
          )}
        </Stack>
        {canDispense && (
          <Button
            size="xs"
            tone="primary"
            leftSection={<IconRepeat size={14} />}
            loading={repeatMutation.isPending}
            disabled={!is_eligible_now}
            onClick={() => repeatMutation.mutate()}
          >
            Dispense repeat
          </Button>
        )}
      </Group>
      {remaining <= 0 && (
        <Alert tone="neutral" mt="xs">
          All repeats used — a new prescription is required.
        </Alert>
      )}
    </Card>
  );
}
