/**
 * "They came back" — putting a no-show back in the queue.
 *
 * A number is called, the patient is in the toilet or gone to the chemist, and
 * the desk marks them no-show. Then they turn up. Until now the only thing the
 * desk could do was issue a new token: a new number, the back of the queue, and
 * the slip in the patient's hand no longer means anything.
 *
 * `POST /api/tokens/{id}/requeue` has existed for exactly this and nothing
 * called it. It keeps the token number, so the slip and the phone link both
 * still work, and it honours the hospital's recall policy — back of the queue
 * by default, or behind N people where the desk has set
 * `queue.missed_token_recall_after`.
 *
 * Shown as a short, self-clearing list rather than a search. The desk is
 * looking at somebody standing in front of them who was called minutes ago;
 * making them type a token number to find that person is the wrong shape.
 */

import { Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import { type ModuleToken, P, recentlyMissedTokens } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { frontOfficeService } from "@/services/frontOffice.service";

/** Which board to watch. The desk that misses tokens is the OPD desk. */
const MODULE = "opd";

/**
 * How often the list re-reads.
 *
 * A patient walks back to the desk in a minute or two, so a stale list is a
 * desk telling somebody standing in front of them that they are not there.
 */
const REFRESH_MS = 15_000;

export function CameBackPanel() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.FRONT_OFFICE.QUEUE_MANAGE);

  // `listOpdTokenBoard` rather than a plain board read, and the distinction
  // is the whole panel: `/api/tokens/board` returns only waiting, called and
  // serving unless `include_finished` is set, so a board read without it can
  // never contain a no_show row. This panel filtered that result for
  // no_show and therefore always found none — it rendered null every time it
  // was mounted. The key carries the flag so it cannot silently share a cache
  // entry with a board that excludes finished tokens.
  const { data, isLoading, isError } = useQuery({
    queryKey: ["token-board", MODULE, "include-finished"],
    queryFn: () => frontOfficeService.listOpdTokenBoard(),
    refetchInterval: REFRESH_MS,
  });

  // Filtered with the shared helper rather than a local predicate: a board and
  // a desk disagreeing about what "recently missed" means is how a patient is
  // announced in one place and absent from the other.
  const missed = useMemo(() => recentlyMissedTokens<ModuleToken>(data ?? [], Date.now()), [data]);

  const requeue = useMutation({
    mutationFn: (id: string) => frontOfficeService.requeueToken(id),
    onSuccess: (token) => {
      notifications.show({ message: `${token.number} is back in the queue.` });
      void queryClient.invalidateQueries({ queryKey: ["token-board", MODULE, "include-finished"] });
      void queryClient.invalidateQueries({ queryKey: ["front-office", "queue-stats"] });
    },
    onError: (error: Error) => notifications.show({ color: "red", message: error.message }),
  });

  if (isLoading || isError) {
    // Silent on both: this panel sits above the day's real work, and a
    // spinner or an error card for a list that is usually empty is noise.
    return null;
  }

  if (missed.length === 0) {
    return null;
  }

  return (
    <Card withBorder>
      <Stack gap="sm" p="md">
        <Stack gap={2}>
          <Text fw={600}>Called and missed</Text>
          <Text size="xs" c="dimmed">
            If one of these is at the desk now, put them back in the queue. They keep their number.
          </Text>
        </Stack>

        {!canManage && (
          <Alert tone="info" title="You can see these but not requeue them">
            Ask someone with queue management rights.
          </Alert>
        )}

        {missed.map((token) => (
          <Group key={token.id} justify="space-between" wrap="nowrap">
            <Stack gap={0}>
              <Text fw={600}>{token.number}</Text>
              <Text size="xs" c="dimmed">
                {token.patient_name ?? "No name on the token"}
                {token.counter_label ? ` · ${token.counter_label}` : ""}
              </Text>
            </Stack>
            <Group gap="xs" wrap="nowrap">
              <Badge tone="warning">missed</Badge>
              {canManage && (
                <Button
                  tone="secondary"
                  size="xs"
                  loading={requeue.isPending && requeue.variables === token.id}
                  disabled={requeue.isPending}
                  onClick={() => requeue.mutate(token.id)}
                  aria-label={`Put token ${token.number} back in the queue`}
                >
                  They came back
                </Button>
              )}
            </Group>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}
