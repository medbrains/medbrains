import { Card, Group, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { P, type Patient, type PatientAcquisition } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Modal, toast } from "@/components/ui";
import { patientsService } from "@/services/patients.service";
import { CampaignSelect } from "./CampaignSelect";

const CAPTURED_VIA: Record<PatientAcquisition["captured_via"], string> = {
  registration: "recorded at registration",
  link: "from a campaign link",
  enquiry: "from their enquiry",
  correction: "corrected",
};

const SOURCE_LABEL: Record<string, string> = {
  walk_in: "Walk-in",
  phone: "Phone",
  online_portal: "Online",
  mobile_app: "Mobile app",
  kiosk: "Kiosk",
  referral: "Referral",
  ambulance: "Ambulance",
  camp: "Camp",
  telemedicine: "Telemedicine",
};

/** Where the patient came from: their source, and the campaign if any. */
export function PatientAcquisitionCard({ patient }: { patient: Patient }) {
  const canCorrect = useHasPermission(P.PATIENTS.ACQUISITION.UPDATE);
  const queryClient = useQueryClient();
  const [editing, edit] = useDisclosure(false);
  const [campaignId, setCampaignId] = useState<string | undefined>();
  const { data: acquisition, isError } = useQuery({
    queryKey: ["patient-acquisition", patient.id],
    queryFn: () => patientsService.getPatientAcquisition(patient.id),
  });
  const correct = useMutation({
    mutationFn: () =>
      patientsService.correctPatientAcquisition(patient.id, { campaign_id: campaignId ?? null }),
    onSuccess: () => {
      toast.success("Campaign updated");
      edit.close();
      void queryClient.invalidateQueries({ queryKey: ["patient-acquisition", patient.id] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not changed" }),
  });

  const source = patient.registration_source
    ? (SOURCE_LABEL[patient.registration_source] ?? patient.registration_source)
    : "Not recorded";
  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={5}>Came through</Title>
        {canCorrect && (
          <Button
            size="xs"
            tone="ghost"
            onClick={() => {
              setCampaignId(acquisition?.campaign_id ?? undefined);
              edit.open();
            }}
          >
            Change campaign
          </Button>
        )}
      </Group>
      <Stack gap={4}>
        <Text size="sm">Source: {source}</Text>
        {isError ? (
          <Text size="sm" c="dimmed">
            The campaign could not be loaded.
          </Text>
        ) : acquisition?.campaign_name ? (
          <Text size="sm">
            Campaign: {acquisition.campaign_name}
            {acquisition.channel && ` (${acquisition.channel})`}
            <Text span size="xs" c="dimmed">
              {" "}
              · {CAPTURED_VIA[acquisition.captured_via]}
              {acquisition.captured_by_name && ` by ${acquisition.captured_by_name}`}
            </Text>
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            No campaign recorded
          </Text>
        )}
      </Stack>
      <Modal opened={editing} onClose={edit.close} title="Change campaign">
        <Stack gap="sm">
          <CampaignSelect value={campaignId} onChange={setCampaignId} />
          <Text size="xs" c="dimmed">
            The change is recorded in the audit log.
          </Text>
          <Group justify="flex-end">
            <Button tone="primary" loading={correct.isPending} onClick={() => correct.mutate()}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
