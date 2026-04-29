import {
  Badge,
  Box,
  Button,
  Collapse,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconExternalLink,
  IconGripVertical,
  IconPlus,
  IconTransform,
} from "@tabler/icons-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDraggable } from "@dnd-kit/core";
import { useIntegrationBuilderStore } from "@medbrains/stores";
import { api } from "@medbrains/api";
import { useQuery } from "@tanstack/react-query";
import type {
  AvailableField,
  EventSchema,
  FieldMapping,
  IntegrationNodeTemplate,
  MappingSource,
  ReactFlowEdge,
  ReactFlowNode,
  SchemaField,
  TargetFieldSuggestion,
} from "@medbrains/types";
import { useCallback, useMemo, useState } from "react";
import { MappingRow } from "./MappingRow";
import { VisualFieldMapper } from "./VisualFieldMapper";

// ── ID generator ──────────────────────────────────────────

let _seq = 0;
function newMappingId(): string {
  _seq += 1;
  return `mapping_${Date.now()}_${_seq}`;
}

// ── Normalize legacy config to FieldMapping[] ─────────────

interface LegacyMapping {
  from?: string;
  to?: string;
  transform?: string;
}

function normalizeMappings(raw: unknown): FieldMapping[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((item) => {
    if (typeof item.id === "string" && typeof item.operation === "string") {
      const mapping = item as unknown as FieldMapping;
      // Auto-migrate legacy single-operation to chain
      if (!mapping.chain && mapping.operation && mapping.operation !== "none") {
        mapping.chain = [
          {
            id: `migrated_${mapping.id}`,
            operation: mapping.operation,
            config: mapping.operationConfig ?? {},
          },
        ];
      }
      if (!mapping.chain) {
        mapping.chain = [];
      }
      return mapping;
    }
    const legacy = item as unknown as LegacyMapping;
    return {
      id: newMappingId(),
      from: legacy.from ?? "",
      to: legacy.to ?? "",
      operation: "none" as const,
      operationConfig: {},
      chain: [],
    };
  });
}

// ── Draggable badge for available fields ──────────────────

function DraggableFieldBadge({ field }: { field: AvailableField }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `avail-${field.nodeId}-${field.path}`,
    data: { type: "available-field", field },
  });

  return (
    <Badge
      ref={setNodeRef}
      size="xs"
      variant="outline"
      color="primary"
      style={{
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1,
        userSelect: "none",
      }}
      {...attributes}
      {...listeners}
    >
      {field.path}
    </Badge>
  );
}

// ── Schema-field → path extractor ─────────────────────────

function schemaFieldPaths(fields: SchemaField[] | undefined): string[] {
  if (!fields || fields.length === 0) return [];
  return fields.map((f) => f.path);
}

// ── Resolve output fields from template's output_schema ───

function templateOutputPaths(
  template: IntegrationNodeTemplate | undefined,
): string[] {
  if (!template) return [];
  const schema = template.output_schema;
  if (schema && Array.isArray(schema.fields) && schema.fields.length > 0) {
    return schemaFieldPaths(schema.fields as SchemaField[]);
  }
  return [];
}

// ── Smart field inference from node + template + schemas ───

function inferOutputFields(
  node: ReactFlowNode,
  template: IntegrationNodeTemplate | undefined,
  eventSchemas: EventSchema[] | undefined,
): string[] {
  const nodeType = node.type ?? "";
  const code = (node.data.templateCode as string) ?? "";
  const nodeConfig = (node.data.config ?? {}) as Record<string, unknown>;

  // Triggers: use event schemas from API
  if (nodeType === "trigger") {
    if (code === "trigger.internal_event") {
      const eventType = nodeConfig.event_type as string | undefined;
      if (eventType && eventSchemas) {
        const schema = eventSchemas.find((s) => s.event_type === eventType);
        if (schema) {
          return schemaFieldPaths(schema.payload_schema);
        }
      }
    }
    // Non-event triggers: use template output_schema
    const tplFields = templateOutputPaths(template);
    if (tplFields.length > 0) return tplFields;
  }

  // Actions & other types: use template output_schema
  if (template) {
    const tplFields = templateOutputPaths(template);
    if (tplFields.length > 0) return tplFields;
  }

  // Conditions: pass through (they don't transform data, just route it)
  if (nodeType === "condition") {
    return ["matched", "branch", "value"];
  }

  // Transforms: they produce output based on their config
  if (nodeType === "transform" && code !== "transform.map_data") {
    return ["result", "transformed_data"];
  }

  return [];
}

// ── Fallback fields when no template match ────────────────

function getFallbackFields(nodeType: string, code: string): string[] {
  if (nodeType === "trigger") return ["event_data", "triggered_at"];
  if (nodeType === "action") return ["success", "id", "result"];
  if (nodeType === "condition") return ["matched", "value"];
  if (nodeType === "transform") return ["result"];
  return [`${code || "node"}.output`];
}

// ── Main Editor ───────────────────────────────────────────

interface FieldMappingEditorProps {
  nodeId: string;
}

export function FieldMappingEditor({ nodeId }: FieldMappingEditorProps) {
  const nodes = useIntegrationBuilderStore((s) => s.nodes);
  const edges = useIntegrationBuilderStore((s) => s.edges);
  const updateNodeData = useIntegrationBuilderStore((s) => s.updateNodeData);

  const { data: templates } = useQuery({
    queryKey: ["integration", "node-templates"],
    queryFn: () => api.listNodeTemplates(),
  });

  const { data: eventSchemas } = useQuery({
    queryKey: ["schema", "events"],
    queryFn: () => api.listEventSchemas(),
  });

  // Fetch module entity schemas for target suggestions
  const { data: moduleEntities } = useQuery({
    queryKey: ["schema", "modules", "all-entities"],
    queryFn: async () => {
      const modules = await api.listSchemaModules();
      const results = await Promise.all(
        modules.map((m) => api.listModuleEntities(m.module_code)),
      );
      return results.flat();
    },
  });

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === nodeId),
    [nodes, nodeId],
  );

  const config = (selectedNode?.data.config ?? {}) as Record<string, unknown>;
  const mappings = useMemo(
    () => normalizeMappings(config.mappings),
    [config.mappings],
  );

  const [availableOpen, setAvailableOpen] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [visualMapperOpen, setVisualMapperOpen] = useState(false);

  // ── Derive available fields from upstream nodes ────────

  const availableFields = useMemo(() => {
    const upstreamNodeIds = new Set<string>();
    const visited = new Set<string>();

    function walk(nId: string) {
      if (visited.has(nId)) return;
      visited.add(nId);
      (edges as ReactFlowEdge[]).forEach((e) => {
        if (e.target === nId) {
          upstreamNodeIds.add(e.source);
          walk(e.source);
        }
      });
    }
    walk(nodeId);

    const fields: AvailableField[] = [];
    (nodes as ReactFlowNode[]).forEach((n) => {
      if (!upstreamNodeIds.has(n.id)) return;
      const label = String(n.data.label ?? n.id);
      const code = n.data.templateCode as string | undefined;
      const nodeConfig = (n.data.config ?? {}) as Record<string, unknown>;

      // 1. Check explicit output_fields in node config
      const outputFields = nodeConfig.output_fields as string[] | undefined;
      if (Array.isArray(outputFields) && outputFields.length > 0) {
        outputFields.forEach((f) => {
          fields.push({ nodeId: n.id, nodeLabel: label, path: f });
        });
        return;
      }

      // 2. Infer fields from template output_schema or event schemas
      const tpl = templates?.find((t) => t.code === code);
      const inferredFields = inferOutputFields(n, tpl, eventSchemas);
      if (inferredFields.length > 0) {
        inferredFields.forEach((path) => {
          fields.push({ nodeId: n.id, nodeLabel: label, path });
        });
        return;
      }

      // 3. Fallback: generic output fields based on node type
      const fallbackFields = getFallbackFields(n.type ?? "", code ?? "");
      fallbackFields.forEach((path) => {
        fields.push({ nodeId: n.id, nodeLabel: label, path });
      });
    });

    return fields;
  }, [nodes, edges, nodeId, templates, eventSchemas]);

  // ── Compute target field suggestions ──────────────────

  const targetSuggestions = useMemo(() => {
    const suggestions: TargetFieldSuggestion[] = [];

    // 1. Downstream node input schemas
    const downstreamNodeIds = new Set<string>();
    (edges as ReactFlowEdge[]).forEach((e) => {
      if (e.source === nodeId) {
        downstreamNodeIds.add(e.target);
      }
    });
    (nodes as ReactFlowNode[]).forEach((n) => {
      if (!downstreamNodeIds.has(n.id)) return;
      const code = n.data.templateCode as string | undefined;
      const tpl = templates?.find((t) => t.code === code);
      if (tpl?.input_schema && Array.isArray(tpl.input_schema.fields)) {
        for (const f of tpl.input_schema.fields as SchemaField[]) {
          suggestions.push({
            path: f.path,
            label: f.label || f.path,
            group: `Node: ${String(n.data.label ?? n.id)}`,
          });
        }
      }
    });

    // 2. Entity schemas from schema registry
    if (moduleEntities) {
      for (const entity of moduleEntities) {
        for (const f of entity.fields) {
          suggestions.push({
            path: f.path,
            label: f.label || f.path,
            group: `Entity: ${entity.entity_label}`,
          });
        }
      }
    }

    // 3. Event schemas
    if (eventSchemas) {
      for (const es of eventSchemas) {
        for (const f of es.payload_schema) {
          suggestions.push({
            path: f.path,
            label: f.label || f.path,
            group: `Event: ${es.label}`,
          });
        }
      }
    }

    // Deduplicate by path
    const seen = new Set<string>();
    return suggestions.filter((s) => {
      if (seen.has(s.path)) return false;
      seen.add(s.path);
      return true;
    });
  }, [nodes, edges, nodeId, templates, moduleEntities, eventSchemas]);

  // ── Persist mappings back to node config ────────────────

  const persistMappings = useCallback(
    (updated: FieldMapping[]) => {
      updateNodeData(nodeId, {
        config: { ...config, mappings: updated },
      });
    },
    [nodeId, config, updateNodeData],
  );

  // ── Mapping CRUD ────────────────────────────────────────

  const handleAdd = useCallback(() => {
    const newMapping: FieldMapping = {
      id: newMappingId(),
      from: "",
      to: "",
      operation: "none",
      operationConfig: {},
      chain: [],
      sources: undefined,
      combineMode: "single",
      combineConfig: undefined,
    };
    persistMappings([...mappings, newMapping]);
  }, [mappings, persistMappings]);

  const handleChange = useCallback(
    (index: number, updated: FieldMapping) => {
      const next = [...mappings];
      next[index] = updated;
      persistMappings(next);
    },
    [mappings, persistMappings],
  );

  const handleDelete = useCallback(
    (index: number) => {
      persistMappings(mappings.filter((_, i) => i !== index));
    },
    [mappings, persistMappings],
  );

  // ── DnD sensors & handlers ──────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current as Record<string, unknown> | undefined;
      const overData = over.data.current as Record<string, unknown> | undefined;

      // Case 1: Reorder mapping rows
      if (activeData?.type === "mapping-row") {
        const oldIndex = mappings.findIndex((m) => m.id === active.id);
        const newIndex = mappings.findIndex((m) => m.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          persistMappings(arrayMove(mappings, oldIndex, newIndex));
        }
        return;
      }

      // Case 2: Drop available field onto a from-field droppable
      if (
        activeData?.type === "available-field" &&
        overData?.type === "from-field"
      ) {
        const field = activeData.field as AvailableField;
        const mappingId = overData.mappingId as string;
        const idx = mappings.findIndex((m) => m.id === mappingId);
        const existing = mappings[idx];
        if (idx !== -1 && existing) {
          // If multi-source mode, append to sources array
          if (existing.combineMode && existing.combineMode !== "single") {
            const currentSources: MappingSource[] = existing.sources ?? [];
            const newSource: MappingSource = {
              id: `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              path: field.path,
              nodeId: field.nodeId,
            };
            const updated: FieldMapping = {
              ...existing,
              sources: [...currentSources, newSource],
            };
            const next = [...mappings];
            next[idx] = updated;
            persistMappings(next);
          } else {
            // Single mode: replace from
            const toValue =
              existing.to ||
              field.path.split(".").pop() ||
              "";
            const updated: FieldMapping = {
              ...existing,
              from: field.path,
              to: toValue,
            };
            const next = [...mappings];
            next[idx] = updated;
            persistMappings(next);
          }
        }
        return;
      }

      // Case 3: Drop available field onto general area — create new mapping
      if (activeData?.type === "available-field") {
        const field = activeData.field as AvailableField;
        const newMapping: FieldMapping = {
          id: newMappingId(),
          from: field.path,
          to: field.path.split(".").pop() ?? field.path,
          operation: "none",
          operationConfig: {},
          chain: [],
        };
        persistMappings([...mappings, newMapping]);
      }
    },
    [mappings, persistMappings],
  );

  // ── Active drag overlay content ─────────────────────────

  const activeDragItem = useMemo(() => {
    if (!activeDragId) return null;
    // Check if it's a mapping row
    const m = mappings.find((row) => row.id === activeDragId);
    if (m) {
      return (
        <Box
          p="xs"
          style={{
            borderRadius: 6,
            border: "1px solid var(--mantine-color-blue-4)",
            background: "var(--mantine-color-blue-0)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <Group gap="xs" wrap="nowrap">
            <IconGripVertical size={14} />
            <Text size="xs" fw={500}>
              {m.from || "(empty)"} → {m.to || "(empty)"}
            </Text>
          </Group>
        </Box>
      );
    }
    // Available field badge
    return (
      <Badge size="sm" variant="filled" color="primary">
        field
      </Badge>
    );
  }, [activeDragId, mappings]);

  const mappingIds = useMemo(() => mappings.map((m) => m.id), [mappings]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Stack gap="sm">
        {/* ── Available Fields ──────────────────────────── */}
        <Box>
          <UnstyledButton
            onClick={() => setAvailableOpen((v) => !v)}
            style={{ width: "100%" }}
          >
            <Group gap={4}>
              {availableOpen ? (
                <IconChevronDown size={12} />
              ) : (
                <IconChevronRight size={12} />
              )}
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Available Fields
              </Text>
              <Badge size="xs" variant="light" color="slate">
                {availableFields.length}
              </Badge>
            </Group>
          </UnstyledButton>

          <Collapse expanded={availableOpen}>
            <Box
              mt={4}
              p="xs"
              style={{
                borderRadius: 6,
                background: "var(--mantine-color-gray-0)",
                border: "1px solid var(--mantine-color-gray-2)",
              }}
            >
              {availableFields.length === 0 ? (
                <Text size="xs" c="dimmed" ta="center">
                  No upstream nodes connected
                </Text>
              ) : (
                <Group gap={4} wrap="wrap">
                  {availableFields.map((f) => (
                    <DraggableFieldBadge
                      key={`${f.nodeId}-${f.path}`}
                      field={f}
                    />
                  ))}
                </Group>
              )}
            </Box>
          </Collapse>
        </Box>

        <Divider
          label={
            <Group gap={4}>
              <IconTransform size={12} />
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ fontSize: 10 }}>
                Field Mappings
              </Text>
              <Badge size="xs" variant="light" color="slate">
                {mappings.length}
              </Badge>
            </Group>
          }
          labelPosition="left"
        />

        {/* Visual Mapper button */}
        <Button
          variant="light"
          color="violet"
          size="xs"
          fullWidth
          leftSection={<IconExternalLink size={14} />}
          onClick={() => setVisualMapperOpen(true)}
        >
          Open Visual Mapper
        </Button>

        {/* ── Mapping Rows ─────────────────────────────── */}
        <ScrollArea.Autosize mah={400}>
          {mappings.length === 0 ? (
            <Box
              p="md"
              ta="center"
              style={{
                borderRadius: 8,
                border: "2px dashed var(--mantine-color-gray-3)",
              }}
            >
              <Text size="sm" c="dimmed" mb={4}>
                No field mappings yet
              </Text>
              <Text size="xs" c="dimmed">
                Click "Add Mapping" or drag a field from above to start mapping.
              </Text>
            </Box>
          ) : (
            <SortableContext
              items={mappingIds}
              strategy={verticalListSortingStrategy}
            >
              {mappings.map((m, i) => (
                <MappingRow
                  key={m.id}
                  mapping={m}
                  index={i}
                  onChange={(updated) => handleChange(i, updated)}
                  onDelete={() => handleDelete(i)}
                  targetSuggestions={targetSuggestions}
                />
              ))}
            </SortableContext>
          )}
        </ScrollArea.Autosize>

        {/* ── Add Button ───────────────────────────────── */}
        <Button
          variant="light"
          size="xs"
          fullWidth
          leftSection={<IconPlus size={14} />}
          onClick={handleAdd}
        >
          Add Field Mapping
        </Button>
      </Stack>

      <DragOverlay>{activeDragItem}</DragOverlay>

      <VisualFieldMapper
        opened={visualMapperOpen}
        onClose={() => setVisualMapperOpen(false)}
        mappings={mappings}
        availableFields={availableFields}
        onSave={persistMappings}
        targetSuggestions={targetSuggestions}
      />
    </DndContext>
  );
}
