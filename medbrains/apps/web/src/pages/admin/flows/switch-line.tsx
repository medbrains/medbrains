/**
 * One switch on the switchboard: its plain sentence, its control, the effect
 * of the current value in one line, and — one click each — the stations it
 * changes on the map, its SOP sentence and its change history.
 */
import { Anchor, Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { FlowHistoryEntry, FlowSwitchDef, FlowSwitchValue } from "@medbrains/types";
import { IconHistory, IconMapPin } from "@tabler/icons-react";
import { Link } from "react-router";
import { Badge, Button, SegmentedControl, Switch } from "@/components/ui";

export interface SwitchLineProps {
  def: FlowSwitchDef;
  value: FlowSwitchValue;
  saved: FlowSwitchValue;
  disabled: boolean;
  history: FlowHistoryEntry[];
  highlighted: boolean;
  onChange: (value: FlowSwitchValue) => void;
  onShowOnMap: () => void;
}

function effectOf(def: FlowSwitchDef, value: FlowSwitchValue): string {
  return def.effects.find((e) => e.value === String(value))?.label ?? "";
}

function shown(def: FlowSwitchDef, v: FlowSwitchValue | undefined): string {
  if (def.kind.type === "on_off") return v === true ? "On" : "Off";
  return def.kind.options.find((o) => o.value === v)?.label ?? String(v ?? "—");
}

export function SwitchLine(props: SwitchLineProps) {
  const { def, value, saved, disabled, history, highlighted, onChange, onShowOnMap } = props;
  const [open, details] = useDisclosure(false);
  const changed = value !== saved;
  const mine = history.filter((h) => h.before?.[def.key] !== h.after?.[def.key]);
  return (
    <Stack gap={4} id={`switch-${def.key}`}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2}>
          <Text fw={600}>{def.sentence}</Text>
          <Text size="sm" c="dimmed">
            {effectOf(def, value)}
          </Text>
        </Stack>
        {def.kind.type === "on_off" ? (
          <Switch
            aria-label={def.sentence}
            checked={value === true}
            disabled={disabled}
            onLabel="On"
            offLabel="Off"
            size="lg"
            onChange={(e) => onChange(e.currentTarget.checked)}
          />
        ) : (
          <SegmentedControl
            aria-label={def.sentence}
            value={String(value)}
            disabled={disabled}
            onChange={onChange}
            data={def.kind.options}
          />
        )}
      </Group>
      <Group gap="xs">
        {changed && <Badge tone="accent">Changed — not yet proposed</Badge>}
        <Button
          tone="ghost"
          size="xs"
          leftSection={<IconMapPin size={16} />}
          aria-pressed={highlighted}
          onClick={onShowOnMap}
        >
          {highlighted ? "Hide on map" : "Show on map"}
        </Button>
        <Button
          tone="ghost"
          size="xs"
          leftSection={<IconHistory size={16} />}
          aria-expanded={open}
          onClick={details.toggle}
        >
          SOP and history ({mine.length})
        </Button>
      </Group>
      {open && (
        <Stack gap={4} pl="md">
          <Text size="sm">
            <Text span fw={600}>
              SOP:{" "}
            </Text>
            {def.sop}
          </Text>
          <Text size="xs" c="dimmed" ff="var(--mb-font-mono)">
            {def.path}
          </Text>
          {mine.length === 0 ? (
            <Text size="sm" c="dimmed">
              Never changed: running as the flow ships.
            </Text>
          ) : (
            mine.map((h) => (
              <Text size="sm" key={h.change_set_id}>
                {shown(def, h.before?.[def.key])} → {shown(def, h.after?.[def.key])}, applied{" "}
                {h.applied_at ? new Date(h.applied_at).toLocaleString() : "—"}; proposed by{" "}
                {h.author_name ?? "unknown"}, approved by {h.approver_name ?? "—"}
                {h.second_approver_name ? ` and ${h.second_approver_name}` : ""}.{" "}
                <Anchor component={Link} to={`/admin/knowledge-changes?open=${h.change_set_id}`}>
                  Open change
                </Anchor>
              </Text>
            ))
          )}
        </Stack>
      )}
    </Stack>
  );
}
