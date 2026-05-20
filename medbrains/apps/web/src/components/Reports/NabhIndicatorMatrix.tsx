import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  LoadingOverlay,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type { NabhIndicator } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCalendarStats,
  IconDotsVertical,
  IconDownload,
  IconFileSpreadsheet,
  IconFilterCheck,
  IconLink,
  IconPhoto,
  IconReport,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { reportsService } from "../../services/reports.service";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  access: { label: "Access & flow", color: "blue" },
  clinical: { label: "Clinical", color: "teal" },
  safety: { label: "Patient safety", color: "red" },
  experience: { label: "Patient experience", color: "violet" },
  operations: { label: "Operations", color: "orange" },
};

function formatValue(value: number | null | undefined, unit: NabhIndicator["unit"]): string {
  if (value == null) return "Pending";
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "minutes") return `${value.toFixed(0)} min`;
  if (unit === "hours") return `${value.toFixed(1)} h`;
  if (unit === "days") return `${value.toFixed(1)} d`;
  if (unit === "count") return value.toFixed(0);
  return value.toFixed(2);
}

function trafficLight(indicator: NabhIndicator): "green" | "amber" | "red" | "gray" {
  if (indicator.value_current_month == null || indicator.target == null) return "gray";
  const value = indicator.value_current_month;
  const target = indicator.target;
  if (indicator.direction === "lower_better") {
    if (value <= target) return "green";
    if (value <= target * 1.25) return "amber";
    return "red";
  }
  if (value >= target) return "green";
  if (value >= target * 0.85) return "amber";
  return "red";
}

function deltaLabel(indicator: NabhIndicator): string | null {
  const current = indicator.value_current_month;
  const previous = indicator.value_prev_month;
  if (current == null || previous == null || previous === 0) return null;
  const diff = current - previous;
  const better = indicator.direction === "lower_better" ? diff < 0 : diff > 0;
  const arrow = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const percent = Math.abs((diff / previous) * 100).toFixed(1);
  return `${arrow} ${percent}% MoM, ${better ? "improving" : diff === 0 ? "flat" : "worsening"}`;
}

function lightColor(light: ReturnType<typeof trafficLight>) {
  if (light === "green") return "green";
  if (light === "amber") return "orange";
  if (light === "red") return "red";
  return "gray";
}

function IndicatorCard({ indicator }: { indicator: NabhIndicator }) {
  const light = trafficLight(indicator);
  const category = CATEGORY_LABELS[indicator.category] ?? {
    label: indicator.category,
    color: "gray",
  };
  const delta = deltaLabel(indicator);

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" gap="xs">
          <Stack gap={2}>
            <Text size="xs" fw={800} tt="uppercase" c="dimmed" ff="monospace">
              {indicator.code}
            </Text>
            <Badge color={category.color} variant="light" size="xs">
              {category.label}
            </Badge>
          </Stack>
          <Badge color={lightColor(light)} variant={light === "gray" ? "outline" : "filled"}>
            {indicator.value_current_month == null ? "Pending" : light}
          </Badge>
        </Group>

        <Text fw={700} lh={1.25}>
          {indicator.label}
        </Text>

        <Group justify="space-between" align="flex-end">
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              Current month
            </Text>
            <Title order={3}>{formatValue(indicator.value_current_month, indicator.unit)}</Title>
          </Stack>
          {indicator.target != null && (
            <Stack gap={0} align="flex-end">
              <Text size="xs" c="dimmed">
                Target
              </Text>
              <Text fw={700}>{formatValue(indicator.target, indicator.unit)}</Text>
            </Stack>
          )}
        </Group>

        <Divider />

        <Stack gap={4}>
          <Text size="xs" c="dimmed">
            {indicator.direction === "lower_better" ? "Lower is better" : "Higher is better"}
            {indicator.denominator_label ? ` · ${indicator.denominator_label}` : ""}
          </Text>
          {delta && (
            <Text size="xs" c="dimmed">
              {delta}
            </Text>
          )}
          {indicator.note && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {indicator.note}
            </Text>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

interface NabhIndicatorMatrixProps {
  search?: string;
}

export function NabhIndicatorMatrix({ search = "" }: NabhIndicatorMatrixProps) {
  const canView = usePermissionStore((state) => state.hasPermission(P.QUALITY.INDICATORS_LIST));
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const normalizedSearch = search.trim().toLowerCase();

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "nabh-indicator-matrix"],
    queryFn: () => reportsService.getNabhIndicators(),
    enabled: canView,
  });

  const categories = useMemo(() => {
    const categorySet = new Set((data?.indicators ?? []).map((indicator) => indicator.category));
    return ["all", ...Array.from(categorySet).sort()];
  }, [data]);

  const filteredIndicators = useMemo(() => {
    return (data?.indicators ?? []).filter((indicator) => {
      const matchesCategory = activeCategory === "all" || indicator.category === activeCategory;
      const searchable = [
        indicator.code,
        indicator.label,
        indicator.category,
        indicator.note ?? "",
        indicator.denominator_label ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return matchesCategory && (!normalizedSearch || searchable.includes(normalizedSearch));
    });
  }, [activeCategory, data, normalizedSearch]);

  if (!canView) {
    return (
      <Card withBorder radius="md" padding="md">
        <Text fw={700}>NABH quality indicators</Text>
        <Text size="sm" c="dimmed">
          Restricted by permission: {P.QUALITY.INDICATORS_LIST}
        </Text>
      </Card>
    );
  }

  return (
    <Card withBorder radius="md" padding="lg" pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Group align="flex-start">
            <ThemeIcon color="red" size={44} radius="md" variant="light">
              <IconFilterCheck size={24} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text size="xs" fw={800} tt="uppercase" c="red">
                NABH evidence matrix
              </Text>
              <Title order={3}>Quality indicators catalog</Title>
              <Text c="dimmed">
                Actual live and pending indicators, targets, trend direction, and evidence gaps.
              </Text>
            </Stack>
          </Group>

          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" aria-label="NABH indicator actions">
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconReport size={14} />}>Open full evidence file</Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconDownload size={14} />}>Download CSV</Menu.Item>
              <Menu.Item leftSection={<IconFileSpreadsheet size={14} />}>Download Excel</Menu.Item>
              <Menu.Item leftSection={<IconPhoto size={14} />}>Save matrix image</Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconLink size={14} />}>Secure share link</Menu.Item>
              <Menu.Item leftSection={<IconCalendarStats size={14} />}>
                Schedule committee pack
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {data && (
          <Group gap="xs">
            <Badge color="green" variant="light" size="lg">
              {data.coverage.computed} live
            </Badge>
            <Badge color="orange" variant="light" size="lg">
              {data.coverage.pending_data_capture} pending
            </Badge>
            <Badge color="gray" variant="light" size="lg">
              {data.coverage.total_indicators} total
            </Badge>
            <Text size="xs" c="dimmed">
              {data.period_label}
            </Text>
          </Group>
        )}

        <Group gap="xs">
          {categories.map((category) => {
            const meta =
              category === "all"
                ? { label: "All", color: "gray" }
                : (CATEGORY_LABELS[category] ?? { label: category, color: "gray" });
            return (
              <Button
                key={category}
                size="xs"
                radius="xl"
                variant={category === activeCategory ? "filled" : "light"}
                color={category === activeCategory ? meta.color : "gray"}
                onClick={() => setActiveCategory(category)}
              >
                {meta.label}
              </Button>
            );
          })}
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
          {filteredIndicators.map((indicator) => (
            <IndicatorCard key={indicator.code} indicator={indicator} />
          ))}
        </SimpleGrid>

        {!isLoading && filteredIndicators.length === 0 && (
          <Text c="dimmed">No NABH indicators match this search/filter.</Text>
        )}
      </Stack>
    </Card>
  );
}
