import { Group, Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { AdtDestination, AdtDestinationInput } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Modal, Table, toast } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";
import { hl7AdtService } from "@/services/hl7Adt.service";
import { Hl7AdtDestinationForm } from "./Hl7AdtDestinationForm";

const KEY = ["hl7-adt"];

const STATUS_TONE = {
  sent: "success",
  pending: "neutral",
  retrying: "warning",
  failed: "danger",
  dlq: "danger",
} as const;

/**
 * Settings → HL7 ADT feeds: the hospital's ADT messages (admit, transfer,
 * discharge, register, update, cancel) to PACS, LIS, billing or dietary
 * systems over MLLP, per destination, and what each message did.
 */
export function Hl7AdtSettings() {
  const canManage = useHasPermission(P.INTEGRATION.HL7_ADT.MANAGE);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdtDestination | "new" | null>(null);
  const destinations = useQuery({
    queryKey: [...KEY, "destinations"],
    queryFn: hl7AdtService.list,
  });
  const deliveries = useQuery({
    queryKey: [...KEY, "deliveries"],
    queryFn: hl7AdtService.deliveries,
  });
  const save = useMutation({
    mutationFn: (v: AdtDestinationInput) =>
      editing && editing !== "new" ? hl7AdtService.update(editing.id, v) : hl7AdtService.create(v),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      setEditing(null);
      toast.success("Saved. New admissions, transfers and discharges go to it from now on.");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save the destination" }),
  });
  const remove = useMutation({
    mutationFn: hl7AdtService.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      toast.success("Removed. Nothing more is sent to it.");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not remove the destination" }),
  });

  return (
    <Stack gap="md">
      <Card>
        <Stack gap="sm">
          <Group justify="space-between">
            <Stack gap={0}>
              <Text fw={600}>Destinations</Text>
              <Text size="sm" c="dimmed">
                Each receives HL7 v2.5 ADT messages over MLLP on the hospital network.
              </Text>
            </Stack>
            {canManage && (
              <Button tone="primary" size="sm" onClick={() => setEditing("new")}>
                Add destination
              </Button>
            )}
          </Group>
          {destinations.isLoading && <Loader size="sm" />}
          {destinations.isError && (
            <Alert tone="danger" title="Could not load the destinations">
              {(destinations.error as Error).message}
            </Alert>
          )}
          {destinations.data?.length === 0 && (
            <Text size="sm" c="dimmed">
              No ADT feed yet. Add the PACS, LIS or billing system that needs to know who is
              admitted.
            </Text>
          )}
          {(destinations.data?.length ?? 0) > 0 && (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Address</Table.Th>
                  <Table.Th>Triggers</Table.Th>
                  <Table.Th>State</Table.Th>
                  {canManage && <Table.Th />}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {destinations.data?.map((d) => (
                  <Table.Tr key={d.id}>
                    <Table.Td>{d.name}</Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace">
                        {d.host}:{d.port}
                      </Text>
                    </Table.Td>
                    <Table.Td>{d.events.join(", ")}</Table.Td>
                    <Table.Td>
                      <Badge tone={d.is_active ? "success" : "neutral"}>
                        {d.is_active ? "Sending" : "Off"}
                      </Badge>
                    </Table.Td>
                    {canManage && (
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Button size="xs" tone="ghost" onClick={() => setEditing(d)}>
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            tone="danger-ghost"
                            loading={remove.isPending && remove.variables === d.id}
                            onClick={() => remove.mutate(d.id)}
                          >
                            Remove
                          </Button>
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Messages sent</Text>
          {deliveries.isError && (
            <Alert tone="danger" title="Could not load the messages">
              This does not mean none were sent — the list failed to load.
            </Alert>
          )}
          {deliveries.data?.length === 0 && (
            <Text size="sm" c="dimmed">
              Nothing sent yet.
            </Text>
          )}
          {(deliveries.data?.length ?? 0) > 0 && (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>When</Table.Th>
                  <Table.Th>Trigger</Table.Th>
                  <Table.Th>Destination</Table.Th>
                  <Table.Th>Result</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {deliveries.data?.map((m) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>{formatDateTime(m.created_at)}</Table.Td>
                    <Table.Td>{m.event ?? "—"}</Table.Td>
                    <Table.Td>{m.destination ?? "Removed"}</Table.Td>
                    <Table.Td>
                      <Badge tone={STATUS_TONE[m.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                        {m.status === "sent" ? "Acknowledged" : m.status}
                      </Badge>
                      {m.last_error && (
                        <Text size="xs" c="var(--mb-text-secondary)">
                          {m.last_error}
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add ADT destination" : "Edit ADT destination"}
        size="lg"
      >
        {editing !== null && (
          <Hl7AdtDestinationForm
            initial={editing === "new" ? undefined : editing}
            busy={save.isPending}
            onSubmit={(v) => save.mutate(v)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </Stack>
  );
}
