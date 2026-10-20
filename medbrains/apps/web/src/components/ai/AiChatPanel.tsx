import { Box, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { type ReactNode, useMemo } from "react";
import { AiLabel, Button, toast } from "@/components/ui";
import styles from "./ai-chat-panel.module.scss";
import { useAiAssistantStore } from "./assistant-store";
import { Conversation } from "./Conversation";
import { CrabLottie } from "./CrabLottie";
import { CrabMascot } from "./CrabMascot";
import { Message } from "./Message";
import { PromptInput } from "./PromptInput";
import { MockTransport } from "./transport/mock";
import type { ChatContext, ChatTransport } from "./transport/types";
import { type UseAiChat, useAiChat } from "./useAiChat";

/** What the label's popover says wherever the assistant appears. */
const AI_EXPLAINER = {
  title: "AI assistant",
  description:
    "Answers are drafted by AI from records you are allowed to see, and can be wrong. Check " +
    "them. Nothing goes into a patient record unless you accept it on the case sheet.",
};

const DEFAULT_FOLLOW_UPS = [
  "Flag any critical values",
  "Draft a progress note",
  "Check drug interactions",
];

export interface AiChatPanelProps {
  /** Backend adapter. Defaults to a MockTransport so the panel works standalone. */
  transport?: ChatTransport;
  /** Clinical/page context injected into every turn (patient, encounter…). */
  context?: ChatContext;
  /** Share an externally-owned chat controller (e.g. the global assistant). */
  controller?: UseAiChat;
  title?: string;
  /** Quick-prompt chips shown on the empty state. */
  suggestions?: string[];
  /** Follow-up action chips shown under the assistant's last answer. */
  followUps?: string[];
  /** Controls rendered at the right of the header (e.g. history / new chat). */
  headerAction?: ReactNode;
}

/**
 * The assembled MedBrains assistant — the crab-mascot chat that every surface
 * (drawer, popover, page, inline) mounts. Backend-agnostic via the transport
 * seam; ships against a mock so it's usable before the streaming API lands.
 * Pass `controller` to share one conversation across surfaces (the global mount).
 */
export function AiChatPanel({
  transport,
  context,
  controller,
  title = "MedBrains Assistant",
  suggestions = [],
  followUps = DEFAULT_FOLLOW_UPS,
  headerAction,
}: AiChatPanelProps) {
  const activeTransport = useMemo(() => transport ?? new MockTransport(), [transport]);
  const internal = useAiChat({ transport: activeTransport, context });
  const { messages, status, send, stop } = controller ?? internal;
  const canWriteNotes = useHasPermission(P.CLINICAL_NOTES.WRITE);
  const offerDraft = useAiAssistantStore((s) => s.offerDraft);
  const offerToNote = (text: string) => {
    offerDraft(text);
    toast.info("Open the case sheet and choose Insert AI draft on a section to review it.", {
      title: "Ready to use in a note",
    });
  };
  const streaming = status === "streaming";
  const stickToken = `${messages.map((m) => m.content.length).join(",")}:${status}`;
  const lastMessage = messages.at(-1);
  const showFollowUps =
    !streaming &&
    lastMessage?.role === "assistant" &&
    lastMessage.status !== "streaming" &&
    !!lastMessage.content &&
    followUps.length > 0;

  return (
    <Stack gap={0} className={styles.panel}>
      <Group gap="sm" className={styles.header} wrap="nowrap">
        <Box className={styles.headerAvatar}>
          <CrabMascot size={30} pose={streaming ? "think" : "greet"} animate={streaming} />
        </Box>
        <div>
          <Group gap={6} wrap="nowrap">
            <Text fw={600} size="sm">
              {title}
            </Text>
            <AiLabel size="xs" explainer={AI_EXPLAINER} />
          </Group>
          <Text size="xs" className={styles.online}>
            online
          </Text>
        </div>
        {headerAction && <Box ml="auto">{headerAction}</Box>}
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
        {messages.map((message, i) => (
          <Message
            key={message.id}
            message={message}
            active={i === messages.length - 1 && !streaming}
            onToolAction={(text, opts) => void send(text, opts)}
            actions={
              canWriteNotes && message.role === "assistant" && message.status === "complete" ? (
                <Button tone="tertiary" size="xs" onClick={() => offerToNote(message.content)}>
                  Use in note
                </Button>
              ) : undefined
            }
          />
        ))}
      </Conversation>

      {showFollowUps && (
        <Group gap="xs" className={styles.followUps} wrap="wrap">
          {followUps.map((followUp) => (
            <Button key={followUp} tone="secondary" size="xs" onClick={() => send(followUp)}>
              {followUp}
            </Button>
          ))}
        </Group>
      )}

      <PromptInput onSubmit={send} onStop={stop} streaming={streaming} />
    </Stack>
  );
}
