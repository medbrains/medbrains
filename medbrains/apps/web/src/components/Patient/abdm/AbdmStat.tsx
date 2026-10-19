import { Text } from "@mantine/core";
import { Card } from "@/components/ui";

interface AbdmStatProps {
  label: string;
  value: string | number;
  hint?: string;
}

/** One ABDM figure with what it counts, for the sharing and dashboard screens. */
export function AbdmStat({ label, value, hint }: AbdmStatProps) {
  return (
    <Card>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text size="xl" fw={600}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Card>
  );
}
