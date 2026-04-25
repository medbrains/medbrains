import { ActionIcon, Badge, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import type { RegulatoryClauseRef, RequirementLevel } from "@medbrains/types";

interface FieldTooltipProps {
  description?: string | null;
  uiHint: string | null;
  clauses: RegulatoryClauseRef[];
}

const LEVEL_COLORS: Record<RequirementLevel, string> = {
  mandatory: "danger",
  conditional: "warning",
  recommended: "primary",
  optional: "slate",
};

export function FieldTooltip({ description, uiHint, clauses }: FieldTooltipProps) {
  if (!description && !uiHint && clauses.length === 0) return null;

  const label = (
    <Stack gap={4}>
      {description && (
        <Text size="xs">
          {description}
        </Text>
      )}
      {uiHint && (
        <Text size="xs" c="dimmed">
          {uiHint}
        </Text>
      )}
      {clauses.length > 0 && (
        <Group gap={4} wrap="wrap">
          {clauses.map((c) => (
            <Badge
              key={`${c.body_code}-${c.clause_code ?? ""}`}
              size="xs"
              color={LEVEL_COLORS[c.requirement_level]}
              variant="light"
            >
              {c.body_code}
              {c.clause_code ? ` ${c.clause_code}` : ""}
            </Badge>
          ))}
        </Group>
      )}
    </Stack>
  );

  return (
    <Tooltip
      label={label}
      multiline
      w={300}
      withArrow
      position="top-end"
      events={{ hover: true, focus: true, touch: true }}
    >
      <ActionIcon variant="subtle" size="xs" color="slate" aria-label="Info">
        <IconInfoCircle size={14} />
      </ActionIcon>
    </Tooltip>
  );
}
