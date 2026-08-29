import { Group, Stack, Text } from "@mantine/core";
import type { MarketingAreaPerformanceRow, MarketingChannelJourneyRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DataTable } from "@/components";
import { Badge, Card } from "@/components/ui";
import { paiseToRupees } from "@/forms/marketing.form";
import { marketingService } from "@/services/marketing.service";

/**
 * The channel vocabulary, said the way the marketing office says it.
 *
 * The database stores a stable code; this is the only place it becomes a
 * phrase, so renaming a label never migrates a column.
 */
const CHANNEL_LABELS: Record<string, string> = {
  inbound_call: "Phone call",
  missed_call: "Missed call",
  web_form: "Website form",
  walk_in: "Walked in",
  whatsapp_inbound: "WhatsApp",
  pamphlet: "Pamphlet",
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
  ad_click: "Advertisement",
  social_post: "Social post",
  social_dm: "Social message",
  search: "Search",
  listing: "Directory listing",
  video: "Video",
  referral: "Referral",
  doctor_referral: "Doctor referral",
  staff_referral: "Staff referral",
  word_of_mouth: "Word of mouth",
  outreach_reply: "Replied to us",
  manual: "Not recorded",
};

function channel(code: string | null): string {
  if (!code) return "—";
  return CHANNEL_LABELS[code] ?? code.replace(/_/g, " ");
}

function rate(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(0)}%`;
}

function gap(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

/**
 * Which channels open, which close, and where.
 *
 * A single-channel report says a hoarding produced forty enquiries and eight
 * patients. This says thirty of those forty came back through a phone call
 * and seven of the eight conversions were in that group — so the hoarding does
 * not close, it opens, and cutting the phone line to fund more hoardings would
 * cut the conversions.
 *
 * "Converted" here means the enquiry actually became a registered patient, not
 * that somebody dragged it into a won column.
 */
export function MarketingChannelsTab() {
  const journey = useQuery({
    queryKey: ["marketing", "reports", "channel-journey"],
    queryFn: () => marketingService.channelJourney(),
  });

  const areas = useQuery({
    queryKey: ["marketing", "reports", "area-performance"],
    queryFn: () => marketingService.areaPerformance(),
  });

  const rows = journey.data ?? [];

  // Channels that bring people in, versus channels that bring them back.
  // Counted over the same rows the table shows, so the summary cannot
  // disagree with what is beneath it.
  const totals = useMemo(() => {
    const opened = rows.reduce((n, r) => n + r.enquiries, 0);
    const converted = rows.reduce((n, r) => n + r.converted, 0);
    const oneTouch = rows
      .filter((r) => r.second_kind === null)
      .reduce((n, r) => n + r.enquiries, 0);
    return { opened, converted, oneTouch };
  }, [rows]);

  const unclassified = useMemo(
    () => rows.filter((r) => r.first_kind === "manual").reduce((n, r) => n + r.enquiries, 0),
    [rows],
  );

  const journeyColumns = [
    {
      key: "first",
      label: "First contact",
      render: (row: MarketingChannelJourneyRow) => (
        <Stack gap={0}>
          <Text fw={500}>{channel(row.first_kind)}</Text>
          {(row.first_medium || row.first_area) && (
            <Text size="xs" c="dimmed">
              {[row.first_medium, row.first_area].filter(Boolean).join(" · ")}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "second",
      label: "Then",
      render: (row: MarketingChannelJourneyRow) =>
        row.second_kind === null ? (
          // Not "—" alone. A single-touch enquiry is a finding, not a blank.
          <Badge tone="neutral" size="sm">
            Never came back
          </Badge>
        ) : (
          <Stack gap={0}>
            <Text size="sm">{channel(row.second_kind)}</Text>
            {row.second_medium && (
              <Text size="xs" c="dimmed">
                {row.second_medium}
              </Text>
            )}
          </Stack>
        ),
    },
    {
      key: "gap",
      label: "Gap",
      render: (row: MarketingChannelJourneyRow) => (
        <Text size="sm" c="dimmed">
          {gap(row.median_gap_hours)}
        </Text>
      ),
    },
    {
      key: "enquiries",
      label: "Enquiries",
      render: (row: MarketingChannelJourneyRow) => <Text size="sm">{row.enquiries}</Text>,
    },
    {
      key: "converted",
      label: "Became patients",
      render: (row: MarketingChannelJourneyRow) => (
        <Text size="sm" fw={row.converted > 0 ? 600 : 400}>
          {row.converted}{" "}
          <Text span size="xs" c="dimmed">
            ({rate(row.converted, row.enquiries)})
          </Text>
        </Text>
      ),
    },
  ];

  const areaColumns = [
    {
      key: "area_label",
      label: "Locality",
      render: (row: MarketingAreaPerformanceRow) => <Text fw={500}>{row.area_label}</Text>,
    },
    {
      key: "channels",
      label: "Channels used",
      render: (row: MarketingAreaPerformanceRow) => <Text size="sm">{row.channels}</Text>,
    },
    {
      key: "enquiries",
      label: "Enquiries",
      render: (row: MarketingAreaPerformanceRow) => <Text size="sm">{row.enquiries}</Text>,
    },
    {
      key: "converted",
      label: "Became patients",
      render: (row: MarketingAreaPerformanceRow) => (
        <Text size="sm">
          {row.converted}{" "}
          <Text span size="xs" c="dimmed">
            ({rate(row.converted, row.enquiries)})
          </Text>
        </Text>
      ),
    },
    {
      key: "spend",
      label: "Spend aimed here",
      render: (row: MarketingAreaPerformanceRow) => (
        <Text size="sm">
          {row.targeted_spend_minor > 0
            ? `₹${paiseToRupees(row.targeted_spend_minor).toLocaleString("en-IN")}`
            : "—"}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      <Card>
        <Group gap="xl">
          <Stack gap={0}>
            <Text size="xl" fw={700}>
              {totals.opened}
            </Text>
            <Text size="xs" c="dimmed">
              Enquiries with a recorded channel
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xl" fw={700}>
              {totals.converted}
            </Text>
            <Text size="xs" c="dimmed">
              Became patients ({rate(totals.converted, totals.opened)})
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xl" fw={700}>
              {totals.oneTouch}
            </Text>
            <Text size="xs" c="dimmed">
              Touched us once and never again
            </Text>
          </Stack>
        </Group>
      </Card>

      {unclassified > 0 && (
        <Text size="sm" c="dimmed">
          {unclassified} {unclassified === 1 ? "enquiry has" : "enquiries have"} no channel
          recorded, so they cannot be credited to anything. Recording how each one found the
          hospital is what makes the rest of this table trustworthy.
        </Text>
      )}

      <Card>
        <Stack gap="sm">
          <Stack gap={2}>
            <Text fw={600} size="sm">
              First contact, then what
            </Text>
            <Text size="xs" c="dimmed">
              Which channel opened the relationship and which one brought them back. A channel that
              opens often and closes rarely is doing its job — the mistake is cutting it to fund the
              one that appears to close.
            </Text>
          </Stack>
          <DataTable
            columns={journeyColumns}
            data={rows}
            loading={journey.isLoading}
            rowKey={(row: MarketingChannelJourneyRow) =>
              `${row.first_kind}-${row.first_medium ?? ""}-${row.first_area ?? ""}-${row.second_kind ?? "none"}`
            }
            emptyTitle={
              journey.isError
                ? "The channel report could not be loaded"
                : "No channels recorded yet"
            }
            emptyDescription={
              journey.isError
                ? "This is not a statement that no channel worked — the report failed to load."
                : "Record how each enquiry found the hospital on its detail panel, and the pairings appear here."
            }
          />
        </Stack>
      </Card>

      <Card>
        <Stack gap="sm">
          <Stack gap={2}>
            <Text fw={600} size="sm">
              By locality
            </Text>
            <Text size="xs" c="dimmed">
              Where the channel was, not where the person lives. Pamphlet runs and hoardings are
              bought by area, and without this the same run repeats in the ward that produced
              nobody.
            </Text>
          </Stack>
          <DataTable
            columns={areaColumns}
            data={areas.data ?? []}
            loading={areas.isLoading}
            rowKey={(row: MarketingAreaPerformanceRow) => row.area_label}
            emptyTitle={
              areas.isError ? "The locality report could not be loaded" : "No localities recorded"
            }
            emptyDescription={
              areas.isError
                ? "This is not a statement that no locality responded — the report failed to load."
                : "Set an area on a touchpoint — the ward a pamphlet covered, the junction a hoarding stands at — and it appears here."
            }
          />
        </Stack>
      </Card>
    </Stack>
  );
}
