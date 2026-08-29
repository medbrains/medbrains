import { Group, Stack, Text, Tooltip } from "@mantine/core";
import type { MarketingCampaignAttributionRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DataTable } from "@/components";
import { Badge, Card } from "@/components/ui";
import { paiseToRupees } from "@/forms/marketing.form";
import { marketingService } from "@/services/marketing.service";

function costPer(spendMinor: number, count: number): string {
  if (count <= 0) return "—";
  return `₹${Math.round(paiseToRupees(spendMinor) / count).toLocaleString("en-IN")}`;
}

/**
 * The two models disagree, and the disagreement is the point.
 *
 * A campaign that is first touch for four hundred people and last touch for
 * six is building awareness — it puts the hospital in people's heads and
 * something else closes them. One that is last touch far more often than
 * first is closing demand somebody else created. Reporting a single number
 * would call one of those a success and the other a failure depending only on
 * which model was picked, which is why both are shown.
 */
function Divergence({ row }: { row: MarketingCampaignAttributionRow }) {
  const { first_touch_enquiries: first, last_touch_enquiries: last } = row;
  if (first === 0 && last === 0) return null;
  // A ratio needs both sides; a campaign at either extreme is described in
  // words instead, because "4.0x" and "only ever first" are different claims.
  if (last === 0) {
    return (
      <Tooltip label="Every enquiry it started was closed by something else">
        <Badge tone="info" size="sm">
          Opens, never closes
        </Badge>
      </Tooltip>
    );
  }
  if (first === 0) {
    return (
      <Tooltip label="It closes enquiries that something else started">
        <Badge tone="neutral" size="sm">
          Closes, never opens
        </Badge>
      </Tooltip>
    );
  }
  const ratio = first / last;
  if (ratio >= 2) {
    return (
      <Tooltip label={`First touch ${ratio.toFixed(1)}x more often than last`}>
        <Badge tone="info" size="sm">
          Mostly awareness
        </Badge>
      </Tooltip>
    );
  }
  if (ratio <= 0.5) {
    return (
      <Tooltip label={`Last touch ${(1 / ratio).toFixed(1)}x more often than first`}>
        <Badge tone="success" size="sm">
          Mostly closing
        </Badge>
      </Tooltip>
    );
  }
  return null;
}

/**
 * Campaign credit, both ways.
 *
 * Replaces nothing — it sits beside the single-attribution funnel, which
 * still answers "what did this campaign's own enquiries do". This answers the
 * question that column could not: a person hears about the hospital at a
 * camp, sees a hoarding, and is finally sent by their GP, and until
 * `mkt_touchpoints` existed the camp took credit for all three.
 */
export function AttributionPanel() {
  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "reports", "attribution"],
    queryFn: () => marketingService.attribution(),
  });

  // Campaigns nobody has ever been attributed to are listed but not summed —
  // a campaign with no touchpoints tells you nothing about attribution, only
  // that nobody has recorded any yet.
  const attributed = useMemo(
    () => rows.filter((r) => r.first_touch_enquiries > 0 || r.last_touch_enquiries > 0),
    [rows],
  );

  const columns = [
    {
      key: "campaign_name",
      label: "Campaign",
      render: (row: MarketingCampaignAttributionRow) => (
        <Stack gap={2}>
          <Group gap="xs" wrap="nowrap">
            <Text fw={500}>{row.campaign_name}</Text>
            <Divergence row={row} />
          </Group>
          <Text size="xs" c="dimmed">
            {row.source}
          </Text>
        </Stack>
      ),
    },
    {
      key: "spend",
      label: "Spend",
      render: (row: MarketingCampaignAttributionRow) => (
        <Text size="sm">₹{paiseToRupees(row.spend_minor).toLocaleString("en-IN")}</Text>
      ),
    },
    {
      key: "first_touch",
      label: "First touch",
      render: (row: MarketingCampaignAttributionRow) => (
        <Text size="sm">
          {row.first_touch_enquiries}{" "}
          <Text span size="xs" c="dimmed">
            enquiries
          </Text>
        </Text>
      ),
    },
    {
      key: "last_touch",
      label: "Last touch",
      render: (row: MarketingCampaignAttributionRow) => (
        <Text size="sm">
          {row.last_touch_enquiries}{" "}
          <Text span size="xs" c="dimmed">
            enquiries
          </Text>
        </Text>
      ),
    },
    {
      key: "attended",
      label: "Attended",
      render: (row: MarketingCampaignAttributionRow) => (
        <Text size="sm">
          {row.first_touch_attended}
          {row.last_touch_attended !== row.first_touch_attended && (
            <Text span size="xs" c="dimmed">
              {" "}
              / {row.last_touch_attended} by last touch
            </Text>
          )}
        </Text>
      ),
    },
    {
      key: "cost_per_attended",
      label: "Cost / attendance",
      render: (row: MarketingCampaignAttributionRow) => (
        // The number the spend decision actually turns on. Attendance, not
        // enquiry: an enquiry that never walks in cost money and produced
        // nothing.
        <Text size="sm" fw={500}>
          {costPer(row.spend_minor, row.first_touch_attended)}
        </Text>
      ),
    },
  ];

  return (
    <Card>
      <Stack gap="sm">
        <Stack gap={2}>
          <Text fw={600} size="sm">
            Campaign attribution
          </Text>
          <Text size="xs" c="dimmed">
            Credited two ways. First touch is what brought someone to the hospital's attention; last
            touch is what finally moved them. Where the two disagree, both are true.
          </Text>
        </Stack>

        <DataTable
          columns={columns}
          data={attributed}
          loading={isLoading}
          rowKey={(row: MarketingCampaignAttributionRow) => row.campaign_id}
          emptyTitle={isError ? "Attribution could not be loaded" : "Nothing attributed yet"}
          emptyDescription={
            isError
              ? "This is not a statement that no campaign produced enquiries — the report failed to load."
              : "Record how an enquiry found the hospital on its detail panel, and credit will appear here."
          }
        />
      </Stack>
    </Card>
  );
}
