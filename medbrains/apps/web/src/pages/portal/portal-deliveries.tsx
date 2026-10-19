/**
 * Deliveries the patient asked for: where each is, when it moved, who is
 * bringing it, the code to give the runner, and the link to pay while a
 * payment is owed. Only the patient's own; never the runner's phone.
 */

import { Box, Group, Stack, Text, Title } from "@mantine/core";
import type { PortalDelivery } from "@medbrains/types";
import { IconExternalLink } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";
import { portalService } from "@/services/portal.service";
import { deliverySteps, PAYMENT_LABEL, SLOT_LABEL, STAGE_VIEW } from "./portal-delivery";
import { PortalList } from "./portal-list";

/** How often an open delivery is checked for news. */
const REFRESH_MS = 30_000;

function DeliveryCard({ d }: { d: PortalDelivery }) {
  const stage = STAGE_VIEW[d.stage];
  return (
    <Box component="section" aria-label={`Delivery: ${d.drugs.join(", ")}`}>
      <Card>
        <Stack gap="xs" p="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={600}>{d.drugs.join(", ") || "Your medicines"}</Text>
            <Badge tone={stage.tone} size="sm">
              {stage.label}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {[
              d.address,
              d.preferred_slot && SLOT_LABEL[d.preferred_slot],
              d.payment && PAYMENT_LABEL[d.payment],
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {deliverySteps(d).map((s) => (
            <Text key={s.label} size="sm">
              {s.label}: {formatDateTime(s.at)}
            </Text>
          ))}
          {d.carrier && (
            <Text size="sm">
              Bringing it: {d.carrier}
              {d.tracking_ref && ` · tracking ${d.tracking_ref}`}
            </Text>
          )}
          {d.note && <Text size="sm">{d.note}</Text>}
          {d.amount_due && d.stage !== "delivered" && (
            <Text size="sm">To pay when it arrives: ₹{d.amount_due}</Text>
          )}
          {d.handover_code && (
            <Stack gap={0}>
              <Text size="xs" c="dimmed">
                Give this code to the person delivering, only when you have your medicines
              </Text>
              <Text
                ff="monospace"
                fz="xl"
                fw={700}
                aria-label={`Delivery code ${d.handover_code.split("").join(" ")}`}
              >
                {d.handover_code}
              </Text>
            </Stack>
          )}
          {d.stage === "awaiting_payment" &&
            (d.payment_url ? (
              <Button
                component="a"
                href={d.payment_url}
                target="_blank"
                rel="noopener noreferrer"
                tone="primary"
                rightSection={<IconExternalLink size={16} />}
              >
                Pay ₹{d.pay_amount} now
              </Button>
            ) : (
              <Text size="sm">Your payment link is being made. Check back in a minute.</Text>
            ))}
        </Stack>
      </Card>
    </Box>
  );
}

export function PortalDeliveries({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["portal-deliveries"],
    queryFn: () => portalService.getPortalDeliveries(token),
    refetchInterval: REFRESH_MS,
    retry: false,
  });
  return (
    <Stack gap="sm">
      <Title order={3}>Deliveries</Title>
      <PortalList query={query} empty="Medicines you ask to have delivered appear here.">
        {(rows: PortalDelivery[]) => rows.map((d) => <DeliveryCard key={d.id} d={d} />)}
      </PortalList>
    </Stack>
  );
}
