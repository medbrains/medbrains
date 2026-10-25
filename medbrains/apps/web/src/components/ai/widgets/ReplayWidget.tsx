import { Skeleton, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui";
import type { AiWidget } from "../transport/types";
import { WidgetView } from "./WidgetView";

export interface ReplayWidgetProps {
  messageId: string;
  index: number;
  title: string;
}

/**
 * A reopened answer's widget that was not stored (it may list patients):
 * fetched again now, with the user's permissions as they are now. Lost access
 * or vanished data says so — never an empty table, never the old values.
 */
export function ReplayWidget({ messageId, index, title }: ReplayWidgetProps) {
  const query = useQuery({
    queryKey: ["ai-replay-widget", messageId, index],
    queryFn: () => api.aiReplayWidget(messageId, index),
    retry: false,
  });
  if (query.isLoading) return <Skeleton height={120} aria-label={`Loading ${title}`} />;
  if (query.isError || !query.data) {
    return (
      <Stack gap={4}>
        <Text size="sm" fw={600}>
          {title}
        </Text>
        <Alert tone="info">This is no longer available to you, or its data has changed.</Alert>
      </Stack>
    );
  }
  return <WidgetView widget={query.data as unknown as AiWidget} />;
}
