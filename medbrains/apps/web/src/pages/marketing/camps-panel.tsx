import { Group, Stack, Text, Tooltip } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { MarketingCampAcquisitionRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconLink } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, Card, toast } from "@/components/ui";

import { marketingService } from "@/services/marketing.service";

function costPer(budget: string | null, count: number): string {
  const spent = Number(budget ?? 0);
  if (count <= 0 || spent <= 0) return "—";
  return `₹${Math.round(spent / count).toLocaleString("en-IN")}`;
}

/**
 * Health camps, as an acquisition channel.
 *
 * The camp module is twenty-seven tables and eight thousand lines, and it
 * referenced nothing in marketing — so the largest acquisition channel an
 * Indian hospital has was invisible to the report that ranks acquisition
 * channels. A camp's budget never sat beside a hoarding's.
 *
 * Two conversion numbers are shown because they disagree, and the gap is the
 * finding: what the camp team recorded when they rang round, against how many
 * attendees actually turned up at the hospital afterwards. A camp reporting
 * forty conversions that produced twelve encounters has a follow-up process
 * reporting intent as outcome.
 */
export function CampsPanel() {
  const queryClient = useQueryClient();
  const canLink = useHasPermission(P.MARKETING.INTERACTIONS_LOG);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const {
    data: camps = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "reports", "camps"],
    queryFn: () => marketingService.campAcquisition(),
  });

  const link = useMutation({
    mutationFn: (campId: string) => marketingService.linkCampAttendees(campId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["marketing"] });
      toast.success(
        result.unreachable > 0
          ? `${result.linked} attendees are now in the funnel. ${result.unreachable} had no usable number.`
          : `${result.linked} attendees are now in the funnel.`,
        { title: "Camp linked" },
      );
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not link the camp" }),
    onSettled: () => setLinkingId(null),
  });

  const columns = [
    {
      key: "name",
      label: "Camp",
      render: (row: MarketingCampAcquisitionRow) => (
        <Stack gap={0}>
          <Text fw={500}>{row.name}</Text>
          <Text size="xs" c="dimmed">
            {row.venue_city ?? "No venue city"} ·{" "}
            {new Date(row.scheduled_date).toLocaleDateString()}
          </Text>
        </Stack>
      ),
    },
    {
      key: "attendees",
      label: "Turned up",
      render: (row: MarketingCampAcquisitionRow) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.attendees}
          </Text>
          {row.expected_participants !== null && (
            <Text size="xs" c="dimmed">
              of {row.expected_participants} expected
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "new_faces",
      label: "New to us",
      render: (row: MarketingCampAcquisitionRow) => (
        <Tooltip
          label={`${row.already_patients} were already our patients — that part is a follow-up clinic, not acquisition`}
        >
          <Stack gap={0}>
            <Text size="sm">{row.new_faces}</Text>
            <Text size="xs" c="dimmed">
              {row.already_patients} already ours
            </Text>
          </Stack>
        </Tooltip>
      ),
    },
    {
      key: "conversions",
      label: "Converted",
      render: (row: MarketingCampAcquisitionRow) => {
        // Where the two measures disagree, say so rather than picking one.
        const overstated = row.team_reported_conversions > row.attended_hospital;
        return (
          <Stack gap={0}>
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" fw={600}>
                {row.attended_hospital}
              </Text>
              {overstated && (
                <Badge tone="warning" size="sm">
                  Team said {row.team_reported_conversions}
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              came to the hospital
            </Text>
          </Stack>
        );
      },
    },
    {
      key: "cost",
      label: "Cost / patient",
      render: (row: MarketingCampAcquisitionRow) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {costPer(row.budget_spent, row.attended_hospital)}
          </Text>
          <Text size="xs" c="dimmed">
            {row.budget_spent
              ? `₹${Number(row.budget_spent).toLocaleString("en-IN")} spent`
              : "No spend recorded"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: MarketingCampAcquisitionRow) =>
        canLink ? (
          <Tooltip label="Puts attendees into the enquiry funnel so they can be followed up and counted as a channel">
            <Button
              tone="ghost"
              size="xs"
              leftSection={<IconLink size={14} />}
              loading={link.isPending && linkingId === row.camp_id}
              onClick={() => {
                setLinkingId(row.camp_id);
                link.mutate(row.camp_id);
              }}
            >
              Link attendees
            </Button>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Card>
      <Stack gap="sm">
        <Stack gap={2}>
          <Text fw={600} size="sm">
            Health camps
          </Text>
          <Text size="xs" c="dimmed">
            Two conversion numbers, because they disagree: what the camp team recorded on follow-up,
            and how many attendees actually turned up at the hospital within ninety days.
          </Text>
        </Stack>

        <DataTable
          columns={columns}
          data={camps}
          loading={isLoading}
          rowKey={(row: MarketingCampAcquisitionRow) => row.camp_id}
          emptyTitle={isError ? "Camps could not be loaded" : "No camps recorded"}
          emptyDescription={
            isError
              ? "This is not a statement that no camp ran — the report failed to load."
              : "Camps are run from the camp module. Once one has attendees, its acquisition shows here."
          }
        />
      </Stack>
    </Card>
  );
}
