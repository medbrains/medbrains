import {
  Card,
  Code,
  Collapse,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Timeline,
} from "@mantine/core";
import type { AuditLogEntry } from "@medbrains/types";
import {
  IconChevronDown,
  IconChevronRight,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";
import { auditService } from "@/services/audit.service";

// ── Constants ──────────────────────────────────────────

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <IconPlus size={14} />,
  update: <IconPencil size={14} />,
  delete: <IconTrash size={14} />,
};

const STATUS_TONE: Record<string, BadgeTone> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  primary: "primary",
  blue: "info",
  teal: "success",
  green: "success",
  orange: "warning",
  violet: "accent",
  grape: "accent",
  red: "danger",
  gray: "neutral",
  slate: "neutral",
};

function statusTone(status: string): BadgeTone {
  return STATUS_TONE[statusColor(status) ?? "slate"] ?? "neutral";
}

// ── Component ──────────────────────────────────────────

export function EntityTimelineTab() {
  const [entityType, setEntityType] = useState<string | null>(null);
  const [entityId, setEntityId] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  // Fetch entity types for dropdown
  const { data: entityTypes } = useQuery({
    queryKey: ["audit-entity-types"],
    queryFn: () => auditService.listEntityTypes(),
  });

  // Fetch timeline only when search is triggered
  const { data: timeline, isLoading } = useQuery({
    queryKey: ["entity-timeline", entityType, entityId],
    queryFn: () =>
      entityType ? auditService.getEntityTimeline(entityType, entityId) : Promise.resolve([]),
    enabled: searchTriggered && !!entityType && !!entityId,
  });

  const handleSearch = () => {
    if (entityType && entityId.trim()) {
      setSearchTriggered(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <Stack gap="md">
      {/* Search Inputs */}
      <Group gap="sm" wrap="wrap">
        <Select
          placeholder="Entity Type"
          data={entityTypes?.map((e) => ({ value: e, label: e })) ?? []}
          value={entityType}
          onChange={(val) => {
            setEntityType(val);
            setSearchTriggered(false);
          }}
          clearable
          size="sm"
          w={200}
        />
        <TextInput
          placeholder="Entity ID (UUID)"
          value={entityId}
          onChange={(e) => {
            setEntityId(e.currentTarget.value);
            setSearchTriggered(false);
          }}
          onKeyDown={handleKeyDown}
          leftSection={<IconSearch size={14} />}
          size="sm"
          w={320}
        />
        <Button
          tone="primary"
          size="sm"
          onClick={handleSearch}
          disabled={!entityType || !entityId.trim()}
        >
          Search
        </Button>
      </Group>

      {/* Results */}
      {isLoading && (
        <Text c="dimmed" ta="center" py="xl">
          Loading timeline...
        </Text>
      )}

      {searchTriggered && !isLoading && timeline && timeline.length === 0 && (
        <Card withBorder p="xl">
          <Text c="dimmed" ta="center">
            No changes found for this entity.
          </Text>
        </Card>
      )}

      {timeline && timeline.length > 0 && (
        <Card withBorder p="md">
          <Text fw={600} mb="md">
            Change History ({timeline.length} entries)
          </Text>
          <Timeline active={timeline.length - 1} bulletSize={28} lineWidth={2}>
            {timeline.map((entry) => (
              <Timeline.Item
                key={entry.id}
                bullet={ACTION_ICONS[entry.action] ?? <IconPencil size={14} />}
                color={statusColor(entry.action) ?? "slate"}
                title={
                  <Group gap="xs">
                    <Badge tone={statusTone(entry.action)} size="sm">
                      {entry.action}
                    </Badge>
                    <Text size="sm" c="dimmed">
                      by {entry.user_name ?? "System"}
                    </Text>
                  </Group>
                }
              >
                <Text size="xs" c="dimmed" mt={4}>
                  {new Date(entry.created_at).toLocaleString()}
                </Text>
                {entry.description && (
                  <Text size="sm" mt={4}>
                    {entry.description}
                  </Text>
                )}
                <DiffSection entry={entry} />
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}

      {!searchTriggered && (
        <Card withBorder p="xl">
          <Text c="dimmed" ta="center">
            Select an entity type and paste the entity UUID to view its full change history.
          </Text>
        </Card>
      )}
    </Stack>
  );
}

// ── Collapsible Diff Section ───────────────────────────

function DiffSection({ entry }: { entry: AuditLogEntry }) {
  const [opened, setOpened] = useState(false);
  const hasData = entry.old_values != null || entry.new_values != null;

  if (!hasData) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <Text
        size="xs"
        c="primary"
        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
        onClick={() => setOpened((o) => !o)}
      >
        {opened ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        {opened ? "Hide diff" : "Show diff"}
      </Text>
      <Collapse expanded={opened}>
        <Stack gap="xs" mt="xs">
          {entry.old_values != null && (
            <div>
              <Text size="xs" fw={600} c="red.6">
                Old Values:
              </Text>
              <Code block>{JSON.stringify(entry.old_values, null, 2)}</Code>
            </div>
          )}
          {entry.new_values != null && (
            <div>
              <Text size="xs" fw={600} c="green.6">
                New Values:
              </Text>
              <Code block>{JSON.stringify(entry.new_values, null, 2)}</Code>
            </div>
          )}
        </Stack>
      </Collapse>
    </div>
  );
}
