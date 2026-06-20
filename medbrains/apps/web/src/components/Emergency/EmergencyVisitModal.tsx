import { Group, Stack } from "@mantine/core";
import type { useDisclosure } from "@mantine/hooks";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, Input, Modal, Select, Switch, TextArea } from "@/components/ui";
import { emergencyService } from "@/services/emergency.service";

const ARRIVAL_MODES = [
  { value: "walk_in", label: "Walk-in" },
  { value: "ambulance", label: "Ambulance" },
  { value: "referral", label: "Referral" },
  { value: "police", label: "Police" },
  { value: "other", label: "Other" },
];

interface EmergencyVisitModalProps {
  patientId: string;
  control: ReturnType<typeof useDisclosure>;
}

/** Register an emergency (ER) visit for the patient — opened from the Patient
 *  Flow "Emergency" chip instead of navigating to the ER page. */
export function EmergencyVisitModal({ patientId, control }: EmergencyVisitModalProps) {
  const [opened, { close }] = control;
  const navigate = useNavigate();
  const [arrivalMode, setArrivalMode] = useState<string | null>("walk_in");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [bayNumber, setBayNumber] = useState("");
  const [isMlc, setIsMlc] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      emergencyService.createErVisit({
        patient_id: patientId,
        arrival_mode: arrivalMode ?? undefined,
        chief_complaint: chiefComplaint.trim() || undefined,
        bay_number: bayNumber.trim() || undefined,
        is_mlc: isMlc,
      }),
    onSuccess: () => {
      close();
      navigate("/emergency");
    },
  });

  return (
    <Modal opened={opened} onClose={close} title="Register emergency visit" size="md">
      <Stack gap="sm">
        <Select
          label="Arrival mode"
          data={ARRIVAL_MODES}
          value={arrivalMode}
          onChange={setArrivalMode}
        />
        <TextArea
          label="Chief complaint"
          value={chiefComplaint}
          onChange={(event) => setChiefComplaint(event.currentTarget.value)}
          minRows={3}
          placeholder="Presenting complaint…"
        />
        <Input
          label="Bay number"
          value={bayNumber}
          onChange={(event) => setBayNumber(event.currentTarget.value)}
          placeholder="e.g. Bay 3"
        />
        <Switch
          label="Medico-legal case (MLC)"
          checked={isMlc}
          onChange={(event) => setIsMlc(event.currentTarget.checked)}
        />
        <Group justify="flex-end" mt="xs">
          <Button tone="secondary" onClick={close}>
            Cancel
          </Button>
          <Button tone="primary" loading={create.isPending} onClick={() => create.mutate()}>
            Register ER visit
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
