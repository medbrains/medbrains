import { Group, Stack, Text, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type ChannelConsent, P, type Patient } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Card, Switch, toast } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";

interface ContactConsentCardProps {
  patient: Patient;
}

const CHANNELS = [
  { channel: "whatsapp", label: "Hospital updates on WhatsApp" },
  { channel: "email", label: "Hospital updates by email" },
] as const;

/** Who agreed to what, and when — and the switch to change it. */
function describe(consent: ChannelConsent | undefined): string {
  if (!consent) return "Never asked";
  const when = new Date(consent.recorded_at).toLocaleDateString();
  const who = consent.recorded_by_name ? ` by ${consent.recorded_by_name}` : "";
  return `${consent.granted ? "Agreed" : "Withdrawn"} ${when}${who}`;
}

/**
 * The patient's messaging consent. Withdrawing is as easy as agreeing (DPDP
 * Act 2023), and each change is a new row, so the history stays.
 */
export function ContactConsentCard({ patient }: ContactConsentCardProps) {
  const canChange = useHasPermission(P.PATIENTS.UPDATE);
  const queryClient = useQueryClient();
  const queryKey = ["patient-contact-consents", patient.id];
  const consents = useQuery({
    queryKey,
    queryFn: () => patientDetailService.getPatientContactConsents(patient.id),
  });
  const change = useMutation({
    mutationFn: (input: { channel: "whatsapp" | "email"; granted: boolean }) =>
      patientDetailService.setPatientContactConsent(patient.id, input),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
    onError: (error: Error) => toast.error(error.message, { title: "Consent not changed" }),
  });

  return (
    <Card withBorder>
      <Title order={5} mb="sm">
        Messaging consent
      </Title>
      {consents.isError ? (
        <Alert tone="danger">Could not load what this patient agreed to.</Alert>
      ) : (
        <Stack gap="sm">
          {CHANNELS.map(({ channel, label }) => {
            const consent = consents.data?.channels.find((c) => c.channel === channel);
            const noEmail = channel === "email" && !patient.email;
            return (
              <Group key={channel} justify="space-between" wrap="nowrap">
                <Stack gap={0}>
                  <Text size="sm" fw={600}>
                    {label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {noEmail && !consent?.granted ? "No email address on file" : describe(consent)}
                  </Text>
                </Stack>
                <Switch
                  aria-label={label}
                  checked={consent?.granted ?? false}
                  disabled={!canChange || consents.isLoading || change.isPending || noEmail}
                  onChange={(event) =>
                    change.mutate({ channel, granted: event.currentTarget.checked })
                  }
                />
              </Group>
            );
          })}
          <Text size="xs" c="dimmed">
            SMS about registration and visits needs no agreement.
          </Text>
        </Stack>
      )}
    </Card>
  );
}
