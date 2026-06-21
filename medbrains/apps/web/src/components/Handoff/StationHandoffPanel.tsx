import { Group, Stack, Text, Textarea } from "@mantine/core";
import { IconArrowsLeftRight, IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, Input, toast } from "@/components/ui";
import { stationHandoffService } from "@/services/stationHandoff.service";

interface Props {
  /** Source module, e.g. "ot" | "ipd" | "pharmacy" | "billing". */
  module: string;
  /** Location kind, e.g. "ot_room" | "ward" | "bed" | "pharmacy_counter". */
  stationType: string;
  /** The location id (uuid-as-string) or a stable label. */
  stationKey: string;
  /** Human-readable location name shown on posted handoffs. */
  stationLabel?: string;
}

/**
 * Generic location/station handoff (open-pickup). Outgoing staff post a
 * handoff for this location; it stays OPEN until whoever staffs the location
 * next acknowledges it. Drop this panel into any location-scoped view.
 */
export function StationHandoffPanel({ module, stationType, stationKey, stationLabel }: Props) {
  const qc = useQueryClient();
  const key = ["station-handoffs", module, stationType, stationKey];
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const { data: handoffs = [] } = useQuery({
    queryKey: key,
    queryFn: () =>
      stationHandoffService.list({
        module,
        station_type: stationType,
        station_key: stationKey,
      }),
    refetchOnWindowFocus: true,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const post = useMutation({
    mutationFn: () =>
      stationHandoffService.create({
        module,
        station_type: stationType,
        station_key: stationKey,
        station_label: stationLabel,
        title: title.trim(),
        summary: summary.trim() || undefined,
      }),
    onSuccess: () => {
      setTitle("");
      setSummary("");
      invalidate();
      toast.success("Handoff posted for this location", { title: "Handover" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not post handoff" }),
  });

  const ack = useMutation({
    mutationFn: (id: string) => stationHandoffService.acknowledge(id),
    onSuccess: () => {
      invalidate();
      toast.success("Handoff acknowledged", { title: "Handover" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not acknowledge" }),
  });

  return (
    <Card withBorder padding="sm">
      <Group gap="xs" mb="xs">
        <IconArrowsLeftRight size={16} />
        <Text fw={600}>Station handover</Text>
        {handoffs.length > 0 && (
          <Badge tone="warning" size="sm">
            {handoffs.length} open
          </Badge>
        )}
      </Group>

      <Stack gap="xs">
        {handoffs.length === 0 && (
          <Text size="sm" c="dimmed">
            No open handovers for this location.
          </Text>
        )}
        {handoffs.map((h) => (
          <Card key={h.id} padding="xs" withBorder>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text size="sm" fw={600}>
                  {h.title}
                </Text>
                {h.summary && (
                  <Text size="xs" c="dimmed">
                    {h.summary}
                  </Text>
                )}
                <Text size="10px" c="dimmed">
                  Posted {new Date(h.handed_off_at).toLocaleString()}
                </Text>
              </Stack>
              <Button
                size="xs"
                tone="primary"
                leftSection={<IconCheck size={13} />}
                loading={ack.isPending}
                onClick={() => ack.mutate(h.id)}
              >
                Acknowledge
              </Button>
            </Group>
          </Card>
        ))}

        <Input
          label="Post a handover"
          placeholder="e.g. Room turned over, next case ready"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
        <Textarea
          placeholder="Pending items / things the next shift should know"
          value={summary}
          onChange={(e) => setSummary(e.currentTarget.value)}
          minRows={2}
        />
        <Group justify="flex-end">
          <Button
            size="xs"
            tone="primary"
            disabled={!title.trim()}
            loading={post.isPending}
            onClick={() => post.mutate()}
          >
            Post handover
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
