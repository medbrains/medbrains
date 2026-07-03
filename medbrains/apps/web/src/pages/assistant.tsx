import { Box, Flex, Group, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { api } from "@medbrains/api";
import {
  IconDownload,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconMessagePlus,
  IconMinus,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  AiChatPanel,
  type ChatRole,
  type ChatSource,
  messageParts,
  SseTransport,
  useAiChat,
} from "@/components/ai";
import { Button, IconButton } from "@/components/ui";
import classes from "./assistant.module.scss";

/** Download the current thread as a markdown transcript (programmatic, no UI markup). */
function downloadTranscript(lines: string): void {
  const blob = new Blob([lines], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "medbrains-assistant.md";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AssistantPage() {
  const navigate = useNavigate();
  const transport = useMemo(() => new SseTransport(), []);
  const controller = useAiChat({ transport });
  const [historyOpen, setHistoryOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(true);

  const { data: conversations = [] } = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => api.listAiConversations(),
  });

  const openConversation = async (id: string) => {
    const loaded = await api.getAiConversationMessages(id);
    controller.hydrate(
      loaded.map((m) => ({
        id: m.id,
        role: m.role as ChatRole,
        content: m.content,
        createdAt: m.created_at,
        status: "complete" as const,
      })),
    );
    transport.setConversationId(id);
  };

  const newChat = () => {
    controller.reset();
    transport.setConversationId(undefined);
  };

  // Sources cited across the thread — the right-hand detail panel.
  const sources: ChatSource[] = controller.messages.flatMap((m) =>
    messageParts(m).flatMap((p) => (p.type === "sources" ? p.sources : [])),
  );

  const onDownload = () => {
    const md = controller.messages
      .map((m) => `**${m.role === "user" ? "You" : "Assistant"}:** ${m.content}`)
      .join("\n\n");
    downloadTranscript(md);
  };

  return (
    <Box className={classes.wrap}>
      <Group className={classes.pageHead} justify="space-between" wrap="nowrap">
        <Text component="h1" fw={700} size="md">
          Assistant
        </Text>
        <Group gap={4} wrap="nowrap">
          <IconButton
            tone="default"
            size="sm"
            aria-label="Minimize assistant"
            onClick={() => navigate(-1)}
          >
            <IconMinus size={16} />
          </IconButton>
          <IconButton
            tone="default"
            size="sm"
            aria-label="Close assistant"
            onClick={() => navigate("/dashboard")}
          >
            <IconX size={16} />
          </IconButton>
        </Group>
      </Group>
      <Flex className={classes.page}>
        {historyOpen ? (
          <Box className={classes.side} component="aside" aria-label="Conversation history">
            <Group className={classes.sideHead} justify="space-between" wrap="nowrap">
              <Text component="h2" fw={600} size="sm">
                History
              </Text>
              <IconButton
                tone="default"
                size="sm"
                aria-label="Collapse history"
                aria-expanded
                onClick={() => setHistoryOpen(false)}
              >
                <IconLayoutSidebarLeftCollapse size={16} />
              </IconButton>
            </Group>
            <Box className={classes.sideBody}>
              <Button
                tone="secondary"
                size="xs"
                fullWidth
                leftSection={<IconMessagePlus size={14} />}
                onClick={newChat}
              >
                New chat
              </Button>
              <ScrollArea className={classes.list} type="hover">
                <Stack gap={2}>
                  {conversations.length === 0 ? (
                    <Text size="xs" c="dimmed" p="xs">
                      No conversations yet.
                    </Text>
                  ) : (
                    conversations.map((c) => (
                      <UnstyledButton
                        key={c.id}
                        className={classes.convItem}
                        onClick={() => void openConversation(c.id)}
                      >
                        <Text size="xs" lineClamp={2}>
                          {c.title ?? "Untitled"}
                        </Text>
                      </UnstyledButton>
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </Box>
          </Box>
        ) : (
          <UnstyledButton
            className={classes.collapsed}
            aria-label="Show history"
            aria-expanded={false}
            onClick={() => setHistoryOpen(true)}
          >
            <IconLayoutSidebarLeftExpand size={18} />
          </UnstyledButton>
        )}

        <Box className={classes.center}>
          <AiChatPanel controller={controller} title="MedBrains Assistant" />
        </Box>

        {detailOpen ? (
          <Box className={classes.side} component="aside" aria-label="Assistant details">
            <Group className={classes.sideHead} justify="space-between" wrap="nowrap">
              <Text component="h2" fw={600} size="sm">
                Details
              </Text>
              <IconButton
                tone="default"
                size="sm"
                aria-label="Collapse details"
                aria-expanded
                onClick={() => setDetailOpen(false)}
              >
                <IconLayoutSidebarRightCollapse size={16} />
              </IconButton>
            </Group>
            <Box className={classes.sideBody}>
              <Button
                tone="secondary"
                size="xs"
                fullWidth
                leftSection={<IconDownload size={14} />}
                disabled={controller.messages.length === 0}
                onClick={onDownload}
              >
                Download transcript
              </Button>
              <ScrollArea className={classes.list} type="hover">
                <Stack gap="xs">
                  <Text size="xs" fw={600} c="dimmed">
                    Sources
                  </Text>
                  {sources.length === 0 ? (
                    <Text size="xs" c="dimmed">
                      Cited sources and generated files appear here.
                    </Text>
                  ) : (
                    sources.map((s) => (
                      <Box key={s.id} className={classes.sourceItem}>
                        <Text size="xs" fw={600}>
                          {s.title}
                        </Text>
                        {s.snippet && (
                          <Text size="xs" c="dimmed" lineClamp={3}>
                            {s.snippet}
                          </Text>
                        )}
                      </Box>
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </Box>
          </Box>
        ) : (
          <UnstyledButton
            className={classes.collapsed}
            aria-label="Show details"
            aria-expanded={false}
            onClick={() => setDetailOpen(true)}
          >
            <IconLayoutSidebarRightExpand size={18} />
          </UnstyledButton>
        )}
      </Flex>
    </Box>
  );
}
