import { Group, Stack, Text } from "@mantine/core";
import { useInterval } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { MrdFileRequest, MrdFileScanStep } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useEffectOnce } from "react-use";
import { QueryError } from "@/components/QueryError";
import { SegmentedControl, toast } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";
import { FileRequestCard } from "./FileRequestCard";
import { PullListView } from "./PullListView";
import { ScanFileModal } from "./ScanFileModal";

/** The queue refreshes this often; the timers tick on the same beat. */
const REFRESH_MS = 15_000;

type View = "open" | "pull";

/**
 * The runner's queue: every open file request, soonest due first, with a
 * live timer each. A failed read is shown as a fault with a retry, never as
 * an empty queue — "no files waiting" is something a runner acts on.
 */
export function FileRequestsTab() {
  const qc = useQueryClient();
  const canFulfil = useHasPermission(P.MRD.FILE_REQUEST.FULFIL);
  const [view, setView] = useState<View>("open");
  const [now, setNow] = useState(() => Date.now());
  const [scanning, setScanning] = useState<{ row: MrdFileRequest; step: MrdFileScanStep } | null>(
    null,
  );
  const tick = useInterval(() => setNow(Date.now()), REFRESH_MS);
  useEffectOnce(() => {
    tick.start();
    return tick.stop;
  });

  const queue = useQuery({
    queryKey: ["mrd-file-requests", "open"],
    queryFn: () => mrdService.listMrdFileRequests(),
    refetchInterval: REFRESH_MS,
    enabled: view === "open",
  });
  const notFound = useMutation({
    mutationFn: (row: MrdFileRequest) => mrdService.markMrdFileNotFound(row.id),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["mrd-file-requests"] });
      toast.warning(`File ${row.record_number} marked not found; the supervisor will be told`);
    },
    onError: (error: Error) => toast.error(error.message, { title: "Not recorded" }),
  });

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <SegmentedControl
          value={view}
          onChange={(value) => setView(value as View)}
          data={[
            { value: "open", label: "Waiting now" },
            { value: "pull", label: "Pull list" },
          ]}
          aria-label="File requests view"
        />
        {view === "open" && queue.data && (
          <Text size="sm" c="dimmed" aria-live="polite">
            {queue.data.length} waiting
          </Text>
        )}
      </Group>

      {view === "pull" && <PullListView canFulfil={canFulfil} />}

      {view === "open" && queue.isError && (
        <QueryError
          title="File requests did not load"
          error={queue.error}
          onRetry={() => void queue.refetch()}
        />
      )}
      {view === "open" && queue.data?.length === 0 && (
        <Text c="dimmed">No files waiting. New OPD visits appear here as they register.</Text>
      )}
      {view === "open" &&
        queue.data?.map((row) => (
          <FileRequestCard
            key={row.id}
            request={row}
            now={now}
            canFulfil={canFulfil}
            onScan={(r, step) => setScanning({ row: r, step })}
            onNotFound={(r) => notFound.mutate(r)}
          />
        ))}

      <ScanFileModal
        request={scanning?.row ?? null}
        step={scanning?.step ?? "picked"}
        onClose={() => setScanning(null)}
      />
    </Stack>
  );
}
