// Home-healthcare ScheduleModal — split from home-healthcare.tsx (pure move).

import { Group, Modal, Stack, Switch, TextInput } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, toast } from "@/components/ui";
import { homeHealthService } from "@/services/homeHealth.service";

export function ScheduleModal({
  patientId,
  opened,
  onClose,
}: {
  patientId: string;
  opened: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [drug, setDrug] = useState("");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState("IV");
  const [isInfusion, setIsInfusion] = useState(true);
  const [rate, setRate] = useState("");
  const [when, setWhen] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      homeHealthService.scheduleHomeMed({
        patient_id: patientId,
        drug_name: drug,
        dose,
        route: route || undefined,
        is_infusion: isInfusion,
        infusion_rate: rate || undefined,
        scheduled_at: when ? new Date(when).toISOString() : new Date().toISOString(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["home-meds", patientId] });
      toast.success("Dose scheduled", { title: "Home healthcare" });
      onClose();
      setDrug("");
      setDose("");
      setRate("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Schedule failed" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Schedule home dose">
      <Stack gap="sm">
        <TextInput
          label="Drug"
          value={drug}
          onChange={(e) => setDrug(e.currentTarget.value)}
          placeholder="Ceftriaxone"
          required
        />
        <Group grow>
          <TextInput
            label="Dose"
            value={dose}
            onChange={(e) => setDose(e.currentTarget.value)}
            placeholder="2 g"
            required
          />
          <TextInput
            label="Route"
            value={route}
            onChange={(e) => setRoute(e.currentTarget.value)}
          />
        </Group>
        <Switch
          label="Infusion"
          checked={isInfusion}
          onChange={(e) => setIsInfusion(e.currentTarget.checked)}
        />
        {isInfusion && (
          <TextInput
            label="Infusion rate"
            value={rate}
            onChange={(e) => setRate(e.currentTarget.value)}
            placeholder="100 ml/hr"
          />
        )}
        <DateTimePicker label="Scheduled at" value={when} onChange={setWhen} />
        <Button
          onClick={() => create.mutate()}
          loading={create.isPending}
          disabled={!drug.trim() || !dose.trim()}
        >
          Schedule
        </Button>
      </Stack>
    </Modal>
  );
}
