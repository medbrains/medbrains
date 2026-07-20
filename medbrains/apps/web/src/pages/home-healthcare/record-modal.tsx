// Home-healthcare RecordModal — split from home-healthcare.tsx (pure move).

import { Modal, Select, Stack, Textarea, TextInput } from "@mantine/core";
import type { HomeMedAdministration } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, toast } from "@/components/ui";
import { homeHealthService } from "@/services/homeHealth.service";

export function RecordModal({
  med,
  onClose,
}: {
  med: HomeMedAdministration | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string | null>("administered");
  const [site, setSite] = useState("");
  const [notes, setNotes] = useState("");

  const record = useMutation({
    mutationFn: () =>
      homeHealthService.recordHomeMed(med?.id ?? "", {
        status: status ?? "administered",
        administration_site: site || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      if (med) void qc.invalidateQueries({ queryKey: ["home-meds", med.patient_id] });
      toast.success("Recorded", { title: "Home healthcare" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Record failed" }),
  });

  return (
    <Modal opened={!!med} onClose={onClose} title={`Record — ${med?.drug_name ?? ""}`}>
      <Stack gap="sm">
        <Select
          label="Outcome"
          data={["administered", "missed", "held"].map((v) => ({ value: v, label: v }))}
          value={status}
          onChange={setStatus}
        />
        <TextInput
          label="Site"
          value={site}
          onChange={(e) => setSite(e.currentTarget.value)}
          placeholder="Left forearm PICC"
        />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Button onClick={() => record.mutate()} loading={record.isPending}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}
