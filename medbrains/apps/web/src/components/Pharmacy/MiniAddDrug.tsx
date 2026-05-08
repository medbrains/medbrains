import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { CreatePharmacyCatalogRequest, DrugSchedule, PharmacyCatalog } from "@medbrains/types";
import { IconCheck, IconPill } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

interface MiniAddDrugProps {
  searchText: string;
  onCreated: (drug: PharmacyCatalog) => void;
  onCancel: () => void;
}

const scheduleOptions: { value: DrugSchedule; label: string }[] = [
  { value: "OTC", label: "OTC" },
  { value: "H", label: "Schedule H" },
  { value: "H1", label: "Schedule H1" },
  { value: "X", label: "Schedule X" },
  { value: "G", label: "Schedule G" },
  { value: "NDPS", label: "NDPS" },
];

function inferName(searchText: string): string {
  return searchText.replace(/\([^)]*\)/g, " ").trim();
}

function inferCode(name: string): string {
  const code = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return code || "DRUG";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to add drug";
}

export function MiniAddDrug({ searchText, onCreated, onCancel }: MiniAddDrugProps) {
  const initialName = useMemo(() => inferName(searchText), [searchText]);
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [genericName, setGenericName] = useState("");
  const [code, setCode] = useState(() => inferCode(initialName));
  const [unit, setUnit] = useState("tablet");
  const [basePrice, setBasePrice] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [drugSchedule, setDrugSchedule] = useState<DrugSchedule>("OTC");

  const mutation = useMutation({
    mutationFn: (payload: CreatePharmacyCatalogRequest) => api.createPharmacyCatalog(payload),
    onSuccess: (drug) => {
      queryClient.invalidateQueries({ queryKey: ["drug-search"] });
      notifications.show({
        title: "Drug added",
        message: `${drug.name} is now selected`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      onCreated(drug);
    },
    onError: (error) => {
      notifications.show({
        title: "Drug add failed",
        message: errorMessage(error),
        color: "danger",
      });
    },
  });

  const canSubmit = name.trim().length > 0 && code.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    const payload: CreatePharmacyCatalogRequest = {
      code: code.trim(),
      name: name.trim(),
      base_price: Number(basePrice) || 0,
      tax_percent: 0,
      reorder_level: Number(reorderLevel) || 0,
      drug_schedule: drugSchedule,
      formulary_status: "approved",
      unit: unit.trim() || "unit",
    };

    if (genericName.trim()) {
      payload.generic_name = genericName.trim();
    }

    mutation.mutate(payload);
  };

  return (
    <Stack gap="sm">
      <TextInput
        label="Drug name"
        required
        value={name}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setName(next);
          if (!code || code === inferCode(name)) {
            setCode(inferCode(next));
          }
        }}
      />
      <TextInput
        label="Generic / INN"
        value={genericName}
        onChange={(event) => setGenericName(event.currentTarget.value)}
      />
      <Group grow align="flex-start">
        <TextInput
          label="Code"
          required
          value={code}
          onChange={(event) => setCode(event.currentTarget.value)}
        />
        <TextInput
          label="Unit"
          value={unit}
          onChange={(event) => setUnit(event.currentTarget.value)}
        />
      </Group>
      <Group grow align="flex-start">
        <TextInput
          label="Base price"
          inputMode="decimal"
          value={basePrice}
          onChange={(event) => setBasePrice(event.currentTarget.value)}
        />
        <TextInput
          label="Reorder level"
          inputMode="numeric"
          value={reorderLevel}
          onChange={(event) => setReorderLevel(event.currentTarget.value)}
        />
      </Group>
      <Select
        allowDeselect={false}
        data={scheduleOptions}
        label="Drug schedule"
        value={drugSchedule}
        onChange={(value) => setDrugSchedule((value as DrugSchedule | null) ?? "OTC")}
      />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconPill size={16} />}
          loading={mutation.isPending}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          Add & select
        </Button>
      </Group>
    </Stack>
  );
}
