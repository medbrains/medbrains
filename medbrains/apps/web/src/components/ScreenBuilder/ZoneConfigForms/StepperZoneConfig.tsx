import { ActionIcon, Group, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { ZoneNode } from "@medbrains/stores";
import { useScreenBuilderStore } from "@medbrains/stores";
import { IconPicker } from "../IconPicker";

interface StepDef {
  key: string;
  label: string;
  icon?: string;
}

export function StepperZoneConfig({ zone }: { zone: ZoneNode }) {
  const updateZone = useScreenBuilderStore((s) => s.updateZone);
  const steps = (zone.config.steps as StepDef[]) ?? [];

  const updateStep = (index: number, updates: Partial<StepDef>) => {
    const updated = steps.map((s, i) => (i === index ? { ...s, ...updates } : s));
    updateZone(zone.clientId, { config: { ...zone.config, steps: updated } });
  };

  const addStep = () => {
    const next = [...steps, { key: `step_${steps.length + 1}`, label: "", icon: "" }];
    updateZone(zone.clientId, { config: { ...zone.config, steps: next } });
  };

  const removeStep = (index: number) => {
    updateZone(zone.clientId, {
      config: { ...zone.config, steps: steps.filter((_, i) => i !== index) },
    });
  };

  return (
    <Stack gap="sm">
      <div style={{ fontSize: "var(--mantine-font-size-sm)", fontWeight: 500, marginBottom: 4 }}>
        Steps
      </div>

      {steps.length === 0 && (
        <Text size="xs" c="dimmed" fs="italic">
          No steps defined
        </Text>
      )}

      {steps.map((step, i) => (
        <Group key={i} gap="xs" align="flex-end" wrap="nowrap">
          <TextInput
            size="xs"
            label={i === 0 ? "Key" : undefined}
            placeholder="step_key"
            value={step.key}
            onChange={(e) => updateStep(i, { key: e.currentTarget.value })}
            style={{ flex: 1 }}
          />
          <TextInput
            size="xs"
            label={i === 0 ? "Label" : undefined}
            placeholder="Step Label"
            value={step.label}
            onChange={(e) => updateStep(i, { label: e.currentTarget.value })}
            style={{ flex: 1 }}
          />
          <IconPicker
            value={step.icon ?? ""}
            onChange={(icon) => updateStep(i, { icon })}
            label=""
          />
          <Tooltip label="Remove step">
            <ActionIcon variant="subtle" color="danger" size="xs" onClick={() => removeStep(i)} aria-label="Delete">
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ))}

      <Group mt="xs">
        <ActionIcon variant="light" size="sm" onClick={addStep} aria-label="Add">
          <IconPlus size={14} />
        </ActionIcon>
        <Text size="xs" c="dimmed">
          Add step
        </Text>
      </Group>
    </Stack>
  );
}
