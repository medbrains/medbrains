/**
 * Refills a patient can ask for. Each recent prescription says what asking
 * would do — straight to the pharmacy, or to the doctor first — or why it
 * can't be asked for now, and how the last request went.
 */

import { Box, Group, Stack, Text, Title } from "@mantine/core";
import type { PortalRefill, PortalRefillRequest } from "@medbrains/types";
import { IconRepeat } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, type BadgeTone, Button, Card, toast } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import { portalDate } from "./portal-format";
import { PortalList } from "./portal-list";

const REQUEST_STATUS: Record<PortalRefillRequest["status"], { label: string; tone: BadgeTone }> = {
  with_doctor: { label: "With your doctor", tone: "info" },
  sent_to_pharmacy: { label: "Sent to the pharmacy", tone: "success" },
  declined: { label: "Declined", tone: "warning" },
};

function LastRequest({ request }: { request: PortalRefillRequest }) {
  const status = REQUEST_STATUS[request.status];
  return (
    <Stack gap={2}>
      <Group gap="xs">
        <Badge tone={status.tone} size="sm">
          {status.label}
        </Badge>
        <Text size="xs" c="dimmed">
          Asked {portalDate(request.created_at)}
        </Text>
      </Group>
      {request.decision_note && <Text size="sm">Doctor's note: {request.decision_note}</Text>}
    </Stack>
  );
}

function RefillCard({ row, token }: { row: PortalRefill; token: string }) {
  const queryClient = useQueryClient();
  const ask = useMutation({
    mutationFn: () => portalService.requestPortalRefill(token, row.prescription_id, {}),
    onSuccess: (request) => {
      toast.success(
        request.status === "with_doctor"
          ? "Your doctor will look at it. We'll show their answer here."
          : "The pharmacy will have it ready.",
        { title: "Refill requested" },
      );
      void queryClient.invalidateQueries({ queryKey: ["portal-refills"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Refill not requested" }),
  });

  return (
    <Box component="section" aria-label={`Refill: ${row.drugs.join(", ")}`}>
      <Card>
        <Stack gap="xs" p="md">
          <Text fw={600}>{row.drugs.join(", ")}</Text>
          <Text size="xs" c="dimmed">
            Prescribed {portalDate(row.prescribed_at)}
            {row.doctor_name && ` by Dr. ${row.doctor_name}`}
            {row.valid_until && ` · valid until ${portalDate(row.valid_until)}`}
            {row.refills_left > 0 && ` · ${row.refills_left} refill(s) left`}
          </Text>
          {row.latest_request && <LastRequest request={row.latest_request} />}
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm">{row.message}</Text>
            {row.goes_to && (
              <Button
                size="sm"
                tone="primary"
                leftSection={<IconRepeat size={16} />}
                loading={ask.isPending}
                onClick={() => ask.mutate()}
              >
                Request refill
              </Button>
            )}
          </Group>
        </Stack>
      </Card>
    </Box>
  );
}

export function PortalRefills({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["portal-refills"],
    queryFn: () => portalService.getPortalRefills(token),
    retry: false,
  });

  return (
    <Stack gap="sm">
      <Title order={3}>Refills</Title>
      <PortalList query={query} empty="You have no recent prescriptions to refill.">
        {(rows: PortalRefill[]) =>
          rows.map((row) => <RefillCard key={row.prescription_id} row={row} token={token} />)
        }
      </PortalList>
    </Stack>
  );
}
