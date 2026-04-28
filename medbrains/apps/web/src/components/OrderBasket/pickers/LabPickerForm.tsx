import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import type { BasketItem, BasketLabItem } from "@medbrains/types";
import type { LabTestCatalog } from "@medbrains/types";
import { LabTestSearchSelect } from "../../LabTestSearchSelect";

interface LabPickerFormProps {
  onAdd: (item: BasketItem) => void;
}

export function LabPickerForm({ onAdd }: LabPickerFormProps) {
  const [testId, setTestId] = useState("");
  const [test, setTest] = useState<LabTestCatalog | undefined>();
  const [priority, setPriority] = useState<string | null>("routine");
  const [indication, setIndication] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setTestId("");
    setTest(undefined);
    setPriority("routine");
    setIndication("");
    setNotes("");
  };

  const handleAdd = () => {
    if (!test) return;
    const item: BasketLabItem = {
      kind: "lab",
      test_id: test.id,
      priority,
      indication: indication.trim() || null,
      notes: notes.trim() || null,
    };
    onAdd(item);
    reset();
  };

  return (
    <Stack gap="xs">
      <LabTestSearchSelect
        value={testId}
        onChange={(id, t) => {
          setTestId(id);
          setTest(t);
        }}
      />
      <Group grow>
        <Select
          label="Priority"
          data={["routine", "stat"]}
          value={priority}
          onChange={setPriority}
        />
        <TextInput
          label="Indication"
          placeholder="optional"
          value={indication}
          onChange={(e) => setIndication(e.currentTarget.value)}
        />
      </Group>
      <TextInput
        label="Notes"
        placeholder="optional"
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button onClick={handleAdd} disabled={!test}>
          Add to basket
        </Button>
      </Group>
    </Stack>
  );
}
