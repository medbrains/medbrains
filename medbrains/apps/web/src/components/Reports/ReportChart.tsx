import {
  ActionIcon,
  Button,
  Card,
  Group,
  LoadingOverlay,
  Menu,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import {
  IconArrowsMaximize,
  IconCalendarStats,
  IconDotsVertical,
  IconDownload,
  IconFileSpreadsheet,
  IconLink,
  IconMail,
  IconPhoto,
  IconReport,
} from "@tabler/icons-react";
import {
  BarChart,
  BoxplotChart,
  CandlestickChart,
  ChordChart,
  CustomChart,
  EffectScatterChart,
  FunnelChart,
  GaugeChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  LinesChart,
  MapChart,
  ParallelChart,
  PictorialBarChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
  SunburstChart,
  ThemeRiverChart,
  TreeChart,
  TreemapChart,
} from "echarts/charts";
import {
  AriaComponent,
  AxisPointerComponent,
  BrushComponent,
  CalendarComponent,
  DatasetComponent,
  DataZoomComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GeoComponent,
  GraphicComponent,
  GridComponent,
  GridSimpleComponent,
  LegendComponent,
  LegendPlainComponent,
  LegendScrollComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  MatrixComponent,
  ParallelComponent,
  PolarComponent,
  RadarComponent,
  SingleAxisComponent,
  ThumbnailComponent,
  TimelineComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
  VisualMapContinuousComponent,
  VisualMapPiecewiseComponent,
} from "echarts/components";
import { type EChartsCoreOption, type EChartsType, init, use } from "echarts/core";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { useEffect, useRef, useState } from "react";

use([
  BarChart,
  BoxplotChart,
  CandlestickChart,
  ChordChart,
  CustomChart,
  EffectScatterChart,
  FunnelChart,
  GaugeChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  LinesChart,
  MapChart,
  ParallelChart,
  PictorialBarChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
  SunburstChart,
  ThemeRiverChart,
  TreeChart,
  TreemapChart,
  AriaComponent,
  AxisPointerComponent,
  BrushComponent,
  CalendarComponent,
  DataZoomComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  DatasetComponent,
  GeoComponent,
  GraphicComponent,
  GridComponent,
  GridSimpleComponent,
  LegendComponent,
  LegendPlainComponent,
  LegendScrollComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  MatrixComponent,
  ParallelComponent,
  PolarComponent,
  RadarComponent,
  SingleAxisComponent,
  ThumbnailComponent,
  TimelineComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
  VisualMapContinuousComponent,
  VisualMapPiecewiseComponent,
  CanvasRenderer,
  SVGRenderer,
]);

interface ReportChartProps {
  title: string;
  description: string;
  permission: string;
  option: EChartsCoreOption;
  isLoading?: boolean;
  height?: number;
  status?: string;
  disabledActions?: boolean;
  sourceHref?: string;
  onViewDetails?: () => void;
}

export function ReportChart({
  title,
  description,
  permission,
  option,
  isLoading = false,
  height = 280,
  status,
  disabledActions = false,
  sourceHref,
  onViewDetails,
}: ReportChartProps) {
  const canView = usePermissionStore((state) => state.hasPermission(permission));
  const [expanded, setExpanded] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const expandedHostRef = useRef<HTMLDivElement | null>(null);
  const expandedChartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    if (!canView || !hostRef.current) return;

    const chart = init(hostRef.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(hostRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [canView]);

  useEffect(() => {
    if (!canView || !chartRef.current) return;
    chartRef.current.setOption(option, true);
  }, [canView, option]);

  useEffect(() => {
    if (!canView || !expanded || !expandedHostRef.current) return;

    const chart = init(expandedHostRef.current, undefined, { renderer: "canvas" });
    expandedChartRef.current = chart;
    chart.setOption(option, true);

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(expandedHostRef.current);
    const frame = window.requestAnimationFrame(() => chart.resize());

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      chart.dispose();
      expandedChartRef.current = null;
    };
  }, [canView, expanded, option]);

  if (!canView) {
    return (
      <Card withBorder radius="md" padding="md" h="100%">
        <Stack gap={4}>
          <Text fw={700}>{title}</Text>
          <Text size="sm" c="dimmed">
            Restricted by permission: {permission}
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <>
      <Card withBorder radius="md" padding="md" pos="relative" h="100%">
        <LoadingOverlay visible={isLoading} />
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Group gap="xs">
                <Text fw={700}>{title}</Text>
                {status && (
                  <Text size="xs" c="dimmed">
                    {status}
                  </Text>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            </Stack>
            <Group gap="xs" wrap="nowrap">
              <ActionIcon
                variant="light"
                aria-label={`Expand ${title}`}
                onClick={() => setExpanded(true)}
              >
                <IconArrowsMaximize size={18} />
              </ActionIcon>
              <Menu shadow="md" width={210} position="bottom-end">
                <Menu.Target>
                  <ActionIcon variant="subtle" aria-label={`${title} actions`}>
                    <IconDotsVertical size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Export</Menu.Label>
                  <Menu.Item leftSection={<IconDownload size={14} />} disabled={disabledActions}>
                    Download CSV
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconFileSpreadsheet size={14} />}
                    disabled={disabledActions}
                  >
                    Download Excel
                  </Menu.Item>
                  <Menu.Item leftSection={<IconReport size={14} />} disabled={disabledActions}>
                    Export PDF
                  </Menu.Item>
                  <Menu.Item leftSection={<IconPhoto size={14} />} disabled={disabledActions}>
                    Save chart image
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconLink size={14} />} disabled={disabledActions}>
                    Secure share link
                  </Menu.Item>
                  <Menu.Item leftSection={<IconCalendarStats size={14} />}>
                    Schedule report
                  </Menu.Item>
                  <Menu.Item leftSection={<IconMail size={14} />} disabled={disabledActions}>
                    Email now
                  </Menu.Item>
                  {sourceHref && (
                    <>
                      <Menu.Divider />
                      <Menu.Item component="a" href={sourceHref}>
                        Open source module
                      </Menu.Item>
                    </>
                  )}
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
          <div style={{ position: "relative" }}>
            {onViewDetails && (
              <Button
                size="xs"
                variant="gradient"
                gradient={{ from: "primary", to: "copper", deg: 120 }}
                leftSection={<IconReport size={14} />}
                onClick={onViewDetails}
                style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
              >
                View details
              </Button>
            )}
            <div
              ref={hostRef}
              role="img"
              style={{ height, width: "100%" }}
              aria-label={`${title} chart`}
            />
          </div>
        </Stack>
      </Card>
      <Modal
        opened={expanded}
        onClose={() => setExpanded(false)}
        fullScreen
        title={
          <Stack gap={2}>
            <Text fw={800}>{title}</Text>
            {status && (
              <Text size="xs" c="dimmed">
                {status}
              </Text>
            )}
          </Stack>
        }
      >
        <Stack gap="sm" h="calc(100dvh - 110px)">
          <Text size="sm" c="dimmed" maw={900}>
            {description}
          </Text>
          <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%" }}>
            {onViewDetails && (
              <Button
                size="xs"
                variant="gradient"
                gradient={{ from: "primary", to: "copper", deg: 120 }}
                leftSection={<IconReport size={14} />}
                onClick={onViewDetails}
                style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
              >
                View details
              </Button>
            )}
            <div
              ref={expandedHostRef}
              role="img"
              style={{ height: "100%", width: "100%" }}
              aria-label={`${title} expanded chart`}
            />
          </div>
        </Stack>
      </Modal>
    </>
  );
}

export type { EChartsCoreOption };
