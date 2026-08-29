import { Group, Stack, Text, Textarea, Timeline } from "@mantine/core";
import type {
  MarketingContact,
  MarketingInteraction,
  MarketingPipelineStage,
} from "@medbrains/types";
import { IconMail, IconMessage, IconNote, IconPhone } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Badge, Button, Drawer, Select, toast } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";
import { ConsentPanel } from "./consent-panel";
import { TouchpointStrip } from "./touchpoint-strip";

const CHANNEL_OPTIONS = [
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "walk_in", label: "Walk-in" },
];

const DISPOSITION_OPTIONS = [
  { value: "interested", label: "Interested" },
  { value: "callback", label: "Call back later" },
  { value: "not_interested", label: "Not interested" },
  { value: "unreachable", label: "Could not reach" },
  { value: "booked", label: "Appointment booked" },
];

function channelIcon(channel: string): ReactNode {
  if (channel === "email") return <IconMail size={12} />;
  if (channel === "whatsapp" || channel === "sms") return <IconMessage size={12} />;
  if (channel === "phone") return <IconPhone size={12} />;
  return <IconNote size={12} />;
}

/** A consent flag is a legal position, so it is stated rather than implied. */
function ConsentBadge({ label, granted }: { label: string; granted: boolean }) {
  return (
    <Badge tone={granted ? "success" : "neutral"} size="sm">
      {label}: {granted ? "yes" : "no"}
    </Badge>
  );
}

export function EnquiryDetailDrawer({
  contact,
  stages,
  canLog,
  canMoveStage,
  onClose,
}: {
  contact: MarketingContact | null;
  stages: MarketingPipelineStage[];
  canLog: boolean;
  canMoveStage: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<string>("phone");
  const [disposition, setDisposition] = useState<string | null>(null);

  const contactId = contact?.id ?? null;

  const {
    data: timeline = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "contacts", contactId, "interactions"],
    queryFn: () => marketingService.listInteractions(contactId as string),
    enabled: contactId !== null,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["marketing", "contacts"] });
  };

  const logMutation = useMutation({
    mutationFn: () =>
      marketingService.logInteraction(contactId as string, {
        kind: "note",
        channel,
        direction: "outbound",
        disposition: disposition ?? undefined,
        note: note.trim() === "" ? undefined : note.trim(),
      }),
    onSuccess: () => {
      setNote("");
      setDisposition(null);
      invalidate();
      toast.success("Interaction logged");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not log interaction" }),
  });

  const stageMutation = useMutation({
    mutationFn: (stageId: string) =>
      marketingService.moveStage(contactId as string, { stage_id: stageId }),
    onSuccess: () => {
      invalidate();
      toast.success("Stage updated");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not move stage" }),
  });

  return (
    <Drawer
      opened={contact !== null}
      onClose={onClose}
      title={contact?.display_name ?? "Enquiry"}
      position="right"
      size="lg"
    >
      {contact && (
        <Stack gap="md">
          <Stack gap={4}>
            <Text size="sm">{contact.primary_phone ?? "No phone on record"}</Text>
            {contact.email && (
              <Text size="sm" c="dimmed">
                {contact.email}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              Source: {contact.source} · first seen{" "}
              {new Date(contact.first_seen_at).toLocaleDateString()}
            </Text>
          </Stack>

          {/* Consent governs whether this person may be contacted at all, so
              it is shown before the control that contacts them. */}
          <Group gap="xs">
            <ConsentBadge label="Call" granted={contact.consent_call} />
            <ConsentBadge label="SMS" granted={contact.consent_sms} />
            <ConsentBadge label="WhatsApp" granted={contact.consent_whatsapp} />
          </Group>

          {canMoveStage && stages.length > 0 && (
            <Select
              label="Pipeline stage"
              data={stages.map((s) => ({ value: s.id, label: s.name }))}
              value={contact.stage_id}
              onChange={(value) => value && stageMutation.mutate(value)}
              disabled={stageMutation.isPending}
              allowDeselect={false}
            />
          )}

          {/* Above the timeline rather than in it: how they arrived is
              context for every row below, not another event in the sequence. */}
          {contactId && <TouchpointStrip contactId={contactId} />}

          {/* Beside how they arrived, because both are standing facts about
              the enquiry rather than events on its timeline. */}
          {contactId && <ConsentPanel contactId={contactId} />}

          {canLog && (
            <Stack gap="xs">
              <Group grow>
                <Select
                  label="Channel"
                  data={CHANNEL_OPTIONS}
                  value={channel}
                  onChange={(value) => setChannel(value ?? "phone")}
                  allowDeselect={false}
                />
                <Select
                  label="Outcome"
                  data={DISPOSITION_OPTIONS}
                  value={disposition}
                  onChange={setDisposition}
                  clearable
                />
              </Group>
              <Textarea
                label="Note"
                autosize
                minRows={2}
                value={note}
                onChange={(event) => setNote(event.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button
                  tone="primary"
                  size="xs"
                  loading={logMutation.isPending}
                  onClick={() => logMutation.mutate()}
                >
                  Log interaction
                </Button>
              </Group>
            </Stack>
          )}

          <Stack gap="xs">
            <Text fw={600} size="sm">
              Timeline
            </Text>
            {isError && (
              <Text size="sm" c="dimmed">
                The timeline could not be loaded. This is not a record of no contact.
              </Text>
            )}
            {!isError && isLoading && (
              <Text size="sm" c="dimmed">
                Loading…
              </Text>
            )}
            {!isError && !isLoading && timeline.length === 0 && (
              <Text size="sm" c="dimmed">
                Nothing logged against this enquiry yet.
              </Text>
            )}
            {timeline.length > 0 && (
              <Timeline active={timeline.length} bulletSize={18} lineWidth={2}>
                {timeline.map((item: MarketingInteraction) => (
                  <Timeline.Item
                    key={item.id}
                    bullet={channelIcon(item.channel)}
                    title={`${item.channel} · ${item.direction}`}
                  >
                    {item.disposition && (
                      <Text size="xs" c="dimmed">
                        {item.disposition}
                      </Text>
                    )}
                    {item.note && <Text size="sm">{item.note}</Text>}
                    <Text size="xs" c="dimmed">
                      {new Date(item.occurred_at).toLocaleString()}
                      {item.duration_secs !== null && ` · ${item.duration_secs}s`}
                    </Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </Stack>
        </Stack>
      )}
    </Drawer>
  );
}
