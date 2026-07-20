// TV-Displays AnnouncementsTab — split from tv-displays.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Card, Group, MultiSelect, Select, SimpleGrid, Stack, Text, Textarea } from "@mantine/core";
import type { TvAnnouncementFormInput } from "@medbrains/schemas";
import { tvAnnouncementFormSchema } from "@medbrains/schemas";
import type { BroadcastAnnouncementRequest, TvDisplay } from "@medbrains/types";
import { IconBell } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Badge, Button, toast } from "@/components/ui";
import {
  defaultTvAnnouncementFormValues,
  tvAnnouncementFormToRequest,
} from "@/forms/tv-displays.form";
import { tvDisplaysService } from "@/services/tvDisplays.service";

const ANNOUNCEMENT_PRIORITIES = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "emergency", label: "Emergency" },
];

export function AnnouncementsTab({ canBroadcast }: { canBroadcast: boolean }) {
  const announcementForm = useForm<TvAnnouncementFormInput>({
    resolver: zodResolver(tvAnnouncementFormSchema),
    defaultValues: defaultTvAnnouncementFormValues,
  });
  const priority = announcementForm.watch("priority");
  const message = announcementForm.watch("message");

  const { data: displays = [] } = useQuery({
    queryKey: ["tv-displays"],
    queryFn: () => tvDisplaysService.listTvDisplays(),
  });

  const broadcastMutation = useMutation({
    mutationFn: (data: BroadcastAnnouncementRequest) =>
      tvDisplaysService.broadcastAnnouncement(data),
    onSuccess: () => {
      toast.success("Announcement has been broadcast to all displays", {
        title: "Announcement Sent",
      });
      announcementForm.reset(defaultTvAnnouncementFormValues);
    },
    onError: () => {
      toast.error("Failed to broadcast announcement", { title: "Error" });
    },
  });

  const handleBroadcast = announcementForm.handleSubmit((values) => {
    broadcastMutation.mutate(tvAnnouncementFormToRequest(values));
  });

  return (
    <Stack gap="lg">
      <Card withBorder p="lg">
        <Stack gap="md">
          <Text fw={600}>Broadcast Announcement</Text>
          <Textarea
            label="Message"
            placeholder="Enter announcement message..."
            rows={4}
            error={announcementForm.formState.errors.message?.message}
            disabled={!canBroadcast}
            {...announcementForm.register("message")}
          />
          <Group>
            <Controller
              control={announcementForm.control}
              name="priority"
              render={({ field, fieldState }) => (
                <Select
                  label="Priority"
                  data={ANNOUNCEMENT_PRIORITIES}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "info")}
                  error={fieldState.error?.message}
                  style={{ width: 150 }}
                  disabled={!canBroadcast}
                />
              )}
            />
            <Controller
              control={announcementForm.control}
              name="display_ids"
              render={({ field, fieldState }) => (
                <MultiSelect
                  label="Target Displays"
                  placeholder="All displays"
                  data={displays.map((d: TvDisplay) => ({
                    value: d.id,
                    label: d.location_name,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  style={{ flex: 1 }}
                  disabled={!canBroadcast}
                />
              )}
            />
          </Group>
          <Group justify="flex-end">
            <Button
              tone={priority === "emergency" ? "danger" : "primary"}
              leftSection={<IconBell size={16} />}
              onClick={() => {
                void handleBroadcast();
              }}
              loading={broadcastMutation.isPending}
              disabled={!canBroadcast || !message.trim()}
            >
              {priority === "emergency" ? "Send Emergency Alert" : "Broadcast"}
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Priority descriptions */}
      <SimpleGrid cols={3}>
        <Card withBorder p="md">
          <Group gap="sm">
            <Badge tone="primary">Info</Badge>
          </Group>
          <Text size="sm" c="dimmed" mt="xs">
            General announcements displayed in rotation with queue information.
          </Text>
        </Card>
        <Card withBorder p="md">
          <Group gap="sm">
            <Badge tone="warning">Warning</Badge>
          </Group>
          <Text size="sm" c="dimmed" mt="xs">
            Important notices that require attention. Displayed more prominently.
          </Text>
        </Card>
        <Card withBorder p="md">
          <Group gap="sm">
            <Badge tone="danger">Emergency</Badge>
          </Group>
          <Text size="sm" c="dimmed" mt="xs">
            Critical alerts that take over the entire display until dismissed.
          </Text>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
