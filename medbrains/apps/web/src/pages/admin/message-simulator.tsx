import { Group, Stack, Text } from "@mantine/core";
import { ApiError, api } from "@medbrains/api";
import { P, type SimulatorInboxQuery } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { PhoneView } from "@/components/MessageSimulator/PhoneView";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Input, SegmentedControl } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";

type Target = "patient" | "recipient";

/** Whose phone to look at: a registered patient, or a number/email typed in. */
function toQuery(target: Target, patientId: string, recipient: string): SimulatorInboxQuery | null {
  if (target === "patient") return patientId ? { patient_id: patientId } : null;
  return recipient.trim().length >= 5 ? { recipient: recipient.trim() } : null;
}

/** Dev/test only: every SMS, WhatsApp and email a person would have received. */
export function MessageSimulatorPage() {
  useRequirePermission(P.ADMIN.NOTIFICATIONS.SIMULATOR.VIEW);
  const [target, setTarget] = useState<Target>("patient");
  const [patientId, setPatientId] = useState("");
  const [recipient, setRecipient] = useState("");
  const query = toQuery(target, patientId, recipient);

  // An empty query is the probe: 200 when the simulator is on, 404 when off.
  const inbox = useQuery({
    queryKey: ["message-simulator", query],
    queryFn: () => api.listSimulatedMessages(query ?? {}),
    refetchInterval: 3000,
    retry: false,
  });
  const isOff = inbox.error instanceof ApiError && inbox.error.status === 404 && !query;

  return (
    <Stack>
      <PageHeader
        title="Message simulator"
        subtitle="What a patient's phone would have received — dev and test only, nothing is sent."
      />
      {isOff ? (
        <Alert tone="info" title="The message simulator is off on this server">
          Messages are sent for real here. On a dev or test server, start the backend with
          MEDBRAINS_NOTIFY_SIMULATOR=true to capture them instead.
        </Alert>
      ) : (
        <Group align="flex-start" gap="xl" wrap="wrap">
          <Stack gap="sm" w={320}>
            <SegmentedControl
              aria-label="Whose phone"
              value={target}
              onChange={(value) => setTarget(value as Target)}
              data={[
                { value: "patient", label: "Patient" },
                { value: "recipient", label: "Number or email" },
              ]}
            />
            {target === "patient" ? (
              <PatientSearchSelect value={patientId} onChange={setPatientId} />
            ) : (
              <Input
                label="Phone number or email"
                placeholder="+91 98765 00000 or name@example.com"
                value={recipient}
                onChange={(event) => setRecipient(event.currentTarget.value)}
              />
            )}
          </Stack>
          {!query && (
            <Text c="dimmed" size="sm">
              Pick a patient, or type a number or email, to see their phone.
            </Text>
          )}
          {query && inbox.isError && (
            <Alert tone="danger" title="Could not load this phone">
              {inbox.error.message}
            </Alert>
          )}
          {query && inbox.data && (
            <PhoneView recipients={inbox.data.recipients} messages={inbox.data.messages} />
          )}
          {query && inbox.isLoading && <Text size="sm">Loading…</Text>}
        </Group>
      )}
    </Stack>
  );
}
