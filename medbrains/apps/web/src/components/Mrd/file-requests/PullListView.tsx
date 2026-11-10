import { Group, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { QueryError } from "@/components/QueryError";
import { Badge, Button, Card, Input, toast } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";
import { groupByDoctor, STATUS_LABEL, STATUS_TONE, tomorrowIso } from "./fileRequestTime";

interface PullListViewProps {
  canFulfil: boolean;
}

/**
 * The night-before pull list: one day's file requests by doctor and time.
 * The evening job builds tomorrow's automatically; "Build pull list" does it
 * now (and again after late bookings — it only adds what is missing).
 */
export function PullListView({ canFulfil }: PullListViewProps) {
  const qc = useQueryClient();
  const [date, setDate] = useState(tomorrowIso);
  const list = useQuery({
    queryKey: ["mrd-file-requests", "date", date],
    queryFn: () => mrdService.listMrdFileRequests({ date }),
    enabled: date.length === 10,
  });
  const build = useMutation({
    mutationFn: () => mrdService.buildMrdPullList({ date }),
    onSuccess: (built) => {
      void qc.invalidateQueries({ queryKey: ["mrd-file-requests"] });
      toast.success(`${built.created} files added to the pull list`);
    },
    onError: (error: Error) => toast.error(error.message, { title: "Pull list not built" }),
  });
  const groups = useMemo(() => groupByDoctor(list.data ?? []), [list.data]);

  return (
    <Stack gap="md">
      <Group align="flex-end" wrap="wrap">
        <Input
          type="date"
          label="Visit date"
          value={date}
          onChange={(event) => setDate(event.currentTarget.value)}
        />
        {canFulfil && (
          <Button tone="primary" onClick={() => build.mutate()} loading={build.isPending}>
            Build pull list
          </Button>
        )}
      </Group>
      {list.isError && (
        <QueryError
          title="The pull list did not load"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      )}
      {list.data?.length === 0 && <Text c="dimmed">No files to pull for this date yet.</Text>}
      {groups.map(([doctor, rows]) => (
        <Card key={doctor} padding="sm" pattern={false}>
          <Title order={4} mb="xs">
            {doctor} · {rows.length}
          </Title>
          <Stack gap={4}>
            {rows.map((row) => (
              <Group key={row.id} justify="space-between" wrap="wrap" gap="xs">
                <Text size="sm" ff="monospace">
                  {row.slot_start?.slice(0, 5) ?? "--:--"} · {row.record_number}
                </Text>
                <Text size="sm">{row.patient_name}</Text>
                <Text size="sm" c="dimmed">
                  {row.location_label ?? "Shelf not recorded"}
                </Text>
                <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
              </Group>
            ))}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
