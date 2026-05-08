import { Button, Group, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { CreateLabCatalogRequest, LabTestCatalog } from "@medbrains/types";
import { IconCheck, IconMicroscope } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

interface MiniAddLabTestProps {
  searchText: string;
  onCreated: (test: LabTestCatalog) => void;
  onCancel: () => void;
}

function inferName(searchText: string): string {
  return searchText.replace(/\([^)]*\)/g, " ").trim();
}

function inferCode(name: string): string {
  const code = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return code || "LAB";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to add lab test";
}

export function MiniAddLabTest({ searchText, onCreated, onCancel }: MiniAddLabTestProps) {
  const initialName = useMemo(() => inferName(searchText), [searchText]);
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(() => inferCode(initialName));
  const [sampleType, setSampleType] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("0");
  const [tatHours, setTatHours] = useState("24");
  const [loincCode, setLoincCode] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: CreateLabCatalogRequest) => api.createLabCatalogEntry(payload),
    onSuccess: (test) => {
      queryClient.invalidateQueries({ queryKey: ["lab-test-search"] });
      notifications.show({
        title: "Lab test added",
        message: `${test.name} is now selected`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      onCreated(test);
    },
    onError: (error) => {
      notifications.show({
        title: "Lab test add failed",
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

    const payload: CreateLabCatalogRequest = {
      code: code.trim(),
      name: name.trim(),
      price: Number(price) || 0,
      tat_hours: Number(tatHours) || 24,
    };

    if (sampleType.trim()) {
      payload.sample_type = sampleType.trim();
    }
    if (unit.trim()) {
      payload.unit = unit.trim();
    }
    if (loincCode.trim()) {
      payload.loinc_code = loincCode.trim();
    }

    mutation.mutate(payload);
  };

  return (
    <Stack gap="sm">
      <TextInput
        label="Test name"
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
      <Group grow align="flex-start">
        <TextInput
          label="Code"
          required
          value={code}
          onChange={(event) => setCode(event.currentTarget.value)}
        />
        <TextInput
          label="LOINC code"
          value={loincCode}
          onChange={(event) => setLoincCode(event.currentTarget.value)}
        />
      </Group>
      <Group grow align="flex-start">
        <TextInput
          label="Sample type"
          value={sampleType}
          onChange={(event) => setSampleType(event.currentTarget.value)}
        />
        <TextInput
          label="Unit"
          value={unit}
          onChange={(event) => setUnit(event.currentTarget.value)}
        />
      </Group>
      <Group grow align="flex-start">
        <TextInput
          label="Price"
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.currentTarget.value)}
        />
        <TextInput
          label="TAT hours"
          inputMode="numeric"
          value={tatHours}
          onChange={(event) => setTatHours(event.currentTarget.value)}
        />
      </Group>
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconMicroscope size={16} />}
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
