import { Group, Text } from "@mantine/core";

interface SelectLabelProps {
  label: string;
  onCreate?: () => void;
  createLabel?: string;
}

export function SelectLabel({ label, onCreate, createLabel = "+ Create new" }: SelectLabelProps) {
  return (
    <Group justify="space-between">
      <Text size="sm" fw={500}>
        {label}
      </Text>
      {onCreate && (
        <Text size="xs" c="primary" style={{ cursor: "pointer" }} onClick={onCreate}>
          {createLabel}
        </Text>
      )}
    </Group>
  );
}
