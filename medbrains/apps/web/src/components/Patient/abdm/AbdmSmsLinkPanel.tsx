import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type AbdmPatientRecords, P } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { abdmRecordsService } from "@/services/abdmRecords.service";

interface AbdmSmsLinkPanelProps {
  patientId: string;
  records: AbdmPatientRecords;
}

const STATUS: Record<"sent" | "delivered" | "failed", { label: string; tone: BadgeTone }> = {
  sent: { label: "Sent — waiting for ABDM", tone: "info" },
  delivered: { label: "ABDM sent the text", tone: "success" },
  failed: { label: "Not sent", tone: "danger" },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/**
 * A patient with no ABHA here (HIP_INIT_NOTIFY_HIECM): ABDM can text them a
 * link to the ABHA app, so the records this hospital holds reach them once
 * they have one. Sent once when a record is captured; staff can send it again.
 */
export function AbdmSmsLinkPanel({ patientId, records }: AbdmSmsLinkPanelProps) {
  const canNotify = useHasPermission(P.ABDM.RECORDS.NOTIFY);
  const queryClient = useQueryClient();
  const send = useMutation({
    mutationFn: () => abdmRecordsService.sendSmsLink(patientId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["abdm", "patient-records", patientId] });
      toast.success("ABDM will text the patient the ABHA app link.", { title: "Sent to ABDM" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "The text was not sent" }),
  });
  if (records.abha_verified) return null;
  const last = records.sms_link;

  return (
    <Alert tone="info" title="The patient has no ABHA here">
      <Stack gap="xs">
        <Text size="sm">
          ABDM can text them a link to the ABHA app. Once they have an ABHA, the records this
          hospital holds can reach it.
        </Text>
        {last && (
          <Group gap="xs">
            <Badge tone={STATUS[last.status].tone}>{STATUS[last.status].label}</Badge>
            <Text size="sm">
              To the mobile ending {last.phone_last4}, {when(last.created_at)}
              {last.automatic ? " (when a record was saved)" : ""}
            </Text>
          </Group>
        )}
        {last?.error && (
          <Text size="sm" c="var(--mb-support-error)">
            {last.error}
          </Text>
        )}
        {!records.phone_on_file && (
          <Text size="sm">Add the patient's mobile number to send the link.</Text>
        )}
        {canNotify && records.configured && (
          <Group>
            <Button
              tone="secondary"
              size="xs"
              disabled={!records.phone_on_file}
              loading={send.isPending}
              onClick={() => send.mutate()}
            >
              {last ? "Text the ABHA app link again" : "Text the ABHA app link"}
            </Button>
          </Group>
        )}
      </Stack>
    </Alert>
  );
}
