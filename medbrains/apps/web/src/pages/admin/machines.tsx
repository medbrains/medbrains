/**
 * Admin → Machines. The main machine's Nodes screen (OS-SETUP-AND-TRUST §8): machines asking to
 * join, each with the code both screens show, and every machine that has joined.
 *
 * Each side proves itself to a person. The machine shows a code that is typed here, which is why it
 * is never shown here: beside Approve it could be copied without looking at the machine. Approving
 * then shows a second code to type on the machine, so a fake main machine gets nowhere.
 */

import { Group, PinInput, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { type DroppedRequest, type JoinedMachine, P, type WaitingMachine } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { Alert, Badge, Button, Card, Modal, Table, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { isRefusedAfterWrongCodes } from "./machine-refusal";

const MACHINES_KEY = ["machines"];
/** A machine is waiting on the other side of the room, so show it promptly. */
const REFRESH_MS = 3_000;
const CODE_LENGTH = 6;

/** The type a person chose on the machine, in words. */
function typeWords(appVariant: string): string {
  return appVariant === "Desktop-Display" ? "Display" : "Workstation";
}

interface ConfirmCodeDialogProps {
  label: string;
  code: string;
  onClose: () => void;
}

/** The second code: read here, typed on the machine, which only then trusts this main machine. */
function ConfirmCodeDialog({ label, code, onClose }: ConfirmCodeDialogProps) {
  return (
    <Modal opened onClose={onClose} title={`One more step for ${label}`} size="sm">
      <Stack gap="md">
        <Text size="sm">Type these digits on that machine's screen to finish joining.</Text>
        <Text ff="monospace" fw={700} size="xl" data-testid="text-confirm-code">
          {code}
        </Text>
        <Group justify="flex-end">
          <Button tone="primary" onClick={onClose} data-testid="btn-close-confirm-code">
            Done
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

interface ApproveDialogProps {
  machine: WaitingMachine;
  onClose: () => void;
}

/** Asks for the code on the machine's own screen, which the server checks. */
function ApproveDialog({ machine, onClose }: ApproveDialogProps) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const approve = useMutation({
    mutationFn: () => api.approveMachine(machine.id, code),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MACHINES_KEY }),
    onError: () => void queryClient.invalidateQueries({ queryKey: MACHINES_KEY }),
  });
  const isRefused = approve.isError && isRefusedAfterWrongCodes(approve.error.message);
  if (approve.data) {
    return (
      <ConfirmCodeDialog label={machine.label} code={approve.data.confirm_code} onClose={onClose} />
    );
  }
  return (
    <Modal opened onClose={onClose} title={`Approve ${machine.label}`} size="sm">
      <Stack gap="md">
        <Text size="sm">Type the {CODE_LENGTH} digits shown on that machine's screen.</Text>
        <PinInput
          length={CODE_LENGTH}
          type="number"
          oneTimeCode={false}
          value={code}
          onChange={setCode}
          aria-label="Code on the machine"
          data-testid="input-machine-code"
        />
        {approve.isError && <Alert tone="danger">{approve.error.message}</Alert>}
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onClose}>
            {isRefused ? "Close" : "Cancel"}
          </Button>
          <Button
            tone="primary"
            onClick={() => approve.mutate()}
            loading={approve.isPending}
            disabled={isRefused || code.length !== CODE_LENGTH}
            data-testid="btn-confirm-approve-machine"
          >
            Approve
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

interface WaitingCardProps {
  waiting: WaitingMachine[];
  canApprove: boolean;
}

/** Machines asking to join. Only those holding the right see Approve and Reject. */
function WaitingCard({ waiting, canApprove }: WaitingCardProps) {
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState<WaitingMachine | null>(null);
  const reject = useMutation({
    mutationFn: (id: string) => api.rejectMachine(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MACHINES_KEY });
      toast.success("Machine refused");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Not done" }),
  });
  return (
    <Card>
      <Stack gap="sm">
        <Text fw={600}>Waiting to join</Text>
        {waiting.length === 0 && (
          <Text size="sm" c="dimmed">
            No machines are waiting. On a new machine, choose "Connecting to my hospital".
          </Text>
        )}
        {waiting.map((machine) => (
          <Group key={machine.id} justify="space-between" data-testid={`row-waiting-${machine.id}`}>
            <Stack gap={0}>
              <Text fw={600}>{machine.label}</Text>
              <Text size="xs" c="dimmed">
                {typeWords(machine.app_variant)} · {machine.address ?? "address unknown"} · asks
                until {new Date(machine.expires_at).toLocaleTimeString()}
              </Text>
            </Stack>
            <Group gap="sm">
              {canApprove && (
                <>
                  <Button
                    tone="primary"
                    onClick={() => setApproving(machine)}
                    data-testid="btn-approve-machine"
                  >
                    Approve
                  </Button>
                  <Button
                    tone="subtle-danger"
                    onClick={() => reject.mutate(machine.id)}
                    loading={reject.isPending}
                    data-testid="btn-reject-machine"
                  >
                    Reject
                  </Button>
                </>
              )}
            </Group>
          </Group>
        ))}
      </Stack>
      {approving && <ApproveDialog machine={approving} onClose={() => setApproving(null)} />}
    </Card>
  );
}

interface JoinedTableProps {
  machines: JoinedMachine[];
  canRemove: boolean;
  canApprove: boolean;
}

/** Shows the second code again, for a machine still waiting for a person to type it. */
function ShowCodeButton({ machine }: { machine: JoinedMachine }) {
  const code = useMutation({ mutationFn: () => api.getMachineConfirmCode(machine.id) });
  return (
    <>
      <Button
        tone="secondary"
        onClick={() => code.mutate()}
        loading={code.isPending}
        data-testid="btn-show-confirm-code"
      >
        Show code
      </Button>
      {code.isError && <Alert tone="danger">{code.error.message}</Alert>}
      {code.data && (
        <ConfirmCodeDialog
          label={machine.label}
          code={code.data.confirm_code}
          onClose={() => code.reset()}
        />
      )}
    </>
  );
}

/** Every machine that has joined. */
function JoinedTable({ machines, canRemove, canApprove }: JoinedTableProps) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<JoinedMachine | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.removeMachine(id),
    onSuccess: () => {
      setRemoving(null);
      void queryClient.invalidateQueries({ queryKey: MACHINES_KEY });
      toast.success("Machine removed. Its access ends within 30 seconds.");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Not done" }),
  });
  return (
    <Card>
      <Stack gap="sm">
        <Text fw={600}>Machines</Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Last seen</Table.Th>
              <Table.Th>Audit address</Table.Th>
              {canRemove && <Table.Th>Remove</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {machines.map((machine) => (
              <Table.Tr key={machine.id} data-testid={`row-machine-${machine.id}`}>
                <Table.Td>{machine.label}</Table.Td>
                <Table.Td>{typeWords(machine.app_variant)}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Badge tone={machine.online ? "success" : "neutral"}>
                      {machine.awaiting_confirmation
                        ? "Waiting for the code"
                        : machine.online
                          ? "Online"
                          : "Not connected"}
                    </Badge>
                    {machine.awaiting_confirmation && canApprove && (
                      <ShowCodeButton machine={machine} />
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  {machine.last_seen_at
                    ? new Date(machine.last_seen_at).toLocaleString()
                    : "Not yet"}
                </Table.Td>
                <Table.Td>{machine.screen_address ?? "Not yet"}</Table.Td>
                {canRemove && (
                  <Table.Td>
                    <Button
                      tone="subtle-danger"
                      onClick={() => setRemoving(machine)}
                      data-testid="btn-remove-machine"
                    >
                      Remove
                    </Button>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
            {machines.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={canRemove ? 6 : 5}>
                  <Text size="sm" c="dimmed">
                    No machines have joined yet.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Stack>
      {removing && (
        <Modal
          opened
          onClose={() => setRemoving(null)}
          title={`Remove ${removing.label}?`}
          size="sm"
        >
          <Stack gap="md">
            <Text size="sm">
              It stops reaching this main machine within 30 seconds and has to join again to come
              back.
            </Text>
            <Group justify="flex-end">
              <Button tone="secondary" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button
                tone="danger"
                onClick={() => remove.mutate(removing.id)}
                loading={remove.isPending}
                data-testid="btn-confirm-remove-machine"
              >
                Remove
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </Card>
  );
}

interface DroppedCardProps {
  dropped: DroppedRequest[];
}

/**
 * Requests that newer ones pushed out. A real machine here simply asks again; many from one address
 * mean something on the network is flooding this main machine.
 */
function DroppedCard({ dropped }: DroppedCardProps) {
  if (dropped.length === 0) {
    return null;
  }
  return (
    <Card data-testid="card-dropped-machines">
      <Stack gap="sm">
        <Text fw={600}>Pushed out of the waiting list</Text>
        <Text size="sm" c="dimmed">
          Nothing was granted. A real machine can ask again. Many from one address may mean
          something on your network is sending requests.
        </Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name it gave</Table.Th>
              <Table.Th>Address</Table.Th>
              <Table.Th>Asked at</Table.Th>
              <Table.Th>Why</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {dropped.map((request) => (
              <Table.Tr key={`${request.created_at}-${request.label}`}>
                <Table.Td>{request.label}</Table.Td>
                <Table.Td>{request.address ?? "Unknown"}</Table.Td>
                <Table.Td>{new Date(request.created_at).toLocaleString()}</Table.Td>
                <Table.Td>{request.reason}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}

/** The Nodes screen. */
export function MachinesPage() {
  useRequirePermission(P.DEVICES.MACHINES.VIEW);
  const canApprove = useHasPermission(P.DEVICES.MACHINES.APPROVE);
  const canRemove = useHasPermission(P.DEVICES.MACHINES.REMOVE);
  const list = useQuery({
    queryKey: MACHINES_KEY,
    queryFn: () => api.listMachines(),
    refetchInterval: REFRESH_MS,
  });
  return (
    <Stack gap="md">
      <PageHeader
        title="Machines"
        subtitle="Workstations and displays that use this main machine."
      />
      {list.isError && (
        <Alert tone="danger">
          Could not load the machines, so this does not mean there are none.
        </Alert>
      )}
      {list.isSuccess && list.data.joining_paused && (
        <Alert tone="danger">
          New machines can't join for now. Too many attempts stopped partway, which is what guessing
          a join code looks like. It starts again by itself within ten minutes. Find what is doing
          this on your network.
        </Alert>
      )}
      {list.isSuccess && !list.data.joining_paused && list.data.given_up > 0 && (
        <Alert tone="warning">
          {list.data.given_up} join attempts stopped partway in the last ten minutes. A few may be a
          machine restarting. Many may be something on your network guessing a join code, so be sure
          of the digits you type.
        </Alert>
      )}
      {list.isSuccess && (
        <>
          <WaitingCard waiting={list.data.waiting} canApprove={canApprove} />
          <JoinedTable
            machines={list.data.machines}
            canRemove={canRemove}
            canApprove={canApprove}
          />
          <DroppedCard dropped={list.data.dropped} />
        </>
      )}
    </Stack>
  );
}
