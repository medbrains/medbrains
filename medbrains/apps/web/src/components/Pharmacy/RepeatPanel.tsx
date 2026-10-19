import { Box, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconRepeat } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, toast } from "@/components/ui";
import { formatDate } from "@/lib/date-utils";
import { pharmacyService } from "@/services/pharmacy.service";

interface Props {
  prescriptionId: string;
}

/**
 * Refills the doctor authorised on this prescription. Issuing one sends it
 * to the prescription queue, where it is reviewed, billed and dispensed as
 * its own order. The panel says why when a refill can't be issued.
 */
export function RepeatPanel({ prescriptionId }: Props) {
  const canView = useHasPermission(P.PHARMACY_IMPROVEMENTS.REPEATS_VIEW);
  const canIssue = useHasPermission(P.PHARMACY_IMPROVEMENTS.REPEATS_DISPENSE);
  const queryClient = useQueryClient();

  const { data: eligibility } = useQuery({
    queryKey: ["repeat-eligibility", prescriptionId],
    queryFn: () => pharmacyService.checkRepeatEligibility(prescriptionId),
    enabled: canView,
  });

  const issue = useMutation({
    mutationFn: () => pharmacyService.dispenseRepeat(prescriptionId, {}),
    onSuccess: (row) => {
      toast.success("Review it in the prescription queue to bill and dispense.", {
        title: `Refill ${row.repeat_index} issued`,
      });
      void queryClient.invalidateQueries({ queryKey: ["repeat-eligibility", prescriptionId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-rx-queue"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Refill not issued" }),
  });

  if (!eligibility || eligibility.repeats_allowed <= 0) return null;
  const { repeats_allowed, repeats_used, remaining, valid_until, reason } = eligibility;

  return (
    <Box component="section" aria-label="Refills">
      <Card padding="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Group gap="xs">
              <IconRepeat size={16} />
              <Text fw={600} size="sm">
                Refills
              </Text>
              <Badge tone={remaining > 0 ? "info" : "neutral"} size="sm">
                {repeats_used} of {repeats_allowed} used
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {reason ?? `${remaining} left`}
              {valid_until && ` · valid until ${formatDate(valid_until)}`}
            </Text>
          </Stack>
          {canIssue && (
            <Button
              size="xs"
              tone="primary"
              leftSection={<IconRepeat size={14} />}
              loading={issue.isPending}
              disabled={reason !== null}
              onClick={() => issue.mutate()}
            >
              Issue refill
            </Button>
          )}
        </Group>
      </Card>
    </Box>
  );
}
