import { Box, Group, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { Button } from "@/components/ui";
import styles from "./ai-chat-panel.module.scss";
import { Conversation } from "./Conversation";
import { CrabLottie } from "./CrabLottie";
import { CrabMascot } from "./CrabMascot";
import { Message } from "./Message";
import { PromptInput } from "./PromptInput";
import { MockTransport } from "./transport/mock";
import type { ChatContext, ChatTransport } from "./transport/types";
import { useAiChat } from "./useAiChat";

export interface AiChatPanelProps {
  /** Backend adapter. Defaults to a MockTransport so the panel works standalone. */
  transport?: ChatTransport;
  /** Clinical/page context injected into every turn (patient, encounter…). */
  context?: ChatContext;
  title?: string;
  /** Quick-prompt chips shown on the empty state. */
  suggestions?: string[];
}

/**
 * The assembled MedBrains assistant — the crab-mascot chat that every surface
 * (drawer, popover, page, inline) mounts. Backend-agnostic via the transport
 * seam; ships against a mock so it's usable before the streaming API lands.
 */
export function AiChatPanel({
  transport,
  context,
  title = "MedBrains Assistant",
  suggestions = [],
}: AiChatPanelProps) {
  const activeTransport = useMemo(() => transport ?? new MockTransport(), [transport]);
  const { messages, status, send, stop } = useAiChat({ transport: activeTransport, context });
  const streaming = status === "streaming";
  const stickToken = `${messages.map((m) => m.content.length).join(",")}:${status}`;

  return (
    <Stack gap={0} className={styles.panel}>
      <Group gap="sm" className={styles.header} wrap="nowrap">
        <Box className={styles.headerAvatar}>
          <CrabMascot size={30} pose={streaming ? "think" : "greet"} animate={streaming} />
        </Box>
        <div>
          <Text fw={600} size="sm">
            {title}
          </Text>
          <Text size="xs" className={styles.online}>
            online
          </Text>
        </div>
      </Group>

      <Conversation
        stickToken={stickToken}
        isEmpty={messages.length === 0}
        empty={
          <>
            <CrabLottie size={132} />
            <Text fw={600} size="sm">
              Hi — I'm your MedBrains assistant.
            </Text>
            <Text size="xs" c="dimmed">
              What can I help you look into?
            </Text>
            {suggestions.length > 0 && (
              <Group gap="xs" justify="center" mt="xs">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    tone="secondary"
                    size="xs"
                    onClick={() => send(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </Group>
            )}
          </>
        }
      >
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
      </Conversation>

      <PromptInput onSubmit={send} onStop={stop} streaming={streaming} />
    </Stack>
  );
}
