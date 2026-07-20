// Bedside-portal BedsideOperationsPanel — split from bedside-portal.tsx (pure move).

import { Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type {
  BedsideNurseRequestRow,
  BedsideRequestStatus,
  BedsideSessionRow,
} from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import { bedsideService } from "@/services/bedside.service";
import { compactContextId, REQUEST_TYPE_CONFIG } from "./shared";

const requestStatusColors: Record<BedsideRequestStatus, BadgeTone> = {
  pending: "warning",
  acknowledged: "info",
  in_progress: "accent",
  completed: "success",
  cancelled: "neutral",
};

export function BedsideOperationsPanel({
  admissionId,
  canListSessions,
  canManageSessions,
  canViewRequests,
}: {
  admissionId: string;
  canListSessions: boolean;
  canManageSessions: boolean;
  canViewRequests: boolean;
}) {
  const queryClient = useQueryClient();

  const sessionsQ = useQuery({
    queryKey: ["bedside", "sessions"],
    queryFn: () => bedsideService.listBedsideSessions(),
    enabled: canListSessions,
  });

  const requestsQ = useQuery({
    queryKey: ["bedside", "nurse-requests", admissionId],
    queryFn: () => bedsideService.listBedsideNurseRequests(admissionId),
    enabled: canViewRequests && admissionId.length > 0,
  });

  const endSessionMut = useMutation({
    mutationFn: (sessionId: string) => bedsideService.endBedsideSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bedside", "sessions"] });
      notifications.show({ title: "Session ended", message: "Bedside tablet session closed." });
    },
  });

  const updateRequestMut = useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: BedsideRequestStatus }) =>
      bedsideService.updateBedsideRequestStatus(requestId, { status }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["bedside", "nurse-requests", admissionId] }),
  });

  return (
    <Stack gap="md">
      {canListSessions && (
        <Card withBorder padding="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Tablet Sessions</Title>
            <Badge tone="neutral" variant="light">
              {(sessionsQ.data ?? []).filter((session) => session.is_active).length} active
            </Badge>
          </Group>
          {sessionsQ.isLoading ? (
            <Loader size="sm" />
          ) : (
            <DataTable
              columns={[
                {
                  key: "admission",
                  label: "Admission",
                  render: (session: BedsideSessionRow) => (
                    <>
                      <Text size="sm" fw={600}>
                        {compactContextId(session.admission_id)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Patient {compactContextId(session.patient_id)}
                      </Text>
                    </>
                  ),
                },
                {
                  key: "bed_device",
                  label: "Bed / Device",
                  render: (session: BedsideSessionRow) => (
                    <>
                      <Text size="sm">{session.bed_location ?? "—"}</Text>
                      <Text size="xs" c="dimmed">
                        {session.device_id ?? "No device id"}
                      </Text>
                    </>
                  ),
                },
                {
                  key: "started",
                  label: "Started",
                  render: (session: BedsideSessionRow) => (
                    <Text size="sm">{new Date(session.started_at).toLocaleString()}</Text>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (session: BedsideSessionRow) => (
                    <Badge tone={session.is_active ? "success" : "neutral"} variant="light">
                      {session.is_active ? "Active" : "Ended"}
                    </Badge>
                  ),
                },
                ...(canManageSessions
                  ? [
                      {
                        key: "actions",
                        label: "Actions",
                        render: (session: BedsideSessionRow) => (
                          <Button
                            tone="secondary"
                            size="xs"
                            disabled={!session.is_active}
                            loading={endSessionMut.isPending}
                            onClick={() => endSessionMut.mutate(session.id)}
                          >
                            End
                          </Button>
                        ),
                      },
                    ]
                  : []),
              ]}
              data={(sessionsQ.data ?? []).slice(0, 20)}
              rowKey={(session) => session.id}
            />
          )}
        </Card>
      )}

      {canViewRequests && admissionId.length > 0 && (
        <Card withBorder padding="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Nurse Request Queue</Title>
            <Badge tone="neutral" variant="light">
              {requestsQ.data?.length ?? 0} requests
            </Badge>
          </Group>
          {requestsQ.isLoading ? (
            <Loader size="sm" />
          ) : (
            <DataTable
              columns={[
                {
                  key: "request",
                  label: "Request",
                  render: (request: BedsideNurseRequestRow) => (
                    <>
                      <Text size="sm" fw={600}>
                        {REQUEST_TYPE_CONFIG[request.request_type]?.label ?? request.request_type}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {request.notes ?? "—"}
                      </Text>
                    </>
                  ),
                },
                {
                  key: "created",
                  label: "Created",
                  render: (request: BedsideNurseRequestRow) => (
                    <Text size="sm">{new Date(request.created_at).toLocaleString()}</Text>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (request: BedsideNurseRequestRow) => (
                    <Badge tone={requestStatusColors[request.status] ?? "neutral"} variant="light">
                      {request.status.replace(/_/g, " ")}
                    </Badge>
                  ),
                },
                ...(canManageSessions
                  ? [
                      {
                        key: "actions",
                        label: "Actions",
                        render: (request: BedsideNurseRequestRow) => (
                          <Group gap="xs" wrap="nowrap">
                            <Button
                              tone="secondary"
                              size="xs"
                              disabled={request.status !== "pending"}
                              loading={updateRequestMut.isPending}
                              onClick={() =>
                                updateRequestMut.mutate({
                                  requestId: request.id,
                                  status: "acknowledged",
                                })
                              }
                            >
                              Ack
                            </Button>
                            <Button
                              tone="secondary"
                              size="xs"
                              disabled={
                                request.status === "completed" || request.status === "cancelled"
                              }
                              loading={updateRequestMut.isPending}
                              onClick={() =>
                                updateRequestMut.mutate({
                                  requestId: request.id,
                                  status: "completed",
                                })
                              }
                            >
                              Done
                            </Button>
                          </Group>
                        ),
                      },
                    ]
                  : []),
              ]}
              data={requestsQ.data ?? []}
              rowKey={(request) => request.id}
            />
          )}
        </Card>
      )}
    </Stack>
  );
}
