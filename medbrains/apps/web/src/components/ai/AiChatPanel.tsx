import { Box, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconArrowRight } from "@tabler/icons-react";
import { type ReactNode, useMemo } from "react";
import { AiLabel, AiOrb, Button, Crab, toast } from "@/components/ui";
import styles from "./ai-chat-panel.module.scss";
import { useAiAssistantStore } from "./assistant-store";
import { Conversation } from "./Conversation";
import { Message } from "./Message";
import { PromptInput } from "./PromptInput";
import { suggestionsFor } from "./suggestions";
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

export interface AiChatPanelProps {
  /** Backend adapter. Defaults to a MockTransport so the panel works standalone. */
  transport?: ChatTransport;
  /** Clinical/page context injected into every turn (patient, encounter…). */
  context?: ChatContext;
  /** Share an externally-owned chat controller (e.g. the global assistant). */
  controller?: UseAiChat;
  title?: string;
  /** Quick prompts on the empty state; defaults to the screen's own. */
  suggestions?: string[];
  /** Follow-up chips under the last answer; defaults to the screen's own. */
  followUps?: string[];
  /** Controls rendered at the right of the header (e.g. history / new chat). */
  headerAction?: ReactNode;
  /** The empty conversation's headline, e.g. "Good morning, Asha". */
  greeting?: string;
}

/**
 * The assembled MedBrains assistant — the chat that every surface
 * (drawer, popover, page, inline) mounts. Backend-agnostic via the transport
 * seam; ships against a mock so it's usable before the streaming API lands.
 * Pass `controller` to share one conversation across surfaces (the global mount).
 */
export function AiChatPanel({
  transport,
  context,
  controller,
  title = "MedBrains Assistant",
  suggestions,
  followUps,
  headerAction,
  greeting = "Hi — I'm your MedBrains assistant.",
}: AiChatPanelProps) {
  const screen = useMemo(() => suggestionsFor(context), [context]);
  const starters = suggestions ?? screen.starters;
  const nextQuestions = followUps ?? screen.followUps;
  const activeTransport = useMemo(() => transport ?? new MockTransport(), [transport]);
  const internal = useAiChat({ transport: activeTransport, context });
  const { messages, status, send, stop } = controller ?? internal;
  const canWriteNotes = useHasPermission(P.CLINICAL_NOTES.WRITE);
  const offerDraft = useAiAssistantStore((s) => s.offerDraft);
  const offerToNote = (text: string, patientId: string | undefined) => {
    offerDraft(text, patientId);
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
    nextQuestions.length > 0;

  return (
    <Stack gap={0} className={styles.panel}>
      <Group gap="sm" className={styles.header} wrap="nowrap">
        <Box className={styles.headerAvatar}>
          <AiOrb variant="glass" size={30} state={streaming ? "thinking" : "idle"} />
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
            <Crab variant="chibi" size={132} />
            <Text fw={600} size="lg">
              {greeting}
            </Text>
            <Text size="xs" c="dimmed">
              What can I help you look into?
            </Text>
            {starters.length > 0 && (
              <Stack gap="xs" mt="sm" className={styles.starters}>
                {starters.map((starter) => (
                  <Button
                    key={starter}
                    tone="secondary"
                    size="sm"
                    fullWidth
                    justify="space-between"
                    rightSection={<IconArrowRight size={16} aria-hidden />}
                    onClick={() => send(starter)}
                  >
                    {starter}
                  </Button>
                ))}
              </Stack>
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
              // Only an answer about a named patient can go into a note — and
              // only that patient's (AiDraftInsert checks the match).
              canWriteNotes &&
              message.role === "assistant" &&
              message.status === "complete" &&
              message.patientId ? (
                <Button
                  tone="tertiary"
                  size="xs"
                  onClick={() => offerToNote(message.content, message.patientId)}
                >
                  Use in note
                </Button>
              ) : undefined
            }
          />
        ))}
      </Conversation>

      {showFollowUps && (
        <Group gap="xs" className={styles.followUps} wrap="wrap">
          {nextQuestions.map((followUp) => (
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
