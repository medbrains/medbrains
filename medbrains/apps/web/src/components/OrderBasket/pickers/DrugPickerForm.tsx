import { Button, Group, NumberInput, Select, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import type { BasketItem, BasketDrugItem } from "@medbrains/types";
import type { PharmacyCatalog } from "@medbrains/types";
import { DrugSearchSelect } from "../../DrugSearchSelect";

interface DrugPickerFormProps {
  onAdd: (item: BasketItem) => void;
}

const FREQ = [
  "OD", "BD", "TDS", "QID", "Q4H", "Q6H", "Q8H", "Q12H", "PRN", "STAT", "Once",
];
const ROUTES = [
  "PO", "IV", "IM", "SC", "Inhalation", "Topical", "PR", "SL", "Per NG",
];

export function DrugPickerForm({ onAdd }: DrugPickerFormProps) {
  const [drugId, setDrugId] = useState("");
  const [drug, setDrug] = useState<PharmacyCatalog | undefined>();
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState<string | null>("BD");
  const [route, setRoute] = useState<string | null>("PO");
  const [duration, setDuration] = useState<number | string>(5);
  const [quantity, setQuantity] = useState<number | string>(10);
  const [indication, setIndication] = useState("");
  const [scheduleX, setScheduleX] = useState("");

  const isScheduleX =
    drug?.drug_schedule != null &&
    String(drug.drug_schedule).toUpperCase() === "X";

  const reset = () => {
    setDrugId("");
    setDrug(undefined);
    setDose("");
    setFrequency("BD");
    setRoute("PO");
    setDuration(5);
    setQuantity(10);
    setIndication("");
    setScheduleX("");
  };

  const canAdd = !!drug && dose.trim() && frequency && route;

  const handleAdd = () => {
    if (!drug) return;
    const item: BasketDrugItem = {
      kind: "drug",
      drug_id: drug.id,
      drug_name: drug.name,
      dose: dose.trim(),
      frequency: frequency ?? "BD",
      route: route ?? "PO",
      duration_days: typeof duration === "number" ? duration : Number(duration) || null,
      indication: indication.trim() || null,
      quantity: typeof quantity === "number" ? quantity : Number(quantity) || 1,
      unit_price: String(drug.base_price ?? "0"),
      schedule_x_serial: isScheduleX ? scheduleX.trim() || null : null,
    };
    onAdd(item);
    reset();
  };

  return (
    <Stack gap="xs">
      <DrugSearchSelect
        value={drugId}
        onChange={(id, d) => {
          setDrugId(id);
          setDrug(d);
        }}
      />
      <Group grow>
        <TextInput
          label="Dose"
          placeholder="e.g., 500mg"
          value={dose}
          onChange={(e) => setDose(e.currentTarget.value)}
          required
        />
        <Select
          label="Frequency"
          data={FREQ}
          value={frequency}
          onChange={setFrequency}
          required
        />
      </Group>
      <Group grow>
        <Select label="Route" data={ROUTES} value={route} onChange={setRoute} required />
        <NumberInput
          label="Duration (days)"
          value={duration}
          onChange={(v) => setDuration(v)}
          min={0}
          max={365}
        />
        <NumberInput
          label="Quantity"
          value={quantity}
          onChange={(v) => setQuantity(v)}
          min={1}
        />
      </Group>
      <TextInput
        label="Indication"
        placeholder="optional — diagnosis or reason"
        value={indication}
        onChange={(e) => setIndication(e.currentTarget.value)}
      />
      {isScheduleX && (
        <TextInput
          label="Schedule X paper Rx serial number"
          placeholder="required for Schedule X"
          value={scheduleX}
          onChange={(e) => setScheduleX(e.currentTarget.value)}
          required
        />
      )}
      <Group justify="flex-end">
        <Button onClick={handleAdd} disabled={!canAdd}>
          Add to basket
        </Button>
      </Group>
    </Stack>
  );
}
