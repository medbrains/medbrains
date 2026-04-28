import { Button, Checkbox, Group, Select, Stack, TextInput } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@medbrains/api";
import type { BasketItem, BasketRadiologyItem } from "@medbrains/types";

interface RadiologyPickerFormProps {
  onAdd: (item: BasketItem) => void;
}

export function RadiologyPickerForm({ onAdd }: RadiologyPickerFormProps) {
  const [modalityId, setModalityId] = useState<string | null>(null);
  const [bodyPart, setBodyPart] = useState("");
  const [indication, setIndication] = useState("");
  const [priority, setPriority] = useState<string | null>("routine");
  const [contrast, setContrast] = useState(false);
  const [pregnancy, setPregnancy] = useState(false);
  const [allergy, setAllergy] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: modalities = [] } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => api.listRadiologyModalities(),
    staleTime: 60_000,
  });

  const reset = () => {
    setModalityId(null);
    setBodyPart("");
    setIndication("");
    setPriority("routine");
    setContrast(false);
    setPregnancy(false);
    setAllergy(false);
    setNotes("");
  };

  const handleAdd = () => {
    if (!modalityId) return;
    const item: BasketRadiologyItem = {
      kind: "radiology",
      modality_id: modalityId,
      body_part: bodyPart.trim() || null,
      clinical_indication: indication.trim() || null,
      priority,
      scheduled_at: null,
      contrast_required: contrast || null,
      pregnancy_checked: pregnancy || null,
      allergy_flagged: allergy || null,
      notes: notes.trim() || null,
    };
    onAdd(item);
    reset();
  };

  return (
    <Stack gap="xs">
      <Select
        label="Modality"
        placeholder="X-ray, CT, MRI, US, etc."
        data={modalities.map((m) => ({ value: m.id, label: m.name }))}
        value={modalityId}
        onChange={setModalityId}
        searchable
        required
      />
      <Group grow>
        <TextInput
          label="Body part"
          placeholder="e.g., Chest PA, Abdomen"
          value={bodyPart}
          onChange={(e) => setBodyPart(e.currentTarget.value)}
        />
        <Select
          label="Priority"
          data={["routine", "urgent", "stat"]}
          value={priority}
          onChange={setPriority}
        />
      </Group>
      <TextInput
        label="Clinical indication"
        value={indication}
        onChange={(e) => setIndication(e.currentTarget.value)}
      />
      <Group>
        <Checkbox
          label="Contrast required"
          checked={contrast}
          onChange={(e) => setContrast(e.currentTarget.checked)}
        />
        <Checkbox
          label="Pregnancy checked"
          checked={pregnancy}
          onChange={(e) => setPregnancy(e.currentTarget.checked)}
        />
        <Checkbox
          label="Allergy flagged"
          checked={allergy}
          onChange={(e) => setAllergy(e.currentTarget.checked)}
        />
      </Group>
      <TextInput
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button onClick={handleAdd} disabled={!modalityId}>
          Add to basket
        </Button>
      </Group>
    </Stack>
  );
}
