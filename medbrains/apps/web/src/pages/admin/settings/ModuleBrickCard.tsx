import { Group, Stack, Text } from "@mantine/core";
import type { ModuleConfig } from "@medbrains/types";
import { Badge, Card, Switch } from "@/components/ui";
import { isOn, names, neededBy } from "./module-bricks";

interface ModuleBrickCardProps {
  mod: ModuleConfig;
  modules: readonly ModuleConfig[];
  pending: boolean;
  onToggle: (mod: ModuleConfig, on: boolean) => void;
}

/** One app brick on the Modules screen: its switch, what it needs and what needs it. */
export function ModuleBrickCard({ mod, modules, pending, onToggle }: ModuleBrickCardProps) {
  const on = isOn(mod);
  const needs = modules.filter((m) => mod.depends_on.includes(m.code));
  const needed = neededBy(mod.code, modules);

  return (
    <Card padding="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} size="sm" lineClamp={1}>
            {mod.name}
          </Text>
          <Badge tone={on ? "success" : "neutral"} size="sm">
            {on ? "On" : "Off"}
          </Badge>
        </Group>
        {mod.description && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {mod.description}
          </Text>
        )}
        <Text size="xs" c="dimmed">
          Needs: {needs.length > 0 ? names(needs) : "nothing else"}
        </Text>
        <Text size="xs" c="dimmed">
          Needed by: {needed.length > 0 ? names(needed) : "no other app"}
        </Text>
        <Switch
          mt="auto"
          checked={on}
          onChange={(e) => onToggle(mod, e.currentTarget.checked)}
          disabled={pending}
          label={on ? "On" : "Off"}
          aria-label={`${mod.name}: ${on ? "on" : "off"}`}
        />
      </Stack>
    </Card>
  );
}
