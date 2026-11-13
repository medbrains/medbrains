import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasAnyPermission } from "@medbrains/stores";
import type { DevicePairingRequest } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Input, Select, toast } from "@/components/ui";
import { DEPARTMENT_LIST_CODES, STATION_LIST_CODES } from "@/lib/api-permission-sets";
import { formatTime } from "@/lib/date-utils";
import { ScreenUrlHint } from "./ScreenUrlHint";

/** The boards a waiting-room screen can show. */
export const BOARDS = [
  { value: "opd", label: "OPD" },
  { value: "registration", label: "Registration" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "lab", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "billing", label: "Billing" },
  { value: "counter_display", label: "Customer display (counter)" },
  // MedBrains Flow: the crowd map of the floor this department's zone is on.
  { value: "flow", label: "Flow (crowd map)" },
];

/** A customer display is bound to a counter, not a department (#4883). */
const COUNTER_DISPLAY = "counter_display";
const COUNTER_TYPES = new Set(["billing_counter", "pharmacy_counter"]);
/** Letters and digits in a pairing code; the dash and spaces are forgiven. */
const CODE_LENGTH = 8;
/** What each app variant is, in words. Only screens pair by code. */
const VARIANT_LABELS: Record<string, string> = { tv: "Screen (TV)" };

/** Whether `typed` has as many letters and digits as a pairing code. */
export function isCompleteCode(typed: string): boolean {
  return typed.replace(/[^a-z0-9]/gi, "").length === CODE_LENGTH;
}

interface Option {
  value: string;
  label: string;
}

interface ScreenRowProps {
  request: DevicePairingRequest;
  departments: Option[];
  counters: Option[];
}

/**
 * One screen asking to be paired: type the code it shows, choose its board,
 * then approve; or deny. The list never carries the code — typing it is how
 * the server knows the approver can see that screen.
 */
function ScreenRow({ request, departments, counters }: ScreenRowProps) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [board, setBoard] = useState<string | null>("opd");
  const [department, setDepartment] = useState<string | null>(null);
  const [counter, setCounter] = useState<string | null>(null);
  const isCounter = board === COUNTER_DISPLAY;
  const decide = useMutation({
    mutationFn: (deny: boolean) =>
      api.approveDevicePairingRequest({
        request_id: request.id,
        user_code: deny ? undefined : code,
        deny,
        department_id: deny || isCounter ? undefined : (department ?? undefined),
        board_module: deny ? undefined : (board ?? undefined),
        station_id: deny || !isCounter ? undefined : (counter ?? undefined),
      }),
    onSuccess: (_, deny) => {
      void queryClient.invalidateQueries({ queryKey: ["device-pairing-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["paired-devices"] });
      toast.success(deny ? "Screen refused" : "Screen paired — it opens its board by itself");
    },
    onError: (error: Error) => {
      // A fifth wrong code refuses the request; the list drops it.
      void queryClient.invalidateQueries({ queryKey: ["device-pairing-requests"] });
      toast.error(error.message, { title: "Not done" });
    },
  });

  return (
    <Card data-testid={`row-screen-${request.reference}`}>
      <Group align="flex-end" wrap="wrap" gap="sm">
        <Stack gap={2}>
          <Text ff="monospace" fw={700}>
            Screen {request.reference}
          </Text>
          <Text size="xs">{request.requested_label}</Text>
          <Group gap="xs">
            <Badge tone="neutral">
              {VARIANT_LABELS[request.app_variant] ?? request.app_variant}
            </Badge>
            <Text size="xs" c="dimmed">
              Asked at {formatTime(request.created_at)}
            </Text>
          </Group>
        </Stack>
        <Input
          label="Code on the screen"
          description="Type it from the screen"
          placeholder="XXXX-XXXX"
          value={code}
          onChange={(event) => setCode(event.currentTarget.value)}
          maxLength={CODE_LENGTH + 2}
          autoComplete="off"
          spellCheck={false}
          required
          ff="monospace"
          w={160}
          data-testid={`input-screen-code-${request.reference}`}
        />
        <Select label="Board" data={BOARDS} value={board} onChange={setBoard} w={160} />
        {isCounter ? (
          <Select
            label="Counter"
            placeholder="Which counter"
            data={counters}
            value={counter}
            onChange={setCounter}
            searchable
            w={220}
            nothingFoundMessage="No billing or pharmacy counters — add one under Manage stations"
            data-testid={`picker-screen-counter-${request.reference}`}
          />
        ) : (
          <Select
            label="Department"
            placeholder="Which department"
            data={departments}
            value={department}
            onChange={setDepartment}
            searchable
            w={220}
            data-testid={`picker-screen-department-${request.reference}`}
          />
        )}
        <Button
          tone="primary"
          onClick={() => decide.mutate(false)}
          loading={decide.isPending}
          disabled={!isCompleteCode(code) || !board || !(isCounter ? counter : department)}
          data-testid={`btn-approve-screen-${request.reference}`}
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
 * Waiting-room screens asking to be paired with this hospital. A TV shows a
 * reference and a code; the administrator finds the reference here, types the
 * code and chooses the board it shows. The screen then acts as the hospital's
 * display account — never as the administrator.
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
  const canListStations = useHasAnyPermission(STATION_LIST_CODES);
  const stations = useQuery({
    queryKey: ["stations"],
    queryFn: () => api.listStations(),
    enabled: canListStations,
    staleTime: 600_000,
  });
  const counterOptions = (stations.data ?? [])
    .filter((s) => COUNTER_TYPES.has(s.station_type) && s.is_active)
    .map((s) => ({ value: s.id, label: s.name }));

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
        <ScreenUrlHint />
        {stations.isError && (
          <Alert tone="warning">
            Could not load the counters, so a customer display cannot be paired.
          </Alert>
        )}
        {(requests.data ?? []).map((request) => (
          <ScreenRow
            key={request.id}
            request={request}
            departments={departmentOptions}
            counters={counterOptions}
          />
        ))}
      </Stack>
    </Card>
  );
}
