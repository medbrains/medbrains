import { Group, Stack, Text } from "@mantine/core";
import type { SimulatedMessage } from "@medbrains/types";
import { IconPaperclip } from "@tabler/icons-react";
import { Badge, Card } from "@/components/ui";
import classes from "./phone-view.module.scss";

interface MessageBubbleProps {
  message: SimulatedMessage;
}

/** One received message: subject, text, attachments, and what sent it. */
export function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <Card withBorder padding="sm" data-testid="simulated-message">
      <Stack gap={4}>
        {message.subject && <Text fw={600}>{message.subject}</Text>}
        <Text size="sm" className={classes.body}>
          {message.body}
        </Text>
        {message.attachments.map((attachment) => (
          <Group key={attachment.object_key ?? attachment.filename} gap={4}>
            <IconPaperclip size={16} aria-hidden />
            <Text size="sm">{attachment.filename ?? "Attachment"}</Text>
          </Group>
        ))}
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            {new Date(message.created_at).toLocaleString()}
          </Text>
          <Badge tone="neutral">{message.event_type}</Badge>
          {message.template_id && <Badge tone="info">Template {message.template_id}</Badge>}
        </Group>
      </Stack>
    </Card>
  );
}
