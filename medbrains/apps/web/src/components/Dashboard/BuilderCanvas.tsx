import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Group,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { useDroppable } from "@dnd-kit/core";
import {
  useDashboardBuilderStore,
  type WidgetNode,
} from "@medbrains/stores";
import { SectionIcon } from "../DynamicForm/SectionIcon";
import {
  IconCopy,
  IconGripVertical,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useRef, useState } from "react";

const COLUMNS = 12;
const ROW_HEIGHT = 80;
const GAP = 8;

interface BuilderCanvasProps {
  isPreviewMode: boolean;
}

export function BuilderCanvas({ isPreviewMode }: BuilderCanvasProps) {
  const widgets = useDashboardBuilderStore((s) => s.widgets);
  const selectedWidgetId = useDashboardBuilderStore((s) => s.selectedWidgetId);
  const selectWidget = useDashboardBuilderStore((s) => s.selectWidget);
  const dragPreview = useDashboardBuilderStore((s) => s.dragPreview);

  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });

  const widgetList = Object.values(widgets);

  // Calculate the max row to determine canvas height (min 8 rows for good drop area)
  const maxRow = Math.max(
    widgetList.reduce(
      (max, w) => Math.max(max, w.position_y + w.height + 2),
      0,
    ),
    isPreviewMode ? 4 : 8,
  );

  // Dot grid background pattern
  const dotBg = isPreviewMode
    ? undefined
    : `radial-gradient(circle, var(--mantine-color-gray-4) 1px, transparent 1px)`;
  const dotBgSize = isPreviewMode
    ? undefined
    : `${(100 / COLUMNS).toFixed(4)}% ${ROW_HEIGHT + GAP}px`;

  return (
    <Box
      ref={setNodeRef}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
        gridAutoRows: ROW_HEIGHT,
        gap: GAP,
        minHeight: maxRow * (ROW_HEIGHT + GAP) + GAP * 2,
        padding: GAP,
        background: isOver
          ? "var(--mantine-color-primary-0)"
          : isPreviewMode
            ? "transparent"
            : "var(--mantine-color-gray-0)",
        backgroundImage: dotBg,
        backgroundSize: dotBgSize,
        backgroundPosition: `${GAP}px ${GAP}px`,
        borderRadius: isPreviewMode ? 0 : 12,
        border: isPreviewMode
          ? "none"
          : isOver
            ? "2px dashed var(--mantine-color-primary-4)"
            : "2px solid var(--mantine-color-gray-2)",
        transition: "background 200ms, border-color 200ms",
      }}
      onClick={() => selectWidget(null)}
    >
      {/* Column guide overlay (edit mode only) */}
      {!isPreviewMode && (
        <Box
          style={{
            position: "absolute",
            inset: GAP,
            display: "grid",
            gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
            gap: GAP,
            pointerEvents: "none",
            opacity: 0.08,
          }}
        >
          {Array.from({ length: COLUMNS }).map((_, i) => (
            <Box
              key={i}
              style={{
                background: "var(--mantine-color-primary-3)",
                borderRadius: 4,
                height: "100%",
              }}
            />
          ))}
        </Box>
      )}

      {/* Drag/Resize preview ghost with live size indicator */}
      {dragPreview && !isPreviewMode && (
        <Box
          style={{
            gridColumn: `${dragPreview.x + 1} / span ${dragPreview.w}`,
            gridRow: `${dragPreview.y + 1} / span ${dragPreview.h}`,
            background: "var(--mantine-color-primary-1)",
            border: "2px dashed var(--mantine-color-primary-4)",
            borderRadius: 8,
            opacity: 0.7,
            pointerEvents: "none",
            zIndex: 5,
            transition: "all 120ms cubic-bezier(0.2, 0, 0, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Live size badge */}
          <Badge
            size="sm"
            variant="filled"
            color="primary"
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              fontVariantNumeric: "tabular-nums",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            {dragPreview.w} x {dragPreview.h}
          </Badge>
          {/* Position badge (for move) */}
          <Badge
            size="xs"
            variant="light"
            color="primary"
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            col {dragPreview.x}, row {dragPreview.y}
          </Badge>
        </Box>
      )}

      {widgetList.map((widget) => (
        <CanvasWidget
          key={widget.clientId}
          widget={widget}
          isSelected={selectedWidgetId === widget.clientId}
          isPreviewMode={isPreviewMode}
          onSelect={() => selectWidget(widget.clientId)}
        />
      ))}

      {widgetList.length === 0 && (
        <Box
          style={{
            gridColumn: "1 / -1",
            gridRow: "1 / 4",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Box
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "var(--mantine-color-gray-1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconGripVertical
              size={28}
              color="var(--mantine-color-gray-5)"
            />
          </Box>
          <Text size="sm" c="dimmed" fw={500}>
            Drag widgets from the palette to build your dashboard
          </Text>
          <Text size="xs" c="dimmed">
            Or double-click a widget template to add it
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ── Canvas Widget with Resize Handles ────────────────────

function CanvasWidget({
  widget,
  isSelected,
  isPreviewMode,
  onSelect,
}: {
  widget: WidgetNode;
  isSelected: boolean;
  isPreviewMode: boolean;
  onSelect: () => void;
}) {
  const moveWidget = useDashboardBuilderStore((s) => s.moveWidget);
  const resizeWidget = useDashboardBuilderStore((s) => s.resizeWidget);
  const removeWidget = useDashboardBuilderStore((s) => s.removeWidget);
  const duplicateWidget = useDashboardBuilderStore((s) => s.duplicateWidget);
  const setDragPreview = useDashboardBuilderStore((s) => s.setDragPreview);

  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // ── Drag to Move ──────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (isPreviewMode) return;
      e.stopPropagation();
      e.preventDefault();
      onSelect();

      const startX = e.clientX;
      const startY = e.clientY;
      const origPx = widget.position_x;
      const origPy = widget.position_y;
      setIsDragging(true);

      const canvas = cardRef.current?.parentElement;
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const cellW =
        (canvasRect.width - GAP * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
      const cellH = ROW_HEIGHT;

      function onMove(ev: MouseEvent) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const colDelta = Math.round(dx / (cellW + GAP));
        const rowDelta = Math.round(dy / (cellH + GAP));
        const newX = Math.max(
          0,
          Math.min(COLUMNS - widget.width, origPx + colDelta),
        );
        const newY = Math.max(0, origPy + rowDelta);

        setDragPreview({
          clientId: widget.clientId,
          x: newX,
          y: newY,
          w: widget.width,
          h: widget.height,
        });
      }

      function onUp(ev: MouseEvent) {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        setIsDragging(false);

        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const colDelta = Math.round(dx / (cellW + GAP));
        const rowDelta = Math.round(dy / (cellH + GAP));
        const newX = Math.max(
          0,
          Math.min(COLUMNS - widget.width, origPx + colDelta),
        );
        const newY = Math.max(0, origPy + rowDelta);

        if (newX !== origPx || newY !== origPy) {
          moveWidget(widget.clientId, { x: newX, y: newY });
        }
        setDragPreview(null);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [
      widget,
      isPreviewMode,
      onSelect,
      moveWidget,
      setDragPreview,
    ],
  );

  // ── Resize from Corner ────────────────────────────────

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (isPreviewMode) return;
      e.stopPropagation();
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const origW = widget.width;
      const origH = widget.height;
      setIsResizing(true);

      const canvas = cardRef.current?.parentElement;
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const cellW =
        (canvasRect.width - GAP * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
      const cellH = ROW_HEIGHT;

      function onMove(ev: MouseEvent) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const colDelta = Math.round(dx / (cellW + GAP));
        const rowDelta = Math.round(dy / (cellH + GAP));
        const newW = Math.max(
          widget.min_width,
          Math.min(
            COLUMNS - widget.position_x,
            origW + colDelta,
          ),
        );
        const newH = Math.max(widget.min_height, Math.min(8, origH + rowDelta));

        setDragPreview({
          clientId: widget.clientId,
          x: widget.position_x,
          y: widget.position_y,
          w: newW,
          h: newH,
        });
      }

      function onUp(ev: MouseEvent) {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        setIsResizing(false);

        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const colDelta = Math.round(dx / (cellW + GAP));
        const rowDelta = Math.round(dy / (cellH + GAP));
        const newW = Math.max(
          widget.min_width,
          Math.min(
            COLUMNS - widget.position_x,
            origW + colDelta,
          ),
        );
        const newH = Math.max(widget.min_height, Math.min(8, origH + rowDelta));

        if (newW !== origW || newH !== origH) {
          resizeWidget(widget.clientId, { w: newW, h: newH });
        }
        setDragPreview(null);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [
      widget,
      isPreviewMode,
      resizeWidget,
      setDragPreview,
    ],
  );

  const widgetTypeLabel =
    widget.widget_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Card
      ref={cardRef}
      padding={0}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect();
      }}
      style={{
        gridColumn: `${widget.position_x + 1} / span ${widget.width}`,
        gridRow: `${widget.position_y + 1} / span ${widget.height}`,
        cursor: isPreviewMode ? "default" : "default",
        outline: isSelected && !isPreviewMode
          ? "2px solid var(--mantine-color-primary-5)"
          : undefined,
        outlineOffset: 1,
        overflow: "hidden",
        zIndex: isDragging || isResizing ? 50 : isSelected ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
        boxShadow: isSelected && !isPreviewMode
          ? "0 0 0 4px rgba(34, 139, 230, 0.15)"
          : "0 1px 3px rgba(0,0,0,0.08)",
        transition: isDragging
          ? "none"
          : "box-shadow 200ms, outline 200ms, opacity 150ms",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Drag handle bar (edit mode) */}
      {!isPreviewMode && (
        <Box
          onMouseDown={handleDragStart}
          style={{
            padding: "4px 8px",
            cursor: "grab",
            background: isSelected
              ? "var(--mantine-color-primary-0)"
              : "var(--mantine-color-gray-0)",
            borderBottom: "1px solid var(--mantine-color-gray-2)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            userSelect: "none",
            transition: "background 150ms",
          }}
        >
          <IconGripVertical
            size={12}
            color="var(--mantine-color-gray-5)"
            style={{ flexShrink: 0 }}
          />
          {widget.icon && (
            <ThemeIcon
              variant="light"
              color={widget.color ?? "slate"}
              size={18}
              radius="md"
            >
              <SectionIcon icon={widget.icon} size={10} />
            </ThemeIcon>
          )}
          <Text
            size="xs"
            fw={600}
            truncate
            style={{ flex: 1 }}
            c="var(--mb-text-primary)"
          >
            {widget.title}
          </Text>

          {/* Quick actions on hover/select */}
          {isSelected && (
            <Group gap={2}>
              <Tooltip label="Duplicate" position="top">
                <ActionIcon
                  variant="subtle"
                  size="xs"
                  color="slate"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateWidget(widget.clientId);
                  }}
                  aria-label="Copy"
                >
                  <IconCopy size={12} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Delete" position="top">
                <ActionIcon
                  variant="subtle"
                  size="xs"
                  color="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeWidget(widget.clientId);
                  }}
                  aria-label="Delete"
                >
                  <IconTrash size={12} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Box>
      )}

      {/* Widget content area */}
      <Box
        style={{
          flex: 1,
          padding: "8px 10px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Group gap={6} mb={4}>
          <Badge
            size="xs"
            variant="light"
            color={widget.color ?? "slate"}
            radius="sm"
          >
            {widgetTypeLabel}
          </Badge>
          {widget.data_source.type === "module_query" && (() => {
            const scope = widget.data_filters?.scope ?? "auto";
            return (
              <Badge
                size="xs"
                variant="light"
                color={scope === "auto" ? "teal" : scope === "all" ? "slate" : "primary"}
                radius="sm"
              >
                {scope === "auto" ? "Dept" : scope === "all" ? "All" : "Filtered"}
              </Badge>
            );
          })()}
          <Text size="xs" c="dimmed">
            {widget.width} x {widget.height}
          </Text>
        </Group>
        {widget.subtitle && (
          <Text size="xs" c="dimmed" truncate lh={1.3}>
            {widget.subtitle}
          </Text>
        )}
        {widget.data_source.type === "module_query" && (
          <Text size="xs" c="var(--mantine-color-primary-5)" fw={500} mt={4}>
            {widget.data_source.module} / {widget.data_source.query}
          </Text>
        )}
      </Box>

      {/* Resize handle (bottom-right corner) */}
      {!isPreviewMode && isSelected && (
        <Box
          onMouseDown={handleResizeStart}
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 16,
            height: 16,
            cursor: "nwse-resize",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            style={{
              width: 8,
              height: 8,
              borderRight: "2px solid var(--mantine-color-primary-5)",
              borderBottom: "2px solid var(--mantine-color-primary-5)",
              borderRadius: "0 0 3px 0",
            }}
          />
        </Box>
      )}

      {/* Resize handle (right edge) */}
      {!isPreviewMode && isSelected && (
        <Box
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const origW = widget.width;
            setIsResizing(true);

            const canvas = cardRef.current?.parentElement;
            if (!canvas) return;
            const canvasRect = canvas.getBoundingClientRect();
            const cellW =
              (canvasRect.width - GAP * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

            function onMove(ev: MouseEvent) {
              const dx = ev.clientX - startX;
              const colDelta = Math.round(dx / (cellW + GAP));
              const newW = Math.max(
                widget.min_width,
                Math.min(COLUMNS - widget.position_x, origW + colDelta),
              );
              setDragPreview({
                clientId: widget.clientId,
                x: widget.position_x,
                y: widget.position_y,
                w: newW,
                h: widget.height,
              });
            }

            function onUp(ev: MouseEvent) {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
              setIsResizing(false);
              const dx = ev.clientX - startX;
              const colDelta = Math.round(dx / (cellW + GAP));
              const newW = Math.max(
                widget.min_width,
                Math.min(COLUMNS - widget.position_x, origW + colDelta),
              );
              if (newW !== origW) {
                resizeWidget(widget.clientId, { w: newW, h: widget.height });
              }
              setDragPreview(null);
            }

            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
          style={{
            position: "absolute",
            right: -2,
            top: "20%",
            bottom: "20%",
            width: 6,
            cursor: "ew-resize",
            background: "var(--mantine-color-primary-3)",
            borderRadius: 3,
            opacity: 0.6,
            zIndex: 20,
            transition: "opacity 150ms",
          }}
        />
      )}

      {/* Resize handle (bottom edge) */}
      {!isPreviewMode && isSelected && (
        <Box
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const startY = e.clientY;
            const origH = widget.height;
            setIsResizing(true);

            const cellH = ROW_HEIGHT;

            function onMove(ev: MouseEvent) {
              const dy = ev.clientY - startY;
              const rowDelta = Math.round(dy / (cellH + GAP));
              const newH = Math.max(widget.min_height, Math.min(8, origH + rowDelta));
              setDragPreview({
                clientId: widget.clientId,
                x: widget.position_x,
                y: widget.position_y,
                w: widget.width,
                h: newH,
              });
            }

            function onUp(ev: MouseEvent) {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
              setIsResizing(false);
              const dy = ev.clientY - startY;
              const rowDelta = Math.round(dy / (cellH + GAP));
              const newH = Math.max(widget.min_height, Math.min(8, origH + rowDelta));
              if (newH !== origH) {
                resizeWidget(widget.clientId, { w: widget.width, h: newH });
              }
              setDragPreview(null);
            }

            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
          style={{
            position: "absolute",
            bottom: -2,
            left: "20%",
            right: "20%",
            height: 6,
            cursor: "ns-resize",
            background: "var(--mantine-color-primary-3)",
            borderRadius: 3,
            opacity: 0.6,
            zIndex: 20,
            transition: "opacity 150ms",
          }}
        />
      )}
    </Card>
  );
}
