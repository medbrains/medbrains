import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { Box, Modal, Text } from "@mantine/core";
import type {
  AvailableField,
  FieldMapping,
  MappingSource,
  TargetFieldSuggestion,
  TransformStep,
} from "@medbrains/types";
import { IconArrowRight } from "@tabler/icons-react";
import { type Edge, ReactFlowProvider } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DestinationPanel } from "./DestinationPanel";
import { FreeformMapperCanvas } from "./FreeformMapperCanvas";
import { MapperToolbar, type ViewMode } from "./MapperToolbar";
import { MappingCard } from "./MappingCard";
import { freeformToMappings, type MapperNode, mappingsToFreeform } from "./mapperSync";
import { PreviewPanel } from "./PreviewPanel";
import { SourcePanel } from "./SourcePanel";
import { getAutoConversionStep, inferFieldType, inferTypeFromFieldName } from "./typeInference";
import styles from "./VisualFieldMapper.module.scss";

// ── Types ─────────────────────────────────────────────────

interface VisualFieldMapperProps {
  opened: boolean;
  onClose: () => void;
  mappings: FieldMapping[];
  availableFields: AvailableField[];
  onSave: (mappings: FieldMapping[]) => void;
  targetSuggestions: TargetFieldSuggestion[];
  sampleData?: Record<string, unknown>;
}

// ── ID generator ──────────────────────────────────────────

let _seq = 0;
function newId(): string {
  _seq += 1;
  return `vmap_${Date.now()}_${_seq}`;
}

function newSourceId(): string {
  _seq += 1;
  return `src_${Date.now()}_${_seq}`;
}

// ── Main Component ────────────────────────────────────────

export function VisualFieldMapper({
  opened,
  onClose,
  mappings: initialMappings,
  availableFields,
  onSave,
  targetSuggestions,
  sampleData: externalSampleData,
}: VisualFieldMapperProps) {
  // ── State ───────────────────────────────────────
  const [localMappings, setLocalMappings] = useState<FieldMapping[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("diagram");
  const [sampleDataJson, setSampleDataJson] = useState("{}");
  const [selectedFreeformNodes, setSelectedFreeformNodes] = useState<string[]>([]);

  // Freeform state
  const [freeformNodes, setFreeformNodes] = useState<MapperNode[]>([]);
  const [freeformEdges, setFreeformEdges] = useState<Edge[]>([]);

  // DnD
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Initialize when modal opens
  const prevOpened = useRef(false);
  useEffect(() => {
    if (opened && !prevOpened.current) {
      const cloned = structuredClone(initialMappings);
      setLocalMappings(cloned);
      setSelectedFreeformNodes([]);
      if (externalSampleData) {
        setSampleDataJson(JSON.stringify(externalSampleData, null, 2));
      }
      // Initialize freeform from mappings
      const { nodes, edges } = mappingsToFreeform(cloned);
      setFreeformNodes(nodes);
      setFreeformEdges(edges);
    }
    prevOpened.current = opened;
  }, [opened, initialMappings, externalSampleData]);

  // Parse sample data
  const parsedSampleData: Record<string, unknown> = useMemo(() => {
    try {
      const parsed = JSON.parse(sampleDataJson) as Record<string, unknown>;
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }, [sampleDataJson]);

  // Enrich source fields with inferred types from sample data (or field name heuristic)
  const enrichedAvailableFields = useMemo(() => {
    const hasSample = Object.keys(parsedSampleData).length > 0;
    return availableFields.map((f) => {
      if (f.type && f.type !== "unknown") return f;
      // Prefer sample data inference, fall back to field name heuristic
      if (hasSample) {
        const inferred = inferFieldType(parsedSampleData, f.path);
        if (inferred !== "unknown") return { ...f, type: inferred };
      }
      const heuristic = inferTypeFromFieldName(f.path);
      return heuristic !== "unknown" ? { ...f, type: heuristic } : f;
    });
  }, [availableFields, parsedSampleData]);

  // Enrich destination suggestions with inferred types from field name heuristics
  const enrichedTargetSuggestions = useMemo(
    () =>
      targetSuggestions.map((s) => {
        if (s.type && s.type !== "unknown") return s;
        const inferred = inferTypeFromFieldName(s.path);
        return inferred !== "unknown" ? { ...s, type: inferred } : s;
      }),
    [targetSuggestions],
  );

  // Mapped paths — recurse into grouped sources to get all leaf paths
  const mappedSourcePaths = useMemo(() => {
    const paths = new Set<string>();
    const collectLeafPaths = (sources: MappingSource[]) => {
      for (const s of sources) {
        if (s.children && s.children.length > 0) {
          collectLeafPaths(s.children);
        } else if (s.path) {
          paths.add(s.path);
        }
      }
    };
    for (const m of localMappings) {
      if (m.combineMode && m.combineMode !== "single" && m.sources) {
        collectLeafPaths(m.sources);
      } else if (m.from) {
        paths.add(m.from);
      }
    }
    return paths;
  }, [localMappings]);

  const mappedDestPaths = useMemo(() => {
    const paths = new Set<string>();
    for (const m of localMappings) {
      if (m.to) paths.add(m.to);
    }
    return paths;
  }, [localMappings]);

  // ── View mode switching with sync ───────────────
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      if (mode === viewMode) return;

      if (mode === "freeform") {
        // Diagram → Freeform: convert current mappings to nodes/edges
        const { nodes, edges } = mappingsToFreeform(localMappings);
        setFreeformNodes(nodes);
        setFreeformEdges(edges);
      } else {
        // Freeform → Diagram: convert nodes/edges back to mappings
        const converted = freeformToMappings(freeformNodes, freeformEdges);
        setLocalMappings(converted);
      }

      setViewMode(mode);
    },
    [viewMode, localMappings, freeformNodes, freeformEdges],
  );

  // ── Mapping CRUD (Diagram mode) ────────────────

  const handleMappingChange = useCallback((index: number, updated: FieldMapping) => {
    setLocalMappings((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }, []);

  const handleMappingDelete = useCallback((index: number) => {
    setLocalMappings((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddMapping = useCallback(
    (fromPath?: string, toPath?: string) => {
      // Auto-match destination via fuzzy match on the source field's leaf name
      let dest = toPath ?? "";
      let matchedSuggestion: TargetFieldSuggestion | undefined;
      if (!dest && fromPath && enrichedTargetSuggestions.length > 0) {
        const leaf = (fromPath.split(".").pop() ?? "").toLowerCase();
        if (leaf) {
          matchedSuggestion = enrichedTargetSuggestions.find(
            (s) => (s.path.split(".").pop() ?? "").toLowerCase() === leaf,
          );
          if (!matchedSuggestion) {
            matchedSuggestion = enrichedTargetSuggestions.find(
              (s) =>
                (s.path.split(".").pop() ?? "").toLowerCase().includes(leaf) ||
                leaf.includes((s.path.split(".").pop() ?? "").toLowerCase()),
            );
          }
          if (matchedSuggestion) dest = matchedSuggestion.path;
        }
      } else if (dest) {
        matchedSuggestion = enrichedTargetSuggestions.find((s) => s.path === dest);
      }

      // Auto-detect type mismatch and insert conversion step
      const chain: TransformStep[] = [];
      if (fromPath && dest) {
        const hasSample = Object.keys(parsedSampleData).length > 0;
        const sourceType = hasSample
          ? inferFieldType(parsedSampleData, fromPath)
          : inferTypeFromFieldName(fromPath);
        const destType = matchedSuggestion?.type ?? inferTypeFromFieldName(dest);
        if (sourceType !== "unknown" && destType !== "unknown") {
          const conversion = getAutoConversionStep(sourceType, destType);
          if (conversion) chain.push(conversion);
        }
      }

      const mapping: FieldMapping = {
        id: newId(),
        from: fromPath ?? "",
        to: dest,
        operation: chain[0]?.operation ?? "none",
        operationConfig: chain[0]?.config ?? {},
        chain,
      };
      setLocalMappings((prev) => [...prev, mapping]);
    },
    [enrichedTargetSuggestions, parsedSampleData],
  );

  // ── DnD handlers (Diagram mode) ────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;

      const activeData = active.data.current as Record<string, unknown> | undefined;

      // When over is null (no collision target found), create new mapping
      // from the dragged source/dest field — this handles cross-panel drags
      // where collision detection can't resolve the target (Modal portals, etc.)
      if (!over) {
        if (activeData?.type === "available-field") {
          const field = activeData.field as AvailableField;
          handleAddMapping(field.path);
        } else if (activeData?.type === "dest-field") {
          const suggestion = activeData.suggestion as TargetFieldSuggestion;
          handleAddMapping(undefined, suggestion.path);
        }
        return;
      }

      const overData = over.data.current as Record<string, unknown> | undefined;

      // Reorder cards
      if (activeData?.type === "mapping-card" && overData?.type === "mapping-card") {
        const oldIndex = localMappings.findIndex((m) => m.id === active.id);
        const newIndex = localMappings.findIndex((m) => m.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          setLocalMappings((prev) => arrayMove(prev, oldIndex, newIndex));
        }
        return;
      }

      // Drop source field onto card input
      if (activeData?.type === "available-field" && overData?.type === "card-input") {
        const field = activeData.field as AvailableField;
        const mappingId = overData.mappingId as string;

        setLocalMappings((prev) =>
          prev.map((m) => {
            if (m.id !== mappingId) return m;

            // Preserve existing sources (including groups) and append the new field
            const existingSources: MappingSource[] =
              m.combineMode && m.combineMode !== "single" && m.sources
                ? [...m.sources]
                : m.from
                  ? [{ id: newSourceId(), path: m.from }]
                  : [];

            if (existingSources.length > 0) {
              const allSources = [...existingSources, { id: newSourceId(), path: field.path }];
              return {
                ...m,
                from: m.from || field.path,
                sources: allSources,
                combineMode:
                  m.combineMode === "single" || !m.combineMode ? "concat" : m.combineMode,
                combineConfig: m.combineConfig ?? { separator: " " },
              };
            }

            return {
              ...m,
              from: field.path,
              to: m.to || field.path.split(".").pop() || "",
            };
          }),
        );
        return;
      }

      // Drop source field onto card TRANSFORM zone → create merge_field step
      if (activeData?.type === "available-field" && overData?.type === "card-transforms") {
        const field = activeData.field as AvailableField;
        const mappingId = overData.mappingId as string;

        setLocalMappings((prev) =>
          prev.map((m) => {
            if (m.id !== mappingId) return m;
            const step: TransformStep = {
              id: `merge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              operation: "merge_field" as TransformStep["operation"],
              config: {
                mergeFieldPath: field.path,
                mergeCombineMode: "concat",
                separator: " ",
              },
            };
            return { ...m, chain: [...(m.chain ?? []), step] };
          }),
        );
        return;
      }

      // Drop operation onto card transform zone
      if (activeData?.type === "operation" && overData?.type === "card-transforms") {
        const op = activeData.operation as { type: string };
        const mappingId = overData.mappingId as string;

        setLocalMappings((prev) =>
          prev.map((m) => {
            if (m.id !== mappingId) return m;
            const step: TransformStep = {
              id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              operation: op.type as TransformStep["operation"],
              config: {},
            };
            return { ...m, chain: [...(m.chain ?? []), step] };
          }),
        );
        return;
      }

      // Drop dest field onto card output zone — auto-insert conversion on type mismatch
      if (activeData?.type === "dest-field" && overData?.type === "card-output") {
        const suggestion = activeData.suggestion as TargetFieldSuggestion;
        const mappingId = overData.mappingId as string;

        setLocalMappings((prev) =>
          prev.map((m) => {
            if (m.id !== mappingId) return m;

            const updated = { ...m, to: suggestion.path };

            // Determine source type from the card's existing source field(s)
            const sourcePath =
              m.combineMode && m.combineMode !== "single" && m.sources
                ? m.sources[0]?.path
                : m.from;
            if (!sourcePath) return updated;

            const hasSample = Object.keys(parsedSampleData).length > 0;
            const srcType = hasSample
              ? inferFieldType(parsedSampleData, sourcePath)
              : inferTypeFromFieldName(sourcePath);
            const dstType = suggestion.type ?? inferTypeFromFieldName(suggestion.path);

            if (srcType !== "unknown" && dstType !== "unknown" && srcType !== dstType) {
              const conversion = getAutoConversionStep(srcType, dstType);
              if (conversion) {
                // Only add if no conversion step already exists in the chain
                const existingChain = m.chain ?? [];
                const hasConversion = existingChain.some((s) => s.id.startsWith("auto_"));
                if (!hasConversion) {
                  updated.chain = [...existingChain, conversion];
                }
              }
            }

            return updated;
          }),
        );
        return;
      }
    },
    [localMappings, handleAddMapping, parsedSampleData],
  );

  // ── Freeform drop handler ──────────────────────

  const handleFreeformDrop = useCallback(
    (type: string, data: Record<string, unknown>, position: { x: number; y: number }) => {
      const nodeId = `drop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      if (type === "sourceField") {
        setFreeformNodes((prev) => [
          ...prev,
          {
            id: nodeId,
            type: "sourceField",
            position,
            data: {
              fieldPath: data.fieldPath as string,
              nodeLabel: data.nodeLabel as string,
            },
          } as MapperNode,
        ]);
      } else if (type === "operation") {
        setFreeformNodes((prev) => [
          ...prev,
          {
            id: nodeId,
            type: "operation",
            position,
            data: {
              operation: data.operation as string,
              label: data.label as string,
              category: data.category as string,
              config: (data.config ?? {}) as Record<string, unknown>,
            },
          } as MapperNode,
        ]);
      } else if (type === "destField") {
        setFreeformNodes((prev) => [
          ...prev,
          {
            id: nodeId,
            type: "destField",
            position,
            data: {
              fieldPath: data.fieldPath as string,
            },
          } as MapperNode,
        ]);
      }
    },
    [],
  );

  // ── Group handler (Freeform mode) ──────────────

  const handleGroup = useCallback(() => {
    if (selectedFreeformNodes.length < 2) return;

    const selectedSourceNodes = freeformNodes.filter(
      (n) => n.type === "sourceField" && selectedFreeformNodes.includes(n.id),
    );

    if (selectedSourceNodes.length < 2) return;

    // Create combiner node at average position
    const avgX =
      selectedSourceNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedSourceNodes.length;
    const avgY =
      selectedSourceNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedSourceNodes.length;

    const combinerId = `cmb_${Date.now()}`;
    const combinerNode: MapperNode = {
      id: combinerId,
      type: "combiner",
      position: { x: avgX + 200, y: avgY },
      data: {
        combineMode: "concat",
        separator: " ",
        sourceCount: selectedSourceNodes.length,
      },
    } as MapperNode;

    // Create edges from selected sources to combiner
    const newEdges: Edge[] = selectedSourceNodes.map((sn, i) => ({
      id: `e_grp_${Date.now()}_${i}`,
      source: sn.id,
      target: combinerId,
      sourceHandle: "output",
      targetHandle: `input-${i}`,
      animated: true,
      style: { stroke: "var(--mantine-color-violet-4)", strokeWidth: 2 },
    }));

    // Transfer any outgoing edges from selected sources to the combiner
    const outgoingEdges = freeformEdges.filter(
      (e) => selectedFreeformNodes.includes(e.source) && !selectedFreeformNodes.includes(e.target),
    );
    const transferredEdges: Edge[] = outgoingEdges.map((e) => ({
      ...e,
      id: `e_xfer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source: combinerId,
      sourceHandle: "output",
    }));

    // Remove old outgoing edges
    const oldOutgoingIds = new Set(outgoingEdges.map((e) => e.id));
    const filteredEdges = freeformEdges.filter((e) => !oldOutgoingIds.has(e.id));

    setFreeformNodes((prev) => [...prev, combinerNode]);
    setFreeformEdges([...filteredEdges, ...newEdges, ...transferredEdges]);
    setSelectedFreeformNodes([]);
  }, [selectedFreeformNodes, freeformNodes, freeformEdges]);

  // ── Save / Cancel ──────────────────────────────

  const handleApply = useCallback(() => {
    // If in freeform mode, sync back to mappings first
    const finalMappings =
      viewMode === "freeform" ? freeformToMappings(freeformNodes, freeformEdges) : localMappings;
    onSave(finalMappings);
    onClose();
  }, [viewMode, freeformNodes, freeformEdges, localMappings, onSave, onClose]);

  // Mapping IDs for sortable
  const mappingIds = useMemo(() => localMappings.map((m) => m.id), [localMappings]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="95%"
      padding={0}
      withCloseButton={false}
      styles={{
        body: { padding: 0 },
        content: { maxHeight: "90vh", display: "flex", flexDirection: "column" },
      }}
    >
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={styles.mapperModal}>
          {/* ── Toolbar ─────────────────────────────── */}
          <MapperToolbar
            mappingCount={localMappings.length}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            sampleData={sampleDataJson}
            onSampleDataChange={setSampleDataJson}
            sourceFieldPaths={[...mappedSourcePaths]}
            canGroup={viewMode === "freeform" && selectedFreeformNodes.length >= 2}
            onGroup={handleGroup}
            onCancel={onClose}
            onApply={handleApply}
          />

          {/* ── 3-Panel Body ────────────────────────── */}
          <div className={styles.body}>
            {/* Left: Source Fields + Operations */}
            <div className={styles.leftPanel}>
              <SourcePanel
                availableFields={enrichedAvailableFields}
                mappedSourcePaths={mappedSourcePaths}
                viewMode={viewMode}
              />
            </div>

            {/* Center: Diagram or Freeform */}
            <div className={styles.centerPanel}>
              {viewMode === "diagram" ? (
                <div className={styles.centerDiagram}>
                  {localMappings.length === 0 ? (
                    <div className={styles.emptyCenter}>
                      <IconArrowRight size={48} color="var(--mantine-color-gray-3)" />
                      <Text size="lg" c="dimmed" mt="md">
                        No mappings yet
                      </Text>
                      <Text size="sm" c="dimmed" mt={4}>
                        Drag a source field from the left panel to create a mapping.
                      </Text>
                    </div>
                  ) : (
                    <SortableContext items={mappingIds} strategy={rectSortingStrategy}>
                      <div className={styles.diagramGrid}>
                        {localMappings.map((m, i) => (
                          <MappingCard
                            key={m.id}
                            mapping={m}
                            index={i}
                            onChange={(updated) => handleMappingChange(i, updated)}
                            onDelete={() => handleMappingDelete(i)}
                            targetSuggestions={enrichedTargetSuggestions}
                            sampleData={parsedSampleData}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  )}
                </div>
              ) : (
                <div className={styles.centerFreeform}>
                  <ReactFlowProvider>
                    <FreeformMapperCanvas
                      nodes={freeformNodes}
                      edges={freeformEdges}
                      onNodesChange={setFreeformNodes}
                      onEdgesChange={setFreeformEdges}
                      onSelectionChange={setSelectedFreeformNodes}
                      onDrop={handleFreeformDrop}
                    />
                  </ReactFlowProvider>
                </div>
              )}
            </div>

            {/* Right: Destination Fields */}
            <div className={styles.rightPanel}>
              <DestinationPanel
                targetSuggestions={enrichedTargetSuggestions}
                mappedDestPaths={mappedDestPaths}
                viewMode={viewMode}
              />
            </div>
          </div>

          {/* ── Preview Panel ───────────────────────── */}
          <PreviewPanel
            mappings={
              viewMode === "freeform"
                ? freeformToMappings(freeformNodes, freeformEdges)
                : localMappings
            }
            sampleData={parsedSampleData}
          />
        </div>

        <DragOverlay>
          {activeDragId ? (
            <Box
              p="xs"
              style={{
                borderRadius: 0,
                border: "1px solid var(--mantine-color-blue-4)",
                background: "var(--mantine-color-blue-0)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <Text size="xs" fw={500}>
                Dragging...
              </Text>
            </Box>
          ) : null}
        </DragOverlay>
      </DndContext>
    </Modal>
  );
}
