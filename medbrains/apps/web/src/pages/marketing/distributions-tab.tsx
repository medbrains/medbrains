import { BarChart } from "@mantine/charts";
import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { MarketingDistributionResult } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DataTable } from "@/components";
import { Badge, Button, Card } from "@/components/ui";
import { paiseToRupees } from "@/forms/marketing.form";
import { marketingService } from "@/services/marketing.service";
import { CampsPanel } from "./camps-panel";
import { CatchmentMap } from "./catchment-map";
import { DistributionForm } from "./distribution-form";

const CHANNEL_LABELS: Record<string, string> = {
  pamphlet: "Pamphlets",
  hoarding: "Hoarding",
  newspaper: "Newspaper",
  magazine: "Magazine",
  radio: "Radio",
  cable_tv: "Cable TV",
  bus_panel: "Bus panel",
  signage: "Signage",
  camp_walkin: "Health camp",
  health_talk: "Health talk",
  corporate_screening: "Corporate screening",
};

function costPer(spendMinor: number, count: number): string {
  if (count <= 0) return "—";
  return `₹${Math.round(paiseToRupees(spendMinor) / count).toLocaleString("en-IN")}`;
}

/**
 * What went out, and what came back.
 *
 * The number the table leads with is **net**, not total. An area produces
 * enquiries anyway — word of mouth, the hospital being nearby — so a run that
 * "produced" forty in a ward that produces thirty regardless produced ten. A
 * report showing forty is the one that keeps a pamphlet run alive for years
 * after it stopped working.
 *
 * Attribution here is a correlation and the screen says so: a pamphlet carries
 * no identifier, so an enquiry is credited to a run by area and timing. Where
 * two runs overlap in one area the row is flagged rather than split, because
 * dividing by a rule nobody chose turns one honest ambiguity into two
 * confident wrong numbers.
 */
export function MarketingDistributionsTab() {
  const canManage = useHasPermission(P.MARKETING.CAMPAIGNS_MANAGE);
  const newRun = useDisclosure(false);
  const {
    data: runs = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "distributions"],
    queryFn: () => marketingService.listDistributions(),
  });

  const totals = useMemo(
    () =>
      runs.reduce(
        (acc, r) => ({
          spend: acc.spend + r.cost_minor,
          enquiries: acc.enquiries + r.enquiries,
          net: acc.net + Math.max(0, r.enquiries - r.baseline_enquiries),
          converted: acc.converted + r.converted,
        }),
        { spend: 0, enquiries: 0, net: 0, converted: 0 },
      ),
    [runs],
  );

  // Expected against actual, per run. Only runs where somebody wrote down an
  // expectation — charting a bar against an absent expectation invents one.
  const expectationData = useMemo(
    () =>
      runs
        .filter((r) => r.expected_enquiries !== null)
        .slice(0, 12)
        .map((r) => ({
          run: `${r.area_name} · ${new Date(r.distributed_on).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
          })}`,
          Expected: r.expected_enquiries ?? 0,
          Actual: r.enquiries,
          "Net of baseline": Math.max(0, r.enquiries - r.baseline_enquiries),
        })),
    [runs],
  );

  const columns = [
    {
      key: "area_name",
      label: "Locality",
      render: (row: MarketingDistributionResult) => (
        <Stack gap={0}>
          <Group gap="xs" wrap="nowrap">
            <Text fw={500}>{row.area_name}</Text>
            {row.overlapping_runs > 0 && (
              <Badge tone="warning" size="sm">
                Overlaps {row.overlapping_runs}
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            {row.campaign_name ?? "No campaign"} ·{" "}
            {new Date(row.distributed_on).toLocaleDateString()}
          </Text>
        </Stack>
      ),
    },
    {
      key: "quantity",
      label: "Sent",
      render: (row: MarketingDistributionResult) => (
        <Stack gap={0}>
          <Text size="sm">{row.quantity.toLocaleString("en-IN")}</Text>
          <Text size="xs" c="dimmed">
            {CHANNEL_LABELS[row.channel] ?? row.channel}
          </Text>
        </Stack>
      ),
    },
    {
      key: "expected",
      label: "Expected",
      render: (row: MarketingDistributionResult) => (
        <Text size="sm" c={row.expected_enquiries === null ? "dimmed" : undefined}>
          {row.expected_enquiries ?? "Not set"}
        </Text>
      ),
    },
    {
      key: "net",
      label: "Net enquiries",
      render: (row: MarketingDistributionResult) => {
        const net = row.enquiries - row.baseline_enquiries;
        return (
          <Stack gap={0}>
            <Text size="sm" fw={600}>
              {net >= 0 ? "+" : ""}
              {net}
            </Text>
            <Text size="xs" c="dimmed">
              {row.enquiries} in window, {row.baseline_enquiries} before
            </Text>
          </Stack>
        );
      },
    },
    {
      key: "converted",
      label: "Became patients",
      render: (row: MarketingDistributionResult) => <Text size="sm">{row.converted}</Text>,
    },
    {
      key: "cost",
      label: "Cost / patient",
      render: (row: MarketingDistributionResult) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {costPer(row.cost_minor, row.converted)}
          </Text>
          <Text size="xs" c="dimmed">
            ₹{paiseToRupees(row.cost_minor).toLocaleString("en-IN")} spent
          </Text>
        </Stack>
      ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={newRun[1].open}
          >
            Record a run
          </Button>
        </Group>
      )}

      <Card>
        <Group gap="xl">
          <Stack gap={0}>
            <Text size="xl" fw={700}>
              ₹{paiseToRupees(totals.spend).toLocaleString("en-IN")}
            </Text>
            <Text size="xs" c="dimmed">
              Spent on physical runs
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xl" fw={700}>
              +{totals.net}
            </Text>
            <Text size="xs" c="dimmed">
              Net enquiries, above what the areas produce anyway
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xl" fw={700}>
              {totals.converted}
            </Text>
            <Text size="xs" c="dimmed">
              Became patients ({costPer(totals.spend, totals.converted)} each)
            </Text>
          </Stack>
        </Group>
      </Card>

      <Card>
        <Stack gap="xs">
          <Stack gap={2}>
            <Text fw={600} size="sm">
              Where the enquiries came from
            </Text>
            <Text size="xs" c="dimmed">
              Each locality at its own coordinates, sized by enquiries and shaded by how many became
              patients.
            </Text>
          </Stack>
          <CatchmentMap runs={runs} />
        </Stack>
      </Card>

      {expectationData.length > 0 && (
        <Card>
          <Stack gap="xs">
            <Stack gap={2}>
              <Text fw={600} size="sm">
                Expected against actual
              </Text>
              <Text size="xs" c="dimmed">
                Only runs where an expectation was written down before the result was known — the
                only time an expectation means anything.
              </Text>
            </Stack>
            <BarChart
              h={300}
              data={expectationData}
              dataKey="run"
              // Zero baseline, always: a truncated axis makes a run that missed
              // its target look like one that met it.
              yAxisProps={{ domain: [0, "auto"] }}
              series={[
                { name: "Expected", color: "gray.5" },
                { name: "Actual", color: "blue.5" },
                { name: "Net of baseline", color: "teal.6" },
              ]}
            />
          </Stack>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={runs}
        loading={isLoading}
        rowKey={(row: MarketingDistributionResult) => row.id}
        emptyTitle={isError ? "Runs could not be loaded" : "No distribution runs recorded"}
        emptyDescription={
          isError
            ? "This is not a statement that nothing was distributed — the list failed to load."
            : "Record a pamphlet run or a hoarding against a locality, and what came back from it appears here."
        }
      />

      <CampsPanel />

      <DistributionForm opened={newRun[0]} onClose={newRun[1].close} />

      <Text size="xs" c="dimmed">
        A pamphlet carries no identifier, so enquiries are credited to a run by locality and timing
        within its response window. That is an inference, not a receipt — and where two runs cover
        one area at once, the row is flagged rather than the enquiries split between them.
      </Text>
    </Stack>
  );
}
