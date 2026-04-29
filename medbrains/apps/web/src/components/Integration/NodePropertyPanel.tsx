import {
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { api } from "@medbrains/api";
import { useIntegrationBuilderStore } from "@medbrains/stores";
import type { EventRegistryRow } from "@medbrains/types";
import {
  IconBolt,
  IconDatabase,
  IconGitBranch,
  IconPlayerPlay,
  IconSettings,
  IconTransform,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { FieldMappingEditor } from "./FieldMappingEditor";

const NODE_TYPE_ICONS: Record<string, typeof IconBolt> = {
  trigger: IconBolt,
  condition: IconGitBranch,
  action: IconPlayerPlay,
  transform: IconTransform,
};

const NODE_TYPE_LABELS: Record<string, string> = {
  trigger: "Trigger",
  condition: "Condition",
  action: "Action",
  transform: "Transform",
  delay: "Delay",
};

interface SchemaProperty {
  type?: string;
  enum?: string[];
  title?: string;
  description?: string;
  default?: unknown;
}

export function NodePropertyPanel() {
  const selectedNodeId = useIntegrationBuilderStore((s) => s.selectedNodeId);
  const nodes = useIntegrationBuilderStore((s) => s.nodes);
  const updateNodeData = useIntegrationBuilderStore((s) => s.updateNodeData);
  const removeNode = useIntegrationBuilderStore((s) => s.removeNode);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId],
  );

  // Fetch all templates to get config_schema for selected node's template
  const { data: templates } = useQuery({
    queryKey: ["integration", "node-templates"],
    queryFn: () => api.listNodeTemplates(),
  });

  // Find the matching template for the selected node
  const matchingTemplate = useMemo(() => {
    if (!selectedNode || !templates) return null;
    const code = selectedNode.data.templateCode as string | undefined;
    if (!code) return null;
    return templates.find((t) => t.code === code) ?? null;
  }, [selectedNode, templates]);

  // Is this a trigger.internal_event node?
  const isTriggerEvent = useMemo(() => {
    if (!selectedNode) return false;
    return (
      (selectedNode.type ?? "") === "trigger" &&
      (selectedNode.data.templateCode as string) === "trigger.internal_event"
    );
  }, [selectedNode]);

  // Is this an action node?
  const isActionNode = useMemo(() => {
    if (!selectedNode) return false;
    return (selectedNode.type ?? "").startsWith("action");
  }, [selectedNode]);

  // Fetch connectors for action node connector selector
  const { data: connectors } = useQuery({
    queryKey: ["orchestration", "connectors"],
    queryFn: () => api.listConnectors(),
    enabled: isActionNode,
  });

  const connectorSelectData = useMemo(() => {
    if (!connectors) return [];
    return connectors.map((c) => ({
      value: c.id,
      label: `${c.name} (${c.connector_type})`,
    }));
  }, [connectors]);

  // Fetch events list for trigger node event selector + action field mapping
  const { data: eventsData } = useQuery({
    queryKey: ["orchestration", "events"],
    queryFn: () => api.listOrchestrationEvents(),
    enabled: isTriggerEvent || isActionNode,
  });

  // Get trigger event payload fields (for field mapping sources)
  const triggerPayloadFields = useMemo(() => {
    if (!isActionNode || !nodes.length) return [];
    const triggerNode = nodes.find((n) => (n.type ?? "").startsWith("trigger"));
    if (!triggerNode) return [];
    const eventCode = (triggerNode.data.config as Record<string, unknown>)?.event_type as string;
    if (!eventCode || !eventsData?.events) return [];
    const event = eventsData.events.find((e: EventRegistryRow) => e.event_code === eventCode);
    if (!event?.payload_schema) return [];
    const schema = event.payload_schema as {
      fields?: Array<{ path: string; type: string; label: string }>;
    };
    return schema.fields ?? [];
  }, [isActionNode, nodes, eventsData]);

  const eventSelectData = useMemo(() => {
    if (!eventsData?.events) return [];
    const grouped = new Map<string, Array<{ value: string; label: string }>>();
    for (const e of eventsData.events) {
      const group = e.module.toUpperCase();
      const items = grouped.get(group) ?? [];
      items.push({
        value: e.event_code,
        label: `${e.event_code} — ${e.description ?? e.action}`,
      });
      grouped.set(group, items);
    }
    return [...grouped.entries()].map(([group, items]) => ({ group, items }));
  }, [eventsData]);

  // Get payload schema for selected event
  const selectedEventPayload = useMemo(() => {
    if (!isTriggerEvent || !eventsData?.events) return [];
    const eventCode = (selectedNode?.data.config as Record<string, unknown>)?.event_type as string;
    if (!eventCode) return [];
    const event = eventsData.events.find((e: EventRegistryRow) => e.event_code === eventCode);
    if (!event?.payload_schema) return [];
    const schema = event.payload_schema as {
      fields?: Array<{ path: string; type: string; label: string }>;
    };
    return schema.fields ?? [];
  }, [isTriggerEvent, eventsData, selectedNode]);

  const formSelectData: Array<{ value: string; label: string }> = [];

  if (!selectedNode) {
    return (
      <Box p="md">
        <Group gap="xs" mb="md">
          <ThemeIcon variant="light" color="slate" size="sm">
            <IconSettings size={14} />
          </ThemeIcon>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            Properties
          </Text>
        </Group>
        <Box
          style={{
            padding: 24,
            textAlign: "center",
            borderRadius: 8,
            border: "2px dashed var(--mantine-color-gray-3)",
          }}
        >
          <Text size="sm" c="dimmed" mb={4}>
            No node selected
          </Text>
          <Text size="xs" c="dimmed">
            Click a node on the canvas or drag one from the palette to get started.
          </Text>
        </Box>
      </Box>
    );
  }

  const config = (selectedNode.data.config ?? {}) as Record<string, unknown>;
  const nodeType = selectedNode.type ?? "";
  const Icon = NODE_TYPE_ICONS[nodeType] ?? IconPlayerPlay;
  const templateCode = selectedNode.data.templateCode as string | undefined;
  const isMapDataNode = nodeType === "transform" && templateCode === "transform.map_data";

  // Get config_schema from either node data or matching template
  const configSchema = (matchingTemplate?.config_schema ??
    selectedNode.data.configSchema ??
    {}) as Record<string, unknown>;
  const properties = (configSchema.properties ?? {}) as Record<string, SchemaProperty>;

  const handleConfigChange = (key: string, value: unknown) => {
    updateNodeData(selectedNode.id, {
      config: { ...config, [key]: value },
    });
  };

  const handleLabelChange = (label: string) => {
    updateNodeData(selectedNode.id, { label });
  };

  return (
    <Box p="md">
      <Group gap="xs" mb="md">
        <ThemeIcon variant="light" color="slate" size="sm">
          <IconSettings size={14} />
        </ThemeIcon>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Properties
        </Text>
      </Group>

      {/* Node type header */}
      <Box
        mb="md"
        p="sm"
        style={{
          borderRadius: 8,
          background: "var(--mantine-color-gray-0)",
          border: "1px solid var(--mantine-color-gray-2)",
        }}
      >
        <Group gap="sm" mb={6}>
          <ThemeIcon
            variant="light"
            color={String(selectedNode.data.color ?? "slate")}
            size="md"
            radius="md"
          >
            <Icon size={16} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={600}>
              {NODE_TYPE_LABELS[nodeType] ?? nodeType}
            </Text>
            {Boolean(selectedNode.data.templateCode) && (
              <Badge size="xs" variant="outline" color="slate">
                {String(selectedNode.data.templateCode)}
              </Badge>
            )}
          </Box>
        </Group>
      </Box>

      <Stack gap="sm">
        {/* Label */}
        <TextInput
          label="Display Name"
          size="xs"
          value={String(selectedNode.data.label ?? "")}
          onChange={(e) => handleLabelChange(e.currentTarget.value)}
          styles={{
            label: {
              fontWeight: 600,
              fontSize: 11,
              textTransform: "uppercase",
              color: "var(--mantine-color-dimmed)",
            },
          }}
        />

        {/* Rich field mapper for Map Data transform nodes */}
        {isMapDataNode && (
          <>
            <Divider
              label={
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ fontSize: 10 }}>
                  Field Mapping
                </Text>
              }
              labelPosition="left"
            />
            <FieldMappingEditor nodeId={selectedNode.id} />
          </>
        )}

        {/* Config properties from schema (generic form for non-map_data nodes) */}
        {!isMapDataNode && Object.keys(properties).length > 0 && (
          <>
            <Divider
              label={
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ fontSize: 10 }}>
                  Configuration
                </Text>
              }
              labelPosition="left"
            />

            {Object.entries(properties).map(([key, schema]) => {
              const value = config[key];
              const fieldLabel =
                schema.title ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

              if (schema.enum) {
                return (
                  <Select
                    key={key}
                    label={fieldLabel}
                    description={schema.description}
                    size="xs"
                    data={schema.enum}
                    value={typeof value === "string" ? value : null}
                    onChange={(v) => handleConfigChange(key, v)}
                    clearable
                    styles={{ label: { fontWeight: 500 } }}
                  />
                );
              }

              if (schema.type === "number" || schema.type === "integer") {
                return (
                  <NumberInput
                    key={key}
                    label={fieldLabel}
                    description={schema.description}
                    size="xs"
                    value={typeof value === "number" ? value : undefined}
                    onChange={(v) => handleConfigChange(key, v)}
                    styles={{ label: { fontWeight: 500 } }}
                  />
                );
              }

              if (schema.type === "boolean") {
                return (
                  <Switch
                    key={key}
                    label={fieldLabel}
                    description={schema.description}
                    size="xs"
                    checked={Boolean(value)}
                    onChange={(e) => handleConfigChange(key, e.currentTarget.checked)}
                  />
                );
              }

              // Long text fields
              if (key === "notes" || key === "description" || key === "body" || key === "message") {
                return (
                  <Textarea
                    key={key}
                    label={fieldLabel}
                    description={schema.description}
                    size="xs"
                    rows={3}
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => handleConfigChange(key, e.currentTarget.value)}
                    styles={{ label: { fontWeight: 500 } }}
                  />
                );
              }

              return (
                <TextInput
                  key={key}
                  label={fieldLabel}
                  description={schema.description}
                  size="xs"
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => handleConfigChange(key, e.currentTarget.value)}
                  styles={{ label: { fontWeight: 500 } }}
                />
              );
            })}
          </>
        )}

        {!isMapDataNode && Object.keys(properties).length === 0 && (
          <Text size="xs" c="dimmed" ta="center" py="sm">
            This node has no configurable properties.
          </Text>
        )}

        {/* Event selector for trigger.internal_event nodes */}
        {isTriggerEvent && (
          <>
            <Divider
              label={
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ fontSize: 10 }}>
                  Event Trigger
                </Text>
              }
              labelPosition="left"
            />
            <Select
              label="Event"
              description="Which system event triggers this pipeline"
              size="xs"
              data={eventSelectData}
              value={typeof config.event_type === "string" ? config.event_type : null}
              onChange={(v) => {
                handleConfigChange("event_type", v);
                // Auto-set pipeline trigger_type + trigger_config when event selected
                const store = useIntegrationBuilderStore.getState();
                if (v) {
                  store.updatePipelineMeta({
                    trigger_type: "internal_event",
                    trigger_config: { event_type: v },
                  });
                }
              }}
              clearable
              searchable
              placeholder="Select event..."
              styles={{
                label: {
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.14em",
                  color: "var(--mb-text-muted)",
                },
              }}
            />

            {/* Payload schema fields */}
            {selectedEventPayload.length > 0 && (
              <>
                <Divider
                  label={
                    <Group gap={4}>
                      <IconDatabase size={10} />
                      <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ fontSize: 10 }}>
                        Event Payload ({selectedEventPayload.length} fields)
                      </Text>
                    </Group>
                  }
                  labelPosition="left"
                />
                <Box
                  style={{
                    borderRadius: 6,
                    border: "1px solid var(--mb-border)",
                    background: "var(--mb-bg-content)",
                    padding: 8,
                    maxHeight: 200,
                    overflow: "auto",
                  }}
                >
                  {selectedEventPayload.map((field) => (
                    <Group
                      key={field.path}
                      gap={6}
                      py={3}
                      style={{ borderBottom: "1px dashed var(--mb-border-subtle)" }}
                    >
                      <Code style={{ fontSize: 11, flex: 1 }}>{field.path}</Code>
                      <Badge size="xs" variant="light" color="slate">
                        {field.type}
                      </Badge>
                    </Group>
                  ))}
                  <Text size="xs" c="dimmed" mt={6} ta="center">
                    These fields are available for mapping in downstream action nodes
                  </Text>
                </Box>
              </>
            )}

            {/* Form Link */}
            <Select
              label="Link Form (optional)"
              description="Expose form fields as additional data sources"
              size="xs"
              data={formSelectData}
              value={typeof config.linked_form === "string" ? config.linked_form : null}
              onChange={(v) => handleConfigChange("linked_form", v)}
              clearable
              searchable
              placeholder="Select a form..."
              styles={{ label: { fontWeight: 500 } }}
            />
          </>
        )}

        {/* Connector + Field Mapping for action nodes */}
        {isActionNode && (
          <>
            <Divider
              label={
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ fontSize: 10 }}>
                  Connector
                </Text>
              }
              labelPosition="left"
            />
            <Select
              label="Connector"
              description="External system to call"
              size="xs"
              data={connectorSelectData}
              value={typeof config.connector_id === "string" ? config.connector_id : null}
              onChange={(v) => handleConfigChange("connector_id", v)}
              clearable
              searchable
              placeholder="Select connector..."
              styles={{
                label: {
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.14em",
                  color: "var(--mb-text-muted)",
                },
              }}
            />

            <TextInput
              label="Action"
              description="Connector action (e.g., send, create, submit)"
              size="xs"
              value={typeof config.action === "string" ? config.action : ""}
              onChange={(e) => handleConfigChange("action", e.currentTarget.value)}
              placeholder="default"
              styles={{
                label: {
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.14em",
                  color: "var(--mb-text-muted)",
                },
              }}
            />

            {/* Field Mapping: source (event payload) → destination (connector input) */}
            {triggerPayloadFields.length > 0 && (
              <>
                <Divider
                  label={
                    <Group gap={4}>
                      <IconDatabase size={10} />
                      <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ fontSize: 10 }}>
                        Field Mapping
                      </Text>
                    </Group>
                  }
                  labelPosition="left"
                />
                <Text size="xs" c="dimmed" mb={4}>
                  Map event payload fields to connector input
                </Text>
                <FieldMappingSection
                  sourceFields={triggerPayloadFields}
                  mappings={
                    (config.field_mapping as Array<{ source: string; destination: string }>) ?? []
                  }
                  onChange={(mappings) => handleConfigChange("field_mapping", mappings)}
                />
              </>
            )}
          </>
        )}

        <Divider my={4} />

        <Button
          variant="light"
          color="danger"
          size="xs"
          fullWidth
          leftSection={<IconTrash size={14} />}
          onClick={() => removeNode(selectedNode.id)}
        >
          Delete Node
        </Button>
      </Stack>
    </Box>
  );
}

/** Inline field mapping section for action nodes. */
interface MappingEntry {
  source: string;
  destination: string;
  static_value?: string;
}

function FieldMappingSection({
  sourceFields,
  mappings,
  onChange,
}: {
  sourceFields: Array<{ path: string; type: string; label: string }>;
  mappings: MappingEntry[];
  onChange: (m: MappingEntry[]) => void;
}) {
  const sourceOptions = sourceFields.map((f) => ({
    value: f.path,
    label: `${f.label} (${f.path})`,
  }));

  const addMapping = () => {
    onChange([...mappings, { source: "", destination: "" }]);
  };

  const updateMapping = (idx: number, field: string, value: string) => {
    const next = mappings.map((m, i) =>
      i === idx ? { source: m.source, destination: m.destination, [field]: value } : m,
    );
    onChange(next);
  };

  const removeMapping = (idx: number) => {
    onChange(mappings.filter((_, i) => i !== idx));
  };

  return (
    <Stack gap={6}>
      {mappings.map((m, idx) => (
        <Group key={`mapping-${m.source}-${m.destination}`} gap={4} align="flex-end">
          <Select
            size="xs"
            data={sourceOptions}
            value={m.source}
            onChange={(v) => updateMapping(idx, "source", v ?? "")}
            placeholder="Source field"
            style={{ flex: 1 }}
            searchable
          />
          <Text size="xs" c="dimmed" style={{ lineHeight: "30px" }}>
            →
          </Text>
          <TextInput
            size="xs"
            value={m.destination}
            onChange={(e) => updateMapping(idx, "destination", e.currentTarget.value)}
            placeholder="Destination"
            style={{ flex: 1 }}
          />
          <Button size="compact-xs" variant="subtle" color="red" onClick={() => removeMapping(idx)}>
            ×
          </Button>
        </Group>
      ))}
      <Button size="compact-xs" variant="light" onClick={addMapping}>
        + Add mapping
      </Button>
    </Stack>
  );
}
