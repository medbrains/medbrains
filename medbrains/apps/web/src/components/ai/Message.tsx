import { Box, Group, Loader, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconUser } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { CrabMascot } from "./CrabMascot";
import styles from "./message.module.scss";
import type { ChatMessage, ChatMessageStatus, ChatRole } from "./transport/types";
import { UnifiedResponse } from "./UnifiedResponse";

export interface MessageProps {
  message: ChatMessage;
  /** Custom avatar (e.g. the crab mascot for the assistant). Defaults to a role icon. */
  avatar?: ReactNode;
  /** Action row rendered under the bubble (copy / regenerate / thumbs…). */
  actions?: ReactNode;
}

/** One chat turn — user bubbles align right, assistant/system/tool align left. */
export function Message({ message, avatar, actions }: MessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const isEmpty = message.content.length === 0;

  return (
    <Group
      align="flex-start"
      gap="sm"
      wrap="nowrap"
      justify={isUser ? "flex-end" : "flex-start"}
      className={styles.row}
    >
      {!isUser && <MessageAvatar role={message.role} status={message.status} custom={avatar} />}
      <Stack gap={4} className={isUser ? styles.userStack : styles.assistantStack}>
        <Box
          className={isUser ? styles.userBubble : styles.assistantBubble}
          data-status={message.status}
        >
          {isStreaming && isEmpty ? (
            <Loader size="sm" aria-label="Assistant is responding" />
          ) : isUser ? (
            <Text size="sm" className={styles.userText}>
              {message.content}
            </Text>
          ) : (
            <UnifiedResponse message={message} />
          )}
        </Box>
        {actions && !isUser && <Box className={styles.actions}>{actions}</Box>}
      </Stack>
      {isUser && <MessageAvatar role={message.role} status={message.status} custom={avatar} />}
    </Group>
  );
}

function MessageAvatar({
  role,
  status,
  custom,
}: {
  role: ChatRole;
  status?: ChatMessageStatus;
  custom?: ReactNode;
}) {
  if (custom) return <>{custom}</>;
  if (role === "user") {
    return (
      <ThemeIcon variant="light" radius="md" size="md" aria-hidden>
        <IconUser size={16} />
      </ThemeIcon>
    );
  }
  // The brain-crab mascot IS the assistant — it thinks while streaming, greets otherwise.
  const streaming = status === "streaming";
  return (
    <Box className={styles.crabAvatar} aria-hidden>
      <CrabMascot size={26} pose={streaming ? "think" : "greet"} animate={streaming} />
    </Box>
  );
}
