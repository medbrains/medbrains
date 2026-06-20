import { Group, Stack } from "@mantine/core";
import type { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, Input, Modal, Select } from "@/components/ui";
import { campService } from "@/services/camp.service";

interface CampRegistrationModalProps {
  patientId: string;
  patientName: string;
  control: ReturnType<typeof useDisclosure>;
}

/** Register the patient to a health camp — opened from the Patient Flow "Camp"
 *  chip instead of navigating to the camp page. */
export function CampRegistrationModal({
  patientId,
  patientName,
  control,
}: CampRegistrationModalProps) {
  const [opened, { close }] = control;
  const navigate = useNavigate();
  const [campId, setCampId] = useState<string | null>(null);
  const [personName, setPersonName] = useState(patientName);

  const { data: camps } = useQuery({
    queryKey: ["camps", "registerable"],
    queryFn: () => campService.listCamps(),
    enabled: opened,
  });

  const create = useMutation({
    mutationFn: () =>
      campService.createCampRegistration({
        camp_id: campId ?? "",
        person_name: personName.trim(),
        patient_id: patientId,
      }),
    onSuccess: () => {
      close();
      navigate("/camp");
    },
  });

  return (
    <Modal opened={opened} onClose={close} title="Register to camp" size="md">
      <Stack gap="sm">
        <Select
          label="Camp"
          placeholder="Select a camp"
          data={(camps ?? []).map((camp) => ({ value: camp.id, label: camp.name }))}
          value={campId}
          onChange={setCampId}
          searchable
          nothingFoundMessage="No camps found"
        />
        <Input
          label="Person name"
          value={personName}
          onChange={(event) => setPersonName(event.currentTarget.value)}
        />
        <Group justify="flex-end" mt="xs">
          <Button tone="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={create.isPending}
            disabled={!campId || !personName.trim()}
            onClick={() => create.mutate()}
          >
            Register
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
