// The wait a patient is actually standing in.
//
// The board already tells someone their number. It did not tell them how long,
// which is the only other thing they want to know and the reason they walk over
// and ask. The estimate existed on a staff screen and had never been shown to
// the person waiting.
//
// Kept out of token-boards-tab.tsx, which is already 880 lines.

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui";
import { opdService } from "@/services/opd.service";

interface BoardWaitEstimateProps {
  /** Kiosk mode is read across a room, so it gets the large treatment. */
  isKiosk?: boolean;
}

export function BoardWaitEstimate({ isKiosk = false }: BoardWaitEstimateProps) {
  // The wait estimate is derived from the live OPD queue.
  const canViewQueue = useHasPermission(P.OPD.QUEUE_VIEW);

  const { t } = useTranslation("frontOffice");

  // The board is per surface rather than per department, so the estimate is the
  // whole OPD queue — which is what somebody reading a waiting-room screen is
  // standing in.
  const { data: estimate } = useQuery({
    queryKey: ["opd-wait-estimate", "board"],
    queryFn: () => opdService.getWaitEstimate(),
    enabled: canViewQueue,
    staleTime: 30_000,
  });

  if (!estimate) return null;

  const minutes = estimate.estimated_minutes;
  // Three outcomes, not two. `null` means this queue has never been measured,
  // which is not the same as a wait of zero -- and on a kiosk in a waiting
  // room, the difference is a patient who leaves and one who does not.
  const headline =
    minutes === null
      ? t("tokenBoards.wait.unknown", "Wait time not yet known")
      : minutes <= 0
        ? t("tokenBoards.wait.next")
        : t("tokenBoards.wait.minutes", { count: minutes });

  return (
    <Card withBorder padding={isKiosk ? "lg" : "md"}>
      <Group justify="space-between" align="center" wrap="nowrap">
        <Stack gap={2}>
          <Text size={isKiosk ? "sm" : "xs"} c="dimmed">
            {t("tokenBoards.wait.label")}
          </Text>
          <Text fw={700} size={isKiosk ? "32px" : "lg"}>
            {headline}
          </Text>
        </Stack>
        <Stack gap={2} align="flex-end">
          <Text size="xs" c="dimmed">
            {t("tokenBoards.wait.ahead", { count: estimate.queue_position })}
          </Text>
          {estimate.median_consultation_minutes !== null && (
            <Text size="xs" c="dimmed">
              {t("tokenBoards.wait.pace", {
                minutes: Math.round(estimate.median_consultation_minutes),
              })}
            </Text>
          )}
        </Stack>
      </Group>
    </Card>
  );
}
