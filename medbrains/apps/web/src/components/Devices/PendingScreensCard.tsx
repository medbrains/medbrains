import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasAnyPermission } from "@medbrains/stores";
import type { DevicePairingRequest } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Card, Select, toast } from "@/components/ui";
import { DEPARTMENT_LIST_CODES } from "@/lib/api-permission-sets";

/** The boards a waiting-room screen can show. */
export const BOARDS = [
  { value: "opd", label: "OPD" },
  { value: "registration", label: "Registration" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "lab", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "billing", label: "Billing" },
];

interface ScreenRowProps {
  request: DevicePairingRequest;
  departments: { value: string; label: string }[];
}

/** One screen asking to be paired: choose its board, then approve or deny. */
function ScreenRow({ request, departments }: ScreenRowProps) {
  const queryClient = useQueryClient();
  const [board, setBoard] = useState<string | null>("opd");
  const [department, setDepartment] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: (deny: boolean) =>
      api.approveDevicePairingRequest({
        user_code: request.user_code,
        deny,
        department_id: deny ? undefined : (department ?? undefined),
        board_module: deny ? undefined : (board ?? undefined),
      }),
    onSuccess: (_, deny) => {
      void queryClient.invalidateQueries({ queryKey: ["device-pairing-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["paired-devices"] });
      toast.success(deny ? "Screen refused" : "Screen paired — it opens its board by itself");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Not done" }),
  });

  return (
    <Card data-testid={`row-screen-${request.user_code}`}>
      <Group align="flex-end" wrap="wrap" gap="sm">
        <Stack gap={0}>
          <Text size="xs" c="dimmed">
            Code on the screen
          </Text>
          <Text ff="monospace" fw={700} size="lg">
            {request.user_code}
          </Text>
          <Text size="xs" c="dimmed">
            {request.requested_label}
          </Text>
        </Stack>
        <Select label="Board" data={BOARDS} value={board} onChange={setBoard} w={160} />
        <Select
          label="Department"
          placeholder="Which department"
          data={departments}
          value={department}
          onChange={setDepartment}
          searchable
          w={220}
          data-testid={`picker-screen-department-${request.user_code}`}
        />
        <Button
          tone="primary"
          onClick={() => decide.mutate(false)}
          loading={decide.isPending}
          disabled={!board || !department}
          data-testid={`btn-approve-screen-${request.user_code}`}
        >
          Approve
        </Button>
        <Button tone="subtle-danger" onClick={() => decide.mutate(true)} loading={decide.isPending}>
          Deny
        </Button>
      </Group>
    </Card>
  );
}

/**
 * Waiting-room screens asking to be paired. A TV shows a code; the
 * administrator matches it here and chooses the board it shows. The screen
 * then acts as the hospital's display account — never as the administrator.
 */
export function PendingScreensCard() {
  const canListDepartments = useHasAnyPermission(DEPARTMENT_LIST_CODES);
  const requests = useQuery({
    queryKey: ["device-pairing-requests"],
    queryFn: () => api.listDevicePairingRequests(),
    // A TV is waiting on the other side of the room; show it promptly.
    refetchInterval: 5_000,
  });
  const departments = useQuery({
    queryKey: ["setup-departments"],
    queryFn: () => api.listDepartments(),
    enabled: canListDepartments,
    staleTime: 600_000,
  });
  const departmentOptions = (departments.data ?? []).map((d) => ({ value: d.id, label: d.name }));

  return (
    <Card>
      <Stack gap="sm">
        <Text fw={600}>Screens waiting to be paired</Text>
        {requests.isError && <Alert tone="danger">Could not load the screens waiting.</Alert>}
        {requests.isSuccess && requests.data.length === 0 && (
          <Text size="sm" c="dimmed">
            No screens are waiting. Open the waiting-room board on the TV to get a code.
          </Text>
        )}
        {(requests.data ?? []).map((request) => (
          <ScreenRow key={request.id} request={request} departments={departmentOptions} />
        ))}
      </Stack>
    </Card>
  );
}
