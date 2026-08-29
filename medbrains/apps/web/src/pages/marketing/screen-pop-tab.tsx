import { Group, Stack, Text, TextInput, Timeline } from "@mantine/core";
import type { MarketingInteraction } from "@medbrains/types";
import { IconPhone, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

/**
 * Who is calling.
 *
 * The endpoint exists for a telephony webhook to drive, but the number is
 * useful typed as well — a desk that has somebody on the line and no idea
 * whether they have called four times already is the problem this solves.
 *
 * A number that is not known comes back as `is_new_caller` rather than an
 * empty contact, and the screen says so in those words: an agent shown a blank
 * record assumes the system lost the history, and asks the wrong question.
 */
export function MarketingScreenPopTab() {
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState("");

  const {
    data: pop,
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["marketing", "screen-pop", lookup],
    queryFn: () => marketingService.screenPop(lookup),
    enabled: lookup.trim().length >= 4,
  });

  return (
    <Stack>
      <Group align="flex-end">
        <TextInput
          label="Caller's number"
          placeholder="As the switch delivered it"
          leftSection={<IconPhone size={14} />}
          value={phone}
          onChange={(event) => setPhone(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setLookup(phone);
          }}
        />
        <Button
          tone="primary"
          size="sm"
          leftSection={<IconSearch size={14} />}
          disabled={phone.trim().length < 4}
          loading={isFetching}
          onClick={() => setLookup(phone)}
        >
          Look up
        </Button>
      </Group>

      {isError && (
        <Alert tone="danger" title="Lookup failed">
          The caller could not be looked up. Treat this as unknown rather than as a new caller —
          they may well have a history.
        </Alert>
      )}

      {pop?.is_new_caller && (
        <Alert tone="info" title="New caller">
          This number is not on record. Ask for a name and raise an enquiry.
        </Alert>
      )}

      {pop?.contact && (
        <Card>
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text fw={600}>{pop.contact.display_name ?? "Unnamed enquiry"}</Text>
                <Text size="sm" c="dimmed">
                  {pop.contact.primary_phone ?? "—"} · since{" "}
                  {new Date(pop.contact.first_seen_at).toLocaleDateString()}
                </Text>
              </Stack>
              <Group gap="xs">
                {pop.stage_name && (
                  <Badge tone="info" size="sm">
                    {pop.stage_name}
                  </Badge>
                )}
                {pop.campaign_name && (
                  <Badge tone="neutral" size="sm">
                    {pop.campaign_name}
                  </Badge>
                )}
              </Group>
            </Group>

            {/* Consent before anything else on this card. The agent is about
                to speak to this person; whether they agreed to be called is
                the first thing that matters, not a detail further down. */}
            <Group gap="xs">
              <Badge tone={pop.contact.consent_call ? "success" : "danger"} size="sm">
                Call: {pop.contact.consent_call ? "consented" : "no consent"}
              </Badge>
              <Badge tone={pop.contact.consent_sms ? "success" : "neutral"} size="sm">
                SMS: {pop.contact.consent_sms ? "yes" : "no"}
              </Badge>
              <Badge tone={pop.contact.consent_whatsapp ? "success" : "neutral"} size="sm">
                WhatsApp: {pop.contact.consent_whatsapp ? "yes" : "no"}
              </Badge>
            </Group>

            {pop.open_tasks > 0 && (
              <Alert tone="warning" title={`${pop.open_tasks} callback already booked`}>
                Somebody has promised this person a call. Check before promising another.
              </Alert>
            )}

            <Stack gap={4}>
              <Text fw={600} size="sm">
                Last {pop.recent.length} interaction{pop.recent.length === 1 ? "" : "s"}
              </Text>
              {pop.recent.length === 0 ? (
                <Text size="sm" c="dimmed">
                  On record, but nothing logged against them yet.
                </Text>
              ) : (
                <Timeline active={pop.recent.length} bulletSize={14} lineWidth={2}>
                  {pop.recent.map((item: MarketingInteraction) => (
                    <Timeline.Item key={item.id} title={`${item.channel} · ${item.direction}`}>
                      {item.disposition && (
                        <Text size="xs" c="dimmed">
                          {item.disposition}
                        </Text>
                      )}
                      {item.note && <Text size="sm">{item.note}</Text>}
                      <Text size="xs" c="dimmed">
                        {new Date(item.occurred_at).toLocaleString()}
                      </Text>
                    </Timeline.Item>
                  ))}
                </Timeline>
              )}
            </Stack>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
