/**
 * The side panel for the station chosen on the canvas: its name, stage,
 * expected time and holder role, the branch it sits on (the condition
 * form), and move/remove. A locked safety signal can move but never be
 * removed or narrowed; the controls say why.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { FlowBlock, FlowClause, FlowFact, FlowNamed, FlowStation } from "@medbrains/types";
import { IconArrowLeft, IconArrowRight, IconLock, IconTrash, IconX } from "@tabler/icons-react";
import { Button, IconButton, Input, NumberField, Panel, Select, Tooltip } from "@/components/ui";
import { removeBlockedReason } from "./builder";
import { clauseToRows, rowsToClause } from "./condition";
import { ConditionForm } from "./condition-form";

export interface StationPanelProps {
  station: FlowStation;
  block: FlowBlock | undefined;
  facts: FlowFact[];
  departments: FlowNamed[];
  roles: FlowNamed[];
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<FlowStation>) => void;
  onBranch: (lane: string | null, clause: FlowClause) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function StationPanel(props: StationPanelProps) {
  const { station: s, block } = props;
  const blocked = removeBlockedReason(s);
  const { rows, joiner } = clauseToRows(s.fact_when);
  const automatic = s.kind.type === "switch" || s.kind.type === "end";

  return (
    <Panel
      title={s.name}
      description={block?.does ?? (automatic ? "Automatic: nobody holds it." : undefined)}
      actions={
        <IconButton aria-label="Close the station panel" onClick={props.onClose}>
          <IconX size={16} aria-hidden />
        </IconButton>
      }
    >
      <Stack gap="md">
        {s.locked && (
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <IconLock size={16} aria-hidden />
            <Text size="sm">
              <b>Required safety signal.</b> {s.required_by} It can move, but never come after
              Discharge, be removed, or be limited to some patients.
            </Text>
          </Group>
        )}
        <Input
          label="Name"
          value={s.name}
          onChange={(e) => props.onChange({ name: e.currentTarget.value })}
        />
        <Input
          label="Stage"
          description="Groups stations on the switchboard, e.g. Before billing"
          value={s.stage}
          onChange={(e) => props.onChange({ stage: e.currentTarget.value })}
        />
        {!automatic && (
          <>
            <NumberField
              label="Expected time (minutes)"
              min={0}
              max={10080}
              value={s.sla_minutes ?? ""}
              onChange={(v) => props.onChange({ sla_minutes: typeof v === "number" ? v : null })}
            />
            <Select
              label="Who holds it (role)"
              description={block ? `Needs the permission ${block.permission}` : undefined}
              placeholder={block ? `Default: ${block.role}` : undefined}
              data={props.roles.map((r) => ({ value: r.code, label: r.name }))}
              value={s.holder_role ?? null}
              searchable
              clearable
              onChange={(v) => props.onChange({ holder_role: v })}
            />
          </>
        )}
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Who stops here
          </Text>
          {rows.length > 0 && (
            <Input
              label="Branch name"
              description="Shown on the map's lane, e.g. Orthopaedics"
              value={s.lane ?? ""}
              onChange={(e) => props.onBranch(e.currentTarget.value, s.fact_when)}
            />
          )}
          <ConditionForm
            rows={rows}
            joiner={joiner}
            facts={props.facts}
            departments={props.departments}
            disabled={s.locked}
            onChange={(next, j) => props.onBranch(s.lane, rowsToClause(next, j))}
          />
        </Stack>
        <Group gap="xs">
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconArrowLeft size={16} />}
            disabled={props.isFirst}
            onClick={() => props.onMove(-1)}
          >
            Move earlier
          </Button>
          <Button
            tone="secondary"
            size="xs"
            rightSection={<IconArrowRight size={16} />}
            disabled={props.isLast}
            onClick={() => props.onMove(1)}
          >
            Move later
          </Button>
          <Tooltip label={blocked ?? "Remove this station from the draft"}>
            <Button
              tone="danger-tertiary"
              size="xs"
              leftSection={<IconTrash size={16} />}
              disabled={Boolean(blocked)}
              aria-describedby={blocked ? `blocked-${s.key}` : undefined}
              onClick={props.onRemove}
            >
              Remove
            </Button>
          </Tooltip>
        </Group>
        {blocked && (
          <Text id={`blocked-${s.key}`} size="xs" c="dimmed">
            Cannot be removed: {blocked}
          </Text>
        )}
      </Stack>
    </Panel>
  );
}
