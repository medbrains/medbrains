import { Group, Stack, Text, Tooltip } from "@mantine/core";
import type { MarketingTouchpoint } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

/** The vocabulary the API accepts, said the way a person would say it. */
const KIND_LABELS: Record<string, string> = {
  inbound_call: "Called us",
  camp_walkin: "Health camp",
  web_form: "Website form",
  referral: "Referred",
  outreach_reply: "Replied to outreach",
  ad_click: "Advertisement",
  walk_in: "Walked in",
  manual: "Recorded by staff",
};

function label(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, " ");
}

/**
 * How this enquiry found the hospital, in order.
 *
 * A single `campaign_id` on the contact could hold only one answer, and
 * `COALESCE` made it the first one forever. A person hears about the hospital
 * at a camp, sees a hoarding, and is finally sent by their GP — and the camp
 * was taking credit for all three.
 *
 * First touch is marked because it is the one the old column was reporting,
 * so the difference between this strip and last year's numbers is visible
 * rather than mysterious.
 */
export function TouchpointStrip({ contactId }: { contactId: string }) {
  const {
    data: touchpoints = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "contacts", contactId, "touchpoints"],
    queryFn: () => marketingService.listTouchpoints(contactId),
  });

  if (isLoading) return null;

  if (isError) {
    // An empty strip would read as "we don't know how they found us", which
    // is a claim about the enquiry rather than about the request.
    return (
      <Text size="xs" c="dimmed">
        How they found us could not be loaded.
      </Text>
    );
  }

  if (touchpoints.length === 0) return null;

  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        How they found us
      </Text>
      <Group gap="xs" wrap="wrap">
        {touchpoints.map((tp: MarketingTouchpoint, index) => (
          <Tooltip
            key={tp.id}
            label={`${new Date(tp.occurred_at).toLocaleDateString()}${
              tp.referrer_label ? ` · ${tp.referrer_label}` : ""
            }`}
          >
            <Badge tone={index === 0 ? "info" : "neutral"} size="sm">
              {tp.campaign_name ?? label(tp.kind)}
              {index === 0 && touchpoints.length > 1 ? " · first" : ""}
            </Badge>
          </Tooltip>
        ))}
      </Group>
    </Stack>
  );
}
