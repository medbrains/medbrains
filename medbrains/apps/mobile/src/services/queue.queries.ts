import type { QueueEntry } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queueService } from "./queue.service";

export type QueueFilter = "all" | "waiting" | "called" | "in_progress";

type QueueAction = (id: string) => Promise<{ status: string }>;

const QUEUE_QUERY_KEY = ["queue"] as const;

function queueStatusForFilter(filter: QueueFilter): string | undefined {
  if (filter === "all") return undefined;
  return filter === "in_progress" ? "in_consultation" : filter;
}

function queueParams(
  departmentId: string | undefined,
  filter: QueueFilter,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (departmentId) params.department_id = departmentId;
  const status = queueStatusForFilter(filter);
  if (status) params.status = status;
  return params;
}

export function useQueueQuery({
  departmentId,
  enabled = true,
  filter,
}: {
  departmentId?: string;
  enabled?: boolean;
  filter: QueueFilter;
}) {
  return useQuery<QueueEntry[]>({
    queryKey: [...QUEUE_QUERY_KEY, departmentId ?? "all-departments", filter],
    queryFn: () => queueService.listQueue(queueParams(departmentId, filter)),
    enabled,
    refetchInterval: 30000,
  });
}

export function useStaffDashboardQueueQuery(options?: { enabled?: boolean }) {
  return useQuery<QueueEntry[]>({
    queryKey: [...QUEUE_QUERY_KEY, "staff-dashboard"],
    queryFn: () => queueService.listQueue({}),
    enabled: options?.enabled ?? true,
    refetchInterval: 30000,
  });
}

function useQueueActionMutation(action: QueueAction) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY }),
  });
}

export function useCallQueueEntryMutation() {
  return useQueueActionMutation(queueService.callQueueEntry);
}

export function useStartConsultationMutation() {
  return useQueueActionMutation(queueService.startConsultation);
}

export function useCompleteQueueEntryMutation() {
  return useQueueActionMutation(queueService.completeQueueEntry);
}

export function useMarkNoShowMutation() {
  return useQueueActionMutation(queueService.markNoShow);
}
