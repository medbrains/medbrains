import { api } from "@medbrains/api";
import { queuesSharingPool } from "@medbrains/schemas";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Alert } from "@/components/ui";

interface SharedPoolNoteProps {
  /** The prefix being typed. */
  prefix: string;
  /** The queue being edited; null for a new one. */
  queueId: string | null;
}

/**
 * Tells the admin when another recycling queue has this prefix. A number held
 * anywhere in the hospital is not given out again, so both queues draw from
 * one pool and run out together.
 */
export function SharedPoolNote({ prefix, queueId }: SharedPoolNoteProps) {
  // The Admin → Queues list's own query: already in the cache behind the form.
  const queues = useQuery({ queryKey: ["queues"], queryFn: () => api.listQueues() });
  const sharing = useMemo(
    () => queuesSharingPool(queues.data ?? [], prefix, queueId),
    [queues.data, prefix, queueId],
  );
  if (sharing.length === 0) return null;
  const names = sharing.map((q) => q.name).join(", ");
  return (
    <Alert tone="info" title="Shares one number pool" data-testid="queue-shared-pool">
      {names} also recycles {prefix.trim().toUpperCase()} numbers. A number in use or cooling off in
      either queue is not given out by the other.
    </Alert>
  );
}
