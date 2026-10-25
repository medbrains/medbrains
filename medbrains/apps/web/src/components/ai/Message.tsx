import { Box, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconUser } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { AiLabel, AiOrb, Alert } from "@/components/ui";
import { MessageMeta } from "./MessageMeta";
import styles from "./message.module.scss";
import { ThinkingIndicator } from "./ThinkingIndicator";
import type { ChatContext, ChatMessage, ChatMessageStatus, ChatRole } from "./transport/types";
import { UnifiedResponse } from "./UnifiedResponse";
import { ReplayWidget } from "./widgets/ReplayWidget";
import { WidgetView } from "./widgets/WidgetView";

export interface MessageProps {
  message: ChatMessage;
  /** Custom avatar (e.g. the crab mascot for the assistant). Defaults to a role icon. */
  avatar?: ReactNode;
  /** Action row rendered under the bubble (copy / regenerate / thumbs…). */
  actions?: ReactNode;
  /** Continue the turn from an interactive tool widget. */
  onToolAction?: (message: string, opts?: { context?: ChatContext }) => void;
  /** True only for the latest turn (interactive widgets render live). */
  active?: boolean;
}

/** One chat turn — user bubbles align right, assistant/system/tool align left. */
export function Message({ message, avatar, actions, onToolAction, active }: MessageProps) {
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
      <Stack
        gap={4}
        className={
          isUser
            ? styles.userStack
            : message.widgets?.length || message.replays?.length
              ? `${styles.assistantStack} ${styles.wide}`
              : styles.assistantStack
        }
      >
        {message.role === "assistant" && (
          <AiLabel size="xs" text="generated" aria-label="AI-generated answer" />
        )}
        <Box
          className={isUser ? styles.userBubble : styles.assistantBubble}
          data-status={message.status}
        >
          {isUser ? (
            <Text size="sm" className={styles.userText}>
              {message.content}
            </Text>
          ) : (
            <Stack gap="xs">
              {(!isEmpty || (message.toolCalls?.length ?? 0) > 0) && (
                <UnifiedResponse message={message} onToolAction={onToolAction} active={active} />
              )}
              {message.widgets?.map((widget, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: widgets arrive in order and never move
                <WidgetView key={i} widget={widget} />
              ))}
              {message.replays?.map((r) => (
                <ReplayWidget
                  key={r.index}
                  messageId={message.id}
                  index={r.index}
                  title={r.title}
                />
              ))}
              {isStreaming && isEmpty && !message.widgets?.length && <ThinkingIndicator />}
            </Stack>
          )}
        </Box>
        {message.guardNotices && message.guardNotices.length > 0 && (
          <Alert tone="warning" title="Part of this answer was removed">
            <Stack gap={4}>
              {message.guardNotices.map((notice) => (
                <Text key={notice} size="sm">
                  {notice}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}
        {message.status === "error" && message.error && (
          <Alert tone="danger" role="alert">
            {message.error}
          </Alert>
        )}
        {!isUser && message.status === "complete" && !isEmpty && (
          <Group gap="xs" className={styles.actions}>
            <MessageMeta
              text={message.content}
              usage={message.usage}
              elapsedMs={message.elapsedMs}
            />
            {actions}
          </Group>
        )}
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
  // The glass orb is the assistant in chat: it thinks while streaming.
  const streaming = status === "streaming";
  return (
    <Box className={styles.orbAvatar} aria-hidden>
      <AiOrb variant="glass" size={26} state={streaming ? "thinking" : "idle"} />
    </Box>
  );
}
