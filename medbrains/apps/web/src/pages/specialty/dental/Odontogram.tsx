import { Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { Badge, Button } from "@/components/ui";
import { ARCHES, conditionTone, type Dentition, label } from "./tooth-layout";

interface OdontogramProps {
  dentition: Dentition;
  onDentition: (d: Dentition) => void;
  /** The latest finding per tooth. */
  findings: Map<string, string>;
  selected: string | null;
  onSelect: (tooth: string) => void;
}

function Arch({
  teeth,
  findings,
  selected,
  onSelect,
  name,
}: Omit<OdontogramProps, "dentition" | "onDentition"> & { teeth: string[]; name: string }) {
  return (
    <Group gap={4} wrap="nowrap" justify="center" role="group" aria-label={name}>
      {teeth.map((tooth) => {
        const condition = findings.get(tooth);
        return (
          <Stack key={tooth} gap={2} align="center">
            <Button
              size="xs"
              tone={selected === tooth ? "primary" : "secondary"}
              aria-pressed={selected === tooth}
              aria-label={`Tooth ${tooth}${condition ? `, ${label(condition)}` : ""}`}
              onClick={() => onSelect(tooth)}
              px={6}
            >
              {tooth}
            </Button>
            {condition && (
              <Badge size="xs" tone={conditionTone(condition)}>
                {label(condition).slice(0, 6)}
              </Badge>
            )}
          </Stack>
        );
      })}
    </Group>
  );
}

/** A clickable FDI chart: pick a tooth to see or record its findings. */
export function Odontogram({ dentition, onDentition, ...arch }: OdontogramProps) {
  const { upper, lower } = ARCHES[dentition];
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Patient&apos;s right ← → left
        </Text>
        <SegmentedControl
          size="xs"
          value={dentition}
          onChange={(v) => onDentition(v as Dentition)}
          data={[
            { value: "permanent", label: "Permanent" },
            { value: "deciduous", label: "Deciduous" },
          ]}
          aria-label="Dentition"
        />
      </Group>
      <Arch {...arch} teeth={upper} name="Upper arch" />
      <Arch {...arch} teeth={lower} name="Lower arch" />
    </Stack>
  );
}
