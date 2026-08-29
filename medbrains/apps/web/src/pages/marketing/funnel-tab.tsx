import { BarChart } from "@mantine/charts";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { MarketingCampaignFunnelRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DataTable } from "@/components";
import { Card } from "@/components/ui";
import { paiseToRupees } from "@/forms/marketing.form";
import { marketingService } from "@/services/marketing.service";

/**
 * A rate is only meaningful when it has a denominator.
 *
 * Every conversion here can legitimately divide by zero — a campaign that has
 * run and drawn nobody, a campaign with enquiries and no wins yet. Rendering
 * those as "0%" states something false about the campaign; rendering them as
 * "—" says there is nothing to divide.
 */
function rate(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function perUnitCost(spendMinor: number, count: number): string {
  if (count <= 0) return "—";
  return `₹${Math.round(paiseToRupees(spendMinor) / count).toLocaleString("en-IN")}`;
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <Stack gap={2}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {label}
        </Text>
        <Text size="xl" fw={700}>
          {value}
        </Text>
        {hint && (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

export function MarketingFunnelTab() {
  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "reports", "campaign-funnel"],
    queryFn: () => marketingService.campaignFunnel(),
  });

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          spend_minor: acc.spend_minor + row.spend_minor,
          enquiries: acc.enquiries + row.enquiries,
          contacted: acc.contacted + row.contacted,
          won: acc.won + row.won,
        }),
        { spend_minor: 0, enquiries: 0, contacted: 0, won: 0 },
      ),
    [rows],
  );

  // Only campaigns that actually drew somebody are charted. A row of zeros
  // occupies the same width as a real one and makes the comparison harder to
  // read, and the table below still lists every campaign.
  const chartData = useMemo(
    () =>
      rows
        .filter((row) => row.enquiries > 0)
        .slice(0, 12)
        .map((row) => ({
          campaign: row.campaign_name,
          Enquiries: row.enquiries,
          Contacted: row.contacted,
          Won: row.won,
        })),
    [rows],
  );

  const columns = [
    {
      key: "campaign_name",
      label: "Campaign",
      render: (row: MarketingCampaignFunnelRow) => (
        <Stack gap={0}>
          <Text fw={500}>{row.campaign_name}</Text>
          <Text size="xs" c="dimmed">
            {row.source}
          </Text>
        </Stack>
      ),
    },
    {
      key: "spend",
      label: "Spend",
      render: (row: MarketingCampaignFunnelRow) => (
        <Text size="sm">₹{paiseToRupees(row.spend_minor).toLocaleString("en-IN")}</Text>
      ),
    },
    {
      key: "enquiries",
      label: "Enquiries",
      render: (row: MarketingCampaignFunnelRow) => <Text size="sm">{row.enquiries}</Text>,
    },
    {
      key: "contacted",
      label: "Contacted",
      render: (row: MarketingCampaignFunnelRow) => (
        <Text size="sm">
          {row.contacted}{" "}
          <Text span size="xs" c="dimmed">
            ({rate(row.contacted, row.enquiries)})
          </Text>
        </Text>
      ),
    },
    {
      key: "won",
      label: "Converted",
      render: (row: MarketingCampaignFunnelRow) => (
        <Text size="sm">
          {row.won}{" "}
          <Text span size="xs" c="dimmed">
            ({rate(row.won, row.enquiries)})
          </Text>
        </Text>
      ),
    },
    {
      key: "cost_per_enquiry",
      label: "Cost / enquiry",
      render: (row: MarketingCampaignFunnelRow) => (
        <Text size="sm">{perUnitCost(row.spend_minor, row.enquiries)}</Text>
      ),
    },
    {
      key: "cost_per_win",
      label: "Cost / conversion",
      render: (row: MarketingCampaignFunnelRow) => (
        <Text size="sm" fw={500}>
          {perUnitCost(row.spend_minor, row.won)}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Metric
          label="Spend"
          value={`₹${paiseToRupees(totals.spend_minor).toLocaleString("en-IN")}`}
          hint="Across all campaigns"
        />
        <Metric label="Enquiries" value={String(totals.enquiries)} />
        <Metric
          label="Contacted"
          value={String(totals.contacted)}
          hint={`${rate(totals.contacted, totals.enquiries)} of enquiries`}
        />
        <Metric
          label="Cost / conversion"
          value={perUnitCost(totals.spend_minor, totals.won)}
          hint={`${totals.won} converted`}
        />
      </SimpleGrid>

      {chartData.length > 0 && (
        <Card>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600} size="sm">
                Enquiry to conversion, by campaign
              </Text>
              {rows.length > chartData.length && (
                <Text size="xs" c="dimmed">
                  Showing {chartData.length} of {rows.length} — campaigns with no enquiries are
                  listed below but not charted
                </Text>
              )}
            </Group>
            <BarChart
              h={280}
              data={chartData}
              dataKey="campaign"
              // Zero baseline, always: a truncated axis makes a small
              // difference in conversion look like a large one.
              yAxisProps={{ domain: [0, "auto"] }}
              series={[
                { name: "Enquiries", color: "blue.5" },
                { name: "Contacted", color: "cyan.6" },
                { name: "Won", color: "teal.6" },
              ]}
            />
          </Stack>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(row: MarketingCampaignFunnelRow) => row.campaign_id}
        emptyTitle={isError ? "The funnel could not be loaded" : "No campaigns to report on"}
        emptyDescription={
          isError
            ? "This is not a statement that there is no activity — the report failed to load."
            : "Create a campaign and attribute enquiries to it to see conversion here."
        }
      />
    </Stack>
  );
}
