/**
 * Materials analytics — cross-domain KPIs for the workspace. Rolls up stock
 * + asset value, low/out/dead-stock counts, and the open-requisition load,
 * plus a stock-value-by-category breakdown, in one read. Pairs the existing
 * per-domain reports (indent dead-stock / valuation) into a single glance.
 */
import { Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconChartBar } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui";
import { assetsService } from "@/services/assets.service";

function money(value: string | number | null): string {
  if (value == null) return "—";
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : `${value}`;
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "warning";
}) {
  const color =
    tone === "danger"
      ? "var(--mb-danger)"
      : tone === "warning"
        ? "var(--mb-warning)"
        : "var(--mb-text-primary)";
  return (
    <Card padding="md">
      <Stack gap={2}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {label}
        </Text>
        <Text size="xl" fw={700} c={color}>
          {value}
        </Text>
      </Stack>
    </Card>
  );
}

export function AnalyticsView() {
  const { data, isLoading } = useQuery({
    queryKey: ["materials-analytics"],
    queryFn: () => assetsService.getMaterialsAnalytics(),
    refetchInterval: 120_000,
  });

  if (isLoading || !data) {
    return (
      <Text size="sm" c="dimmed">
        Loading analytics…
      </Text>
    );
  }

  const maxCategoryValue = Math.max(1, ...data.categories.map((c) => Number(c.stock_value) || 0));

  return (
    <Stack gap="lg">
      <PageHeader
        title="Analytics"
        subtitle="Inventory value, stock health and requisition load across materials"
        icon={<IconChartBar size={20} stroke={1.5} />}
      />
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
        <Kpi label="Total value" value={money(data.total_value)} />
        <Kpi label="Stock value" value={money(data.stock_value)} />
        <Kpi label="Asset value" value={money(data.asset_value)} />
        <Kpi
          label="Low stock"
          value={String(data.low_stock_count)}
          tone={data.low_stock_count > 0 ? "warning" : undefined}
        />
        <Kpi
          label="Out of stock"
          value={String(data.out_of_stock_count)}
          tone={data.out_of_stock_count > 0 ? "danger" : undefined}
        />
        <Kpi
          label="Dead stock (90d)"
          value={String(data.dead_stock_count)}
          tone={data.dead_stock_count > 0 ? "warning" : undefined}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Kpi label="Stock items" value={String(data.stock_item_count)} />
        <Kpi label="Assets" value={String(data.asset_count)} />
        <Kpi
          label="Open requisitions"
          value={String(data.open_requisitions)}
          tone={data.open_requisitions > 0 ? "warning" : undefined}
        />
      </SimpleGrid>

      <Card padding="md">
        <Stack gap="sm">
          <Text size="sm" fw={600}>
            Stock value by category
          </Text>
          {data.categories.length === 0 ? (
            <Text size="sm" c="dimmed">
              No stock recorded.
            </Text>
          ) : (
            data.categories.map((c) => (
              <Stack key={c.category ?? "uncategorised"} gap={4}>
                <Stack gap={0}>
                  <Text size="sm">
                    {c.category ?? "Uncategorised"}{" "}
                    <Text span size="xs" c="dimmed">
                      · {c.item_count} item{c.item_count === 1 ? "" : "s"}
                    </Text>
                  </Text>
                </Stack>
                <Progress
                  value={((Number(c.stock_value) || 0) / maxCategoryValue) * 100}
                  size="lg"
                  aria-label={`${c.category ?? "Uncategorised"} stock value ${money(c.stock_value)}`}
                />
                <Text size="xs" c="dimmed" ta="right">
                  {money(c.stock_value)}
                </Text>
              </Stack>
            ))
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
