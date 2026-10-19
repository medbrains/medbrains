import { Group, Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type UhiRequest, type UhiRequestState, type UhiService } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import {
  Alert,
  Badge,
  type BadgeTone,
  Button,
  Card,
  Modal,
  SegmentedControl,
  Table,
  TextArea,
  toast,
} from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { formatDateTime } from "@/lib/date-utils";
import { uhiService } from "@/services/uhi.service";

const SERVICE_LABEL: Record<UhiService, string> = {
  teleconsultation: "Teleconsultation",
  ambulance: "Ambulance",
  blood_bank: "Blood",
};

const STATE: Record<UhiRequestState, { label: string; tone: BadgeTone }> = {
  pending: { label: "Waiting for us", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  cancelled: { label: "Cancelled by patient", tone: "neutral" },
};

/**
 * UHI requests: what patient apps booked or asked for through NHA's Unified
 * Health Interface. Teleconsultations are booked straight into the day's
 * appointments; ambulance and blood requests wait here for someone to say
 * whether the hospital can help, and that answer goes back to the app.
 */
export function UhiRequestsPage() {
  useRequirePermission(P.UHI.REQUESTS.VIEW);
  const canRespond = useHasPermission(P.UHI.REQUESTS.RESPOND);
  const canDispatch = useHasPermission(P.AMBULANCE.TRIPS.CREATE);
  const canIssueBlood = useHasPermission(P.BLOOD_BANK.INVENTORY.MANAGE);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [declining, setDeclining] = useState<UhiRequest | null>(null);
  const [reason, setReason] = useState("");
  const key = ["uhi", "requests", filter];
  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => uhiService.listRequests(filter === "pending" ? "pending" : undefined),
  });
  const done = (title: string) => () => {
    void queryClient.invalidateQueries({ queryKey: ["uhi", "requests"] });
    toast.success("The patient's app has been told.", { title });
  };
  const accept = useMutation({
    mutationFn: uhiService.accept,
    onSuccess: done("Request accepted"),
    onError: (e: Error) => toast.error(e.message, { title: "Could not accept" }),
  });
  const decline = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => uhiService.decline(id, why),
    onSuccess: () => {
      setDeclining(null);
      setReason("");
      done("Request declined")();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not decline" }),
  });

  const mayAnswer = (r: UhiRequest) =>
    canRespond &&
    r.state === "pending" &&
    (r.service === "ambulance" ? canDispatch : r.service === "blood_bank" && canIssueBlood);

  return (
    <Stack>
      <PageHeader
        title="UHI requests"
        subtitle="Bookings and requests from patient apps, through NHA's Unified Health Interface"
        actions={
          <SegmentedControl
            aria-label="Show"
            value={filter}
            onChange={(v) => setFilter(v === "all" ? "all" : "pending")}
            data={[
              { value: "pending", label: "Waiting for us" },
              { value: "all", label: "All" },
            ]}
          />
        }
      />
      {isLoading && <Loader size="sm" />}
      {isError && (
        <Alert tone="danger" title="Could not load UHI requests">
          This does not mean there are none — the list failed to load.
        </Alert>
      )}
      {data && data.length === 0 && (
        <Card>
          <Text size="sm" c="dimmed">
            {filter === "pending" ? "Nothing is waiting for an answer." : "No requests yet."}
          </Text>
        </Card>
      )}
      {data && data.length > 0 && (
        <Card>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Service</Table.Th>
                <Table.Th>Patient</Table.Th>
                <Table.Th>Asked for</Table.Th>
                <Table.Th>State</Table.Th>
                <Table.Th>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <Text size="sm">{SERVICE_LABEL[r.service]}</Text>
                    <Text size="xs" c="dimmed">
                      {formatDateTime(r.confirmed_at ?? r.updated_at)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{r.customer_name ?? "—"}</Text>
                    <Text size="xs" c="dimmed">
                      {[r.customer_phone, r.customer_abha].filter(Boolean).join(" · ")}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{r.summary || "—"}</Text>
                    {r.service === "teleconsultation" && r.appointment_id && (
                      <Text size="xs" c="dimmed">
                        In the OPD appointments for that day
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge tone={STATE[r.state].tone}>{STATE[r.state].label}</Badge>
                    {r.decline_reason && <Text size="xs">{r.decline_reason}</Text>}
                  </Table.Td>
                  <Table.Td>
                    {mayAnswer(r) ? (
                      <Group gap="xs">
                        <Button
                          size="xs"
                          tone="primary"
                          loading={accept.isPending && accept.variables === r.id}
                          onClick={() => accept.mutate(r.id)}
                        >
                          {r.service === "ambulance" ? "Accept and dispatch" : "Accept"}
                        </Button>
                        <Button size="xs" tone="secondary" onClick={() => setDeclining(r)}>
                          Decline
                        </Button>
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
      <Modal
        opened={declining !== null}
        onClose={() => setDeclining(null)}
        title="Decline this request?"
        danger
        primaryAction={{
          label: "Decline",
          disabled: reason.trim() === "",
          loading: decline.isPending,
          onClick: () => declining && decline.mutate({ id: declining.id, why: reason.trim() }),
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setDeclining(null) }}
      >
        <TextArea
          label="Reason the patient will see"
          description="So they can look elsewhere, e.g. “No ambulance free for the next hour”."
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          autosize
          minRows={2}
        />
      </Modal>
    </Stack>
  );
}
