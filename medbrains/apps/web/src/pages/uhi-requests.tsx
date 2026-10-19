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
import { UhiPaymentCell } from "./uhi-payment-cell";

const SERVICE_LABEL: Record<UhiService, string> = {
  teleconsultation: "Teleconsultation",
  physical_consultation: "Visit",
  lab_tests: "Lab tests",
  ambulance: "Ambulance",
  blood_bank: "Blood",
};

const STATE: Record<UhiRequestState, { label: string; tone: BadgeTone }> = {
  awaiting_payment: { label: "Held — waiting for payment", tone: "warning" },
  pending: { label: "Waiting for us", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  cancelled: { label: "Cancelled by patient", tone: "neutral" },
  expired: { label: "Not paid in time", tone: "neutral" },
};

const IN_APPOINTMENTS: UhiService[] = ["teleconsultation", "physical_consultation"];

const ACCEPT_LABEL: Partial<Record<UhiService, string>> = {
  ambulance: "Accept and dispatch",
  lab_tests: "Accept and order the tests",
};

/**
 * UHI requests: what patient apps booked or asked for through NHA's Unified
 * Health Interface. Consultations are booked straight into the day's
 * appointments (a teleconsultation paid online is held until it is paid);
 * ambulance, blood and lab requests wait here for someone to say whether the
 * hospital can help, and that answer goes back to the app.
 */
export function UhiRequestsPage() {
  useRequirePermission(P.UHI.REQUESTS.VIEW);
  const canRespond = useHasPermission(P.UHI.REQUESTS.RESPOND);
  const canDispatch = useHasPermission(P.AMBULANCE.TRIPS.CREATE);
  const canIssueBlood = useHasPermission(P.BLOOD_BANK.INVENTORY.MANAGE);
  const canOrderLab = useHasPermission(P.LAB.ORDERS.DIRECT);
  const canBookCollection = useHasPermission(P.LAB.SAMPLES.MANAGE);
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

  // Each service's accept needs its module's own permission as well.
  const serviceGate: Partial<Record<UhiService, (r: UhiRequest) => boolean>> = {
    ambulance: () => canDispatch,
    blood_bank: () => canIssueBlood,
    lab_tests: (r) => canOrderLab && (!r.home_collection || canBookCollection),
  };
  const mayAnswer = (r: UhiRequest) =>
    canRespond && r.state === "pending" && (serviceGate[r.service]?.(r) ?? false);

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
                <Table.Th>Payment</Table.Th>
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
                    {IN_APPOINTMENTS.includes(r.service) && r.appointment_id && (
                      <Text size="xs" c="dimmed">
                        In the OPD appointments for that day
                      </Text>
                    )}
                    {r.lab_order_ids.length > 0 && (
                      <Text size="xs" c="dimmed">
                        {`${r.lab_order_ids.length} lab orders placed`}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge tone={STATE[r.state].tone}>{STATE[r.state].label}</Badge>
                    {r.decline_reason && <Text size="xs">{r.decline_reason}</Text>}
                    {r.state === "awaiting_payment" && r.hold_expires_at && (
                      <Text size="xs" c="dimmed">
                        {`Slot let go at ${formatDateTime(r.hold_expires_at)} unless paid`}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <UhiPaymentCell request={r} />
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
                          {ACCEPT_LABEL[r.service] ?? "Accept"}
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
