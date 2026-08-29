import { Group, Stack, Text, TextInput } from "@mantine/core";
import type { MarketingArea, MarketingCampaign } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Modal, Select, toast } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

/**
 * How somebody found the hospital, grouped the way a person answering the
 * phone would ask it.
 *
 * Grouped rather than a flat list of twenty-eight: "how did you hear about
 * us?" has a handful of natural answers, and a telecaller scanning an
 * alphabetical list mid-call picks the first plausible one.
 */
const CHANNEL_GROUPS = [
  {
    group: "They contacted us",
    items: [
      { value: "inbound_call", label: "Phoned us" },
      { value: "missed_call", label: "Gave a missed call" },
      { value: "whatsapp_inbound", label: "WhatsApp" },
      { value: "web_form", label: "Website form" },
      { value: "walk_in", label: "Walked in" },
    ],
  },
  {
    group: "Saw it somewhere",
    items: [
      { value: "pamphlet", label: "Pamphlet" },
      { value: "hoarding", label: "Hoarding" },
      { value: "newspaper", label: "Newspaper" },
      { value: "magazine", label: "Magazine" },
      { value: "radio", label: "Radio" },
      { value: "cable_tv", label: "Cable TV" },
      { value: "bus_panel", label: "Bus panel" },
      { value: "signage", label: "Signage near the hospital" },
    ],
  },
  {
    group: "Online",
    items: [
      { value: "search", label: "Searched for us" },
      { value: "social_post", label: "Social media post" },
      { value: "social_dm", label: "Social media message" },
      { value: "ad_click", label: "Advertisement" },
      { value: "listing", label: "Directory listing" },
      { value: "video", label: "Video" },
    ],
  },
  {
    group: "Somebody told them",
    items: [
      { value: "doctor_referral", label: "A doctor referred them" },
      { value: "staff_referral", label: "Hospital staff" },
      { value: "referral", label: "Another organisation" },
      { value: "word_of_mouth", label: "Word of mouth" },
    ],
  },
  {
    group: "At an event",
    items: [
      { value: "camp_walkin", label: "Health camp" },
      { value: "health_talk", label: "Health talk" },
      { value: "corporate_screening", label: "Corporate screening" },
    ],
  },
];

/** Channels that happen in a place, and so are worth asking where. */
const PLACE_CHANNELS = new Set([
  "pamphlet",
  "hoarding",
  "newspaper",
  "bus_panel",
  "signage",
  "camp_walkin",
  "health_talk",
  "corporate_screening",
  "walk_in",
]);

/** Channels where naming who sent them is the useful part. */
const REFERRER_CHANNELS = new Set([
  "referral",
  "doctor_referral",
  "staff_referral",
  "word_of_mouth",
]);

/**
 * Record how this enquiry found the hospital.
 *
 * Deliberately additive: a person hears about the hospital at a camp, sees a
 * hoarding, and is finally sent by their GP. Each one is a row, and the
 * channel report reads the order.
 *
 * A single inline control rather than React Hook Form — four fields, two of
 * them conditional, no cross-field validation. The repo's forms rule allows
 * useState for exactly this shape.
 */
export function AddTouchpointModal({
  contactId,
  opened,
  onClose,
}: {
  contactId: string;
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [areaLabel, setAreaLabel] = useState("");
  const [referrer, setReferrer] = useState("");

  const campaigns = useQuery({
    queryKey: ["marketing", "campaigns"],
    queryFn: () => marketingService.listCampaigns(),
    enabled: opened,
  });

  // Suggested, not enforced. The desk should never be blocked because a ward
  // is not yet in the master — the free-text label is adopted when somebody
  // later defines that locality.
  const areas = useQuery({
    queryKey: ["marketing", "areas"],
    queryFn: () => marketingService.listAreas(),
    enabled: opened,
  });

  const add = useMutation({
    mutationFn: () =>
      marketingService.addTouchpoint(contactId, {
        kind: kind ?? "manual",
        campaign_id: campaignId ?? undefined,
        area_label: areaLabel.trim() || undefined,
        referrer_label: referrer.trim() || undefined,
        source: "front_desk",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["marketing", "contacts", contactId, "touchpoints"],
      });
      void queryClient.invalidateQueries({ queryKey: ["marketing", "reports"] });
      toast.success("Recorded", { title: "How they found us" });
      setKind(null);
      setCampaignId(null);
      setAreaLabel("");
      setReferrer("");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not record it" }),
  });

  const wantsPlace = kind !== null && PLACE_CHANNELS.has(kind);
  const wantsReferrer = kind !== null && REFERRER_CHANNELS.has(kind);

  return (
    <Modal opened={opened} onClose={onClose} title="How did they find us?" size="md">
      <Stack gap="sm">
        <Select
          label="Channel"
          placeholder="Pick the closest"
          data={CHANNEL_GROUPS}
          value={kind}
          onChange={setKind}
          searchable
        />

        {wantsPlace && (
          <TextInput
            label="Where"
            description="The ward or town — where the pamphlet or hoarding was, not where they live"
            placeholder="Gandhipuram"
            list="marketing-areas"
            value={areaLabel}
            onChange={(event) => setAreaLabel(event.currentTarget.value)}
          />
        )}
        {/* Suggestions from the master, without forcing a choice from it. */}
        <datalist id="marketing-areas">
          {(areas.data ?? []).map((a: MarketingArea) => (
            <option key={a.id} value={a.name} />
          ))}
        </datalist>

        {wantsReferrer && (
          <TextInput
            label="Who sent them"
            description="An organisation or a coarse label — never a named individual with money attached"
            placeholder="Ramesh Clinic, Anna Nagar"
            value={referrer}
            onChange={(event) => setReferrer(event.currentTarget.value)}
          />
        )}

        <Select
          label="Campaign"
          placeholder="Optional"
          data={(campaigns.data ?? []).map((c: MarketingCampaign) => ({
            value: c.id,
            label: c.name,
          }))}
          value={campaignId}
          onChange={setCampaignId}
          clearable
          searchable
        />

        <Text size="xs" c="dimmed">
          Adds to the list rather than replacing it — somebody can hear about the hospital more than
          once, and the order is what the channel report reads.
        </Text>

        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            disabled={kind === null}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            Record it
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
