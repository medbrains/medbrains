import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Alert, Badge, FloorMap, FloorMapTable } from "@/components/ui";
import { floorSummary, zoneViews } from "./flow-state";

/** A wall board reads every 30 s and keeps its last good floor between reads. */
const BOARD_REFRESH_MS = 30_000;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

/**
 * The command-centre wall board: the floor map in large type, crowd overlay,
 * counts only. No recommendations and no history on a wall. A failed read
 * keeps the last good floor with "stale since", never a blank screen.
 */
export function FlowBoard({ floorId }: { floorId?: string }) {
  const board = useQuery({
    queryKey: ["flow", "board", floorId ?? "device"],
    queryFn: () => api.getFlowBoard(floorId),
    refetchInterval: BOARD_REFRESH_MS,
    retry: 2,
  });
  const data = board.data;
  // One snapshot replaces the last; nothing accumulates over a week on the wall.
  const views = useMemo(() => (data ? zoneViews(data.zones, "crowd", []) : []), [data]);
  if (!data) {
    return board.isError ? (
      <Alert tone="warning">
        Flow is not reachable. This board will show the floor as soon as it is.
      </Alert>
    ) : null;
  }
  const summary = floorSummary(data.floor_name, views);
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fz={28} fw={600}>
          {data.floor_name}
        </Text>
        <Group gap="xs">
          <Badge tone="info" size="lg">
            Estimated
          </Badge>
          {data.as_of && <Text fz={20}>Updated {timeOf(data.as_of)}</Text>}
        </Group>
      </Group>
      {(board.isError || data.stale) && (
        <Alert tone="warning">
          {data.as_of ? `Stale since ${timeOf(data.as_of)}.` : "No reading yet."} Showing the last
          known floor.
        </Alert>
      )}
      <FloorMap zones={views} summary={summary} height={560} large />
      <FloorMapTable zones={views} caption={summary} metricLabel="People" />
    </Stack>
  );
}
